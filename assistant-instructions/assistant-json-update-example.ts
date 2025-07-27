// Update to assistantService.ts to handle JSON responses

async getAssistantResponse(
  route: string,
  userMessage: string,
  context?: Record<string, any>
): Promise<AssistantResponse> {
  // ... existing code ...

  // After getting the assistant's response
  const textContent = assistantMessage.content
    .filter(content => content.type === 'text')
    .map(content => (content as any).text.value)
    .join('\n');

  // Try to parse as JSON if the assistant is configured for JSON
  let structuredResponse = null;
  let responseText = textContent;
  
  try {
    // Check if response is JSON
    const parsed = JSON.parse(textContent);
    
    // Validate against schema (you'd implement this)
    if (this.isValidStructuredResponse(parsed)) {
      structuredResponse = parsed;
      responseText = parsed.response; // Use the response field for backward compatibility
    }
  } catch (e) {
    // Not JSON, use as plain text
    logger.debug('Assistant returned text response, not JSON');
  }

  return {
    response: responseText,
    assistantId,
    threadId: thread.id,
    confidence: 0.9,
    structured: structuredResponse, // Add structured field
    category: structuredResponse?.category,
    priority: structuredResponse?.priority,
    actions: structuredResponse?.actions
  };
}

private isValidStructuredResponse(data: any): boolean {
  // Basic validation - you could use a JSON schema validator
  return data && 
    typeof data.response === 'string' &&
    typeof data.category === 'string' &&
    Array.isArray(data.actions);
}
