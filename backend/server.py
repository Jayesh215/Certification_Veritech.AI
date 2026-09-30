"""Veritech.AI Certificate Registration Portal - FastAPI backend."""
import hashlib
import hmac
import io
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import base64
import csv
import bcrypt
import jwt as pyjwt
import qrcode
import razorpay
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, APIRouter, HTTPException, Header, Query, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas
from starlette.middleware.cors import CORSMiddleware

from email_service import send_payment_success_email

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_REPLACE_ME")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "REPLACE_ME_SECRET")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "jayeshgangurde15@gmail.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Jayesh@123")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://veritech-intern.preview.emergentagent.com")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Razorpay client - initialized lazily so app can start with placeholder keys
def get_razorpay_client() -> Optional[razorpay.Client]:
    if RAZORPAY_KEY_ID.startswith("rzp_") and not RAZORPAY_KEY_ID.endswith("REPLACE_ME"):
        return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    return None


app = FastAPI(title="Veritech.AI Certificate Portal")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("veritech")


# ============================================================
# Models
# ============================================================
INTERNSHIP_TYPES = [
    "Web Development", "Java Development", "Python Development",
    "React.js Development", "Angular Development", "AI / Machine Learning",
    "Data Science", "UI/UX Design", "Software Testing",
    "Full Stack Development", "Other",
]
CERTIFICATE_TYPES = [
    "Internship Certificate", "Internship Completion Certificate",
    "Training Certificate", "Other",
]
DURATION_MONTHS = {0, 1, 2, 3, 6}  # 0 = "1 Day" express plan


class RegistrationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    mobile: str = Field(min_length=10, max_length=15)
    college: Optional[str] = ""
    course: Optional[str] = ""
    branch: Optional[str] = ""
    graduation_year: Optional[str] = ""
    internship_type: str
    internship_start_date: str
    internship_end_date: str
    internship_id_input: Optional[str] = ""
    certificate_type: str = "Internship Certificate"
    duration_months: int
    declaration_accepted: bool


class RegistrationUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    college: Optional[str] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[str] = None
    internship_type: Optional[str] = None
    internship_start_date: Optional[str] = None
    internship_end_date: Optional[str] = None
    certificate_type: Optional[str] = None
    duration_months: Optional[int] = None


class OrderCreate(BaseModel):
    registration_id: str
    duration_months: int


class PaymentVerify(BaseModel):
    registration_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class MockPay(BaseModel):
    registration_id: str
    success: bool = True


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


# ============================================================
# Helpers
# ============================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


async def next_registration_id() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"reg_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"VT-{year}-{seq:06d}"


def create_admin_token(email: str) -> str:
    payload = {
        "sub": email,
        "role": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_admin(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing admin token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except pyjwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return payload["sub"]


async def get_plan(duration_months: int) -> dict:
    if duration_months not in DURATION_MONTHS:
        raise HTTPException(400, "Invalid certificate duration")
    plan = await db.plans.find_one({"duration_months": duration_months, "is_active": True})
    if not plan:
        raise HTTPException(404, "Plan not found or inactive")
    return clean(plan)


# ============================================================
# Startup - seed plans and admin
# ============================================================
DEFAULT_PLANS = [
    {"name": "1 Day", "duration_months": 0, "price": 1, "currency": "INR",
     "description": "Express same-day certificate", "is_active": True, "popular": False},
    {"name": "1 Month", "duration_months": 1, "price": 99, "currency": "INR",
     "description": "Official Veritech.AI Certificate", "is_active": True, "popular": False},
    {"name": "2 Months", "duration_months": 2, "price": 149, "currency": "INR",
     "description": "Extended duration certificate", "is_active": True, "popular": False},
    {"name": "3 Months", "duration_months": 3, "price": 199, "currency": "INR",
     "description": "Most popular internship certificate", "is_active": True, "popular": True},
    {"name": "6 Months", "duration_months": 6, "price": 499, "currency": "INR",
     "description": "Comprehensive specialization certificate", "is_active": True, "popular": False},
]


@app.on_event("startup")
async def startup():
    # Seed plans
    for plan in DEFAULT_PLANS:
        existing = await db.plans.find_one({"duration_months": plan["duration_months"]})
        if not existing:
            plan_doc = {**plan, "created_at": now_iso(), "updated_at": now_iso()}
            await db.plans.insert_one(plan_doc)
    # Seed admin
    existing_admin = await db.admin_users.find_one({"email": ADMIN_EMAIL})
    if not existing_admin:
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.admin_users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hashed,
            "created_at": now_iso(),
        })
    # Indexes
    await db.registrations.create_index("registration_id", unique=True)
    await db.registrations.create_index("email")
    await db.payments.create_index("registration_id")
    logger.info("Startup complete: plans and admin seeded")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ============================================================
