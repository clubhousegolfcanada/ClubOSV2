/**
 * BookingNotificationService
 *
 * Handles all booking-related notifications including email, SMS, and in-app notifications.
 * Manages confirmation emails, reminders, cancellations, and staff alerts.
 */

import { logger } from '../../utils/logger';
import { db } from '../../utils/database';
import {
  DbBooking,
  BookingNotification,
  NotificationType,
  NotificationPriority,
  CustomerTier
} from '../../types/booking';
import { format, addHours, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import * as nodemailer from 'nodemailer';
import { openPhoneService } from '../openphoneService';

export class BookingNotificationService {
  private static emailTransporter: nodemailer.Transporter | null = null;
  private static openPhoneService = openPhoneService;
  private static readonly TIMEZONE = 'America/New_York';

  /**
   * Initialize the notification service
   */
  static async initialize(): Promise<void> {
    try {
      // Initialize email transporter
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        // Verify transporter
        await this.emailTransporter.verify();
        logger.info('Email transporter initialized successfully');
      } else {
        logger.warn('Email configuration missing, notifications will be logged only');
      }

      logger.info('BookingNotificationService initialized');
    } catch (error) {
      logger.error('Failed to initialize BookingNotificationService:', error);
    }
  }

  /**
   * Send booking confirmation
   */
  static async sendBookingConfirmation(booking: DbBooking): Promise<void> {
    try {
      logger.info('Sending booking confirmation', { bookingId: booking.id });

      // Get location and space details
      const locationResult = await db.query(
        'SELECT * FROM locations WHERE id = $1',
        [booking.location_id]
      );
      const location = locationResult.rows[0];

      const spaceResult = await db.query(
        'SELECT * FROM spaces WHERE id = ANY($1)',
        [booking.space_ids]
      );
      const spaces = spaceResult.rows;

      // Format booking details
      const startTime = toZonedTime(booking.start_at, this.TIMEZONE);
      const endTime = toZonedTime(booking.end_at, this.TIMEZONE);

      const templateData = {
        customerName: booking.customer_name || 'Valued Customer',
        bookingId: booking.id.toString().slice(0, 8).toUpperCase(),
        locationName: location?.name || 'Clubhouse 24/7',
        locationAddress: location?.address || '',
        spaceNames: spaces.map(s => s.name).join(', '),
        date: format(startTime, 'EEEE, MMMM d, yyyy'),
        startTime: format(startTime, 'h:mm a'),
        endTime: format(endTime, 'h:mm a'),
        totalAmount: booking.total_amount ? `$${booking.total_amount.toFixed(2)}` : 'N/A',
        depositAmount: booking.deposit_amount ? `$${booking.deposit_amount.toFixed(2)}` : null,
        bookingUrl: `${process.env.FRONTEND_URL}/bookings/${booking.id}`,
        cancellationUrl: `${process.env.FRONTEND_URL}/bookings/${booking.id}/cancel`,
        modifyUrl: `${process.env.FRONTEND_URL}/bookings/${booking.id}/modify`
      };

      // Send email confirmation
      if (booking.customer_email) {
        await this.sendEmail(
          booking.customer_email,
          'Booking Confirmation - Clubhouse 24/7',
          this.getConfirmationEmailHtml(templateData),
          this.getConfirmationEmailText(templateData),
          this.generateICSAttachment(booking, location, spaces)
        );
      }

      // Send SMS confirmation
      if (booking.customer_phone) {
        const smsMessage = `Your Clubhouse 24/7 booking is confirmed!\n` +
          `📅 ${templateData.date}\n` +
          `⏰ ${templateData.startTime} - ${templateData.endTime}\n` +
          `📍 ${templateData.spaceNames}\n` +
          `ID: #${templateData.bookingId}`;

        await this.sendSMS(booking.customer_phone, smsMessage);
      }

      // Schedule reminder (24 hours before)
      if (booking.start_at > new Date()) {
        const reminderTime = addHours(booking.start_at, -24);
        if (reminderTime > new Date()) {
          await this.scheduleReminder(booking, reminderTime);
        }
      }

      // Send staff alert for high-value bookings
      if (booking.total_amount && booking.total_amount > 200) {
        await this.sendStaffAlert(booking, 'high_value_booking');
      }

      logger.info('Booking confirmation sent successfully', { bookingId: booking.id });
    } catch (error) {
      logger.error('Failed to send booking confirmation:', error);
      // Don't throw - we don't want to fail the booking if notification fails
    }
  }

  /**
   * Send booking reminder
   */
  static async sendBookingReminder(booking: DbBooking): Promise<void> {
    try {
      logger.info('Sending booking reminder', { bookingId: booking.id });

      const startTime = toZonedTime(booking.start_at, this.TIMEZONE);
      const reminderData = {
        customerName: booking.customer_name || 'Valued Customer',
        date: format(startTime, 'MMMM d'),
        time: format(startTime, 'h:mm a'),
        bookingUrl: `${process.env.FRONTEND_URL}/bookings/${booking.id}`
      };

      // Send email reminder
      if (booking.customer_email) {
        const subject = 'Reminder: Your booking is tomorrow';
        const html = `
          <h2>Booking Reminder</h2>
          <p>Hi ${reminderData.customerName},</p>
          <p>This is a friendly reminder about your upcoming booking tomorrow:</p>
          <p><strong>📅 ${reminderData.date} at ${reminderData.time}</strong></p>
          <p><a href="${reminderData.bookingUrl}">View Booking Details</a></p>
        `;
        await this.sendEmail(booking.customer_email, subject, html);
      }

      // Send SMS reminder
      if (booking.customer_phone) {
        const smsMessage = `Reminder: Your Clubhouse 24/7 booking is tomorrow at ${reminderData.time}. See you soon!`;
        await this.sendSMS(booking.customer_phone, smsMessage);
      }

    } catch (error) {
      logger.error('Failed to send booking reminder:', error);
    }
  }

  /**
   * Send cancellation confirmation
   */
  static async sendCancellationConfirmation(
    booking: DbBooking,
    reason?: string,
    refundAmount?: number
  ): Promise<void> {
    try {
      logger.info('Sending cancellation confirmation', { bookingId: booking.id });

      const templateData = {
        customerName: booking.customer_name || 'Valued Customer',
        bookingId: booking.id.toString().slice(0, 8).toUpperCase(),
        cancellationReason: reason || 'Customer requested cancellation',
        refundAmount: refundAmount ? `$${refundAmount.toFixed(2)}` : null,
        refundStatus: refundAmount ? 'Refund will be processed within 3-5 business days' : null
      };

      // Send email
      if (booking.customer_email) {
        const subject = 'Booking Cancellation Confirmation';
        const html = `
          <h2>Booking Cancelled</h2>
          <p>Hi ${templateData.customerName},</p>
          <p>Your booking #${templateData.bookingId} has been cancelled.</p>
          ${templateData.refundAmount ? `<p>Refund Amount: ${templateData.refundAmount}</p>` : ''}
          ${templateData.refundStatus ? `<p>${templateData.refundStatus}</p>` : ''}
          <p>We hope to see you again soon!</p>
        `;
        await this.sendEmail(booking.customer_email, subject, html);
      }

      // Send SMS
      if (booking.customer_phone) {
        const smsMessage = `Your Clubhouse 24/7 booking #${templateData.bookingId} has been cancelled. ` +
          (refundAmount ? `Refund of ${templateData.refundAmount} will be processed soon.` : '');
        await this.sendSMS(booking.customer_phone, smsMessage);
      }

      // Notify staff
      await this.sendStaffAlert(booking, 'cancellation');

    } catch (error) {
      logger.error('Failed to send cancellation confirmation:', error);
    }
  }

  /**
   * Send modification confirmation
   */
  static async sendModificationConfirmation(
    oldBooking: DbBooking,
    newBooking: DbBooking,
    changesMade: string[]
  ): Promise<void> {
    try {
      logger.info('Sending modification confirmation', { bookingId: newBooking.id });

      const newStartTime = toZonedTime(newBooking.start_at, this.TIMEZONE);
      const templateData = {
        customerName: newBooking.customer_name || 'Valued Customer',
        bookingId: newBooking.id.toString().slice(0, 8).toUpperCase(),
        changes: changesMade.join(', '),
        newDate: format(newStartTime, 'MMMM d, yyyy'),
        newTime: format(newStartTime, 'h:mm a')
      };

      // Send email
      if (newBooking.customer_email) {
        const subject = 'Booking Modified Successfully';
        const html = `
          <h2>Booking Modified</h2>
          <p>Hi ${templateData.customerName},</p>
          <p>Your booking #${templateData.bookingId} has been modified.</p>
          <p><strong>Changes made:</strong> ${templateData.changes}</p>
          <p><strong>New date/time:</strong> ${templateData.newDate} at ${templateData.newTime}</p>
        `;
        await this.sendEmail(newBooking.customer_email, subject, html);
      }

    } catch (error) {
      logger.error('Failed to send modification confirmation:', error);
    }
  }

  /**
   * Send staff alert
   */
  private static async sendStaffAlert(booking: DbBooking, alertType: string): Promise<void> {
    try {
      // Get staff notification settings
      const staffResult = await db.query(
        `SELECT email, phone FROM users
         WHERE role IN ('admin', 'operator')
         AND notification_preferences->>'booking_alerts' = 'true'`
      );

      const message = this.getStaffAlertMessage(booking, alertType);

      for (const staff of staffResult.rows) {
        if (staff.email) {
          await this.sendEmail(
            staff.email,
            `Booking Alert: ${alertType.replace('_', ' ').toUpperCase()}`,
            message
          );
        }
      }

      // Also send to Slack if configured
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackNotification(message);
      }

    } catch (error) {
      logger.error('Failed to send staff alert:', error);
    }
  }

  /**
   * Generate staff alert message
   */
  private static getStaffAlertMessage(booking: DbBooking, alertType: string): string {
    const startTime = format(toZonedTime(booking.start_at, this.TIMEZONE), 'MMM d, h:mm a');

    switch (alertType) {
      case 'high_value_booking':
        return `High-value booking created:\n` +
          `Customer: ${booking.customer_name}\n` +
          `Amount: $${booking.total_amount?.toFixed(2)}\n` +
          `Time: ${startTime}`;

      case 'cancellation':
        return `Booking cancelled:\n` +
          `Customer: ${booking.customer_name}\n` +
          `Original time: ${startTime}\n` +
          `Booking ID: ${booking.id}`;

      case 'no_show':
        return `Customer no-show:\n` +
          `Customer: ${booking.customer_name}\n` +
          `Time: ${startTime}\n` +
          `Contact: ${booking.customer_phone || booking.customer_email}`;

      default:
        return `Booking alert for ${booking.customer_name} at ${startTime}`;
    }
  }

  /**
   * Send email
   */
  private static async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    attachments?: any[]
  ): Promise<void> {
    if (!this.emailTransporter) {
      logger.info('Email not configured, logging instead', { to, subject });
      return;
    }

    try {
      const info = await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@clubhouse247.com',
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        attachments
      });

      logger.info('Email sent successfully', { messageId: info.messageId, to });
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send SMS
   */
  private static async sendSMS(phone: string, message: string): Promise<void> {
    try {
      // Use OpenPhone service for SMS
      const fromNumber = process.env.OPENPHONE_DEFAULT_NUMBER || '';
      await this.openPhoneService.sendMessage(phone, fromNumber, message);
      logger.info('SMS sent successfully', { phone });
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      // Don't throw - SMS is not critical
    }
  }

  /**
   * Send Slack notification
   */
  private static async sendSlackNotification(message: string): Promise<void> {
    if (!process.env.SLACK_WEBHOOK_URL) return;

    try {
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Failed to send Slack notification:', error);
    }
  }

  /**
   * Schedule a reminder
   */
  private static async scheduleReminder(booking: DbBooking, reminderTime: Date): Promise<void> {
    try {
      // Store reminder in database for a job queue to process
      await db.query(
        `INSERT INTO scheduled_notifications
         (booking_id, type, scheduled_for, status)
         VALUES ($1, $2, $3, 'pending')`,
        [booking.id, 'reminder', reminderTime]
      );

      logger.info('Reminder scheduled', {
        bookingId: booking.id,
        scheduledFor: reminderTime
      });
    } catch (error) {
      logger.error('Failed to schedule reminder:', error);
    }
  }

  /**
   * Generate ICS calendar attachment
   */
  private static generateICSAttachment(
    booking: DbBooking,
    location: any,
    spaces: any[]
  ): any {
    const startTime = booking.start_at.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const endTime = booking.end_at.toISOString().replace(/[-:]/g, '').replace('.000', '');
    const uid = `${booking.id}@clubhouse247.com`;

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Clubhouse 24/7//Booking System//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace('.000', '')}
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:Clubhouse 24/7 - ${spaces.map(s => s.name).join(', ')}
DESCRIPTION:Booking ID: ${booking.id}\\nLocation: ${location?.name}
LOCATION:${location?.address || 'Clubhouse 24/7'}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    return {
      filename: `booking-${booking.id}.ics`,
      content: icsContent,
      contentType: 'text/calendar'
    };
  }

  /**
   * Get confirmation email HTML template
   */
  private static getConfirmationEmailHtml(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0C9B7C; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .buttons { text-align: center; margin: 20px 0; }
    .btn { display: inline-block; padding: 12px 30px; margin: 0 10px; text-decoration: none; border-radius: 5px; }
    .btn-primary { background: #0C9B7C; color: white; }
    .btn-secondary { background: #6c757d; color: white; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Booking Confirmed!</h1>
      <p>Confirmation #${data.bookingId}</p>
    </div>

    <div class="content">
      <p>Hi ${data.customerName},</p>
      <p>Your booking at Clubhouse 24/7 has been confirmed. We look forward to seeing you!</p>

      <div class="booking-details">
        <h3>Booking Details</h3>
        <div class="detail-row">
          <strong>Date:</strong>
          <span>${data.date}</span>
        </div>
        <div class="detail-row">
          <strong>Time:</strong>
          <span>${data.startTime} - ${data.endTime}</span>
        </div>
        <div class="detail-row">
          <strong>Location:</strong>
          <span>${data.locationName}</span>
        </div>
        <div class="detail-row">
          <strong>Space:</strong>
          <span>${data.spaceNames}</span>
        </div>
        <div class="detail-row">
          <strong>Total Amount:</strong>
          <span>${data.totalAmount}</span>
        </div>
        ${data.depositAmount ? `
        <div class="detail-row">
          <strong>Deposit Paid:</strong>
          <span>${data.depositAmount}</span>
        </div>
        ` : ''}
      </div>

      <div class="buttons">
        <a href="${data.bookingUrl}" class="btn btn-primary">View Booking</a>
        <a href="${data.modifyUrl}" class="btn btn-secondary">Modify Booking</a>
      </div>

      <p><strong>Location Address:</strong><br>${data.locationAddress}</p>

      <p><strong>Cancellation Policy:</strong><br>
      Cancellations must be made at least 24 hours in advance to avoid fees.</p>
    </div>

    <div class="footer">
      <p>© 2025 Clubhouse 24/7. All rights reserved.</p>
      <p>Questions? Contact us at support@clubhouse247.com</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Get confirmation email text template
   */
  private static getConfirmationEmailText(data: any): string {
    return `
Booking Confirmed!
Confirmation #${data.bookingId}

Hi ${data.customerName},

Your booking at Clubhouse 24/7 has been confirmed. We look forward to seeing you!

BOOKING DETAILS
Date: ${data.date}
Time: ${data.startTime} - ${data.endTime}
Location: ${data.locationName}
Space: ${data.spaceNames}
Total Amount: ${data.totalAmount}
${data.depositAmount ? `Deposit Paid: ${data.depositAmount}` : ''}

View your booking: ${data.bookingUrl}
Modify booking: ${data.modifyUrl}

Location Address:
${data.locationAddress}

Cancellation Policy:
Cancellations must be made at least 24 hours in advance to avoid fees.

© 2025 Clubhouse 24/7. All rights reserved.
Questions? Contact us at support@clubhouse247.com
`;
  }

  /**
   * Process pending notifications (called by job queue)
   */
  static async processPendingNotifications(): Promise<void> {
    try {
      // Get pending notifications that are due
      const pendingResult = await db.query(
        `SELECT * FROM scheduled_notifications
         WHERE status = 'pending'
         AND scheduled_for <= NOW()
         ORDER BY scheduled_for
         LIMIT 10`
      );

      for (const notification of pendingResult.rows) {
        try {
          // Get booking details
          const bookingResult = await db.query(
            'SELECT * FROM bookings WHERE id = $1',
            [notification.booking_id]
          );

          if (bookingResult.rows[0]) {
            const booking = bookingResult.rows[0];

            switch (notification.type) {
              case 'reminder':
                await this.sendBookingReminder(booking);
                break;
              case 'feedback':
                // await this.sendFeedbackRequest(booking);
                break;
            }

            // Mark as sent
            await db.query(
              'UPDATE scheduled_notifications SET status = $1, sent_at = NOW() WHERE id = $2',
              ['sent', notification.id]
            );
          }
        } catch (error) {
          logger.error('Failed to process notification:', error);
          // Mark as failed
          await db.query(
            'UPDATE scheduled_notifications SET status = $1, error = $2 WHERE id = $3',
            ['failed', error.message, notification.id]
          );
        }
      }
    } catch (error) {
      logger.error('Failed to process pending notifications:', error);
    }
  }
}

// Initialize the service on module load
BookingNotificationService.initialize().catch(error => {
  logger.error('Failed to initialize BookingNotificationService on load:', error);
});