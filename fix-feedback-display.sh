#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Fix feedback log to display structured response data

- Store full structured response data (actions, emergency contacts, escalation) in feedback
- Update feedback submission to include all LLM response properties as JSON
- Create FeedbackResponse component to parse and display structured feedback
- Update Operations page to show all response details in feedback log
- Display emergency contacts, escalation info, and required actions in feedback view
- Handle both plain text and structured JSON responses in feedback display"
git push origin main
