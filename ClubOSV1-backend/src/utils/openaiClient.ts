import OpenAI from 'openai';
import { logger } from './logger';

let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  
  if (!openaiInstance) {
    try {
      openaiInstance = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      logger.info('OpenAI client initialized');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
      return null;
    }
  }
  
  return openaiInstance;
}

export function hasOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}