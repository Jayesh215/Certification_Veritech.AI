"""Email service - Resend payment confirmation and pending reminders."""
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


def _pending_reminder_html(reg: dict, cta_url: str) -> str:
    duration = _duration_label(
        reg.get("duration_months"),
        reg.get("internship_start_date") or "",
        reg.get("internship_end_date") or "",
    )
    status = str(reg.get("payment_status") or "PENDING").upper()
    status_line = (
        "Your registration is ready, but payment is still pending."
        if status == "PENDING"
        else "Your previous payment attempt did not complete."
    )
    cta = _esc(cta_url)
    return f"""
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:32px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr><td style="background:#0F172A;padding:24px;">
            <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Veritech<span style="color:#3B82F6;">.AI</span></div>
            <div style="color:#94A3B8;font-size:11px;font-weight:600;letter-spacing:2px;margin-top:6px;">COMPLETE YOUR CERTIFICATE</div>
          </td></tr>
          <tr><td style="padding:32px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;color:#0F172A;">Grab your certificate instantly</h1>
            <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
              Hello <strong>{_esc(reg.get('full_name'))}</strong>, {_esc(status_line)}
              Finish payment now and download your official Veritech.AI internship certificate right away.
            </p>
            <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;margin-bottom:20px;">
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;">Registration ID</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;">{_esc(reg.get('registration_id'))}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Internship</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{_esc(reg.get('internship_type') or '')}</td></tr>
              <tr><td style="padding:14px 18px;color:#64748B;font-size:13px;border-top:1px solid #F1F5F9;">Duration</td>
                  <td style="padding:14px 18px;color:#0F172A;font-size:13px;font-weight:700;text-align:right;border-top:1px solid #F1F5F9;">{_esc(duration)}</td></tr>
            </table>
            <h2 style="margin:0 0 10px;font-size:16px;color:#0F172A;">Why this certificate matters</h2>
            <ul style="margin:0 0 22px;padding-left:18px;color:#475569;font-size:14px;line-height:1.7;">
              <li>It is official proof you finished a Veritech.AI internship, with your role and dates on record.</li>
              <li>Hiring teams at larger technology companies look for fresher profiles that already show real work experience.</li>
              <li>Each certificate includes a QR code employers can scan to verify it was issued by Veritech.AI.</li>
              <li>You can attach it to campus forms, resumes, and LinkedIn while you apply.</li>
            </ul>
            <div style="text-align:center;">
              <a href="{cta}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;border-radius:12px;">
                Grab your certificate instantly
              </a>
            </div>
            <p style="margin:16px 0 0;color:#64748B;font-size:12px;line-height:1.6;text-align:center;">
              Or open this link: <a href="{cta}" style="color:#2563EB;">{cta}</a>
            </p>
          </td></tr>
          <tr><td style="background:#F8FAFC;padding:18px 24px;color:#94A3B8;font-size:11px;text-align:center;">
            © 2026 Veritech.AI · AI • Software • Technology
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


def _pending_reminder_text(reg: dict, cta_url: str) -> str:
    status = str(reg.get("payment_status") or "PENDING").upper()
    status_line = (
        "Your registration is ready, but payment is still pending."
        if status == "PENDING"
        else "Your previous payment attempt did not complete."
    )
    return (
        f"Hello {reg.get('full_name') or ''},\n\n"
        f"{status_line} Grab your certificate instantly by completing payment now.\n\n"
        "Why this certificate matters:\n"
        "- Official proof you finished a Veritech.AI internship, with role and dates on record\n"
        "- Helps fresher resumes stand out to hiring teams at larger technology companies\n"
        "- Includes a QR code employers can verify\n"
        "- Ready to attach to campus forms, resumes, and LinkedIn\n\n"
        f"Registration ID: {reg.get('registration_id') or ''}\n"
        f"Internship: {reg.get('internship_type') or ''}\n"
        f"Duration: {_duration_label(reg.get('duration_months'), reg.get('internship_start_date') or '', reg.get('internship_end_date') or '')}\n\n"
        f"Grab your certificate instantly: {cta_url}\n"
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


async def send_pending_reminder_email(reg: dict, *, cta_url: str = "") -> Optional[str]:
    if not _configure_resend():
        logger.info("Resend disabled — skipping reminder for %s", reg.get("registration_id"))
        return None
    if not reg.get("email"):
        return None

    reg_id = reg.get("registration_id") or "registration"
    params = {
        "from": SENDER_EMAIL,
        "to": [reg["email"]],
        "subject": f"Grab your Veritech.AI certificate instantly — {reg_id}",
        "html": _pending_reminder_html(reg, cta_url),
        "text": _pending_reminder_text(reg, cta_url),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        eid = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        logger.info("Reminder email sent to %s (id=%s)", reg["email"], eid)
        return eid
    except Exception as e:
        logger.error("Resend reminder failed: %s", e)
        return None


def _intern_claim_invite_html(intern: dict, *, claim_url: str, site_url: str) -> str:
    name = _esc(intern.get("full_name") or "Intern")
    claim = _esc(claim_url)
    site = _esc(site_url)
    return f"""
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:32px 0;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr><td style="background:#0F172A;padding:24px;">
            <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">VeriTech<span style="color:#3B82F6;">.AI</span></div>
            <div style="color:#94A3B8;font-size:11px;font-weight:600;letter-spacing:2px;margin-top:6px;">INTERNSHIP CERTIFICATE</div>
          </td></tr>
          <tr><td style="padding:32px 24px;color:#475569;font-size:14px;line-height:1.7;">
            <p style="margin:0 0 16px;color:#0F172A;">Dear <strong>{name}</strong>,</p>
            <p style="margin:0 0 16px;">
              As we approach the final stage of our internship journey, Team VeriTech.AI would like to express our sincere
              gratitude for your hard work, dedication, and commitment. Your contributions and efforts throughout the
              internship are truly appreciated.
            </p>
            <p style="margin:0 0 16px;">
              We are delighted to announce that all interns are eligible to receive their Internship Certificate!
            </p>
            <h2 style="margin:0 0 10px;font-size:18px;color:#0F172A;">Grab your internship certificate instantly!</h2>
            <p style="margin:0 0 18px;">
              Take the next step in your professional journey by registering for your official internship certificate.
              The registration process is simple, and you can receive your certificate instantly upon successful registration.
            </p>
            <div style="text-align:center;margin:0 0 22px;">
              <a href="{claim}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;border-radius:12px;">
                Register for your internship certificate
              </a>
            </div>
            <p style="margin:0 0 18px;font-size:13px;">
              Register here:<br/>
              <a href="{claim}" style="color:#2563EB;word-break:break-all;">{claim}</a>
            </p>
            <h2 style="margin:0 0 10px;font-size:16px;color:#0F172A;">Why is your internship certificate important?</h2>
            <ul style="margin:0 0 18px;padding-left:18px;">
              <li style="margin-bottom:8px;"><strong>Showcase practical experience:</strong> Highlight your hands-on project experience to potential employers.</li>
              <li style="margin-bottom:8px;"><strong>Strengthen your resume:</strong> Add value to your professional profile and job applications.</li>
              <li style="margin-bottom:8px;"><strong>Validate your skills:</strong> Demonstrate your commitment to learning and professional development.</li>
              <li style="margin-bottom:8px;"><strong>Boost your career opportunities:</strong> Support your journey toward future jobs, higher education, and new opportunities.</li>
            </ul>
            <p style="margin:0 0 16px;padding:12px 14px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;color:#92400E;">
              <strong>Registration deadline: 31st October 2026</strong><br/>
              Don't miss this opportunity! Complete your registration before the deadline and take pride in your internship achievements.
            </p>
            <p style="margin:0 0 16px;">
              Learn more about the importance and benefits of your VeriTech.AI internship certificate:<br/>
              <a href="{site}" style="color:#2563EB;">{site}</a>
            </p>
            <p style="margin:0 0 16px;">
              Once again, thank you for being a part of the VeriTech.AI internship program. We wish you continued success
              in your career and future endeavors!
            </p>
            <p style="margin:0;color:#0F172A;">
              Best Regards,<br/>
              <strong>HR Team</strong><br/>
              Email: <a href="mailto:hr@veritech-ai.com" style="color:#2563EB;">hr@veritech-ai.com</a>
              &nbsp;|&nbsp;
              <a href="https://www.veritech-ai.com" style="color:#2563EB;">www.veritech-ai.com</a>
            </p>
          </td></tr>
          <tr><td style="background:#F8FAFC;padding:18px 24px;color:#94A3B8;font-size:11px;text-align:center;">
            © 2026 VeriTech.AI · AI • Software • Technology
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


