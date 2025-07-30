-- Check if documents exist about 7iron, fan, bettergolf, nick
-- Run this in your database to verify data exists

-- Total documents
SELECT COUNT(*) as total_documents FROM extracted_knowledge;

-- Documents by category
SELECT category, COUNT(*) as count 
FROM extracted_knowledge 
GROUP BY category 
ORDER BY count DESC;

-- Search for specific terms
SELECT 
  '7iron' as search_term,
  COUNT(*) as count,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM extracted_knowledge 
WHERE problem ILIKE '%7iron%' OR solution ILIKE '%7iron%'
UNION ALL
SELECT 
  'fan' as search_term,
  COUNT(*) as count,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM extracted_knowledge 
WHERE problem ILIKE '%fan%' OR solution ILIKE '%fan%'
UNION ALL
SELECT 
  'bettergolf' as search_term,
  COUNT(*) as count,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM extracted_knowledge 
WHERE problem ILIKE '%bettergolf%' OR solution ILIKE '%bettergolf%'
UNION ALL
SELECT 
  'nick' as search_term,
  COUNT(*) as count,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM extracted_knowledge 
WHERE problem ILIKE '%nick%' OR solution ILIKE '%nick%';

-- Sample documents about 7iron
SELECT id, category, problem, solution, confidence 
FROM extracted_knowledge 
WHERE problem ILIKE '%7iron%' OR solution ILIKE '%7iron%'
LIMIT 5;