# Public routes
# ============================================================
@api.get("/")
async def root():
    return {"service": "Veritech.AI Certificate Portal", "status": "ok"}


@api.get("/plans")
async def list_plans():
    plans = await db.plans.find({"is_active": True}).sort("duration_months", 1).to_list(20)
    return [clean(p) for p in plans]


@api.post("/registrations")
async def create_registration(body: RegistrationCreate):
    if not body.declaration_accepted:
        raise HTTPException(400, "Please accept the declaration")
    if body.internship_type not in INTERNSHIP_TYPES:
        raise HTTPException(400, "Invalid internship type")
    if body.certificate_type not in CERTIFICATE_TYPES:
        raise HTTPException(400, "Invalid certificate type")
    if body.duration_months not in DURATION_MONTHS:
        raise HTTPException(400, "Invalid certificate duration")
    if not re.fullmatch(r"[0-9+\-\s]{10,15}", body.mobile):
        raise HTTPException(400, "Please enter a valid mobile number")

    plan = await get_plan(body.duration_months)
    reg_id = await next_registration_id()

    doc = {
        "registration_id": reg_id,
        "full_name": body.full_name.strip(),
        "email": body.email.lower(),
        "mobile": body.mobile.strip(),
        "college": body.college or "",
        "course": body.course or "",
        "branch": body.branch or "",
        "graduation_year": body.graduation_year or "",
        "internship_type": body.internship_type,
        "internship_start_date": body.internship_start_date,
        "internship_end_date": body.internship_end_date,
        "internship_id_input": body.internship_id_input or "",
        "certificate_type": body.certificate_type,
        "duration_months": body.duration_months,
        "amount": plan["price"],
        "currency": "INR",
        "declaration_accepted": True,
        "status": "PENDING_PAYMENT",
        "payment_status": "PENDING",
        "certificate_status": "Pending",
        "certificate_number": None,
        "certificate_generated_at": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.registrations.insert_one(doc)
    return clean(doc)


@api.get("/registrations/{registration_id}")
async def get_registration(registration_id: str):
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    return clean(reg)


@api.patch("/registrations/{registration_id}")
async def update_registration(registration_id: str, body: RegistrationUpdate):
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.get("payment_status") == "PAID":
        raise HTTPException(400, "Cannot edit a paid registration")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "duration_months" in updates:
        plan = await get_plan(updates["duration_months"])
        updates["amount"] = plan["price"]
    updates["updated_at"] = now_iso()
    await db.registrations.update_one({"registration_id": registration_id}, {"$set": updates})
    updated = await db.registrations.find_one({"registration_id": registration_id})
    return clean(updated)


@api.get("/registrations/status/lookup")
async def lookup_status(query: str = Query(min_length=3)):
    q = query.strip()
    reg = await db.registrations.find_one({
        "$or": [{"registration_id": q.upper()}, {"email": q.lower()}]
    })
    if not reg:
        raise HTTPException(404, "No registration found for this ID or email")
    return clean(reg)


# ============================================================
# Payment routes
# ============================================================
@api.post("/payments/order")
async def create_order(body: OrderCreate):
    reg = await db.registrations.find_one({"registration_id": body.registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.get("payment_status") == "PAID":
        raise HTTPException(400, "Payment already completed")

    plan = await get_plan(body.duration_months)
    # Ensure registration duration aligns with the plan chosen at payment time
    if reg["duration_months"] != body.duration_months:
        await db.registrations.update_one(
            {"registration_id": body.registration_id},
            {"$set": {"duration_months": body.duration_months,
                      "amount": plan["price"], "updated_at": now_iso()}},
        )
    amount_paise = int(plan["price"]) * 100

    rz = get_razorpay_client()
    if rz is None:
        # Mock order (Razorpay keys not configured)
        mock_order_id = f"order_mock_{body.registration_id.replace('-', '')}"
        await db.payments.update_one(
            {"registration_id": body.registration_id, "status": {"$ne": "PAID"}},
            {"$set": {
                "registration_id": body.registration_id,
                "razorpay_order_id": mock_order_id,
                "amount": plan["price"],
                "currency": "INR",
                "status": "CREATED",
                "mode": "mock",
                "created_at": now_iso(),
            }},
            upsert=True,
        )
        return {
            "mock": True,
            "key_id": RAZORPAY_KEY_ID,
            "order_id": mock_order_id,
            "amount": amount_paise,
            "currency": "INR",
            "name": reg["full_name"],
            "email": reg["email"],
            "mobile": reg["mobile"],
        }

    try:
        order = rz.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"rcpt_{body.registration_id}",
            "notes": {"registration_id": body.registration_id},
        })
    except Exception as e:
        logger.error("Razorpay order failed: %s", e)
        raise HTTPException(502, "Could not create payment order")

    await db.payments.update_one(
        {"registration_id": body.registration_id, "status": {"$ne": "PAID"}},
        {"$set": {
            "registration_id": body.registration_id,
            "razorpay_order_id": order["id"],
            "amount": plan["price"],
            "currency": "INR",
            "status": "CREATED",
            "mode": "razorpay",
            "created_at": now_iso(),
        }},
        upsert=True,
    )
    return {
        "mock": False,
        "key_id": RAZORPAY_KEY_ID,
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "name": reg["full_name"],
        "email": reg["email"],
        "mobile": reg["mobile"],
    }


@api.post("/payments/verify")
async def verify_payment(body: PaymentVerify):
    payment = await db.payments.find_one({
        "registration_id": body.registration_id,
        "razorpay_order_id": body.razorpay_order_id,
    })
    if not payment:
        raise HTTPException(404, "Order not found")
    if payment["status"] == "PAID":
        return {"verified": True, "already": True}

    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        await db.payments.update_one(
            {"registration_id": body.registration_id, "razorpay_order_id": body.razorpay_order_id},
            {"$set": {"status": "FAILED", "updated_at": now_iso()}},
        )
        raise HTTPException(400, "Payment signature verification failed")

    await _mark_paid(body.registration_id, body.razorpay_order_id,
                    body.razorpay_payment_id, body.razorpay_signature)
    return {"verified": True}


@api.post("/payments/mock-complete")
async def mock_complete(body: MockPay):
    """Complete a mock payment when Razorpay keys are placeholders."""
    payment = await db.payments.find_one({"registration_id": body.registration_id})
    if not payment:
        raise HTTPException(404, "Order not found. Create order first.")
    if payment.get("mode") != "mock":
        raise HTTPException(400, "Real Razorpay keys are configured; use /payments/verify")
    if not body.success:
        await db.payments.update_one(
            {"registration_id": body.registration_id},
            {"$set": {"status": "FAILED", "updated_at": now_iso()}},
        )
        await db.registrations.update_one(
            {"registration_id": body.registration_id},
            {"$set": {"payment_status": "FAILED", "status": "PAYMENT_FAILED",
                      "updated_at": now_iso()}},
        )
        return {"verified": False, "status": "FAILED"}

    mock_payment_id = f"pay_mock_{body.registration_id.replace('-', '')}"
    await _mark_paid(body.registration_id, payment["razorpay_order_id"],
                    mock_payment_id, "mock_signature")
    return {"verified": True, "payment_id": mock_payment_id}


async def _mark_paid(reg_id: str, order_id: str, payment_id: str, signature: str):
    paid_at = now_iso()
    await db.payments.update_one(
        {"registration_id": reg_id, "razorpay_order_id": order_id},
        {"$set": {
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
            "status": "PAID",
            "paid_at": paid_at,
            "updated_at": paid_at,
        }},
    )
    await db.registrations.update_one(
        {"registration_id": reg_id},
        {"$set": {
            "payment_status": "PAID",
            "status": "PAID",
            "paid_at": paid_at,
            "razorpay_payment_id": payment_id,
            "razorpay_order_id": order_id,
            "updated_at": paid_at,
        }},
    )
    # Fire confirmation email (non-blocking)
    reg = await db.registrations.find_one({"registration_id": reg_id})
    if reg:
        try:
            await send_payment_success_email(clean(reg))
        except Exception as e:
            logger.error("email dispatch failed: %s", e)


@api.get("/payments/{registration_id}")
async def get_payment(registration_id: str):
    p = await db.payments.find_one({"registration_id": registration_id})
    if not p:
        raise HTTPException(404, "No payment found")
    return clean(p)


# ============================================================
# Public certificate verification (QR target)
# ============================================================
@api.get("/verify/{cert_number}")
async def verify_certificate(cert_number: str):
    reg = await db.registrations.find_one({"certificate_number": cert_number})
    if not reg:
        raise HTTPException(404, "Certificate not found")
    reg = clean(reg)
    return {
        "verified": True,
        "certificate_number": reg["certificate_number"],
        "full_name": reg["full_name"],
        "internship_type": reg["internship_type"],
        "certificate_type": reg["certificate_type"],
        "duration_months": reg["duration_months"],
        "internship_start_date": reg["internship_start_date"],
        "internship_end_date": reg["internship_end_date"],
        "certificate_status": reg["certificate_status"],
        "issued_on": reg.get("certificate_generated_at"),
        "registration_id": reg["registration_id"],
    }


# ============================================================
# Admin routes
# ============================================================
@api.post("/admin/login")
async def admin_login(body: AdminLogin):
    admin = await db.admin_users.find_one({"email": body.email.lower()})
    if not admin:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(body.password.encode(), admin["password_hash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    token = create_admin_token(admin["email"])
    return {"token": token, "email": admin["email"]}


@api.get("/admin/me")
async def admin_me(email: str = Depends(require_admin)):
    return {"email": email, "role": "admin"}


@api.get("/admin/dashboard")
async def admin_dashboard(email: str = Depends(require_admin)):
    total = await db.registrations.count_documents({})
    paid = await db.registrations.count_documents({"payment_status": "PAID"})
    pending = await db.registrations.count_documents({"payment_status": "PENDING"})
    failed = await db.registrations.count_documents({"payment_status": "FAILED"})
    certs_generated = await db.registrations.count_documents({"certificate_status": {"$in": ["Generated", "Issued"]}})
    revenue_docs = await db.registrations.find({"payment_status": "PAID"}, {"amount": 1}).to_list(10000)
    revenue = sum(int(d.get("amount", 0)) for d in revenue_docs)
    return {
        "total_registrations": total,
        "paid": paid,
        "pending": pending,
        "failed": failed,
        "revenue": revenue,
        "certificates_generated": certs_generated,
    }


@api.get("/admin/registrations")
async def admin_registrations(
    email: str = Depends(require_admin),
    search: Optional[str] = None,
    payment_status: Optional[str] = None,
    duration: Optional[int] = None,
    internship_type: Optional[str] = None,
):
    q = {}
    if search:
        s = search.strip()
        q["$or"] = [
            {"registration_id": {"$regex": s, "$options": "i"}},
            {"full_name": {"$regex": s, "$options": "i"}},
            {"email": {"$regex": s, "$options": "i"}},
            {"mobile": {"$regex": s, "$options": "i"}},
        ]
    if payment_status:
        q["payment_status"] = payment_status
    if duration:
        q["duration_months"] = int(duration)
    if internship_type:
        q["internship_type"] = internship_type
    docs = await db.registrations.find(q).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


@api.get("/admin/payments")
async def admin_payments(email: str = Depends(require_admin)):
    docs = await db.payments.find({}).sort("created_at", -1).to_list(500)
    result = []
    for d in docs:
        d = clean(d)
        reg = await db.registrations.find_one({"registration_id": d["registration_id"]})
        if reg:
            d["full_name"] = reg.get("full_name")
            d["email"] = reg.get("email")
            d["duration_months"] = reg.get("duration_months")
        result.append(d)
    return result


@api.get("/admin/registrations/export")
async def admin_registrations_export(email: str = Depends(require_admin)):
    docs = await db.registrations.find({}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Registration ID", "Full Name", "Email", "Mobile", "College", "Course",
        "Branch", "Graduation Year", "Internship Type", "Start Date", "End Date",
        "Certificate Type", "Duration (Months)", "Amount", "Currency",
        "Payment Status", "Payment ID", "Certificate Status", "Certificate Number",
        "Registered At", "Paid At",
    ])
    for d in docs:
        w.writerow([
            d.get("registration_id",""), d.get("full_name",""), d.get("email",""),
            d.get("mobile",""), d.get("college",""), d.get("course",""),
            d.get("branch",""), d.get("graduation_year",""),
            d.get("internship_type",""), d.get("internship_start_date",""),
            d.get("internship_end_date",""), d.get("certificate_type",""),
            d.get("duration_months",""), d.get("amount",""), d.get("currency","INR"),
            d.get("payment_status",""), d.get("razorpay_payment_id",""),
            d.get("certificate_status",""), d.get("certificate_number",""),
            d.get("created_at",""), d.get("paid_at",""),
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="veritech-registrations.csv"'},
    )


@api.get("/admin/payments/export")
async def admin_payments_export(email: str = Depends(require_admin)):
    docs = await db.payments.find({}).sort("created_at", -1).to_list(10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Razorpay Order ID", "Registration ID", "Name", "Email",
        "Razorpay Payment ID", "Amount", "Currency", "Status", "Mode",
        "Created At", "Paid At",
    ])
    for d in docs:
        reg = await db.registrations.find_one({"registration_id": d.get("registration_id","")})
        w.writerow([
            d.get("razorpay_order_id",""), d.get("registration_id",""),
            (reg or {}).get("full_name",""), (reg or {}).get("email",""),
            d.get("razorpay_payment_id",""), d.get("amount",""),
            d.get("currency","INR"), d.get("status",""), d.get("mode",""),
            d.get("created_at",""), d.get("paid_at",""),
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="veritech-payments.csv"'},
    )


@api.post("/admin/certificates/{registration_id}/generate")
async def admin_generate_certificate(registration_id: str, email: str = Depends(require_admin)):
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.get("payment_status") != "PAID":
        raise HTTPException(400, "Cannot generate certificate before payment")
    cert_number = f"VT-CERT-{datetime.now(timezone.utc).year}-{registration_id.split('-')[-1]}"
    now = now_iso()
    await db.registrations.update_one(
        {"registration_id": registration_id},
        {"$set": {
            "certificate_status": "Generated",
            "certificate_number": cert_number,
            "certificate_generated_at": now,
            "updated_at": now,
        }},
    )
    return {"certificate_number": cert_number, "status": "Generated"}


@api.get("/certificates/{registration_id}/download")
async def download_certificate(registration_id: str):
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.get("payment_status") != "PAID":
        raise HTTPException(400, "Certificate available only after payment")

    # Auto-generate if not generated yet
    if reg.get("certificate_status") == "Pending":
        cert_number = f"VT-CERT-{datetime.now(timezone.utc).year}-{registration_id.split('-')[-1]}"
        await db.registrations.update_one(
            {"registration_id": registration_id},
            {"$set": {
                "certificate_status": "Generated",
                "certificate_number": cert_number,
                "certificate_generated_at": now_iso(),
            }},
        )
        reg["certificate_number"] = cert_number

    branding = await _get_branding()
    pdf_bytes = _build_certificate_pdf(reg, branding)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{registration_id}-certificate.pdf"'},
    )


@api.get("/admin/certificates/{registration_id}/preview")
async def preview_certificate(registration_id: str, email: str = Depends(require_admin)):
    """Inline PDF preview for admins. Does not persist certificate number if pending."""
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    reg = clean(reg)
    if not reg.get("certificate_number"):
        reg["certificate_number"] = f"VT-CERT-{datetime.now(timezone.utc).year}-{registration_id.split('-')[-1]} (PREVIEW)"
    branding = await _get_branding()
    pdf_bytes = _build_certificate_pdf(reg, branding)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{registration_id}-preview.pdf"'},
    )


# ============================================================
# Branding (signature + seal) — admin only
# ============================================================
ALLOWED_IMG_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_IMG_BYTES = 2 * 1024 * 1024  # 2 MB


async def _get_branding() -> dict:
    doc = await db.settings.find_one({"_id": "branding"})
    return clean(doc) if doc else {}


async def _save_branding_field(field: str, b64: Optional[str], mime: Optional[str]):
    await db.settings.update_one(
        {"_id": "branding"},
        {"$set": {
            f"{field}_b64": b64,
            f"{field}_mime": mime,
            f"{field}_updated_at": now_iso(),
        }},
        upsert=True,
    )


async def _upload_image(field: str, file: UploadFile) -> dict:
    if file.content_type not in ALLOWED_IMG_MIME:
        raise HTTPException(400, "Please upload a PNG, JPG or WEBP image")
    data = await file.read()
    if len(data) > MAX_IMG_BYTES:
        raise HTTPException(400, "Image must be under 2 MB")
    if len(data) == 0:
        raise HTTPException(400, "Empty file")
    b64 = base64.b64encode(data).decode()
    await _save_branding_field(field, b64, file.content_type)
    return {"ok": True, "size": len(data), "mime": file.content_type}


@api.get("/admin/branding")
async def admin_get_branding(email: str = Depends(require_admin)):
    b = await _get_branding()
    return {
        "signature": {
            "present": bool(b.get("signature_b64")),
            "mime": b.get("signature_mime"),
            "updated_at": b.get("signature_updated_at"),
        },
        "seal": {
            "present": bool(b.get("seal_b64")),
            "mime": b.get("seal_mime"),
            "updated_at": b.get("seal_updated_at"),
        },
    }


@api.get("/admin/branding/{kind}/image")
async def admin_get_branding_image(kind: str, email: str = Depends(require_admin)):
    if kind not in ("signature", "seal"):
        raise HTTPException(404, "Not found")
    b = await _get_branding()
    b64 = b.get(f"{kind}_b64")
    mime = b.get(f"{kind}_mime") or "image/png"
    if not b64:
        raise HTTPException(404, f"No {kind} uploaded")
    return Response(content=base64.b64decode(b64), media_type=mime)


@api.post("/admin/branding/signature")
async def admin_upload_signature(file: UploadFile = File(...), email: str = Depends(require_admin)):
    return await _upload_image("signature", file)


@api.post("/admin/branding/seal")
async def admin_upload_seal(file: UploadFile = File(...), email: str = Depends(require_admin)):
    return await _upload_image("seal", file)


@api.delete("/admin/branding/{kind}")
async def admin_delete_branding(kind: str, email: str = Depends(require_admin)):
    if kind not in ("signature", "seal"):
        raise HTTPException(404, "Not found")
    await _save_branding_field(kind, None, None)
    return {"ok": True}


@api.get("/receipts/{registration_id}/download")
async def download_receipt(registration_id: str):
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    if reg.get("payment_status") != "PAID":
        raise HTTPException(400, "Receipt available only after payment")
    pdf_bytes = _build_receipt_pdf(reg)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{registration_id}-receipt.pdf"'},
    )


