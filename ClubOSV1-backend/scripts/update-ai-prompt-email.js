const { pool } = require('../dist/utils/db-pool');
const { logger } = require('../dist/utils/logger');

async function updatePromptTemplate() {
  try {
    console.log('Updating AI prompt template with correct email...');
    
    const updateQuery = `
      UPDATE ai_prompt_templates 
      SET template = 'CRITICAL INSTRUCTIONS - YOU ARE RESPONDING TO A CUSTOMER:

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

7. FOR CONFIDENTIAL MATTERS:
   - If asked about something confidential or sensitive, politely redirect to email booking@clubhouse247golf.com

CONVERSATION HISTORY:
{conversation_history}

{relevant_knowledge}

CLIENT''S CURRENT MESSAGE: {customer_message}

Generate a specific, helpful response. If you cannot provide a useful answer, respond with: "I''ll need to check on that and get back to you shortly."',
      updated_at = NOW(),
      updated_by = (SELECT id FROM users WHERE email = 'admin@clubhouse247golf.com' LIMIT 1)
      WHERE name = 'customer_message_response'
    `;
    
    const result = await pool.query(updateQuery);
    
    if (result.rowCount > 0) {
      console.log('✅ Successfully updated AI prompt template with booking@clubhouse247golf.com');
      
      // Also log the change in history
      await pool.query(`
        INSERT INTO ai_prompt_template_history (
          template_id,
          old_template,
          new_template,
          changed_by,
          change_reason
        )
        SELECT 
          t.id,
          t.template,
          $1,
          (SELECT id FROM users WHERE email = 'admin@clubhouse247golf.com' LIMIT 1),
          'Updated confidential redirect email to booking@clubhouse247golf.com'
        FROM ai_prompt_templates t
        WHERE t.name = 'customer_message_response'
      `, [updateQuery.match(/SET template = '(.*)'/s)[1]]);
      
      console.log('✅ Change logged in template history');
    } else {
      console.log('⚠️  No template found with name "customer_message_response"');
    }
    
  } catch (error) {
    console.error('❌ Error updating prompt template:', error);
  } finally {
    await pool.end();
  }
}

updatePromptTemplate();