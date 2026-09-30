"""Backend API smoke + coverage tests for Veritech.AI Portal."""
import requests
import json
import sys
import time

BASE = "https://veritech-intern.preview.emergentagent.com/api"
ADMIN_EMAIL = "jayeshgangurde15@gmail.com"
ADMIN_PASSWORD = "Jayesh@123"

results = {"passed": [], "failed": []}

def rec(name, ok, detail=""):
    if ok:
        results["passed"].append(name)
        print(f"[PASS] {name}")
    else:
        results["failed"].append({"name": name, "detail": detail})
        print(f"[FAIL] {name} :: {detail}")

# 1. GET /api/plans
try:
    r = requests.get(f"{BASE}/plans", timeout=15)
    plans = r.json()
    prices = {p["duration_months"]: p["price"] for p in plans}
    ok = (r.status_code == 200 and len(plans) == 4 and prices.get(1) == 99
          and prices.get(2) == 149 and prices.get(3) == 199 and prices.get(6) == 499)
    pop = next((p for p in plans if p["duration_months"] == 3), {})
    ok = ok and pop.get("popular") is True
    rec("GET /plans returns 4 plans w/ correct prices & 3M popular", ok, json.dumps(plans)[:200])
except Exception as e:
    rec("GET /plans", False, str(e))

# 2. POST /api/registrations validation
sample_reg = {
    "full_name": "Test Intern",
    "email": f"testintern_{int(time.time())}@example.com",
    "mobile": "9876543210",
    "college_name": "Test College",
    "branch": "CSE",
    "year": "3rd",
    "internship_domain": "AI/ML",
    "start_date": "2026-01-01",
    "end_date": "2026-02-01",
    "duration_months": 1,
    "declaration_accepted": True,
}

# invalid mobile
try:
    bad = dict(sample_reg); bad["mobile"] = "123"
    r = requests.post(f"{BASE}/registrations", json=bad, timeout=15)
    rec("POST /registrations rejects invalid mobile", r.status_code in (400,422), f"{r.status_code} {r.text[:150]}")
except Exception as e:
    rec("POST /registrations invalid mobile", False, str(e))

# invalid email
try:
    bad = dict(sample_reg); bad["email"] = "notanemail"
    r = requests.post(f"{BASE}/registrations", json=bad, timeout=15)
    rec("POST /registrations rejects invalid email", r.status_code in (400,422), f"{r.status_code}")
except Exception as e:
    rec("POST /registrations invalid email", False, str(e))

# invalid duration
try:
    bad = dict(sample_reg); bad["duration_months"] = 4
    r = requests.post(f"{BASE}/registrations", json=bad, timeout=15)
    rec("POST /registrations rejects invalid duration", r.status_code in (400,422), f"{r.status_code}")
except Exception as e:
    rec("POST /registrations invalid duration", False, str(e))

# declaration false
try:
    bad = dict(sample_reg); bad["declaration_accepted"] = False
    r = requests.post(f"{BASE}/registrations", json=bad, timeout=15)
    rec("POST /registrations rejects declaration=false", r.status_code in (400,422), f"{r.status_code}")
except Exception as e:
    rec("POST /registrations declaration false", False, str(e))

# create valid registration #1
reg_id_1 = None
try:
    r = requests.post(f"{BASE}/registrations", json=sample_reg, timeout=15)
    data = r.json()
    reg_id_1 = data.get("registration_id") or data.get("id")
    ok = r.status_code in (200,201) and reg_id_1 and reg_id_1.startswith("VT-")
    rec("POST /registrations creates registration with VT-YYYY-###### ID", ok, f"{r.status_code} {data}"[:250])
except Exception as e:
    rec("POST /registrations valid", False, str(e))

# create #2 for sequential ID check
reg_id_2 = None
try:
    s2 = dict(sample_reg); s2["email"] = f"testintern2_{int(time.time())}@example.com"
    r = requests.post(f"{BASE}/registrations", json=s2, timeout=15)
    data = r.json()
    reg_id_2 = data.get("registration_id") or data.get("id")
    # extract number
    n1 = int(reg_id_1.split("-")[-1]) if reg_id_1 else 0
    n2 = int(reg_id_2.split("-")[-1]) if reg_id_2 else 0
    rec("Sequential unique registration IDs", n2 == n1 + 1, f"{reg_id_1} -> {reg_id_2}")
