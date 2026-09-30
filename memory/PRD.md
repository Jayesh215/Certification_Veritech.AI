# Veritech.AI Certificate Registration Portal — PRD

## Overview
Certificate registration + payment portal for Veritech.AI interns.  Interns register their internship details, choose a certificate duration, pay via Razorpay, and download a PDF certificate. Admin dashboard for managing registrations, payments, and certificates.

## Stack
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + sonner
- Backend: FastAPI + Motor (MongoDB) + Razorpay + reportlab (PDF) + JWT (admin auth)
- Storage: MongoDB (`veritech_portal` database)

## User personas
1. **Intern** — registers via public link, pays for certificate, downloads receipt & PDF certificate
2. **Admin** (Veritech.AI staff) — reviews registrations, tracks revenue, generates certificates

## Core flows (implemented)
- Landing → Register (with `?intern=VT-...` prefill) → Review → Payment (4 plans) → Razorpay (mock in placeholder-key mode) → Success → Download receipt + certificate
- Status lookup by registration ID or email
- Admin login (JWT), dashboard KPIs, registrations table with filters, payments ledger, certificate management (generate/download)

## Business rules
- Prices come from DB (`plans` collection) — not frontend. 1M/₹99, 2M/₹149, 3M/₹199 (Popular), 6M/₹499
- Registration IDs: `VT-YYYY-######` from an atomic counter
- Payment status flows: PENDING → PAID / FAILED
- Certificate can be generated only after PAID
- Razorpay signature verified backend-side (HMAC-SHA256, timing-safe)
- Placeholder Razorpay keys → auto-switch to mock mode (`/api/payments/mock-complete`)

## Admin
- Email: `jayeshgangurde15@gmail.com`
- Password: `Jayesh@123`
- Seeded on backend startup via bcrypt

## What's implemented (Sept 2026)
- All 13 pages from spec
- 4-step stepper, form validation, mobile responsive
- Razorpay integration (mock + real), signature verification, mock-complete for placeholder keys
- PDF receipt and PDF certificate via reportlab (A4/landscape)
- JWT-guarded admin routes; auth-aware API client
- Seed script (plans + admin) runs on startup
- MongoDB indexes on `registration_id` (unique) and `email`

## Backlog / Next
- P0: Wire real Razorpay live keys once provided
- P1: Email confirmations via Resend (templates ready in spec; SMTP not integrated)
- P1: Bulk export CSV from admin
- P2: Custom certificate template designer / QR verification page
- P2: Rate limiting on public endpoints
- P2: Refund flow from admin

## Test credentials
See `/app/memory/test_credentials.md`
