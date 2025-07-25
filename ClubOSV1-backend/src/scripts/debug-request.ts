import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Debug endpoint to see exactly what's being received
app.post('/debug', (req, res) => {
  console.log('\n=== DEBUG REQUEST RECEIVED ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('SmartAssistEnabled value:', req.body.smartAssistEnabled);
  console.log('SmartAssistEnabled type:', typeof req.body.smartAssistEnabled);
  console.log('==============================\n');
  
  res.json({
    received: req.body,
    smartAssistEnabled: {
      value: req.body.smartAssistEnabled,
      type: typeof req.body.smartAssistEnabled
    }
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Debug server listening on http://localhost:${PORT}`);
  console.log('\nTo test, update your frontend API URL temporarily to:');
  console.log(`http://localhost:${PORT}/debug`);
  console.log('\nOr use curl:');
  console.log(`curl -X POST http://localhost:${PORT}/debug -H "Content-Type: application/json" -d '{"smartAssistEnabled": true, "requestDescription": "test"}'`);
});
