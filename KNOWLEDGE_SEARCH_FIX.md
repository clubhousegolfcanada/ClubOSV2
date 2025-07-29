# Knowledge Search Integration Fix

## Problem
The knowledge extraction feature was storing data in the `extracted_knowledge` table, but the LLM's LocalProvider was only searching in:
1. Static JSON files in the knowledge-base directory
2. The `knowledge_base` table (not `extracted_knowledge`)

This meant that all the knowledge extracted from OpenPhone calls and uploaded documents was not being used when answering questions.

## Solution
Updated the `knowledgeLoader.ts` to search BOTH tables:

### 1. Updated `searchKnowledgeDB` method
- Now uses a UNION query to search both `knowledge_base` and `extracted_knowledge` tables
- Prioritizes results by confidence score
- Maps extracted knowledge fields to match the expected format

### 2. Updated `findSolutionDB` method  
- Searches for matching symptoms/problems in both tables
- Returns combined results ordered by match count and priority

### 3. Updated `searchKnowledge` method
- Modified to attempt database search first (including extracted_knowledge)
- Falls back to file-based search if database is unavailable

### 4. Updated `initializeDB` method
- Now checks for both tables and logs record counts from each
- Initializes if either table exists

## Result
Now when users ask questions in the dashboard, the LLM will:
1. Search the static knowledge base (knowledge_base table and JSON files)
2. Search the dynamically extracted knowledge (extracted_knowledge table)
3. Return the best matching results from either source

This means all 300+ documents you uploaded will now be searchable and used to answer questions!

## Files Modified
- `/ClubOSV1-backend/src/knowledge-base/knowledgeLoader.ts` - Updated all search methods to include extracted_knowledge table