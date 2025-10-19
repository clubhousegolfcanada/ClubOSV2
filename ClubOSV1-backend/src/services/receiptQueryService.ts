import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { format, subDays, subWeeks, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

interface ReceiptQuery {
  text: string;
  userId?: string;
}

interface ReceiptQueryResult {
  success: boolean;
  receipts?: any[];
  summary?: {
    count: number;
    totalAmount: number;
    averageAmount?: number;
    vendors?: string[];
    dateRange?: { from: string; to: string };
  };
  message?: string;
  error?: string;
  actions?: {
    type: 'edit' | 'delete' | 'reconcile' | 'view';
    receiptId?: string;
    field?: string;
    value?: any;
  };
}

export class ReceiptQueryService {
  /**
   * Parse natural language query and return receipt results
   */
  async queryReceipts(query: ReceiptQuery): Promise<ReceiptQueryResult> {
    const { text, userId } = query;
    const lowerText = text.toLowerCase();

    try {
      // Detect query intent
      const intent = this.detectIntent(lowerText);

      switch (intent.type) {
        case 'search':
          return await this.searchReceipts(intent, userId);
        case 'summary':
          return await this.getReceiptSummary(intent, userId);
        case 'action':
          return await this.handleReceiptAction(intent, userId);
        default:
          return await this.defaultSearch(lowerText, userId);
      }
    } catch (error) {
      logger.error('Receipt query error:', error);
      return {
        success: false,
        error: 'Failed to process receipt query',
        message: 'I had trouble searching for receipts. Please try rephrasing your query.'
      };
    }
  }

  /**
   * Detect the intent of the query
   */
  private detectIntent(text: string): any {
    // Action patterns
    if (text.includes('delete') || text.includes('remove')) {
      return { type: 'action', action: 'delete', text };
    }
    if (text.includes('edit') || text.includes('change') || text.includes('update')) {
      return { type: 'action', action: 'edit', text };
    }
    if (text.includes('reconcile') || text.includes('mark as reconciled')) {
      return { type: 'action', action: 'reconcile', text };
    }

    // Summary patterns
    if (text.includes('total') || text.includes('sum') || text.includes('spent') || text.includes('expenses')) {
      return { type: 'summary', text };
    }

    // Default to search
    return { type: 'search', text };
  }

  /**
   * Search receipts based on natural language
   */
  private async searchReceipts(intent: any, userId?: string): Promise<ReceiptQueryResult> {
    const { text } = intent;

    // Parse search parameters
    const params = this.parseSearchParams(text);

    // Build query
    let queryStr = `
      SELECT
        r.id,
        r.vendor,
        r.amount_cents,
        r.tax_cents,
        r.purchase_date,
        r.category,
        r.payment_method,
        r.club_location,
        r.notes,
        r.reconciled,
        r.created_at,
        r.file_data IS NOT NULL as has_photo,
        u.name as uploader_name
      FROM receipts r
      LEFT JOIN users u ON r.uploader_user_id = u.id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add date filter
    if (params.dateRange) {
      queryStr += ` AND r.created_at >= $${paramIndex} AND r.created_at <= $${paramIndex + 1}`;
      queryParams.push(params.dateRange.from, params.dateRange.to);
      paramIndex += 2;
    }

    // Add vendor filter
    if (params.vendor) {
      queryStr += ` AND r.vendor ILIKE $${paramIndex}`;
      queryParams.push(`%${params.vendor}%`);
      paramIndex++;
    }

    // Add amount filter
    if (params.minAmount !== undefined) {
      queryStr += ` AND r.amount_cents >= $${paramIndex}`;
      queryParams.push(params.minAmount * 100);
      paramIndex++;
    }
    if (params.maxAmount !== undefined) {
      queryStr += ` AND r.amount_cents <= $${paramIndex}`;
      queryParams.push(params.maxAmount * 100);
      paramIndex++;
    }

    // Add location filter
    if (params.location) {
      queryStr += ` AND r.club_location = $${paramIndex}`;
      queryParams.push(params.location);
      paramIndex++;
    }

    // Add reconciled filter
    if (params.reconciled !== undefined) {
      queryStr += ` AND r.reconciled = $${paramIndex}`;
      queryParams.push(params.reconciled);
      paramIndex++;
    }

    // Add category filter
    if (params.category) {
      queryStr += ` AND r.category ILIKE $${paramIndex}`;
      queryParams.push(`%${params.category}%`);
      paramIndex++;
    }

    // Add sorting and limit
    queryStr += ` ORDER BY r.created_at DESC LIMIT ${params.limit || 10}`;

    const result = await db.query(queryStr, queryParams);

    // Format receipts
    const receipts: Array<{
      id: string;
      vendor: string;
      amount: string;
      tax: string | null;
      date: string;
      category: string;
      paymentMethod: string;
      location: string;
      reconciled: boolean;
      hasPhoto: boolean;
      uploadedBy: string;
    }> = result.rows.map(r => ({
      id: r.id,
      vendor: r.vendor || 'Unknown Vendor',
      amount: r.amount_cents ? (r.amount_cents / 100).toFixed(2) : '0.00',
      tax: r.tax_cents ? (r.tax_cents / 100).toFixed(2) : null,
      date: r.purchase_date ? format(new Date(r.purchase_date), 'MMM dd, yyyy') :
            format(new Date(r.created_at), 'MMM dd, yyyy'),
      category: r.category,
      paymentMethod: r.payment_method,
      location: r.club_location,
      reconciled: r.reconciled,
      hasPhoto: r.has_photo,
      uploadedBy: r.uploader_name
    }));

    // Create response message
    let message = `Found ${receipts.length} receipt${receipts.length !== 1 ? 's' : ''}`;
    if (params.vendor) message += ` from ${params.vendor}`;
    if (params.dateRange) {
      const fromDate = format(new Date(params.dateRange.from), 'MMM dd');
      const toDate = format(new Date(params.dateRange.to), 'MMM dd');
      message += ` between ${fromDate} and ${toDate}`;
    }

    return {
      success: true,
      receipts,
      summary: {
        count: receipts.length,
        totalAmount: receipts.reduce((sum, r) => sum + parseFloat(r.amount), 0),
        vendors: [...new Set(receipts.map(r => r.vendor as string))].slice(0, 5)
      },
      message
    };
  }

  /**
   * Get receipt summary statistics
   */
  private async getReceiptSummary(intent: any, userId?: string): Promise<ReceiptQueryResult> {
    const { text } = intent;
    const params = this.parseSearchParams(text);

    let queryStr = `
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount_cents), 0) as total_amount,
        COALESCE(AVG(amount_cents), 0) as avg_amount,
        COALESCE(SUM(tax_cents), 0) as total_tax,
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        array_agg(DISTINCT vendor) FILTER (WHERE vendor IS NOT NULL) as vendors
      FROM receipts
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Add filters similar to search
    if (params.dateRange) {
      queryStr += ` AND created_at >= $${paramIndex} AND created_at <= $${paramIndex + 1}`;
      queryParams.push(params.dateRange.from, params.dateRange.to);
      paramIndex += 2;
    }

    if (params.vendor) {
      queryStr += ` AND vendor ILIKE $${paramIndex}`;
      queryParams.push(`%${params.vendor}%`);
      paramIndex++;
    }

    if (params.location) {
      queryStr += ` AND club_location = $${paramIndex}`;
      queryParams.push(params.location);
      paramIndex++;
    }

    if (params.category) {
      queryStr += ` AND category ILIKE $${paramIndex}`;
      queryParams.push(`%${params.category}%`);
      paramIndex++;
    }

    const result = await db.query(queryStr, queryParams);
    const summary = result.rows[0];

    const totalAmount = (summary.total_amount / 100).toFixed(2);
    const avgAmount = summary.count > 0 ? (summary.avg_amount / 100).toFixed(2) : '0.00';
    const totalTax = (summary.total_tax / 100).toFixed(2);

    // Create descriptive message
    let message = `📊 Receipt Summary:\n`;
    message += `• Total Receipts: ${summary.count}\n`;
    message += `• Total Amount: $${totalAmount}\n`;
    message += `• Average Amount: $${avgAmount}\n`;
    if (parseFloat(totalTax) > 0) {
      message += `• Total Tax: $${totalTax}\n`;
    }
    if (summary.vendors && summary.vendors.length > 0) {
      message += `• Top Vendors: ${summary.vendors.slice(0, 3).join(', ')}\n`;
    }
    if (params.dateRange) {
      const fromDate = format(new Date(params.dateRange.from), 'MMM dd, yyyy');
      const toDate = format(new Date(params.dateRange.to), 'MMM dd, yyyy');
      message += `• Period: ${fromDate} to ${toDate}`;
    }

    return {
      success: true,
      summary: {
        count: parseInt(summary.count),
        totalAmount: parseFloat(totalAmount),
        averageAmount: parseFloat(avgAmount),
        vendors: summary.vendors || [],
        dateRange: params.dateRange
      },
      message
    };
  }

  /**
   * Handle receipt actions (edit, delete, reconcile)
   */
  private async handleReceiptAction(intent: any, userId?: string): Promise<ReceiptQueryResult> {
    const { action, text } = intent;

    // Extract receipt identifier from text
    const receiptId = this.extractReceiptId(text);

    if (!receiptId) {
      return {
        success: false,
        message: `Please specify which receipt to ${action}. You can use the receipt ID or describe it (e.g., "the Home Depot receipt from yesterday").`
      };
    }

    // Return action details for the frontend to handle
    return {
      success: true,
      message: `Ready to ${action} receipt ${receiptId}. Please confirm this action.`,
      actions: {
        type: action as any,
        receiptId
      }
    };
  }

  /**
   * Default search when intent is unclear
   */
  private async defaultSearch(text: string, userId?: string): Promise<ReceiptQueryResult> {
    // Simple text search across vendor, notes, and OCR text
    const queryStr = `
      SELECT
        r.id,
        r.vendor,
        r.amount_cents,
        r.purchase_date,
        r.club_location,
        r.reconciled,
        r.created_at
      FROM receipts r
      WHERE
        r.vendor ILIKE $1 OR
        r.notes ILIKE $1 OR
        r.ocr_text ILIKE $1
      ORDER BY r.created_at DESC
      LIMIT 10
    `;

    const searchTerm = `%${text}%`;
    const result = await db.query(queryStr, [searchTerm]);

    const receipts = result.rows.map(r => ({
      id: r.id,
      vendor: r.vendor || 'Unknown',
      amount: r.amount_cents ? (r.amount_cents / 100).toFixed(2) : '0.00',
      date: r.purchase_date ? format(new Date(r.purchase_date), 'MMM dd, yyyy') :
            format(new Date(r.created_at), 'MMM dd, yyyy'),
      location: r.club_location,
      reconciled: r.reconciled
    }));

    return {
      success: true,
      receipts,
      summary: {
        count: receipts.length,
        totalAmount: receipts.reduce((sum, r) => sum + parseFloat(r.amount), 0)
      },
      message: receipts.length > 0
        ? `Found ${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} matching "${text}"`
        : `No receipts found matching "${text}"`
    };
  }

  /**
   * Parse search parameters from natural language
   */
  private parseSearchParams(text: string): any {
    const params: any = {};

    // Parse date ranges
    if (text.includes('today')) {
      const today = new Date();
      params.dateRange = {
        from: startOfWeek(today).toISOString(),
        to: endOfWeek(today).toISOString()
      };
    } else if (text.includes('yesterday')) {
      const yesterday = subDays(new Date(), 1);
      params.dateRange = {
        from: startOfWeek(yesterday).toISOString(),
        to: endOfWeek(yesterday).toISOString()
      };
    } else if (text.includes('this week') || text.includes('last week')) {
      const weeksAgo = text.includes('last') ? 1 : 0;
      const targetDate = subWeeks(new Date(), weeksAgo);
      params.dateRange = {
        from: startOfWeek(targetDate).toISOString(),
        to: endOfWeek(targetDate).toISOString()
      };
    } else if (text.includes('this month') || text.includes('last month')) {
      const monthsAgo = text.includes('last') ? 1 : 0;
      const targetDate = subMonths(new Date(), monthsAgo);
      params.dateRange = {
        from: startOfMonth(targetDate).toISOString(),
        to: endOfMonth(targetDate).toISOString()
      };
    } else if (text.match(/last (\d+) days?/)) {
      const match = text.match(/last (\d+) days?/);
      const days = parseInt(match![1]);
      params.dateRange = {
        from: subDays(new Date(), days).toISOString(),
        to: new Date().toISOString()
      };
    }

    // Parse vendors
    const vendors = ['home depot', 'costco', 'walmart', 'staples', 'amazon', 'lowes', 'canadian tire'];
    for (const vendor of vendors) {
      if (text.includes(vendor)) {
        params.vendor = vendor;
        break;
      }
    }

    // Parse amounts
    const amountMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1]);
      if (text.includes('over') || text.includes('above') || text.includes('more than')) {
        params.minAmount = amount;
      } else if (text.includes('under') || text.includes('below') || text.includes('less than')) {
        params.maxAmount = amount;
      } else {
        // Exact or approximate amount
        params.minAmount = amount * 0.9;
        params.maxAmount = amount * 1.1;
      }
    }

    // Parse locations
    const locations = ['bedford', 'dartmouth', 'bayers lake', 'halifax', 'truro', 'stratford', 'river oaks'];
    for (const location of locations) {
      if (text.includes(location)) {
        params.location = location.split(' ').map(w =>
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
        break;
      }
    }

    // Parse reconciliation status
    if (text.includes('unreconciled') || text.includes('not reconciled')) {
      params.reconciled = false;
    } else if (text.includes('reconciled')) {
      params.reconciled = true;
    }

    // Parse categories
    const categories = ['supplies', 'equipment', 'office', 'maintenance', 'food', 'technology'];
    for (const category of categories) {
      if (text.includes(category)) {
        params.category = category;
        break;
      }
    }

    // Parse limit
    if (text.includes('all')) {
      params.limit = 100;
    } else if (text.includes('recent') || text.includes('latest')) {
      params.limit = 5;
    }

    return params;
  }

  /**
   * Extract receipt ID from action text
   */
  private extractReceiptId(text: string): string | null {
    // Try to find UUID
    const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      return uuidMatch[0];
    }

    // Try to find receipt number reference
    const numberMatch = text.match(/#?(\d+)/);
    if (numberMatch) {
      // This would need to look up the actual receipt by some reference
      return numberMatch[1];
    }

    // Try to identify by description
    // This would need more sophisticated parsing and database lookup

    return null;
  }
}

export const receiptQueryService = new ReceiptQueryService();