const OpenAI = require('openai');

async function testAssistants() {
  console.log('🔍 Testing OpenAI Assistants Configuration\n');
  
  // Check environment variables
  const assistantIds = {
    'Booking & Access': process.env.BOOKING_ACCESS_GPT_ID,
    'Emergency': process.env.EMERGENCY_GPT_ID,
    'TechSupport': process.env.TECH_SUPPORT_GPT_ID,
    'BrandTone': process.env.BRAND_MARKETING_GPT_ID
  };
  
  console.log('📋 Configured Assistant IDs:');
  Object.entries(assistantIds).forEach(([route, id]) => {
    console.log(`   ${route}: ${id ? `✅ ${id}` : '❌ Not configured'}`);
  });
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ OPENAI_API_KEY not set!');
    return;
  }
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  console.log('\n🧪 Testing each assistant:');
  
  for (const [route, assistantId] of Object.entries(assistantIds)) {
    if (!assistantId) {
      console.log(`\n❌ ${route}: No assistant ID configured`);
      continue;
    }
    
    try {
      console.log(`\n🔄 Testing ${route} (${assistantId})...`);
      
      // Try to retrieve the assistant
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      
      console.log(`   ✅ Assistant found: "${assistant.name}"`);
      console.log(`   📝 Instructions preview: ${assistant.instructions?.substring(0, 100)}...`);
      console.log(`   🤖 Model: ${assistant.model}`);
      
      // Try to create a thread and send a test message
      const thread = await openai.beta.threads.create();
      console.log(`   ✅ Thread created: ${thread.id}`);
      
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: 'Test message: Hello, are you working?'
      });
      
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId
      });
      
      console.log(`   ✅ Run created: ${run.id}`);
      console.log(`   ✅ Assistant ${route} is working!`);
      
    } catch (error) {
      console.error(`   ❌ ${route} failed: ${error.message}`);
      if (error.message.includes('No assistant found')) {
        console.error(`      The assistant ID ${assistantId} does not exist in your OpenAI account`);
      }
    }
  }
  
  console.log('\n✅ Test complete!');
}

// Run the test
testAssistants().catch(console.error);
