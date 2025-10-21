import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import QRCodeLib from 'qrcode';
import {
  CheckCircle,
  Download,
  Mail,
  MessageSquare,
  Copy,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  QrCode,
  Smartphone,
  Share2,
  Printer,
  CreditCard,
  Shield,
  AlertCircle,
  User
} from 'lucide-react';
import { BookingMode } from './UnifiedBookingCard';
import StatusBadge from '@/components/ui/StatusBadge';
import logger from '@/services/logger';
import toast from 'react-hot-toast';

interface BookingConfirmationProps {
  mode: BookingMode;
  bookingData: any;
  onClose: () => void;
  onNewBooking: () => void;
}

interface BookingDetails {
  confirmationNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  locationName: string;
  spaceName?: string;
  startAt: string;
  endAt: string;
  totalAmount?: number;
  depositPaid?: number;
  remainingBalance?: number;
  notes?: string;
  eventName?: string;
  expectedAttendees?: number;
  blockReason?: string;
  maintenanceType?: string;
  recurringPattern?: any;
}

export default function BookingConfirmation({
  mode,
  bookingData,
  onClose,
  onNewBooking
}: BookingConfirmationProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate QR code on mount
  useEffect(() => {
    generateQrCode();
  }, [bookingData]);

  const generateQrCode = async () => {
    try {
      // Create a URL that can be scanned to view booking details
      const bookingUrl = `${window.location.origin}/booking/${bookingData.confirmationNumber || bookingData.id}`;

      const qrDataUrl = await QRCodeLib.toDataURL(bookingUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1F2937',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      setQrCodeUrl(qrDataUrl);
    } catch (error) {
      logger.error('Failed to generate QR code:', error);
    }
  };

  const handleCopyConfirmation = () => {
    const confirmationText = `
Booking Confirmation: ${bookingData.confirmationNumber || bookingData.id}
${bookingData.customerName}
${format(parseISO(bookingData.startAt), 'MMM d, yyyy h:mm a')} - ${format(parseISO(bookingData.endAt), 'h:mm a')}
Location: ${bookingData.locationName}
${bookingData.totalAmount ? `Total: $${bookingData.totalAmount.toFixed(2)}` : ''}
    `.trim();

    navigator.clipboard.writeText(confirmationText);
    setCopied(true);
    toast.success('Confirmation copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleEmailConfirmation = async () => {
    if (!bookingData.customerEmail) {
      toast.error('No email address available');
      return;
    }

    setSendingEmail(true);
    try {
      // Simulate email sending - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`Confirmation sent to ${bookingData.customerEmail}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      toast.error('Failed to send confirmation email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSmsConfirmation = async () => {
    if (!bookingData.customerPhone) {
      toast.error('No phone number available');
      return;
    }

    setSendingSms(true);
    try {
      // Simulate SMS sending - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success(`SMS sent to ${bookingData.customerPhone}`);
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      toast.error('Failed to send SMS confirmation');
    } finally {
      setSendingSms(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `booking-${bookingData.confirmationNumber || bookingData.id}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  // Get mode-specific configuration
  const getModeConfig = () => {
    switch (mode) {
      case 'booking':
        return {
          title: 'Booking Confirmed',
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'block':
        return {
          title: 'Time Blocked',
          icon: Shield,
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      case 'maintenance':
        return {
          title: 'Maintenance Scheduled',
          icon: AlertCircle,
          color: 'text-orange-500',
          bgColor: 'bg-orange-50 dark:bg-orange-950/20',
          borderColor: 'border-orange-200 dark:border-orange-800'
        };
      case 'event':
        return {
          title: 'Event Created',
          icon: Calendar,
          color: 'text-purple-500',
          bgColor: 'bg-purple-50 dark:bg-purple-950/20',
          borderColor: 'border-purple-200 dark:border-purple-800'
        };
      case 'class':
        return {
          title: 'Class Scheduled',
          icon: User,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
      default:
        return {
          title: 'Confirmed',
          icon: CheckCircle,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 dark:bg-gray-950/20',
          borderColor: 'border-gray-200 dark:border-gray-800'
        };
    }
  };

  const config = getModeConfig();
  const Icon = config.icon;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className={`${config.bgColor} border ${config.borderColor} rounded-lg overflow-hidden`}>
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`w-8 h-8 ${config.color}`} />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {config.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Confirmation #{bookingData.confirmationNumber || bookingData.id}
                </p>
              </div>
            </div>
            <StatusBadge
              status="success"
              label={mode === 'booking' ? 'Confirmed' : 'Scheduled'}
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Left Column - Details */}
          <div className="space-y-4">
            {/* Customer Info */}
            {bookingData.customerName && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Customer Information
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {bookingData.customerName}
                    </span>
                  </div>
                  {bookingData.customerEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {bookingData.customerEmail}
                      </span>
                    </div>
                  )}
                  {bookingData.customerPhone && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {bookingData.customerPhone}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Booking Details */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {mode === 'booking' ? 'Booking' : mode.charAt(0).toUpperCase() + mode.slice(1)} Details
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {bookingData.locationName}
                    {bookingData.spaceName && ` - ${bookingData.spaceName}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {format(parseISO(bookingData.startAt), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {format(parseISO(bookingData.startAt), 'h:mm a')} -
                    {format(parseISO(bookingData.endAt), 'h:mm a')}
                  </span>
                </div>

                {/* Mode-specific details */}
                {mode === 'event' && bookingData.eventName && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {bookingData.eventName}
                    </p>
                    {bookingData.expectedAttendees && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {bookingData.expectedAttendees} expected attendees
                      </p>
                    )}
                  </div>
                )}

                {mode === 'block' && bookingData.blockReason && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reason: {bookingData.blockReason}
                    </p>
                  </div>
                )}

                {mode === 'maintenance' && bookingData.maintenanceType && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Type: {bookingData.maintenanceType}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Info */}
            {bookingData.totalAmount && bookingData.totalAmount > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Payment Summary
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total Amount</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      ${bookingData.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  {bookingData.depositPaid && bookingData.depositPaid > 0 && (
                    <>
                      <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                        <span className="text-sm">Deposit Paid</span>
                        <span className="text-sm font-medium">
                          ${bookingData.depositPaid.toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Remaining Balance
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          ${(bookingData.totalAmount - bookingData.depositPaid).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2">
                    <CreditCard className="w-3 h-3" />
                    <span>Payment will be processed at check-in</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - QR Code & Actions */}
          <div className="space-y-4">
            {/* QR Code */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Mobile Access
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                {qrCodeUrl ? (
                  <div className="flex flex-col items-center space-y-3">
                    <img
                      src={qrCodeUrl}
                      alt="Booking QR Code"
                      className="w-48 h-48 border-2 border-gray-200 dark:border-gray-700 rounded-lg"
                    />
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                      <Smartphone className="inline w-3 h-3 mr-1" />
                      Scan with your phone to access booking details
                    </p>
                    <button
                      onClick={handleDownloadQr}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download QR Code
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <QrCode className="w-12 h-12 mb-2" />
                    <p className="text-xs">Generating QR code...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Share Actions */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Share Confirmation
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-2">
                <button
                  onClick={handleCopyConfirmation}
                  className={`w-full px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    copied
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy Confirmation'}
                </button>

                {bookingData.customerEmail && (
                  <button
                    onClick={handleEmailConfirmation}
                    disabled={sendingEmail}
                    className="w-full px-3 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Mail className="w-4 h-4" />
                    {sendingEmail ? 'Sending...' : 'Email Confirmation'}
                  </button>
                )}

                {bookingData.customerPhone && (
                  <button
                    onClick={handleSmsConfirmation}
                    disabled={sendingSms}
                    className="w-full px-3 py-2 text-sm font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {sendingSms ? 'Sending...' : 'SMS Confirmation'}
                  </button>
                )}

                <button
                  onClick={handlePrint}
                  className="w-full px-3 py-2 text-sm font-medium bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Confirmation
                </button>
              </div>
            </div>

            {/* Recurring Info */}
            {bookingData.recurringPattern && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                      Recurring {bookingData.recurringPattern.frequency}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      This {mode} will repeat according to the selected pattern
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onNewBooking}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              mode === 'booking' ? 'bg-green-600 hover:bg-green-700' :
              mode === 'block' ? 'bg-red-600 hover:bg-red-700' :
              mode === 'maintenance' ? 'bg-orange-600 hover:bg-orange-700' :
              mode === 'event' ? 'bg-purple-600 hover:bg-purple-700' :
              'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Create Another {mode === 'booking' ? 'Booking' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        </div>
      </div>

      {/* Print-only styles */}
      <style jsx>{`
        @media print {
          .max-w-2xl {
            max-width: 100%;
          }
          button {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}