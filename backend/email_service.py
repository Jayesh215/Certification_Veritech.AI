"""Email service - Resend payment confirmation with certificate."""
import asyncio
import base64
import html
import logging
import os
from datetime import datetime
from typing import Optional
from urllib.parse import urlencode, urlparse

import resend

logger = logging.getLogger("veritech.email")

SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "Veritech.AI <onboarding@resend.dev>")

def _configure_resend() -> str:
    key = os.environ.get("RESEND_API_KEY", "").strip()
    if key:
        resend.api_key = key
    return key


def _esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _date_label(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").strftime("%d %b %Y")
    except ValueError:
        return raw


def _duration_label(months, start: str = "", end: str = "") -> str:
    try:
        n = int(months)
    except (TypeError, ValueError):
        return ""
    if n == 0:
        label = "1 Day"
    elif n == 1:
        label = "1 Month"
    else:
        label = f"{n} Months"
    start_label = _date_label(start)
    end_label = _date_label(end)
    if start_label and end_label:
        return f"{label} ({start_label} – {end_label})"
    return label


def _linkedin_certification_url(reg: dict, tracker_url: str) -> str:
    cert_id = str(reg.get("certificate_number") or "").strip()
    parsed = urlparse(tracker_url or "")
    if not cert_id or not parsed.scheme or not parsed.netloc:
        return ""
    issued = reg.get("certificate_generated_at") or reg.get("paid_at") or ""
    year = month = ""
    try:
        issued_dt = datetime.fromisoformat(str(issued).replace("Z", "+00:00"))
        year = str(issued_dt.year)
        month = str(issued_dt.month)
    except ValueError:
        pass
    role = str(reg.get("internship_type") or "").strip()
    name = f"{role} Internship" if role else (reg.get("certificate_type") or "Internship Certificate")
    params = {
        "startTask": "CERTIFICATION_NAME",
        "name": name,
        "organizationName": "Veritech.AI",
        "certUrl": f"{parsed.scheme}://{parsed.netloc}/verify/{cert_id}",
        "certId": cert_id,
    }
    if year and month:
        params["issueYear"] = year
        params["issueMonth"] = month
    return f"https://www.linkedin.com/profile/add?{urlencode(params)}"


def _payment_success_html(reg: dict, tracker_url: str) -> str:
    duration = _duration_label(
        reg.get("duration_months"),
        reg.get("internship_start_date") or "",
        reg.get("internship_end_date") or "",
    )
    tracker = _esc(tracker_url)
    linkedin = _esc(_linkedin_certification_url(reg, tracker_url))
    linkedin_button = ""
    if linkedin:
        linkedin_button = f"""
              <a href="{linkedin}" style="display:inline-block;background:#0A66C2;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:12px;margin-left:8px;">
                in &nbsp;Add to LinkedIn
              </a>"""
    return f"""
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:32px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr><td style="background:#0F172A;padding:24px;">
            <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Veritech<span style="color:#3B82F6;">.AI</span></div>
            <div style="color:#94A3B8;font-size:11px;font-weight:600;letter-spacing:2px;margin-top:6px;">PAYMENT CONFIRMATION</div>
          </td></tr>
          <tr><td style="padding:32px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#0F172A;">Payment confirmed</h1>
            <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
              Hello <strong>{_esc(reg.get('full_name'))}</strong>, your Veritech.AI certificate payment is complete.
              Your certificate is attached to this email.
            </p>
            <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;">
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;">Registration ID</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;">{_esc(reg.get('registration_id'))}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Payment ID</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{_esc(reg.get('razorpay_payment_id'))}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Duration</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{_esc(duration)}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Certificate</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{_esc(reg.get('certificate_type') or 'Internship Certificate')}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Amount Paid</td>
                  <td style="padding:14px 18px;color:#2563EB;font-size:16px;font-weight:800;text-align:right;border-top:1px solid #F1F5F9;">Rs. {int(reg.get('amount') or 0)}</td></tr>
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="{tracker}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:12px;">
                Track your certificate
              </a>
              {linkedin_button}
            </div>
            <p style="margin:16px 0 0;color:#64748B;font-size:12px;line-height:1.6;text-align:center;">
              Or open this link: <a href="{tracker}" style="color:#2563EB;">{tracker}</a>
            </p>
          </td></tr>
          <tr><td style="background:#F8FAFC;padding:18px 24px;color:#94A3B8;font-size:11px;text-align:center;">
            © 2026 Veritech.AI · AI • Software • Technology
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


def _payment_success_text(reg: dict, tracker_url: str) -> str:
    linkedin = _linkedin_certification_url(reg, tracker_url)
    linkedin_line = f"\nAdd this certificate to LinkedIn: {linkedin}\n" if linkedin else ""
    return (
        f"Hello {reg.get('full_name') or ''},\n\n"
        "Your Veritech.AI certificate payment is confirmed. "
        "The certificate is attached.\n\n"
        f"Registration ID: {reg.get('registration_id') or ''}\n"
        f"Payment ID: {reg.get('razorpay_payment_id') or ''}\n"
        f"Duration: {_duration_label(reg.get('duration_months'), reg.get('internship_start_date') or '', reg.get('internship_end_date') or '')}\n"
        f"Certificate: {reg.get('certificate_type') or 'Internship Certificate'}\n"
        f"Amount paid: Rs. {int(reg.get('amount') or 0)}\n\n"
        f"Track your certificate: {tracker_url}\n"
        f"{linkedin_line}"
    )


async def send_payment_success_email(
    reg: dict,
    *,
    certificate_pdf: Optional[bytes] = None,
    tracker_url: str = "",
) -> Optional[str]:
    if not _configure_resend():
        logger.info("Resend disabled — skipping email for %s", reg.get("registration_id"))
        return None
    if not reg.get("email"):
        return None

    reg_id = reg.get("registration_id") or "registration"
    attachments = []
    if certificate_pdf:
        attachments.append({
            "filename": f"{reg_id}-certificate.pdf",
            "content": base64.b64encode(certificate_pdf).decode(),
            "content_type": "application/pdf",
        })

    params = {
        "from": SENDER_EMAIL,
        "to": [reg["email"]],
        "subject": f"Payment confirmed — {reg_id}",
        "html": _payment_success_html(reg, tracker_url),
        "text": _payment_success_text(reg, tracker_url),
        "attachments": attachments,
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        eid = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        logger.info("Email sent to %s (id=%s)", reg["email"], eid)
        return eid
    except Exception as e:
        logger.error("Resend send failed: %s", e)
        return None
