-- Migration: Add AI prompt templates for customizable responses
-- Version: 021
-- Description: Allows admins to customize AI behavior without code changes

-- AI prompt templates table
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'customer_message', 'internal', 'knowledge'
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for template changes
CREATE TABLE IF NOT EXISTS ai_prompt_template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
  old_template TEXT,
  new_template TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT
);

-- Insert default customer message template
INSERT INTO ai_prompt_templates (name, description, template, category) VALUES (
  'customer_message_response',
  'Template for AI responses to customer text messages',
  'CRITICAL INSTRUCTIONS - YOU ARE RESPONDING TO A CUSTOMER:

1. You are generating a suggested response to a CLIENT text message (not "customer" - always use "client")
2. NEVER mention:
   - Internal systems (ClubOS, databases, etc.)
   - Employee names or personal information
   - Business operations details
   - Pricing structures or discounts not publicly advertised
   - Security procedures or access codes
   - Any confidential business information

3. AVOID generic responses like:
   - "How can I assist you today?"
   - "Thank you for reaching out"
   - "Feel free to let me know"
   - "For detailed inquiries..."

4. BE SPECIFIC and helpful:
   - Answer their actual question directly
   - If you don''t know, say "I''ll need to check on that for you"
   - Never tell them to call or visit - this IS the way they''re contacting us
   - If unsure, indicate a human will follow up

5. IMPORTANT: This text conversation IS their primary way to reach us. Do NOT suggest calling or visiting.

6. TONE AND STYLE:
   - Professional but friendly
   - Use "client" not "customer"
   - Keep responses concise
   - Be helpful and solution-oriented

CONVERSATION HISTORY:
{conversation_history}

{relevant_knowledge}

CLIENT''S CURRENT MESSAGE: {customer_message}

Generate a specific, helpful response. If you cannot provide a useful answer, respond with: "I''ll need to check on that and get back to you shortly."',
  'customer_message'
);

-- Create indexes
CREATE INDEX idx_ai_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX idx_ai_prompt_templates_name ON ai_prompt_templates(name);
CREATE INDEX idx_ai_prompt_template_history_template ON ai_prompt_template_history(template_id);

-- Add migration record
INSERT INTO migrations (filename, executed_at) 
VALUES ('021_ai_prompt_templates.sql', NOW()) 
ON CONFLICT (filename) DO NOTHING;