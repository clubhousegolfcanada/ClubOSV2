/**
 * Contact Handlers
 * 
 * Manages contact information from OpenPhone
 */

import { Request, Response } from 'express';
import { db } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { openPhoneService } from '../../../services/openphoneService';

/**
 * List all contacts
 */
export async function listContacts(req: Request, res: Response) {
  const { search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = `
      SELECT DISTINCT ON (phone_number)
        phone_number,
        customer_name,
        MAX(updated_at) as last_contact,
        COUNT(*) OVER (PARTITION BY phone_number) as conversation_count
      FROM openphone_conversations
      WHERE customer_name IS NOT NULL
    `;
    
    const params: any[] = [];
    
    if (search) {
      query += ` AND (customer_name ILIKE $1 OR phone_number LIKE $1)`;
      params.push(`%${search}%`);
    }
    
    query += ` GROUP BY phone_number, customer_name
      ORDER BY phone_number, MAX(updated_at) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    params.push(Number(limit), offset);

    const result = await db.query(query, params);
    
    res.json({
      contacts: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    throw new AppError('Failed to fetch contacts', 500);
  }
}

/**
 * Get contact details
 */
export async function getContact(req: Request, res: Response) {
  const { contactId } = req.params; // This would be phone number

  try {
    const conversations = await db.query(`
      SELECT * FROM openphone_conversations
      WHERE phone_number = $1
      ORDER BY updated_at DESC
    `, [contactId]);

    if (conversations.rows.length === 0) {
      throw new AppError('Contact not found', 404);
    }

    const contact = {
      phone_number: contactId,
      name: conversations.rows[0].customer_name,
      conversations: conversations.rows,
      total_messages: conversations.rows.reduce((sum, conv) => 
        sum + (conv.messages?.length || 0), 0
      ),
      first_contact: conversations.rows[conversations.rows.length - 1].created_at,
      last_contact: conversations.rows[0].updated_at
    };

    res.json(contact);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching contact:', error);
    throw new AppError('Failed to fetch contact', 500);
  }
}

/**
 * Update contact information
 */
export async function updateContact(req: Request, res: Response) {
  const { contactId } = req.params;
  const { name } = req.body;

  if (!name) {
    throw new AppError('Name is required', 400);
  }

  try {
    // Update all conversations with this phone number
    await db.query(`
      UPDATE openphone_conversations
      SET customer_name = $2, updated_at = NOW()
      WHERE phone_number = $1
    `, [contactId, name]);

    logger.info('Contact updated', {
      phone: contactId,
      name,
      updatedBy: req.user!.id
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating contact:', error);
    throw new AppError('Failed to update contact', 500);
  }
}

/**
 * Sync contacts from OpenPhone
 */
export async function syncContacts(req: Request, res: Response) {
  try {
    // This would integrate with OpenPhone API to sync contacts
    // For now, we'll return a placeholder response
    
    logger.info('Contact sync initiated', {
      initiatedBy: req.user!.id
    });

    res.json({
      success: true,
      message: 'Contact sync initiated',
      syncId: Date.now()
    });
  } catch (error) {
    logger.error('Error syncing contacts:', error);
    throw new AppError('Failed to sync contacts', 500);
  }
}