except Exception as e:
    rec("Sequential IDs", False, str(e))

# 3. GET /api/registrations/{id}
try:
    r = requests.get(f"{BASE}/registrations/{reg_id_1}", timeout=15)
    rec("GET /registrations/{id}", r.status_code == 200 and r.json().get("registration_id") == reg_id_1, f"{r.status_code}")
except Exception as e:
    rec("GET /registrations/{id}", False, str(e))

# 4. POST /api/payments/order
try:
    r = requests.post(f"{BASE}/payments/order", json={"registration_id": reg_id_1}, timeout=15)
    d = r.json()
    ok = (r.status_code == 200 and d.get("mock") is True and d.get("order_id")
          and d.get("amount") == 9900 and d.get("key_id") and d.get("prefill"))
    rec("POST /payments/order mock mode", ok, json.dumps(d)[:250])
except Exception as e:
    rec("POST /payments/order", False, str(e))

# 5. POST /api/payments/mock-complete success
try:
    r = requests.post(f"{BASE}/payments/mock-complete",
                     json={"registration_id": reg_id_1, "success": True}, timeout=15)
    d = r.json()
    ok = r.status_code == 200 and d.get("payment_id","").startswith(("pay_mock","mock"))
    rec("POST /payments/mock-complete success=true", ok, json.dumps(d)[:200])
    # verify PAID
    r2 = requests.get(f"{BASE}/registrations/{reg_id_1}", timeout=15)
    rd = r2.json()
    ok2 = rd.get("payment_status") == "PAID" and rd.get("paid_at") and rd.get("razorpay_payment_id")
    rec("Registration marked PAID with paid_at & payment_id", ok2, json.dumps(rd)[:250])
except Exception as e:
    rec("mock-complete success flow", False, str(e))

# 6. POST /api/payments/mock-complete failure on reg_id_2
try:
    r = requests.post(f"{BASE}/payments/mock-complete",
                     json={"registration_id": reg_id_2, "success": False}, timeout=15)
    r2 = requests.get(f"{BASE}/registrations/{reg_id_2}", timeout=15)
    rec("mock-complete success=false marks FAILED", r2.json().get("payment_status") == "FAILED", r2.text[:200])
except Exception as e:
    rec("mock-complete failure", False, str(e))

# 7. Status lookup
try:
    r = requests.get(f"{BASE}/registrations/status/lookup", params={"query": reg_id_1}, timeout=15)
    rec("Status lookup by ID", r.status_code == 200 and r.json().get("registration_id") == reg_id_1, f"{r.status_code}")
    r = requests.get(f"{BASE}/registrations/status/lookup", params={"query": sample_reg["email"]}, timeout=15)
    rec("Status lookup by email", r.status_code == 200 and r.json().get("registration_id") == reg_id_1, f"{r.status_code}")
except Exception as e:
    rec("Status lookup", False, str(e))

