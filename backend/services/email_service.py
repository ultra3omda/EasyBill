import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

# Email configuration: support MAIL_* (Laravel-style) and SMTP_*
SMTP_HOST = os.environ.get('MAIL_HOST') or os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('MAIL_PORT') or os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('MAIL_USERNAME') or os.environ.get('SMTP_USER', '')
SMTP_PASSWORD = os.environ.get('MAIL_PASSWORD') or os.environ.get('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.environ.get('MAIL_FROM_ADDRESS') or os.environ.get('SMTP_FROM_EMAIL', 'noreply@easybill.com')
SMTP_FROM_NAME = os.environ.get('MAIL_FROM_NAME') or os.environ.get('SMTP_FROM_NAME', 'EasyBill')
MAIL_ENCRYPTION = (os.environ.get('MAIL_ENCRYPTION') or '').lower()
# Frontend URL for email links - must be set in production
FRONTEND_URL = os.environ.get('FRONTEND_URL')
if not FRONTEND_URL:
    # Only log warning, don't fail - email features will work but links will be None
    import logging
    logging.warning("FRONTEND_URL not set in environment - email links will not work properly")

class EmailService:
    """Service for sending emails via SMTP"""
    
    def __init__(self):
        self.smtp_host = SMTP_HOST
        self.smtp_port = SMTP_PORT
        self.smtp_user = SMTP_USER
        self.smtp_password = SMTP_PASSWORD
        self.from_email = SMTP_FROM_EMAIL
        self.from_name = SMTP_FROM_NAME
        self.frontend_url = FRONTEND_URL
        self.use_ssl = MAIL_ENCRYPTION == 'ssl' or SMTP_PORT == 465
    
    def _send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send an email via SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            text_content: Plain text content (optional)
        
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, 'plain')
                msg.attach(part1)
            
            part2 = MIMEText(html_content, 'html')
            msg.attach(part2)
            
            # Send email
            if not self.smtp_user or not self.smtp_password:
                logger.warning("SMTP credentials not configured. Email not sent.")
                logger.info(f"Would send email to {to_email}: {subject}")
                return True  # Return True in dev mode
            
            if self.use_ssl:
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_verification_email(self, to_email: str, full_name: str, token: str) -> bool:
        """Send email verification link"""
        verification_link = f"{self.frontend_url}/verify-email?token={token}"
        
        subject = "Vérifiez votre adresse email - EasyBill"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #7c3aed 0%, #f59e0b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ color: white; margin: 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Bienvenue sur EasyBill !</h1>
                </div>
                <div class="content">
                    <p>Bonjour {full_name},</p>
                    <p>Merci de vous être inscrit sur EasyBill. Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
                    <div style="text-align: center;">
                        <a href="{verification_link}" class="button">Vérifier mon email</a>
                    </div>
                    <p>Ou copiez ce lien dans votre navigateur :</p>
                    <p style="word-break: break-all; color: #7c3aed;">{verification_link}</p>
                    <p>Ce lien est valide pendant 24 heures.</p>
                    <p>Si vous n'avez pas créé de compte sur EasyBill, vous pouvez ignorer cet email.</p>
                </div>
                <div class="footer">
                    <p>© 2026 EasyBill - Gestion de facturation pour TPE/PME</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Bienvenue sur EasyBill !
        
        Bonjour {full_name},
        
        Merci de vous être inscrit sur EasyBill. Pour activer votre compte, veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :
        
        {verification_link}
        
        Ce lien est valide pendant 24 heures.
        
        Si vous n'avez pas créé de compte sur EasyBill, vous pouvez ignorer cet email.
        
        © 2026 EasyBill
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_password_reset_email(self, to_email: str, full_name: str, token: str) -> bool:
        """Send password reset link"""
        reset_link = f"{self.frontend_url}/reset-password?token={token}"
        
        subject = "Réinitialisation de votre mot de passe - EasyBill"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #7c3aed 0%, #f59e0b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ color: white; margin: 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .alert {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Réinitialisation de mot de passe</h1>
                </div>
                <div class="content">
                    <p>Bonjour {full_name},</p>
                    <p>Vous avez demandé la réinitialisation de votre mot de passe EasyBill. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                    <div style="text-align: center;">
                        <a href="{reset_link}" class="button">Réinitialiser mon mot de passe</a>
                    </div>
                    <p>Ou copiez ce lien dans votre navigateur :</p>
                    <p style="word-break: break-all; color: #7c3aed;">{reset_link}</p>
                    <div class="alert">
                        <strong>⚠️ Important :</strong> Ce lien est valide pendant 30 minutes seulement.
                    </div>
                    <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.</p>
                </div>
                <div class="footer">
                    <p>© 2026 EasyBill - Gestion de facturation pour TPE/PME</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Réinitialisation de mot de passe - EasyBill
        
        Bonjour {full_name},
        
        Vous avez demandé la réinitialisation de votre mot de passe EasyBill. Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
        
        {reset_link}
        
        ⚠️ Important : Ce lien est valide pendant 30 minutes seulement.
        
        Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
        
        © 2026 EasyBill
        """
        
        return self._send_email(to_email, subject, html_content, text_content)
    
    def send_invoice_email(
        self,
        to_email: str,
        customer_name: str,
        invoice_number: str,
        invoice_total: float,
        invoice_pdf_url: str
    ) -> bool:
        """Send invoice to customer"""
        subject = f"Facture {invoice_number} - EasyBill"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #7c3aed 0%, #f59e0b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ color: white; margin: 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .invoice-info {{ background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }}
                .button {{ display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📄 Nouvelle Facture</h1>
                </div>
                <div class="content">
                    <p>Bonjour {customer_name},</p>
                    <p>Veuillez trouver ci-joint votre facture.</p>
                    <div class="invoice-info">
                        <p><strong>Numéro de facture :</strong> {invoice_number}</p>
                        <p><strong>Montant total :</strong> {invoice_total:.2f} TND</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="{invoice_pdf_url}" class="button">Télécharger la facture (PDF)</a>
                    </div>
                    <p>Merci pour votre confiance.</p>
                </div>
                <div class="footer">
                    <p>© 2026 EasyBill - Gestion de facturation pour TPE/PME</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(to_email, subject, html_content)
    
    def send_quote_email(
        self,
        to_email: str,
        customer_name: str,
        quote_number: str,
        quote_total: float,
        quote_pdf_url: str
    ) -> bool:
        """Send quote to customer"""
        subject = f"Devis {quote_number} - EasyBill"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #7c3aed 0%, #f59e0b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .header h1 {{ color: white; margin: 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .quote-info {{ background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }}
                .button {{ display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📋 Nouveau Devis</h1>
                </div>
                <div class="content">
                    <p>Bonjour {customer_name},</p>
                    <p>Veuillez trouver ci-joint votre devis.</p>
                    <div class="quote-info">
                        <p><strong>Numéro de devis :</strong> {quote_number}</p>
                        <p><strong>Montant total :</strong> {quote_total:.2f} TND</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="{quote_pdf_url}" class="button">Télécharger le devis (PDF)</a>
                    </div>
                    <p>N'hésitez pas à nous contacter pour toute question.</p>
                </div>
                <div class="footer">
                    <p>© 2026 EasyBill - Gestion de facturation pour TPE/PME</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(to_email, subject, html_content)
    
    def send_portal_link_email(
        self,
        to_email: str,
        customer_name: str,
        company_name: str,
        portal_url: str,
        expires_at: str
    ) -> bool:
        """Send customer portal access link"""
        subject = f"Accès à votre espace client - {company_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }}
                .info {{ background: #e8f4f8; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Accès à votre espace client</h1>
                </div>
                <div class="content">
                    <p>Bonjour {customer_name},</p>
                    
                    <p>Bienvenue sur votre espace client personnel de <strong>{company_name}</strong> !</p>
                    
                    <p>Vous pouvez désormais consulter en ligne :</p>
                    <ul>
                        <li>📄 Vos factures</li>
                        <li>💰 Vos paiements</li>
                        <li>📋 Vos devis</li>
                        <li>📊 Votre solde</li>
                    </ul>
                    
                    <div style="text-align: center;">
                        <a href="{portal_url}" class="button">Accéder à mon espace client</a>
                    </div>
                    
                    <div class="info">
                        <strong>⚠️ Important :</strong><br>
                        Ce lien est personnel et sécurisé. Il expire le {expires_at}.<br>
                        Ne le partagez avec personne.
                    </div>
                    
                    <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                    
                    <p>Cordialement,<br>
                    L'équipe {company_name}</p>
                </div>
                <div class="footer">
                    <p>&copy; 2026 {company_name}. Tous droits réservés.</p>
                    <p>Propulsé par EasyBill</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Accès à votre espace client - {company_name}
        
        Bonjour {customer_name},
        
        Bienvenue sur votre espace client personnel de {company_name} !
        
        Vous pouvez désormais consulter en ligne :
        - Vos factures
        - Vos paiements
        - Vos devis
        - Votre solde
        
        Accédez à votre espace client : {portal_url}
        
        Important : Ce lien est personnel et sécurisé. Il expire le {expires_at}.
        Ne le partagez avec personne.
        
        Si vous avez des questions, n'hésitez pas à nous contacter.
        
        Cordialement,
        L'équipe {company_name}
        
        ---
        © 2026 {company_name}. Tous droits réservés.
        Propulsé par EasyBill
        """
        
        return self._send_email(to_email, subject, html_content, text_content)

# Create singleton instance
email_service = EmailService()
