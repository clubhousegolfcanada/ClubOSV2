# How to Update OpenAI Assistants to JSON Schema

## Steps for Each Assistant

1. **Go to OpenAI Platform**
   - Navigate to: https://platform.openai.com/assistants
   - Find your assistant

2. **Update Response Format**
   - In the assistant settings, find "Response format"
   - Change from "text" to "json_schema"
   - A new field will appear for the schema

3. **Add the JSON Schema**
   - Copy the appropriate schema from `json-schemas.md`
   - Paste it into the "Response format schema" field
   - The schema enforces the exact structure

4. **Update Instructions**
   - Replace the assistant's instructions with the content from the corresponding `.md` file
   - The instructions include examples that match the schema

5. **Save the Assistant**

## Benefits of json_schema over json_object

### ✅ **Guaranteed Structure**
- With `json_object`: Assistant might return `{"message": "..."}` or any structure
- With `json_schema`: Always get exactly the fields you defined

### ✅ **Type Safety**
- Enforces types (string, boolean, array, etc.)
- Enforces enums (e.g., priority must be "low", "medium", or "high")
- Prevents missing required fields

### ✅ **Better Reliability**
- No need to validate JSON structure in your code
- OpenAI ensures the response matches your schema
- Reduces errors from unexpected formats

## Example Difference

### With json_object (unpredictable):
```json
{
  "message": "I'll help with that",
  "type": "help",
  "urgency": 5
}
```

### With json_schema (guaranteed):
```json
{
  "response": "I'll help you resolve the frozen equipment issue.",
  "category": "solution",
  "priority": "medium",
  "actions": [...],
  "metadata": {...},
  "escalation": {...}
}
```

## Important Notes

1. **Strict Mode**: The schemas use `"strict": true` which enforces exact compliance
2. **Required Fields**: All main fields are required to ensure consistency
3. **Enums**: Categories and priorities are limited to specific values
4. **Additional Properties**: Some objects allow extra fields for flexibility

The backend code already handles both text and JSON responses, so the migration can be done one assistant at a time!
