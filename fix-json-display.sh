#!/bin/bash
chmod +x fix-json-display.sh
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Fix JSON display issue with OpenAI assistant responses

- Enhanced assistantService.ts to better parse JSON responses from OpenAI assistants
- Improved JSON detection and extraction logic to handle various response formats
- Added fallback handling for responses that contain both JSON and plain text
- Updated ResponseDisplay component to properly render structured responses
- Added better error handling and logging for JSON parsing failures
- Clean up JSON artifacts from display text if parsing fails
- Preserve whitespace formatting in response display with whitespace-pre-wrap
- Added console logging for debugging response format issues"
git push origin main
