#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Improve JSON parsing robustness for OpenAI assistant responses

- Created extractJsonFromText method for more robust JSON extraction
- Better handling of malformed JSON and mixed content responses
- Improved brace counting to find proper JSON boundaries
- Handle JSON that appears anywhere in the response text
- Added debug endpoint /api/llm/debug-assistant for testing response parsing
- Better error handling and logging for JSON parsing failures
- Preserve text that appears after JSON structures
- Clean up response display to avoid showing raw JSON to users"
git push origin main
