"""Email service - Resend integration with graceful degradation."""
import asyncio
import logging
import os
from typing import Optional

import resend

logger = logging.getLogger("veritech.email")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "Veritech.AI <onboarding@resend.dev>")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _payment_success_html(reg: dict) -> str:
    return f"""
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:32px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr><td style="background:#0F172A;padding:24px;">
            <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Veritech<span style="color:#3B82F6;">.AI</span></div>
            <div style="color:#94A3B8;font-size:11px;font-weight:600;letter-spacing:2px;margin-top:6px;">CERTIFICATE REGISTRATION</div>
          </td></tr>
          <tr><td style="padding:32px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#0F172A;">Payment confirmed 🎉</h1>
            <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
              Hello <strong>{reg.get('full_name','')}</strong>, your Veritech.AI certificate registration has been successfully completed.
            </p>
            <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;">
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;">Registration ID</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;">{reg.get('registration_id','')}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Certificate</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{reg.get('certificate_type','Internship Certificate')}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Duration</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{('1 Day' if reg.get('duration_months') == 0 else f"{reg.get('duration_months','')} Month(s)")}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Payment ID</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{reg.get('razorpay_payment_id','')}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Amount Paid</td>
                  <td style="padding:14px 18px;color:#2563EB;font-size:16px;font-weight:800;text-align:right;border-top:1px solid #F1F5F9;">₹{int(reg.get('amount',0))}</td></tr>
            </table>
            <p style="margin:24px 0 0;color:#64748B;font-size:12px;line-height:1.6;">
              Your certificate will be issued to this email address. You can verify its authenticity anytime at Veritech.AI.
            </p>
          </td></tr>
          <tr><td style="background:#F8FAFC;padding:18px 24px;color:#94A3B8;font-size:11px;text-align:center;">
            © 2026 Veritech.AI · AI • Software • Technology
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def send_payment_success_email(reg: dict) -> Optional[str]:
    if not RESEND_API_KEY:
        logger.info("Resend disabled — skipping email for %s", reg.get("registration_id"))
        return None
    if not reg.get("email"):
        return None
    params = {
        "from": SENDER_EMAIL,
        "to": [reg["email"]],
        "subject": "Veritech.AI Certificate Registration Confirmed",
        "html": _payment_success_html(reg),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        eid = result.get("id") if isinstance(result, dict) else None
        logger.info("Email sent to %s (id=%s)", reg["email"], eid)
        return eid
    except Exception as e:
        logger.error("Resend send failed: %s", e)
        return None
