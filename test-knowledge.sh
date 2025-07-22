#!/bin/bash

echo "Testing knowledge base endpoint..."
curl -X POST http://localhost:3001/api/knowledge/test \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Screen frozen"
  }' | jq .