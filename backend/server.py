"""Veritech.AI Certificate Registration Portal - FastAPI backend."""
import asyncio
import hashlib
import hmac
import io
import json
import logging
import os
import re
import time
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
from supabase_store import DocumentStore
from pydantic import BaseModel, EmailStr, Field
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from email_service import (
    send_intern_claim_invite_email,
    send_payment_success_email,
    send_pending_reminder_email,
)

JWT_SECRET = os.environ["JWT_SECRET"]
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "rzp_test_REPLACE_ME")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "REPLACE_ME_SECRET")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "jayeshgangurde15@gmail.com").strip().lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Jayesh@123")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://certificate.veritech-ai.com")
if os.environ.get("VERCEL") and ("localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL):
    FRONTEND_URL = "https://certificate.veritech-ai.com"

db = DocumentStore()

# Short-lived caches for hot public reads (plans / branding). Unlimited concurrent
# users share these without hammering the DB on every page load.
_BRANDING_CACHE: dict = {"at": 0.0, "value": None}
_PLANS_CACHE: dict = {"at": 0.0, "value": None}
# Per-duration dashboard payloads: { "<duration|all>": {"at": float, "value": dict} }
_DASHBOARD_CACHE: dict = {}
_FAILURE_CACHE: dict = {"at": 0.0, "value": None}
_CACHE_TTL_SEC = 45.0
_DASHBOARD_TTL_SEC = 20.0


def _invalidate_branding_cache() -> None:
    _BRANDING_CACHE["at"] = 0.0
    _BRANDING_CACHE["value"] = None
    _PLANS_CACHE["at"] = 0.0
    _PLANS_CACHE["value"] = None


def _invalidate_admin_stats_cache() -> None:
    _DASHBOARD_CACHE.clear()
    _FAILURE_CACHE["at"] = 0.0
    _FAILURE_CACHE["value"] = None


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
DURATION_MONTHS = {1, 2, 3, 6}


class RegistrationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    mobile: str = Field(min_length=10, max_length=15)
    college: Optional[str] = ""
    course: Optional[str] = ""
    branch: Optional[str] = ""
    graduation_year: Optional[str] = ""
    internship_type: str
    internship_start_date: Optional[str] = ""
    internship_end_date: Optional[str] = ""
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
    gateway: str = "razorpay"  # "dummy" skips Razorpay for local testing


class PaymentVerify(BaseModel):
    registration_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class MockPay(BaseModel):
    registration_id: str
    success: bool = True


class PaymentFailure(BaseModel):
    registration_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    reason: Optional[str] = None
    source: Optional[str] = None
    step: Optional[str] = None


class RefundRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    amount: Optional[int] = None  # in rupees; if None → full refund


class BulkDeleteRequest(BaseModel):
    registration_ids: list[str] = Field(..., min_length=1)


class InternBulkDeleteRequest(BaseModel):
    intern_ids: list[str] = Field(..., min_length=1)


class InternUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    college: Optional[str] = None
    course: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[str] = None
    internship_type: Optional[str] = None


class ClearConfirmRequest(BaseModel):
    """Require explicit confirmation text to wipe a collection."""
    confirm: str = Field(min_length=1, max_length=32)


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


def _as_utc(value) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def _duration_label(months: int) -> str:
    if months == 0:
        return "1 Day"
    if months == 1:
        return "1 Month"
    return f"{months} Months"


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


async def next_intern_id() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"intern_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter["seq"] if counter else 1
    return f"INT-{year}-{seq:06d}"


INTERN_CSV_COLUMNS = [
    "full_name",
    "email",
    "mobile",
    "college",
    "course",
    "branch",
    "graduation_year",
    "internship_type",
]
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _normalize_intern_csv_header(value: str) -> str:
    return re.sub(r"[\s\-]+", "_", (value or "").strip().lower())


def _intern_field_errors(full_name: str, email: str, mobile: str) -> tuple[list[str], list[str]]:
    """Return (error messages, invalid field names). Empty lists means valid."""
    errors: list[str] = []
    fields: list[str] = []
    if len((full_name or "").strip()) < 2:
        errors.append("Name is required (min 2 characters)")
        fields.append("full_name")
    email_norm = (email or "").strip().lower()
    if not _EMAIL_RE.match(email_norm):
        errors.append("Invalid email")
        fields.append("email")
    if not re.match(r"^[0-9+\-\s]{10,15}$", (mobile or "").strip()):
        errors.append("Invalid mobile (10–15 digits)")
        fields.append("mobile")
    return errors, fields


def _intern_cell_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _parse_intern_csv_bytes(raw: bytes) -> list[dict]:
    text = None
    for encoding in ("utf-8-sig", "utf-16", "utf-16-le", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise HTTPException(400, "Could not read CSV encoding")
    sample = text[:8192]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise HTTPException(400, "File has no header row")
    rows: list[dict] = []
    for row in reader:
        rows.append({str(k): _intern_cell_str(v) for k, v in (row or {}).items() if k is not None})
    return rows


def _parse_intern_xlsx_bytes(raw: bytes) -> list[dict]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise HTTPException(500, "Excel (.xlsx) support is not installed on the server") from exc
    try:
        wb = load_workbook(filename=io.BytesIO(raw), read_only=True, data_only=True)
    except Exception as exc:
        raise HTTPException(400, f"Could not read Excel file: {exc}") from exc
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        raise HTTPException(400, "Excel sheet is empty")
    headers = [_intern_cell_str(h) for h in header_row]
    if not any(headers):
        raise HTTPException(400, "Excel file has no header row")
    rows: list[dict] = []
    for values in rows_iter:
        if values is None:
            continue
        row = {}
        empty = True
        for idx, header in enumerate(headers):
            if not header:
                continue
            val = _intern_cell_str(values[idx] if idx < len(values) else "")
            if val:
                empty = False
            row[header] = val
        if not empty:
            rows.append(row)
    return rows


def _parse_intern_xls_bytes(raw: bytes) -> list[dict]:
    """Legacy .xls via xlrd. xlrd 2.x only supports .xls (not .xlsx)."""
    try:
        import xlrd
    except ImportError as exc:
        raise HTTPException(500, "Excel (.xls) support is not installed on the server") from exc
    try:
        book = xlrd.open_workbook(file_contents=raw)
    except Exception as exc:
        raise HTTPException(
            400,
            "Could not read .xls file. Save as .xlsx or CSV and try again.",
        ) from exc
    sheet = book.sheet_by_index(0)
    if sheet.nrows < 1:
        raise HTTPException(400, "Excel sheet is empty")
    headers = [_intern_cell_str(sheet.cell_value(0, c)) for c in range(sheet.ncols)]
    if not any(headers):
        raise HTTPException(400, "Excel file has no header row")
    rows: list[dict] = []
    for r in range(1, sheet.nrows):
        row = {}
        empty = True
        for c, header in enumerate(headers):
            if not header:
                continue
            val = _intern_cell_str(sheet.cell_value(r, c))
            if val:
                empty = False
            row[header] = val
        if not empty:
            rows.append(row)
    return rows


def _parse_intern_upload(filename: str, raw: bytes) -> tuple[list[dict], str]:
    name = (filename or "").lower().strip()
    # Magic-byte fallback when extension is missing/wrong
    is_zip_xlsx = len(raw) >= 2 and raw[:2] == b"PK"
    is_ole_xls = len(raw) >= 8 and raw[:8] == b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1"

    if name.endswith((".xlsx", ".xlsm", ".xltx", ".xltm")) or (not name and is_zip_xlsx):
        return _parse_intern_xlsx_bytes(raw), "excel_import"
    if name.endswith(".xls") or (not name.endswith((".csv", ".txt", ".tsv")) and is_ole_xls):
        # Some .xlsx mislabeled — try openpyxl first if ZIP
        if is_zip_xlsx:
            return _parse_intern_xlsx_bytes(raw), "excel_import"
        return _parse_intern_xls_bytes(raw), "excel_import"
    if name.endswith((".csv", ".txt", ".tsv")) or not name or name.endswith(".csv"):
        return _parse_intern_csv_bytes(raw), "csv_import"
    if is_zip_xlsx:
        return _parse_intern_xlsx_bytes(raw), "excel_import"
    if is_ole_xls:
        return _parse_intern_xls_bytes(raw), "excel_import"
    # Default: try CSV (comma/semicolon/tab)
    try:
        return _parse_intern_csv_bytes(raw), "csv_import"
    except HTTPException:
        raise HTTPException(
            400,
            "Unsupported file. Upload CSV (.csv/.txt/.tsv) or Excel (.xlsx/.xlsm/.xls).",
        )


def _intern_template_csv() -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(INTERN_CSV_COLUMNS)
    w.writerow([
        "Ada Lovelace",
        "ada.lovelace@example.com",
        "9876543210",
        "Veritech Institute",
        "B.Tech",
        "Computer Science",
        "2026",
        "Web Development",
    ])
    w.writerow([
        "Alan Turing",
        "alan.turing@example.com",
        "9123456780",
        "Veritech Institute",
        "B.Sc",
        "Mathematics",
        "2025",
        "AI / Machine Learning",
    ])
    return buf.getvalue()


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
    {"name": "1 Month", "duration_months": 1, "price": 99, "currency": "INR",
     "description": "Official Veritech.AI Certificate", "is_active": True, "popular": False},
    {"name": "2 Months", "duration_months": 2, "price": 149, "currency": "INR",
     "description": "Extended duration certificate", "is_active": True, "popular": False},
    {"name": "3 Months", "duration_months": 3, "price": 199, "currency": "INR",
     "description": "Most popular internship certificate", "is_active": True, "popular": True},
    {"name": "6 Months", "duration_months": 6, "price": 499, "currency": "INR",
     "description": "Comprehensive specialization certificate", "is_active": True, "popular": False},
]


_startup_lock = asyncio.Lock()
_startup_done = False


@app.on_event("startup")
async def startup():
    global _startup_done
    if _startup_done and db.pool is not None:
        return
    async with _startup_lock:
        if _startup_done and db.pool is not None:
            return
        await db.connect()
    # Seed plans
    for plan in DEFAULT_PLANS:
        existing = await db.plans.find_one({"duration_months": plan["duration_months"]})
        if not existing:
            plan_doc = {**plan, "created_at": now_iso(), "updated_at": now_iso()}
            await db.plans.insert_one(plan_doc)
    # Hide the retired 1 Day plan from public pricing and new registrations.
    await db.plans.update_one(
        {"duration_months": 0},
        {"$set": {"is_active": False, "updated_at": now_iso()}},
    )
    _PLANS_CACHE["at"] = 0.0
    _PLANS_CACHE["value"] = None
    # Keep the configured admin account able to sign in with ADMIN_PASSWORD.
    existing_admin = await db.admin_users.find_one({"email": ADMIN_EMAIL})
    password_ok = False
    if existing_admin and existing_admin.get("password_hash"):
        try:
            password_ok = bcrypt.checkpw(ADMIN_PASSWORD.encode(), existing_admin["password_hash"].encode())
        except ValueError:
            password_ok = False
    if not existing_admin:
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.admin_users.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": hashed,
            "created_at": now_iso(),
        })
    elif not password_ok:
        hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.admin_users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hashed, "updated_at": now_iso()}},
        )
    # Indexes
    await db.registrations.create_index("registration_id", unique=True)
    await db.registrations.create_index("email")
    await db.payments.create_index("registration_id")
    # Warm hot caches so the first visitor is not waiting on a cold Supabase round-trip.
    try:
        await list_plans()
        await _get_branding()
    except Exception as e:
        logger.warning("cache warm failed: %s", e)
    _startup_done = True
    logger.info("Startup complete: plans and admin seeded")