# 8. Admin login
token = None
try:
    r = requests.post(f"{BASE}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    token = r.json().get("access_token") or r.json().get("token")
    rec("Admin login valid credentials", r.status_code == 200 and token, f"{r.status_code} {r.text[:150]}")
    r = requests.post(f"{BASE}/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
    rec("Admin login wrong creds -> 401", r.status_code == 401, f"{r.status_code}")
except Exception as e:
    rec("Admin login", False, str(e))

H = {"Authorization": f"Bearer {token}"} if token else {}

# 9. Admin routes auth
for path in ["/admin/dashboard", "/admin/registrations", "/admin/payments"]:
    try:
        r = requests.get(f"{BASE}{path}", timeout=15)
        rec(f"{path} without token -> 401/403", r.status_code in (401,403), f"{r.status_code}")
        r = requests.get(f"{BASE}{path}", headers=H, timeout=15)
        rec(f"{path} with token -> 200", r.status_code == 200, f"{r.status_code} {r.text[:150]}")
    except Exception as e:
        rec(f"{path}", False, str(e))

# 10. Dashboard KPIs
try:
    r = requests.get(f"{BASE}/admin/dashboard", headers=H, timeout=15)
    d = r.json()
    ok = r.status_code == 200 and d.get("total_registrations", 0) >= 2 and d.get("paid", d.get("total_paid",0)) >= 1
    rec("Dashboard KPI counts reflect data", ok, json.dumps(d)[:300])
except Exception as e:
    rec("Dashboard KPIs", False, str(e))

# 11. Admin registrations filters
try:
    r = requests.get(f"{BASE}/admin/registrations", headers=H, params={"search": sample_reg["email"]}, timeout=15)
    rec("Admin registrations search filter", r.status_code == 200 and len(r.json()) >= 1, f"{r.status_code}")
    r = requests.get(f"{BASE}/admin/registrations", headers=H, params={"payment_status": "PAID"}, timeout=15)
    regs = r.json()
    rec("Admin registrations payment_status filter", r.status_code == 200 and all(x.get("payment_status") == "PAID" for x in regs), f"{len(regs)} results")
    r = requests.get(f"{BASE}/admin/registrations", headers=H, params={"duration_months": 1}, timeout=15)
    rec("Admin registrations duration filter", r.status_code == 200, f"{r.status_code}")
except Exception as e:
    rec("Admin registrations filters", False, str(e))

# 12. Admin payments
try:
    r = requests.get(f"{BASE}/admin/payments", headers=H, timeout=15)
    payments = r.json()
    ok = r.status_code == 200 and isinstance(payments, list)
    # check joined data - first payment should have some registration info
    joined = ok and (len(payments) == 0 or any(k in payments[0] for k in ("full_name","email","registration_id")))
    rec("Admin payments returns joined data", ok and joined, json.dumps(payments[:1])[:300])
except Exception as e:
    rec("Admin payments", False, str(e))

# 13. Certificate generate
try:
    r = requests.post(f"{BASE}/admin/certificates/{reg_id_1}/generate", headers=H, timeout=15)
    d = r.json()
    ok = r.status_code == 200 and d.get("certificate_number")
    rec("Generate certificate for PAID", ok, json.dumps(d)[:200])
    # unpaid
    r = requests.post(f"{BASE}/admin/certificates/{reg_id_2}/generate", headers=H, timeout=15)
    rec("Generate certificate on unpaid -> 400", r.status_code == 400, f"{r.status_code} {r.text[:150]}")
except Exception as e:
    rec("Certificate generate", False, str(e))

# 14. Certificate download
try:
    r = requests.get(f"{BASE}/certificates/{reg_id_1}/download", timeout=20)
    ct = r.headers.get("content-type","")
    rec("Certificate download PAID -> PDF", r.status_code == 200 and "pdf" in ct, f"{r.status_code} {ct}")
    r = requests.get(f"{BASE}/certificates/{reg_id_2}/download", timeout=20)
    rec("Certificate download unpaid -> 400", r.status_code == 400, f"{r.status_code}")
except Exception as e:
    rec("Certificate download", False, str(e))

# 15. Receipt download
try:
    r = requests.get(f"{BASE}/receipts/{reg_id_1}/download", timeout=20)
    ct = r.headers.get("content-type","")
    rec("Receipt download PAID -> PDF", r.status_code == 200 and "pdf" in ct, f"{r.status_code} {ct}")
except Exception as e:
    rec("Receipt download", False, str(e))

# 16. Signature verification with invalid sig
try:
    payload = {
        "registration_id": reg_id_2,
        "razorpay_order_id": "order_fake",
        "razorpay_payment_id": "pay_fake",
        "razorpay_signature": "invalid_sig"
    }
    r = requests.post(f"{BASE}/payments/verify", json=payload, timeout=15)
    rec("Signature verify invalid -> 400", r.status_code == 400, f"{r.status_code} {r.text[:200]}")
except Exception as e:
    rec("Signature verify", False, str(e))

print("\n=== SUMMARY ===")
print(f"Passed: {len(results['passed'])}")
print(f"Failed: {len(results['failed'])}")
for f in results["failed"]:
    print(f"  - {f['name']}: {f['detail'][:200]}")
