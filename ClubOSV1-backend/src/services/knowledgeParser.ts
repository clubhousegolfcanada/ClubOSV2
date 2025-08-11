/**
 * Knowledge Parser Service
 * Parses uploaded files (.md, .json, .txt) into knowledge entries
 */

import { logger } from '../utils/logger';

export interface ParsedEntry {
  key: string;
  value: any;
}

/**
 * Parse uploaded file into knowledge entries
 */
export async function parseUploadedFile(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<ParsedEntry[]> {
  const content = buffer.toString('utf-8');
  const extension = filename.split('.').pop()?.toLowerCase();

  logger.info('Parsing uploaded file', { filename, mimetype, extension });

  switch (extension) {
    case 'json':
      return parseJSON(content, filename);
    case 'md':
    case 'markdown':
      return parseMarkdown(content, filename);
    case 'txt':
    case 'text':
      return parseText(content, filename);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

/**
 * Parse JSON file
 * Expects object with key-value pairs or array of objects
 */
function parseJSON(content: string, filename: string): ParsedEntry[] {
  try {
    const data = JSON.parse(content);
    const entries: ParsedEntry[] = [];
    const baseKey = filename.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9]/g, '_');

    if (Array.isArray(data)) {
      // Array of objects - each becomes an entry
      data.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          const key = item.key || item.id || item.name || `${baseKey}.item_${index}`;
          entries.push({
            key: String(key).toLowerCase().replace(/\s+/g, '_'),
            value: item
          });
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      // Object - each property becomes an entry
      for (const [key, value] of Object.entries(data)) {
        entries.push({
          key: `${baseKey}.${key}`.toLowerCase().replace(/\s+/g, '_'),
          value
        });
      }
    }

    logger.info('Parsed JSON file', { filename, entries: entries.length });
    return entries;
  } catch (error) {
    logger.error('Failed to parse JSON', { filename, error });
    throw new Error('Invalid JSON format');
  }
}

/**
 * Parse Markdown file
 * Extracts headers as keys and content as values
 */
function parseMarkdown(content: string, filename: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const baseKey = filename.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Split by headers (# or ##)
  const sections = content.split(/^#{1,2}\s+/m);
  
  sections.forEach((section, index) => {
    if (index === 0 && section.trim()) {
      // Content before first header
      entries.push({
        key: `${baseKey}.intro`,
        value: {
          content: section.trim(),
          type: 'markdown'
        }
      });
    } else if (section.trim()) {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      
      if (title) {
        const key = `${baseKey}.${title}`.toLowerCase()
          .replace(/[^a-zA-Z0-9.]/g, '_')
          .replace(/_+/g, '_');
        
        entries.push({
          key,
          value: {
            title,
            content,
            type: 'markdown'
          }
        });
      }
    }
  });

  // If no headers found, treat entire content as one entry
  if (entries.length === 0 && content.trim()) {
    entries.push({
      key: baseKey,
      value: {
        content: content.trim(),
        type: 'markdown'
      }
    });
  }

  logger.info('Parsed Markdown file', { filename, entries: entries.length });
  return entries;
}

/**
 * Parse Text file
 * Looks for Q&A format or key-value pairs
 */
function parseText(content: string, filename: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const baseKey = filename.replace(/\.txt$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
  
  // Try to detect format
  const lines = content.split('\n').filter(line => line.trim());
  
  // Check for Q&A format
  const qaPattern = /^(Q:|Question:|A:|Answer:)/i;
  const keyValuePattern = /^([^:]+):\s*(.+)$/;
  
  let currentQuestion = '';
  let currentAnswer = '';
  let mode: 'qa' | 'keyvalue' | 'plain' = 'plain';
  
  // Detect mode
  if (lines.some(line => qaPattern.test(line))) {
    mode = 'qa';
  } else if (lines.some(line => keyValuePattern.test(line))) {
    mode = 'keyvalue';
  }
  
  if (mode === 'qa') {
    // Q&A format
    lines.forEach(line => {
      if (/^(Q:|Question:)/i.test(line)) {
        // Save previous Q&A if exists
        if (currentQuestion && currentAnswer) {
          const key = `${baseKey}.${currentQuestion}`
            .toLowerCase()
            .replace(/[^a-zA-Z0-9.]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 100); // Limit key length
          
          entries.push({
            key,
            value: {
              question: currentQuestion,
              answer: currentAnswer,
              type: 'faq'
            }
          });
        }
        currentQuestion = line.replace(/^(Q:|Question:)/i, '').trim();
        currentAnswer = '';
      } else if (/^(A:|Answer:)/i.test(line)) {
        currentAnswer = line.replace(/^(A:|Answer:)/i, '').trim();
      } else if (currentAnswer) {
        // Continuation of answer
        currentAnswer += ' ' + line.trim();
      }
    });
    
    // Save last Q&A
    if (currentQuestion && currentAnswer) {
      const key = `${baseKey}.${currentQuestion}`
        .toLowerCase()
        .replace(/[^a-zA-Z0-9.]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 100);
      
      entries.push({
        key,
        value: {
          question: currentQuestion,
          answer: currentAnswer,
          type: 'faq'
        }
      });
    }
  } else if (mode === 'keyvalue') {
    // Key-value format
    lines.forEach(line => {
      const match = line.match(keyValuePattern);
      if (match) {
        const [, rawKey, value] = match;
        const key = `${baseKey}.${rawKey}`
          .toLowerCase()
          .replace(/[^a-zA-Z0-9.]/g, '_')
          .replace(/_+/g, '_');
        
        entries.push({
          key,
          value: value.trim()
        });
      }
    });
  } else {
    // Plain text - treat as single entry
    entries.push({
      key: baseKey,
      value: {
        content: content.trim(),
        type: 'text'
      }
    });
  }

  logger.info('Parsed Text file', { filename, mode, entries: entries.length });
  return entries;
}

/**
 * Parse CSV format (for future extension)
 */
function parseCSV(content: string, filename: string): ParsedEntry[] {
  // Implementation for CSV parsing
  // Could use csv-parse library
  throw new Error('CSV parsing not yet implemented');
}