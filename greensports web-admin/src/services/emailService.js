import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';

export const emailService = {
  /**
   * Send password reset email using Firebase Auth (guaranteed to deliver official password reset links)
   */
  async sendPasswordReset(email) {
    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail) throw new Error('Please enter a valid email address.');

    // 1. Send official Firebase Auth password reset email
    await sendPasswordResetEmail(auth, trimmedEmail);

    // 2. Also attempt Resend notification if configured
    try {
      if (RESEND_API_KEY) {
        await this.sendCustomEmail({
          to: trimmedEmail,
          subject: 'OurSideHQ - Password Reset Request',
          html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #0b1724; color: #ffffff; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #10b981; margin: 0; font-size: 26px;">OurSideHQ</h1>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">GreenSports Platform Notification</p>
              </div>
              <div style="background: rgba(255, 255, 255, 0.05); padding: 24px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <h2 style="font-size: 18px; margin-top: 0; color: #ffffff;">Password Reset Request</h2>
                <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                  We received a request to reset your password for your OurSideHQ account. A secure reset link has been dispatched to this email address.
                </p>
                <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                  If you did not request this, please ignore this email or reach out to your club administrator.
                </p>
              </div>
              <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
                &copy; ${new Date().getFullYear()} OurSideHQ / GreenSports Network. All rights reserved.
              </div>
            </div>
          `
        });
      }
    } catch (resendErr) {
      // Non-fatal if direct Resend call from browser is restricted by CORS
      console.warn('Resend notification notice:', resendErr.message);
    }

    return true;
  },

  /**
   * Direct email dispatch via Resend REST API (using dev proxy or direct endpoint)
   */
  async sendCustomEmail({ to, subject, html, from = 'OurSideHQ <onboarding@resend.dev>' }) {
    if (!RESEND_API_KEY) return false;

    // Use local proxy in dev or browser to avoid CORS preflight rejection
    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const endpoint = isDev ? '/api/resend/emails' : 'https://api.resend.com/emails';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Resend API notice:', response.status, errorData);
      }
      return true;
    } catch (err) {
      console.warn('Resend email notice (handled gracefully):', err.message);
      return false;
    }
  }
};