# ============================================================
# PDF generation
# ============================================================
def _build_certificate_pdf(reg: dict, branding: Optional[dict] = None) -> bytes:
    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=landscape(A4))
    w, h = landscape(A4)
    navy = HexColor("#0F172A")
    blue = HexColor("#2563EB")
    muted = HexColor("#64748B")

    # Border frame
    c.setStrokeColor(navy)
    c.setLineWidth(3)
    c.rect(0.4 * inch, 0.4 * inch, w - 0.8 * inch, h - 0.8 * inch)
    c.setStrokeColor(blue)
    c.setLineWidth(1)
    c.rect(0.55 * inch, 0.55 * inch, w - 1.1 * inch, h - 1.1 * inch)

    # Header brand
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(w / 2, h - 1.2 * inch, "Veritech.AI")
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(w / 2, h - 1.5 * inch, "AI • SOFTWARE • TECHNOLOGY")

    # Title
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(w / 2, h - 2.4 * inch, "Certificate of Internship")

    # Body
    c.setFillColor(muted)
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 3.0 * inch, "This is to certify that")

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(w / 2, h - 3.6 * inch, reg["full_name"])

    c.setFillColor(muted)
    c.setFont("Helvetica", 13)
    duration_text = ("has successfully completed a 1-day internship program in"
                     if reg["duration_months"] == 0
                     else f"has successfully completed a {reg['duration_months']}-month internship program in")
    c.drawCentredString(w / 2, h - 4.2 * inch, duration_text)

    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, h - 4.7 * inch, reg["internship_type"])

    c.setFillColor(muted)
    c.setFont("Helvetica", 12)
    c.drawCentredString(
        w / 2, h - 5.2 * inch,
        f"From {reg['internship_start_date']} to {reg['internship_end_date']}",
    )

    # Footer meta
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(1.0 * inch, 0.9 * inch, f"Certificate No: {reg.get('certificate_number', '')}")
    c.drawString(1.0 * inch, 0.72 * inch, f"Registration ID: {reg['registration_id']}")

    # Signature image (bottom right) - falls back to text line
    sig_y = 1.35 * inch
    if branding and branding.get("signature_b64"):
        try:
            sig_bytes = base64.b64decode(branding["signature_b64"])
            c.drawImage(ImageReader(io.BytesIO(sig_bytes)), w - 3.4 * inch, sig_y,
                        width=1.6 * inch, height=0.7 * inch,
                        mask="auto", preserveAspectRatio=True)
        except Exception as e:
            logger.error("signature draw failed: %s", e)
    # Signature line + label always drawn
    c.setStrokeColor(muted)
    c.setLineWidth(0.7)
    c.line(w - 3.4 * inch, sig_y - 0.05 * inch, w - 1.0 * inch, sig_y - 0.05 * inch)
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - 1.0 * inch, 0.9 * inch, "Veritech.AI Authorized Signatory")
    c.setFont("Helvetica", 9)
    c.setFillColor(muted)
    c.drawRightString(w - 1.0 * inch, 0.72 * inch, f"Issued on {datetime.now(timezone.utc).strftime('%d %B %Y')}")

    # Seal image (bottom-center-left, near signature line)
    if branding and branding.get("seal_b64"):
        try:
            seal_bytes = base64.b64decode(branding["seal_b64"])
            c.drawImage(ImageReader(io.BytesIO(seal_bytes)),
                        w / 2 - 0.55 * inch, 1.05 * inch,
                        width=1.1 * inch, height=1.1 * inch,
                        mask="auto", preserveAspectRatio=True)
        except Exception as e:
            logger.error("seal draw failed: %s", e)

    # QR code linking to public verification page
    if reg.get("certificate_number"):
        try:
            verify_url = f"{FRONTEND_URL}/verify/{reg['certificate_number']}"
            qr_img = qrcode.make(verify_url)
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            c.drawImage(ImageReader(qr_buf), w - 2.0 * inch, 1.15 * inch,
                        width=1.1 * inch, height=1.1 * inch, mask="auto")
            c.setFont("Helvetica", 7)
            c.setFillColor(muted)
            c.drawRightString(w - 0.9 * inch, 1.05 * inch, "Scan to verify authenticity")
        except Exception as e:
            logger.error("QR generation failed: %s", e)

    c.showPage()
    c.save()
    return buf.getvalue()