@app.middleware("http")
async def _ensure_database(request, call_next):
    if db.pool is None:
        await startup()
    return await call_next(request)


@app.on_event("shutdown")
async def shutdown():
    await db.close()


# ============================================================
# Public routes
# ============================================================
@api.get("/")
async def root():
    return {"service": "Veritech.AI Certificate Portal", "status": "ok"}


@api.get("/plans")
async def list_plans():
    now = time.monotonic()
    if _PLANS_CACHE["value"] is not None and (now - _PLANS_CACHE["at"]) < _CACHE_TTL_SEC:
        return _PLANS_CACHE["value"]
    plans = await db.plans.find({"is_active": True}).sort("duration_months", 1).to_list(20)
    periods = _periods_public(await _get_branding())
    result = []
    for plan in plans:
        item = clean(plan)
        if int(item.get("duration_months") or -1) not in DURATION_MONTHS:
            continue
        slot = periods.get(str(item.get("duration_months"))) or {}
        item["start_date"] = slot.get("start_date") or ""
        item["end_date"] = slot.get("end_date") or ""
        result.append(item)
    _PLANS_CACHE["at"] = now
    _PLANS_CACHE["value"] = result
    return result


@api.get("/internship-periods")
async def internship_periods():
    return {"periods": _periods_public(await _get_branding())}


@api.get("/internship-domains")
async def internship_domains():
    return {"domains": _domains_public(await _get_branding())}


@api.post("/registrations")
async def create_registration(body: RegistrationCreate):
    """Create a registration. No per-email / per-user quota — unlimited concurrent signups."""
    if not body.declaration_accepted:
        raise HTTPException(400, "Please accept the declaration")
    offered = _domains_public(await _get_branding())
    if body.internship_type not in offered:
        raise HTTPException(400, "Please select an internship domain from the list")
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
    if "internship_type" in updates and updates["internship_type"] not in _domains_public(await _get_branding()):
        raise HTTPException(400, "Please select an internship domain from the list")
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
        "$or": [
            {"registration_id": q.upper()},
            {"certificate_number": q.upper()},
            {"email": q.lower()},
        ]
    })
    if not reg:
        raise HTTPException(404, "No certificate found for this registration ID, certificate ID, or email")
    return clean(reg)


# ============================================================
# Payment routes
# ============================================================
@api.post("/payments/order")
async def create_order(body: OrderCreate):
    """Start checkout for any unpaid registration. No global user/payment caps —
    many users can pay at the same time; only this registration's PAID state is checked."""
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
    use_dummy = body.gateway == "dummy"
    if use_dummy:
        # Explicit test gateway — skips Razorpay checkout
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

    if rz is None:
        raise HTTPException(
            503,
            "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or use Dummy payment (test).",
        )

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