def _intern_claim_invite_text(intern: dict, *, claim_url: str, site_url: str) -> str:
    name = intern.get("full_name") or "Intern"
    return (
        f"Dear {name},\n\n"
        "As we approach the final stage of our internship journey, Team VeriTech.AI would like to express our sincere "
        "gratitude for your hard work, dedication, and commitment. Your contributions and efforts throughout the "
        "internship are truly appreciated.\n\n"
        "We are delighted to announce that all interns are eligible to receive their Internship Certificate!\n\n"
        "GRAB YOUR INTERNSHIP CERTIFICATE INSTANTLY!\n\n"
        "Take the next step in your professional journey by registering for your official internship certificate. "
        "The registration process is simple, and you can receive your certificate instantly upon successful registration.\n\n"
        f"Register for Your Internship Certificate:\n{claim_url}\n\n"
        "Why Is Your Internship Certificate Important?\n"
        "- Showcase Practical Experience: Highlight your hands-on project experience to potential employers.\n"
        "- Strengthen Your Resume: Add value to your professional profile and job applications.\n"
        "- Validate Your Skills: Demonstrate your commitment to learning and professional development.\n"
        "- Boost Your Career Opportunities: Support your journey toward future jobs, higher education, and new opportunities.\n\n"
        "Registration Deadline: 31st October 2026\n\n"
        "Don't miss this opportunity! Complete your registration before the deadline and take pride in your internship achievements.\n\n"
        f"Learn more about the importance and benefits of your VeriTech.AI internship certificate:\n{site_url}\n\n"
        "Once again, thank you for being a part of the VeriTech.AI internship program. We wish you continued success "
        "in your career and future endeavors!\n\n"
        "Best Regards,\n"
        "HR Team\n"
        "Email: hr@veritech-ai.com | www.veritech-ai.com\n"
    )


async def send_intern_claim_invite_email(
    intern: dict,
    *,
    claim_url: str = "",
    status_url: str = "",
    site_url: str = "",
) -> Optional[str]:
    if not _configure_resend():
        logger.info("Resend disabled — skipping claim invite for %s", intern.get("intern_id"))
        return None
    to_email = (intern.get("email") or "").strip()
    if not to_email:
        return None

    site = (site_url or status_url or "").rstrip("/") or "https://certificate.veritech-ai.com"
    register_url = claim_url or f"{site}/register"
    name = (intern.get("full_name") or "Intern").strip()
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": f"Grab your VeriTech.AI internship certificate instantly — {name}",
        "html": _intern_claim_invite_html(intern, claim_url=register_url, site_url=site),
        "text": _intern_claim_invite_text(intern, claim_url=register_url, site_url=site),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        eid = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        logger.info("Claim invite sent to %s for %s (id=%s)", to_email, intern.get("intern_id"), eid)
        return eid
    except Exception as e:
        logger.error("Resend claim invite failed for %s: %s", to_email, e)
        return None
