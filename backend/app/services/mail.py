import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """
    Sends HTML email when SMTP_* env vars are set; otherwise logs the link (dev).
    Set: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM
    Optional: SMTP_USE_TLS (default true for port 587)
    """
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    if not smtp_host:
        logger.debug("send_password_reset_email skipped: SMTP_HOST not set")
        return

    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    from_addr = os.environ.get("SMTP_FROM", smtp_user).strip()

    subject = "Reset your Fantasy Cricket password"
    text = f"""Reset your password by opening this link in your browser:

{reset_link}

If you did not request this, you can ignore this email.
"""
    html = f"""<!DOCTYPE html>
<html><body style="font-family: sans-serif;">
  <p>Reset your Fantasy Cricket password by clicking below:</p>
  <p><a href="{reset_link}">{reset_link}</a></p>
  <p style="color:#666;font-size:12px;">If you did not request this, you can ignore this email.</p>
</body></html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        if use_tls:
            server.starttls()
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        server.sendmail(from_addr, [to_email], msg.as_string())

    logger.info("Password reset email sent to %s", to_email)