@api.post("/payments/record-failure")
async def record_payment_failure(body: PaymentFailure):
    """Store a Razorpay failure event. Never marks a paid order as failed."""
    payment = await db.payments.find_one({"registration_id": body.registration_id})
    if not payment:
        raise HTTPException(404, "Order not found")
    if payment.get("status") == "PAID":
        # Payment already succeeded (e.g. retry after success) — ignore.
        return {"recorded": False, "reason": "already_paid"}

    failure = {
        "razorpay_payment_id": body.razorpay_payment_id,
        "failure_code": body.code,
        "failure_reason": body.reason,
        "failure_description": body.description,
        "failure_source": body.source,
        "failure_step": body.step,
        "status": "FAILED",
        "updated_at": now_iso(),
    }
    await db.payments.update_one(
        {"registration_id": body.registration_id},
        {"$set": failure},
    )
    await db.registrations.update_one(
        {"registration_id": body.registration_id, "payment_status": {"$ne": "PAID"}},
        {"$set": {
            "payment_status": "FAILED",
            "status": "PAYMENT_FAILED",
            "last_failure_reason": body.description or body.reason,
            "updated_at": now_iso(),
        }},
    )
    return {"recorded": True}


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
                      "last_failure_reason": "Test payment failure",
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
    _invalidate_admin_stats_cache()
    reg = await db.registrations.find_one({"registration_id": reg_id})
    if not reg:
        return

    if not reg.get("certificate_number"):
        cert_number = f"VT-CERT-{datetime.now(timezone.utc).year}-{reg_id.split('-')[-1]}"
        issued_at = now_iso()
        await db.registrations.update_one(
            {"registration_id": reg_id},
            {"$set": {
                "certificate_status": "Generated",
                "certificate_number": cert_number,
                "certificate_generated_at": issued_at,
                "updated_at": issued_at,
            }},
        )
        reg["certificate_number"] = cert_number
        reg["certificate_status"] = "Generated"
        reg["certificate_generated_at"] = issued_at

    try:
        branding = await _get_branding()
        start, end = _certificate_dates(reg, branding)
        if start and end:
            reg["internship_start_date"] = start
            reg["internship_end_date"] = end
        certificate_pdf = _build_certificate_pdf(reg, branding)
        tracker_url = f"{FRONTEND_URL.rstrip('/')}/status?q={reg_id}"
        await send_payment_success_email(
            clean(reg),
            certificate_pdf=certificate_pdf,
            tracker_url=tracker_url,
        )
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
async def admin_dashboard(
    email: str = Depends(require_admin),
    duration: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    now_mono = time.monotonic()
    cache_key = f"{'all' if duration is None else int(duration)}|{date_from or ''}|{date_to or ''}"
    cached = _DASHBOARD_CACHE.get(cache_key)
    if cached and cached.get("value") is not None and (now_mono - cached["at"]) < _DASHBOARD_TTL_SEC:
        return cached["value"]

    # One registrations scan is enough — today_received comes from reg.paid_at (no second payments load).
    query = {}
    if duration is not None:
        query["duration_months"] = int(duration)
    regs = await db.registrations.find(query).sort("created_at", -1).to_list(10000)

    from_d = None
    to_d = None
    try:
        if date_from:
            from_d = datetime.strptime(date_from[:10], "%Y-%m-%d").date()
        if date_to:
            to_d = datetime.strptime(date_to[:10], "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date_from / date_to (use YYYY-MM-DD)")
    if from_d or to_d:
        filtered = []
        for reg in regs:
            created = _as_utc(reg.get("created_at"))
            if not created:
                continue
            day = created.date()
            if from_d and day < from_d:
                continue
            if to_d and day > to_d:
                continue
            filtered.append(reg)
        regs = filtered

    now = datetime.now(timezone.utc)
    today = now.date()

    paid = pending = failed = refunded = certs = 0
    revenue = 0
    today_received = 0
    month_buckets = {}
    for offset in range(5, -1, -1):
        year, month = _shift_month(now.year, now.month, -offset)
        month_buckets[(year, month)] = {
            "label": datetime(year, month, 1, tzinfo=timezone.utc).strftime("%b"),
            "revenue": 0,
            "registrations": 0,
        }
    day_buckets = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        day_buckets.append({"date": day.isoformat(), "label": day.strftime("%a"), "count": 0})
    day_index = {bucket["date"]: bucket for bucket in day_buckets}
    duration_buckets = {
        months: {"months": months, "label": _duration_label(months), "count": 0, "revenue": 0}
        for months in (0, 1, 2, 3, 6)
    }
    internship_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    today_registrations = 0

    for reg in regs:
        status = reg.get("payment_status") or "PENDING"
        status_counts[status] = status_counts.get(status, 0) + 1
        amount = int(reg.get("amount") or 0)
        if status == "PAID":
            paid += 1
            revenue += amount
            paid_at = _as_utc(reg.get("paid_at"))
            if paid_at and paid_at.date() == today:
                today_received += amount
        elif status == "FAILED":
            failed += 1
        elif status in ("REFUNDED", "PARTIALLY_REFUNDED"):
            refunded += 1
        else:
            pending += 1
        if reg.get("certificate_status") in ("Generated", "Issued"):
            certs += 1
        created = _as_utc(reg.get("created_at"))
        if created:
            key = (created.year, created.month)
            if key in month_buckets:
                month_buckets[key]["registrations"] += 1
                if status == "PAID":
                    month_buckets[key]["revenue"] += amount
            if created.date() == today:
                today_registrations += 1
            day = day_index.get(created.date().isoformat())
            if day:
                day["count"] += 1
        duration = reg.get("duration_months")
        if duration in duration_buckets:
            duration_buckets[duration]["count"] += 1
            if status == "PAID":
                duration_buckets[duration]["revenue"] += amount
        internship = reg.get("internship_type") or "Other"
        internship_counts[internship] = internship_counts.get(internship, 0) + 1

    months = list(month_buckets.values())
    current_revenue = months[-1]["revenue"] if months else 0
    previous_revenue = months[-2]["revenue"] if len(months) > 1 else 0
    if previous_revenue:
        revenue_change_pct = round((current_revenue - previous_revenue) / previous_revenue * 100)
    elif current_revenue:
        revenue_change_pct = 100
    else:
        revenue_change_pct = 0

    internships = [
        {"label": label, "count": count}
        for label, count in sorted(internship_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    ]
    status_labels = {
        "PAID": "Paid",
        "PENDING": "Pending",
        "FAILED": "Failed",
        "REFUNDED": "Refunded",
        "PARTIALLY_REFUNDED": "Partial refund",
    }
    statuses = [
        {"key": key, "label": status_labels.get(key, key.title()), "count": count}
        for key, count in sorted(status_counts.items(), key=lambda item: item[1], reverse=True)
        if count
    ]
    # Already sorted by created_at DESC from the query
    recent = regs[:6]
    periods = _periods_public(await _get_branding())
    durations = []
    for duration_months, bucket in duration_buckets.items():
        slot = periods.get(str(duration_months)) or {}
        durations.append({
            **bucket,
            "start_date": slot.get("start_date") or "",
            "end_date": slot.get("end_date") or "",
        })
    payload = {
        "total_registrations": len(regs),
        "paid": paid,
        "pending": pending,
        "failed": failed,
        "refunded": refunded,
        "revenue": revenue,
        "certificates_generated": certs,
        "today_received": today_received,
        "today_registrations": today_registrations,
        "week_total": sum(bucket["count"] for bucket in day_buckets),
        "revenue_change_pct": revenue_change_pct,
        "months": months,
        "days": [{"label": bucket["label"], "count": bucket["count"]} for bucket in day_buckets],
        "durations": durations,
        "internships": internships,
        "statuses": statuses,
        "recent": [
            {
                "registration_id": reg.get("registration_id"),
                "full_name": reg.get("full_name"),
                "payment_status": reg.get("payment_status"),
                "amount": int(reg.get("amount") or 0),
                "duration_months": reg.get("duration_months"),
                "internship_start_date": reg.get("internship_start_date") or (periods.get(str(reg.get("duration_months"))) or {}).get("start_date") or "",
                "internship_end_date": reg.get("internship_end_date") or (periods.get(str(reg.get("duration_months"))) or {}).get("end_date") or "",
                "internship_type": reg.get("internship_type"),
                "created_at": reg.get("created_at"),
            }
            for reg in recent
        ],
        "generated_at": now.isoformat(),
        "duration_filter": duration,
        "date_from": date_from,
        "date_to": date_to,
    }
    _DASHBOARD_CACHE[cache_key] = {"at": now_mono, "value": payload}
    return payload


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
    if duration is not None:
        q["duration_months"] = int(duration)
    if internship_type:
        q["internship_type"] = internship_type
    docs = await db.registrations.find(q).sort("created_at", -1).to_list(500)
    return [clean(d) for d in docs]


async def _send_one_registration_reminder(reg: dict, admin_email: str) -> dict:
    registration_id = reg.get("registration_id") or ""
    status = str(reg.get("payment_status") or "").upper()
    if status not in ("PENDING", "FAILED"):
        raise HTTPException(400, "Reminder emails are only available for pending or failed payments")
    if not reg.get("email"):
        raise HTTPException(400, "This registration has no email address")

    cta_url = f"{FRONTEND_URL.rstrip('/')}/status?q={registration_id}"
    message_id = await send_pending_reminder_email(reg, cta_url=cta_url)
    if not message_id:
        raise HTTPException(502, "Could not send the reminder email. Check email settings and try again.")

    try:
        prev_count = int(reg.get("reminder_email_count") or 0)
    except (TypeError, ValueError):
        prev_count = 0
    next_count = prev_count + 1

    await db.registrations.update_one(
        {"registration_id": registration_id},
        {"$set": {
            "reminder_email_sent_at": now_iso(),
            "reminder_email_id": message_id,
            "reminder_email_count": next_count,
            "updated_at": now_iso(),
        }},
    )
    await db.audit_logs.insert_one({
        "action": "reminder_email_sent",
        "registration_id": registration_id,
        "admin_email": admin_email,
        "email_id": message_id,
        "reminder_email_count": next_count,
        "created_at": now_iso(),
    })
    return {
        "ok": True,
        "email_id": message_id,
        "to": reg["email"],
        "registration_id": registration_id,
        "reminder_email_count": next_count,
    }


@api.post("/admin/registrations/{registration_id}/send-reminder")
async def admin_send_registration_reminder(
    registration_id: str,
    email: str = Depends(require_admin),
):
    reg = await db.registrations.find_one({"registration_id": registration_id})
    if not reg:
        raise HTTPException(404, "Registration not found")
    result = await _send_one_registration_reminder(reg, email)
    logger.info(
        "Admin %s sent reminder email for %s (%s)",
        email, registration_id, result.get("email_id"),
    )
    return result


@api.post("/admin/registrations/bulk-send-reminder")
async def admin_bulk_send_registration_reminder(
    body: BulkDeleteRequest,
    email: str = Depends(require_admin),
):
    ids = [str(i).strip() for i in body.registration_ids if str(i).strip()]
    if not ids:
        raise HTTPException(400, "No registration IDs provided")

    sent = 0
    skipped = 0
    failed = 0
    details: list[dict] = []

    for registration_id in ids:
        reg = await db.registrations.find_one({"registration_id": registration_id})
        if not reg:
            failed += 1
            details.append({"registration_id": registration_id, "status": "failed", "message": "Not found"})
            continue
        status = str(reg.get("payment_status") or "").upper()
        if status not in ("PENDING", "FAILED"):
            skipped += 1
            details.append({
                "registration_id": registration_id,
                "status": "skipped",
                "message": f"Status is {status or 'unknown'}",
            })
            continue
        try:
            result = await _send_one_registration_reminder(reg, email)
            sent += 1
            details.append({
                "registration_id": registration_id,
                "status": "sent",
                "to": result.get("to"),
            })
        except HTTPException as exc:
            failed += 1
            details.append({
                "registration_id": registration_id,
                "status": "failed",
                "message": str(exc.detail),
            })
        except Exception as exc:
            failed += 1
            details.append({
                "registration_id": registration_id,
                "status": "failed",
                "message": str(exc),
            })

    logger.info(
        "Admin %s bulk reminders: sent=%s skipped=%s failed=%s",
        email, sent, skipped, failed,
    )
    return {
        "ok": True,
        "sent": sent,
        "skipped": skipped,
        "failed": failed,
        "details": details[:200],
    }


async def _cascade_delete_registrations(registration_ids: list[str]) -> dict:
    """Permanently remove registrations and related payments / audit rows from DB."""
    ids = [str(i).strip() for i in registration_ids if str(i).strip()]
    if not ids:
        return {"registrations": 0, "payments": 0, "audit_logs": 0}
    regs = await db.registrations.delete_many_by_field("registration_id", ids)
    pays = await db.payments.delete_many_by_field("registration_id", ids)
    audits = await db.audit_logs.delete_many_by_field("registration_id", ids)
    _invalidate_admin_stats_cache()
    return {"registrations": regs, "payments": pays, "audit_logs": audits}


@api.post("/admin/registrations/bulk-delete")
async def admin_bulk_delete_registrations(
    body: BulkDeleteRequest,
    email: str = Depends(require_admin),
):
    deleted = await _cascade_delete_registrations(body.registration_ids)
    logger.info("Admin %s bulk-deleted registrations: %s", email, deleted)
    return {"ok": True, "deleted": deleted}


@api.post("/admin/registrations/clear")
async def admin_clear_registrations(
    body: ClearConfirmRequest,
    email: str = Depends(require_admin),
):
    if body.confirm.strip().upper() != "DELETE":
        raise HTTPException(400, 'Type DELETE to confirm clearing all registrations')
    regs = await db.registrations.delete_all()
    pays = await db.payments.delete_all()
    audits = await db.audit_logs.delete_all()
    _invalidate_admin_stats_cache()
    logger.info("Admin %s cleared all registrations/payments/audit_logs", email)
    return {
        "ok": True,
        "deleted": {"registrations": regs, "payments": pays, "audit_logs": audits},
    }


@api.post("/admin/payments/bulk-delete")
async def admin_bulk_delete_payments(
    body: BulkDeleteRequest,
    email: str = Depends(require_admin),
):
    ids = [str(i).strip() for i in body.registration_ids if str(i).strip()]
    if not ids:
        raise HTTPException(400, "No payment registration IDs provided")
    pays = await db.payments.delete_many_by_field("registration_id", ids)
    audits = await db.audit_logs.delete_many_by_field("registration_id", ids)
    _invalidate_admin_stats_cache()
    logger.info("Admin %s bulk-deleted payments: %s", email, pays)
    return {"ok": True, "deleted": {"payments": pays, "audit_logs": audits}}


@api.post("/admin/payments/clear")
async def admin_clear_payments(
    body: ClearConfirmRequest,
    email: str = Depends(require_admin),
):
    if body.confirm.strip().upper() != "DELETE":
        raise HTTPException(400, "Type DELETE to confirm clearing all payments")
    pays = await db.payments.delete_all()
    audits = await db.audit_logs.delete_all()
    _invalidate_admin_stats_cache()
    logger.info("Admin %s cleared all payments/audit_logs", email)
    return {"ok": True, "deleted": {"payments": pays, "audit_logs": audits}}


@api.post("/admin/certificates/bulk-delete")
async def admin_bulk_delete_certificates(
    body: BulkDeleteRequest,
    email: str = Depends(require_admin),
):
    """Certificates live on registration docs — cascade-delete those records."""
    deleted = await _cascade_delete_registrations(body.registration_ids)
    logger.info("Admin %s bulk-deleted certificate registrations: %s", email, deleted)
    return {"ok": True, "deleted": deleted}


@api.post("/admin/certificates/clear")
async def admin_clear_certificates(
    body: ClearConfirmRequest,
    email: str = Depends(require_admin),
):
    """Remove all paid registrations (certificate list source) and related payments."""
    if body.confirm.strip().upper() != "DELETE":
        raise HTTPException(400, "Type DELETE to confirm clearing all certificates")
    paid = await db.registrations.find({"payment_status": "PAID"}).to_list(100000)
    ids = [r.get("registration_id") for r in paid if r.get("registration_id")]
    deleted = await _cascade_delete_registrations(ids)
    logger.info("Admin %s cleared paid certificate registrations: %s", email, deleted)
    return {"ok": True, "deleted": deleted}


# ============================================================
# Admin Interns roster (independent of registrations / payments)
# ============================================================
@api.get("/admin/interns")
async def admin_list_interns(
    email: str = Depends(require_admin),
    search: Optional[str] = None,
):
    q = {}
    if search:
        s = search.strip()
        if s:
            q["$or"] = [
                {"intern_id": {"$regex": s, "$options": "i"}},
                {"full_name": {"$regex": s, "$options": "i"}},
                {"email": {"$regex": s, "$options": "i"}},
                {"mobile": {"$regex": s, "$options": "i"}},
                {"college": {"$regex": s, "$options": "i"}},
                {"internship_type": {"$regex": s, "$options": "i"}},
            ]
    # No artificial import/list cap — return full roster
    docs = await db.interns.find(q).sort("created_at", -1).to_list(1_000_000)
    return [clean(d) for d in docs]


@api.get("/admin/interns/template")
async def admin_interns_template(email: str = Depends(require_admin)):
    return Response(
        content=_intern_template_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="veritech-interns-template.csv"'},
    )


@api.post("/admin/interns/import")
async def admin_interns_import(
    file: UploadFile = File(...),
    email: str = Depends(require_admin),
):
    filename = file.filename or ""
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Uploaded file is empty")

    parsed_rows, source_label = _parse_intern_upload(filename, raw)
    if not parsed_rows:
        raise HTTPException(400, "No data rows found in the file")

    first_headers = list(parsed_rows[0].keys())
    header_map = {_normalize_intern_csv_header(h): h for h in first_headers if h}
    for row in parsed_rows[1:]:
        for h in row.keys():
            norm = _normalize_intern_csv_header(h)
            if norm and norm not in header_map:
                header_map[norm] = h

    existing = await db.interns.find({}).to_list(1_000_000)
    by_email = {
        str(d.get("email") or "").strip().lower(): d
        for d in existing
        if str(d.get("email") or "").strip() and d.get("is_valid", True)
    }

    imported = 0
    updated = 0
    skipped = 0
    invalid_count = 0
    errors: list[dict] = []
    seen_in_file: set[str] = set()

    for index, row in enumerate(parsed_rows, start=2):
        def cell(col: str) -> str:
            raw_key = header_map.get(col)
            if not raw_key:
                return ""
            return _intern_cell_str(row.get(raw_key))

        full_name = cell("full_name")
        intern_email = cell("email").lower()
        mobile = cell("mobile")
        college = cell("college")
        course = cell("course")
        branch = cell("branch")
        graduation_year = cell("graduation_year")
        internship_type = cell("internship_type")

        # Skip only completely blank lines
        if not any([full_name, intern_email, mobile, college, course, branch, graduation_year, internship_type]):
            skipped += 1
            continue

        field_errors, invalid_fields = _intern_field_errors(full_name, intern_email, mobile)
        if intern_email and intern_email in seen_in_file:
            field_errors = [*field_errors, f"Duplicate email in file ({intern_email})"]
            if "email" not in invalid_fields:
                invalid_fields = [*invalid_fields, "email"]
        if intern_email:
            seen_in_file.add(intern_email)

        is_valid = len(field_errors) == 0
        if not is_valid:
            invalid_count += 1
            errors.append({"row": index, "message": "; ".join(field_errors)})

        now = now_iso()
        payload = {
            "full_name": full_name,
            "email": intern_email,
            "mobile": mobile,
            "college": college,
            "course": course,
            "branch": branch,
            "graduation_year": graduation_year,
            "internship_type": internship_type,
            "source": source_label,
            "is_valid": is_valid,
            "validation_errors": field_errors,
            "invalid_fields": invalid_fields,
            "updated_at": now,
        }

        # Upsert only when email is valid and already on roster
        existing_doc = by_email.get(intern_email) if is_valid and intern_email else None
        if existing_doc:
            intern_id = existing_doc.get("intern_id") or existing_doc.get("_id")
            await db.interns.update_one({"intern_id": intern_id}, {"$set": payload})
            updated += 1
            by_email[intern_email] = {**existing_doc, **payload, "intern_id": intern_id}
        else:
            intern_id = await next_intern_id()
            doc = {
                **payload,
                "intern_id": intern_id,
                "_id": intern_id,
                "created_at": now,
            }
            await db.interns.insert_one(doc)
            imported += 1
            if is_valid and intern_email:
                by_email[intern_email] = doc

    logger.info(
        "Admin %s imported interns (%s): imported=%s updated=%s skipped=%s invalid=%s",
        email, source_label, imported, updated, skipped, invalid_count,
    )
    return {
        "ok": True,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "invalid_count": invalid_count,
        "errors": errors[:200],
        "error_count": len(errors),
        "format": source_label,
    }


@api.patch("/admin/interns/{intern_id}")
async def admin_update_intern(
    intern_id: str,
    body: InternUpdateRequest,
    email: str = Depends(require_admin),
):
    intern = await db.interns.find_one({"intern_id": intern_id})
    if not intern:
        raise HTTPException(404, "Intern not found")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in updates:
        updates["email"] = str(updates["email"]).strip().lower()
    for key in ("full_name", "mobile", "college", "course", "branch", "graduation_year", "internship_type"):
        if key in updates:
            updates[key] = str(updates[key]).strip()

    merged = {**intern, **updates}
    field_errors, invalid_fields = _intern_field_errors(
        merged.get("full_name") or "",
        merged.get("email") or "",
        merged.get("mobile") or "",
    )
    updates.update({
        "is_valid": len(field_errors) == 0,
        "validation_errors": field_errors,
        "invalid_fields": invalid_fields,
        "updated_at": now_iso(),
    })
    await db.interns.update_one({"intern_id": intern_id}, {"$set": updates})
    updated = await db.interns.find_one({"intern_id": intern_id})
    return clean(updated)


@api.post("/admin/interns/bulk-delete")
async def admin_interns_bulk_delete(
    body: InternBulkDeleteRequest,
    email: str = Depends(require_admin),
):
    ids = [str(i).strip() for i in body.intern_ids if str(i).strip()]
    if not ids:
        raise HTTPException(400, "No intern IDs provided")
    deleted = await db.interns.delete_many_by_field("intern_id", ids)
    logger.info("Admin %s bulk-deleted interns: %s", email, deleted)
    return {"ok": True, "deleted": {"interns": deleted}}


@api.post("/admin/interns/clear")
async def admin_interns_clear(
    body: ClearConfirmRequest,
    email: str = Depends(require_admin),
):
    if body.confirm.strip().upper() != "DELETE":
        raise HTTPException(400, "Type DELETE to confirm clearing all interns")
    deleted = await db.interns.delete_all()
    logger.info("Admin %s cleared all interns: %s", email, deleted)
    return {"ok": True, "deleted": {"interns": deleted}}


async def _send_one_intern_claim_invite(intern: dict, admin_email: str) -> dict:
    """Send (or resend) claim invite for one intern. Returns result dict; raises HTTPException on hard fail."""
    intern_id = intern.get("intern_id") or ""
    if intern.get("is_valid") is False:
        raise HTTPException(400, "Fix invalid fields before sending the invite")
    if not intern.get("email"):
        raise HTTPException(400, "This intern has no email address")

    base = FRONTEND_URL.rstrip("/")
    # Prefill intern id on register when available; otherwise fall back to /register
    claim_url = f"{base}/register/{intern_id}" if intern_id else f"{base}/register"
    message_id = await send_intern_claim_invite_email(
        intern,
        claim_url=claim_url,
        site_url=base,
        status_url=f"{base}/status",
    )
    if not message_id:
        raise HTTPException(502, "Could not send the invitation email. Check email settings and try again.")

    try:
        prev_count = int(intern.get("invite_email_count") or 0)
    except (TypeError, ValueError):
        prev_count = 0
    next_count = prev_count + 1

    await db.interns.update_one(
        {"intern_id": intern_id},
        {"$set": {
            "invite_email_sent_at": now_iso(),
            "invite_email_id": message_id,
            "invite_email_count": next_count,
            "updated_at": now_iso(),
        }},
    )
    await db.audit_logs.insert_one({
        "action": "intern_claim_invite_sent",
        "intern_id": intern_id,
        "admin_email": admin_email,
        "email_id": message_id,
        "invite_email_count": next_count,
        "created_at": now_iso(),
    })
    return {
        "ok": True,
        "email_id": message_id,
        "to": intern["email"],
        "intern_id": intern_id,
        "invite_email_count": next_count,
    }


@api.post("/admin/interns/{intern_id}/send-invite")
async def admin_send_intern_claim_invite(
    intern_id: str,
    email: str = Depends(require_admin),
):
    intern = await db.interns.find_one({"intern_id": intern_id})
    if not intern:
        raise HTTPException(404, "Intern not found")
    result = await _send_one_intern_claim_invite(intern, email)
    logger.info("Admin %s sent claim invite for %s (%s)", email, intern_id, result.get("email_id"))
    return result


@api.post("/admin/interns/bulk-send-invite")
async def admin_bulk_send_intern_claim_invite(
    body: InternBulkDeleteRequest,
    email: str = Depends(require_admin),
    stream: bool = Query(False),
):
    ids = [str(i).strip() for i in body.intern_ids if str(i).strip()]
    if not ids:
        raise HTTPException(400, "No intern IDs provided")

    async def _process():
        sent = 0
        skipped = 0
        failed = 0
        details: list[dict] = []
        total = len(ids)
        yield {
            "event": "start",
            "total": total,
            "done": 0,
            "sent": 0,
            "skipped": 0,
            "failed": 0,
        }

        for idx, intern_id in enumerate(ids, start=1):
            intern = await db.interns.find_one({"intern_id": intern_id})
            if not intern:
                failed += 1
                details.append({"intern_id": intern_id, "status": "failed", "message": "Intern not found"})
            elif intern.get("is_valid") is False:
                skipped += 1
                details.append({
                    "intern_id": intern_id,
                    "status": "skipped",
                    "message": "Invalid fields — fix before sending",
                })
            elif not intern.get("email"):
                skipped += 1
                details.append({
                    "intern_id": intern_id,
                    "status": "skipped",
                    "message": "Missing email",
                })
            else:
                try:
                    result = await _send_one_intern_claim_invite(intern, email)
                    sent += 1
                    details.append({
                        "intern_id": intern_id,
                        "status": "sent",
                        "to": result.get("to"),
                    })
                except HTTPException as exc:
                    failed += 1
                    details.append({
                        "intern_id": intern_id,
                        "status": "failed",
                        "message": str(exc.detail),
                    })
                except Exception as exc:
                    failed += 1
                    details.append({
                        "intern_id": intern_id,
                        "status": "failed",
                        "message": str(exc),
                    })

            yield {
                "event": "progress",
                "total": total,
                "done": idx,
                "sent": sent,
                "skipped": skipped,
                "failed": failed,
                "current_id": intern_id,
            }

        logger.info(
            "Admin %s bulk claim invites: sent=%s skipped=%s failed=%s",
            email, sent, skipped, failed,
        )
        yield {
            "event": "done",
            "ok": True,
            "total": total,
            "done": total,
            "sent": sent,
            "skipped": skipped,
            "failed": failed,
            "details": details[:200],
        }

    if stream:
        async def ndjson():
            async for payload in _process():
                yield json.dumps(payload) + "\n"

        return StreamingResponse(ndjson(), media_type="application/x-ndjson")

    final = None
    async for payload in _process():
        if payload.get("event") == "done":
            final = payload
    return {
        "ok": True,
        "sent": final.get("sent", 0) if final else 0,
        "skipped": final.get("skipped", 0) if final else 0,
        "failed": final.get("failed", 0) if final else 0,
        "details": (final or {}).get("details", []),
    }


@api.get("/admin/failure-analytics")
async def admin_failure_analytics(email: str = Depends(require_admin)):
    """Breakdown of failed payments by Razorpay-reported reason/code."""
    now_mono = time.monotonic()
    if _FAILURE_CACHE["value"] is not None and (now_mono - _FAILURE_CACHE["at"]) < _DASHBOARD_TTL_SEC:
        return _FAILURE_CACHE["value"]

    # Single scan — previous version ran 4 full payment-collection reads.
    failed = await db.payments.find({"status": "FAILED"}).to_list(5000)
    desc_counts: dict[str, int] = {}
    code_counts: dict[str, int] = {}
    step_counts: dict[str, int] = {}
    for payment in failed:
        desc = payment.get("failure_description") or "Unknown reason"
        code = payment.get("failure_code") or "UNKNOWN"
        step = payment.get("failure_step") or "unknown"
        desc_counts[desc] = desc_counts.get(desc, 0) + 1
        code_counts[code] = code_counts.get(code, 0) + 1
        step_counts[step] = step_counts.get(step, 0) + 1

    def _top(counts: dict[str, int]):
        return [
            {"label": label, "count": count}
            for label, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:10]
        ]

    payload = {
        "total_failed": len(failed),
        "by_description": _top(desc_counts),
        "by_code": _top(code_counts),
        "by_step": _top(step_counts),
    }
    _FAILURE_CACHE["at"] = now_mono
    _FAILURE_CACHE["value"] = payload
    return payload


@api.post("/admin/payments/{registration_id}/refund")
async def admin_refund_payment(
    registration_id: str,
    body: RefundRequest,
    email: str = Depends(require_admin),
):
    payment = await db.payments.find_one({"registration_id": registration_id})
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.get("status") != "PAID":
        raise HTTPException(400, "Only paid payments can be refunded")
    if payment.get("status") == "REFUNDED":
        raise HTTPException(400, "Payment already refunded")
    if not payment.get("razorpay_payment_id"):
        raise HTTPException(400, "No Razorpay payment ID on record")

    full_amount_rupees = int(payment["amount"])
    refund_rupees = body.amount if body.amount and body.amount > 0 else full_amount_rupees
    if refund_rupees > full_amount_rupees:
        raise HTTPException(400, "Refund amount cannot exceed captured amount")
    refund_paise = refund_rupees * 100

    rz = get_razorpay_client()
    if rz is None or payment.get("mode") == "mock":
        refund_id = f"rfnd_mock_{registration_id.replace('-', '')}"
        gateway_response = {"mock": True}
    else:
        try:
            rf = rz.payment.refund(payment["razorpay_payment_id"], {
                "amount": refund_paise,
                "notes": {
                    "registration_id": registration_id,
                    "reason": body.reason,
                    "refunded_by": email,
                },
            })
            refund_id = rf.get("id")
            gateway_response = rf
        except Exception as e:
            logger.error("Razorpay refund failed: %s", e)
            raise HTTPException(502, f"Razorpay refund failed: {e}")

    now = now_iso()
    is_full = refund_rupees == full_amount_rupees
    payment_status = "REFUNDED" if is_full else "PARTIALLY_REFUNDED"
    reg_status = "REFUNDED" if is_full else "PARTIALLY_REFUNDED"

    await db.payments.update_one(
        {"registration_id": registration_id},
        {"$set": {
            "status": payment_status,
            "refund_id": refund_id,
            "refund_amount": refund_rupees,
            "refund_reason": body.reason,
            "refunded_by": email,
            "refunded_at": now,
            "updated_at": now,
        }},
    )
    await db.registrations.update_one(
        {"registration_id": registration_id},
        {"$set": {
            "payment_status": payment_status,
            "status": reg_status,
            "refund_id": refund_id,
            "refunded_at": now,
            "updated_at": now,
        }},
    )
    _invalidate_admin_stats_cache()
    # Audit log
    await db.audit_logs.insert_one({
        "kind": "refund",
        "registration_id": registration_id,
        "razorpay_payment_id": payment["razorpay_payment_id"],
        "refund_id": refund_id,
        "amount": refund_rupees,
        "reason": body.reason,
        "actor": email,
        "gateway_response": gateway_response,
        "created_at": now,
    })
    return {
        "refunded": True,
        "refund_id": refund_id,
        "amount": refund_rupees,
        "status": payment_status,
    }


@api.get("/admin/audit-logs")
async def admin_audit_logs(email: str = Depends(require_admin), kind: Optional[str] = None):
    q = {"kind": kind} if kind else {}
    docs = await db.audit_logs.find(q).sort("created_at", -1).to_list(200)
    return [clean(d) for d in docs]


async def _registration_lookup() -> dict:
    """One bulk read — avoids N+1 find_one calls on payment list screens."""
    regs = await db.registrations.find({}).to_list(10000)
    return {r.get("registration_id"): r for r in regs if r.get("registration_id")}


@api.get("/admin/payments")
async def admin_payments(email: str = Depends(require_admin)):
    docs = await db.payments.find({}).sort("created_at", -1).to_list(500)
    regs_by_id = await _registration_lookup()
    result = []
    for d in docs:
        d = clean(d)
        reg = regs_by_id.get(d.get("registration_id"))
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
    regs_by_id = await _registration_lookup()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Razorpay Order ID", "Registration ID", "Name", "Email",
        "Razorpay Payment ID", "Amount", "Currency", "Status", "Mode",
        "Created At", "Paid At",
    ])
    for d in docs:
        reg = regs_by_id.get(d.get("registration_id") or "") or {}
        w.writerow([
            d.get("razorpay_order_id",""), d.get("registration_id",""),
            reg.get("full_name",""), reg.get("email",""),
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
# Branding (logo, signature, seal, internship dates) — admin only
# ============================================================
ALLOWED_IMG_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_IMG_BYTES = 2 * 1024 * 1024  # 2 MB
BRAND_IMAGES = ("logo", "signature", "seal")
PERIOD_MONTHS = ("1", "2", "3", "6")


class PeriodSlot(BaseModel):
    start_date: str = ""
    end_date: str = ""


class PeriodsUpdate(BaseModel):
    periods: dict[str, PeriodSlot] = {}


class DomainSlot(BaseModel):
    name: str
    active: bool = True


class DomainsUpdate(BaseModel):
    domains: list[DomainSlot] = []


def _empty_periods() -> dict:
    return {key: {"start_date": "", "end_date": ""} for key in PERIOD_MONTHS}


def _domains_all(branding: Optional[dict]) -> list[dict]:
    raw = (branding or {}).get("domains")
    if not isinstance(raw, list) or not raw:
        return [{"name": name, "active": True} for name in INTERNSHIP_TYPES]
    items = []
    seen = set()
    for item in raw:
        if isinstance(item, str):
            name, active = item, True
        elif isinstance(item, dict):
            name, active = item.get("name"), bool(item.get("active", True))
        else:
            continue
        name = " ".join(str(name or "").split())
        key = name.casefold()
        if not name or key in seen:
            continue
        seen.add(key)
        items.append({"name": name, "active": active})
    return items or [{"name": name, "active": True} for name in INTERNSHIP_TYPES]


def _domains_public(branding: Optional[dict]) -> list[str]:
    return [item["name"] for item in _domains_all(branding) if item["active"]]


def _clean_domains(domains: list[DomainSlot]) -> list[dict]:
    cleaned = []
    seen = set()
    for slot in domains:
        name = " ".join((slot.name or "").split())
        key = name.casefold()
        if not name:
            continue
        if len(name) > 80:
            raise HTTPException(400, "Each domain name must be 80 characters or fewer")
        if key in seen:
            continue
        seen.add(key)
        cleaned.append({"name": name, "active": bool(slot.active)})
    if not cleaned:
        raise HTTPException(400, "Add at least one internship domain")
    if len(cleaned) > 40:
        raise HTTPException(400, "You can offer up to 40 domains")
    active = [item for item in cleaned if item["active"]]
    if not active:
        raise HTTPException(400, "Select at least one domain for the registration form")
    return cleaned


def _periods_public(branding: Optional[dict]) -> dict:
    stored = (branding or {}).get("periods") or {}
    public = _empty_periods()
    for key in PERIOD_MONTHS:
        slot = stored.get(key) or {}
        public[key] = {
            "start_date": str(slot.get("start_date") or ""),
            "end_date": str(slot.get("end_date") or ""),
        }
    return public


def _parse_period_date(value: str) -> Optional[datetime]:
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def _format_cert_date(value: str) -> str:
    parsed = _parse_period_date((value or "").strip())
    if not parsed:
        return (value or "").strip()
    return parsed.strftime("%d %B %Y")


def _duration_with_dates(reg: dict, branding: Optional[dict] = None) -> str:
    try:
        n = int(reg.get("duration_months"))
    except (TypeError, ValueError):
        n = None
    if n == 0:
        label = "1 Day"
    elif n == 1:
        label = "1 Month"
    elif n:
        label = f"{n} Months"
    else:
        label = ""
    start, end = _certificate_dates(reg, branding)
    start_label = _format_cert_date(start) if start else ""
    end_label = _format_cert_date(end) if end else ""
    if start_label and end_label:
        return f"{label} ({start_label} - {end_label})".strip()
    return label


def _certificate_dates(reg: dict, branding: Optional[dict]) -> tuple[str, str]:
    months = str(reg.get("duration_months") if reg.get("duration_months") is not None else "")
    slot = _periods_public(branding).get(months) or {}
    start = (slot.get("start_date") or "").strip()
    end = (slot.get("end_date") or "").strip()
    if start and end:
        return start, end
    return (
        str(reg.get("internship_start_date") or "").strip(),
        str(reg.get("internship_end_date") or "").strip(),
    )


async def _sync_period_dates(periods: dict) -> None:
    docs = await db.registrations.find({}).to_list(10000)
    for reg in docs:
        key = str(reg.get("duration_months") if reg.get("duration_months") is not None else "")
        slot = periods.get(key) or {}
        start = (slot.get("start_date") or "").strip()
        end = (slot.get("end_date") or "").strip()
        if not start or not end:
            continue
        await db.registrations.update_one(
            {"registration_id": reg.get("registration_id")},
            {"$set": {
                "internship_start_date": start,
                "internship_end_date": end,
                "updated_at": now_iso(),
            }},
        )


async def _get_branding() -> dict:
    now = time.monotonic()
    if _BRANDING_CACHE["value"] is not None and (now - _BRANDING_CACHE["at"]) < _CACHE_TTL_SEC:
        return _BRANDING_CACHE["value"]
    doc = await db.settings.find_one({"_id": "branding"})
    value = clean(doc) if doc else {}
    _BRANDING_CACHE["at"] = now
    _BRANDING_CACHE["value"] = value
    return value


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
    _invalidate_branding_cache()


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
        "logo": {
            "present": bool(b.get("logo_b64")),
            "mime": b.get("logo_mime"),
            "updated_at": b.get("logo_updated_at"),
        },
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
        "periods": _periods_public(b),
        "domains": _domains_all(b),
    }


@api.get("/admin/branding/{kind}/image")
async def admin_get_branding_image(kind: str, email: str = Depends(require_admin)):
    if kind not in BRAND_IMAGES:
        raise HTTPException(404, "Not found")
    b = await _get_branding()
    b64 = b.get(f"{kind}_b64")
    mime = b.get(f"{kind}_mime") or "image/png"
    if not b64:
        raise HTTPException(404, f"No {kind} uploaded")
    return Response(content=base64.b64decode(b64), media_type=mime)


@api.post("/admin/branding/logo")
async def admin_upload_logo(file: UploadFile = File(...), email: str = Depends(require_admin)):
    return await _upload_image("logo", file)


@api.post("/admin/branding/signature")
async def admin_upload_signature(file: UploadFile = File(...), email: str = Depends(require_admin)):
    return await _upload_image("signature", file)


@api.post("/admin/branding/seal")
async def admin_upload_seal(file: UploadFile = File(...), email: str = Depends(require_admin)):
    return await _upload_image("seal", file)


@api.delete("/admin/branding/{kind}")
async def admin_delete_branding(kind: str, email: str = Depends(require_admin)):
    if kind not in BRAND_IMAGES:
        raise HTTPException(404, "Not found")
    await _save_branding_field(kind, None, None)
    return {"ok": True}


@api.put("/admin/branding/periods")
async def admin_update_periods(body: PeriodsUpdate, email: str = Depends(require_admin)):
    cleaned = _empty_periods()
    for key in PERIOD_MONTHS:
        slot = body.periods.get(key) or PeriodSlot()
        start = slot.start_date.strip()
        end = slot.end_date.strip()
        if not start and not end:
            continue
        if not start or not end:
            raise HTTPException(400, f"The {key}-month internship needs both a start date and an end date")
        start_dt = _parse_period_date(start)
        end_dt = _parse_period_date(end)
        if not start_dt or not end_dt:
            raise HTTPException(400, "Enter dates as YYYY-MM-DD")
        if end_dt < start_dt:
            raise HTTPException(400, f"The {key}-month end date must be on or after the start date")
        cleaned[key] = {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
        }
    await db.settings.update_one(
        {"_id": "branding"},
        {"$set": {"periods": cleaned, "periods_updated_at": now_iso()}},
        upsert=True,
    )
    _invalidate_branding_cache()
    await _sync_period_dates(cleaned)
    return {"ok": True, "periods": cleaned}


@api.put("/admin/branding/domains")
async def admin_update_domains(body: DomainsUpdate, email: str = Depends(require_admin)):
    cleaned = _clean_domains(body.domains)
    await db.settings.update_one(
        {"_id": "branding"},
        {"$set": {"domains": cleaned, "domains_updated_at": now_iso()}},
        upsert=True,
    )
    _invalidate_branding_cache()
    return {"ok": True, "domains": cleaned}


# ============================================================
# PDF generation
# ============================================================
def _draw_rich_text(c, x, y, parts, size, max_width, leading, color):
    """Draw wrapped text. parts is a list of (text, bold)."""
    words = []
    for text, bold in parts:
        font = "Helvetica-Bold" if bold else "Helvetica"
        for word in str(text or "").split():
            words.append((word, font))
    lines = []
    line = []
    width = 0
    space = c.stringWidth(" ", "Helvetica", size)
    for word, font in words:
        word_width = c.stringWidth(word, font, size)
        extra = space if line else 0
        if line and width + extra + word_width > max_width:
            lines.append(line)
            line = [(word, font)]
            width = word_width
        else:
            line.append((word, font))
            width += extra + word_width
    if line:
        lines.append(line)
    for row in lines:
        cursor = x
        for index, (word, font) in enumerate(row):
            if index and not word[:1] in ",.;:)":
                cursor += space
            c.setFillColor(color)
            c.setFont(font, size)
            c.drawString(cursor, y, word)
            cursor += c.stringWidth(word, font, size)
        y -= leading
    return y


def _draw_veritech_mark(c, x, y, size, align, black, blue):
    """Draw Veritech in black and .AI in blue."""
    name = "Veritech"
    suffix = ".AI"
    font = "Helvetica-Bold"
    name_w = c.stringWidth(name, font, size)
    total = name_w + c.stringWidth(suffix, font, size)
    if align == "right":
        start = x - total
    elif align == "center":
        start = x - total / 2
    else:
        start = x
    c.setFont(font, size)
    c.setFillColor(black)
    c.drawString(start, y, name)
    c.setFillColor(blue)
    c.drawString(start + name_w, y, suffix)


def _build_certificate_pdf(reg: dict, branding: Optional[dict] = None) -> bytes:
    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    black = HexColor("#111111")
    blue = HexColor("#2563EB")
    muted = HexColor("#334155")

    margin = 0.55 * inch
    c.setStrokeColor(black)
    c.setLineWidth(1.4)
    c.rect(margin, margin, w - 2 * margin, h - 2 * margin)

    left = margin + 0.45 * inch
    right = w - margin - 0.45 * inch
    text_width = right - left

    if branding and branding.get("logo_b64"):
        try:
            logo_bytes = base64.b64decode(branding["logo_b64"])
            c.drawImage(
                ImageReader(io.BytesIO(logo_bytes)),
                left, h - 1.45 * inch,
                width=2.05 * inch, height=0.62 * inch,
                mask="auto", preserveAspectRatio=True, anchor="sw",
            )
        except Exception as e:
            logger.error("logo draw failed: %s", e)

    # Wordmark, top right: Veritech in black, .AI in blue
    _draw_veritech_mark(c, right, h - 1.05 * inch, 18, "right", black, blue)
    c.setFillColor(muted)
    c.setFont("Helvetica", 8)
    c.drawRightString(right, h - 1.22 * inch, "Software IT services")

    # Title
    title = "CERTIFICATE FOR INTERNSHIP"
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 16)
    title_w = c.stringWidth(title, "Helvetica-Bold", 16)
    title_x = (w - title_w) / 2
    title_y = h - 2.15 * inch
    c.drawString(title_x, title_y, title)
    c.setLineWidth(0.8)
    c.line(title_x, title_y - 3, title_x + title_w, title_y - 3)

    y = title_y - 0.45 * inch

    name = (reg.get("full_name") or "the intern").strip()
    internship_type = (reg.get("internship_type") or "Software Engineer").strip()
    # Avoid "… Development Internship Internship" if admin stored a label that already ends with it
    if internship_type.lower().endswith(" internship"):
        internship_label = internship_type
    else:
        internship_label = f"{internship_type} Internship"
    start, end = _certificate_dates(reg, branding)
    start_label = _format_cert_date(start) if start else ""
    end_label = _format_cert_date(end) if end else ""

    intro = [
        ("This is to certify that", False),
        (name, True),
        ("has successfully completed the", False),
        (internship_label, True),
        ("organized and conducted by Veritech.AI Software IT Services", False),
    ]
    if start_label and end_label:
        intro += [("from", False), (start_label, True), ("to", False), (f"{end_label}.", True)]
    else:
        last_text, last_bold = intro[-1]
        intro[-1] = (f"{last_text}.", last_bold)
    paragraphs = [
        intro,
        [("During the internship, the intern worked on software development projects involving the design, development, testing, and implementation of software applications. The intern gained practical experience in programming, application development, debugging, and problem-solving while applying industry-standard software engineering practices.", False)],
        [
            ("Throughout the internship,", False),
            (name, True),
            ("demonstrated dedication, a willingness to learn, and a proactive approach to assigned tasks. The intern successfully completed the assigned responsibilities and contributed to the project objectives.", False),
        ],
        [("We appreciate the intern's efforts and wish them continued success in their professional career.", False)],
    ]
    y = _draw_rich_text(c, left, y, paragraphs[0], 11, text_width, 15, black)
    for parts in paragraphs[1:]:
        y = _draw_rich_text(c, left, y - 0.22 * inch, parts, 11, text_width, 15, black)

    y -= 0.45 * inch
    c.setFont("Helvetica", 9)
    c.setFillColor(muted)
    meta = f"Registration ID: {reg.get('registration_id', '')}"
    if reg.get("certificate_number"):
        meta = f"Certificate No: {reg['certificate_number']}    {meta}"
    c.drawString(left, y, meta)

    sign_top = 2.55 * inch
    if branding and branding.get("signature_b64"):
        try:
            sig_bytes = base64.b64decode(branding["signature_b64"])
            c.drawImage(
                ImageReader(io.BytesIO(sig_bytes)),
                left, sign_top,
                width=1.7 * inch, height=0.65 * inch,
                mask="auto", preserveAspectRatio=True, anchor="sw",
            )
        except Exception as e:
            logger.error("signature draw failed: %s", e)
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, 2.25 * inch, "AUTHORIZED SIGNATORY")
    c.setFont("Helvetica", 11)
    c.drawString(left, 2.05 * inch, "(Program Director)")

    if branding and branding.get("seal_b64"):
        try:
            seal_bytes = base64.b64decode(branding["seal_b64"])
            c.drawImage(
                ImageReader(io.BytesIO(seal_bytes)),
                right - 1.15 * inch, 2.05 * inch,
                width=1.05 * inch, height=1.05 * inch,
                mask="auto", preserveAspectRatio=True, anchor="sw",
            )
        except Exception as e:
            logger.error("seal draw failed: %s", e)

    # Footer: email + website only, stacked vertically
    c.setFillColor(black)
    c.setFont("Helvetica", 9)
    c.drawCentredString(w / 2, 1.12 * inch, "Email: info@veritech-ai.com")
    c.setFillColor(blue)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(w / 2, 0.92 * inch, "www.veritech-ai.com")

    if reg.get("certificate_number"):
        try:
            verify_url = f"{FRONTEND_URL}/verify/{reg['certificate_number']}"
            qr_img = qrcode.make(verify_url)
            qr_buf = io.BytesIO()
            qr_img.save(qr_buf, format="PNG")
            qr_buf.seek(0)
            qr_size = 0.72 * inch
            c.drawImage(ImageReader(qr_buf), right - qr_size, margin + 0.18 * inch,
                        width=qr_size, height=qr_size, mask="auto")
        except Exception as e:
            logger.error("QR generation failed: %s", e)

    c.showPage()
    c.save()
    return buf.getvalue()


def _cors_origins() -> list[str]:
    configured = [item.strip() for item in os.environ.get("CORS_ORIGINS", "*").split(",") if item.strip()]
    if "*" in configured:
        return configured
    for local in (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://certificate.veritech-ai.com",
    ):
        if local not in configured:
            configured.append(local)
    return configured


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins(),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)
