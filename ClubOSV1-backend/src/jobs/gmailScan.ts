import cron from 'node-cron';
import { logger } from '../utils/logger';

class GmailScanJob {
  private isRunning = false;

  /**
   * Start the Gmail scan job - runs daily at 6 AM Atlantic (10 AM UTC)
   * Gated by GMAIL_SCAN_ENABLED=true environment variable
   */
  start() {
    if (process.env.GMAIL_SCAN_ENABLED !== 'true') {
      logger.info('⏸️ Gmail scan job DISABLED (set GMAIL_SCAN_ENABLED=true to enable)');
      return;
    }

    // 6 AM Atlantic = 10 AM UTC
    cron.schedule('0 10 * * *', async () => {
      if (this.isRunning) {
        logger.warn('Gmail scan already running, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        logger.info('📧 Starting scheduled Gmail receipt scan...');
        const { runGmailScan } = await import('../services/gmail/gmailReceiptScanner');
        const result = await runGmailScan();
        logger.info(`✅ Gmail scan complete: ${result.emailsScanned} emails scanned, ${result.receiptsCreated} receipts created, ${result.duplicatesSkipped} duplicates skipped`);
      } catch (error) {
        logger.error('❌ Scheduled Gmail scan failed:', error);
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('📧 Gmail scan job scheduled (daily at 6 AM Atlantic)');
  }
}

export default new GmailScanJob();