def _build_receipt_pdf(reg: dict) -> bytes:
    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    navy = HexColor("#0F172A")
    blue = HexColor("#2563EB")
    muted = HexColor("#64748B")
    green = HexColor("#16A34A")

    y = h - 1 * inch
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(1 * inch, y, "Veritech.AI")
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y - 0.25 * inch, "Payment Receipt")

    c.setFillColor(green)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(w - 1 * inch, y, "PAID")

    y -= 1 * inch
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(1 * inch, y, w - 1 * inch, y)

    rows = [
        ("Registration ID", reg["registration_id"]),
        ("Name", reg["full_name"]),
        ("Email", reg["email"]),
        ("Mobile", reg["mobile"]),
        ("Certificate", reg.get("certificate_type", "Internship Certificate")),
        ("Duration", "1 Day" if reg['duration_months'] == 0 else f"{reg['duration_months']} Month(s)"),
        ("Payment ID", reg.get("razorpay_payment_id", "")),
        ("Order ID", reg.get("razorpay_order_id", "")),
        ("Payment Date", reg.get("paid_at", "")[:10]),
    ]
    y -= 0.35 * inch
    for label, value in rows:
        c.setFillColor(muted)
        c.setFont("Helvetica", 10)
        c.drawString(1 * inch, y, label)
        c.setFillColor(navy)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(3 * inch, y, str(value))
        y -= 0.32 * inch

    y -= 0.2 * inch
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(1 * inch, y, w - 1 * inch, y)
    y -= 0.4 * inch
    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(1 * inch, y, "Amount Paid")
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 20)
    c.drawRightString(w - 1 * inch, y, f"Rs. {int(reg.get('amount', 0))}")

    c.setFillColor(muted)
    c.setFont("Helvetica", 9)
    c.drawString(1 * inch, 0.75 * inch,
                 "Thank you for registering with Veritech.AI.")
    c.drawString(1 * inch, 0.6 * inch,
                 "For queries: support@veritech.ai")

    c.showPage()
    c.save()
    return buf.getvalue()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
