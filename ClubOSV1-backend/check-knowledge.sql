-- Check what knowledge tables exist and their content
SELECT 'Tables with knowledge:' as info;

SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = t1.table_name) as count
FROM information_schema.tables t1
WHERE table_schema = 'public' 
  AND table_name LIKE '%knowledge%' OR table_name LIKE '%sop%'
ORDER BY table_name;

-- Check knowledge_store for gift cards
SELECT '---' as separator;
SELECT 'Knowledge Store gift card entries:' as info;
SELECT COUNT(*) as gift_card_entries
FROM knowledge_store 
WHERE (key ILIKE '%gift%' OR value::text ILIKE '%gift%')
  AND superseded_by IS NULL;

-- Check SOP embeddings structure
SELECT '---' as separator;
SELECT 'SOP embeddings columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sop_embeddings' 
ORDER BY ordinal_position;

-- Count SOPs with gift card content
SELECT '---' as separator;
SELECT 'SOPs mentioning gift cards:' as info;
SELECT COUNT(*) as gift_card_sops
FROM sop_embeddings 
WHERE content ILIKE '%gift%card%';

-- Sample gift card knowledge
SELECT '---' as separator;
SELECT 'Sample gift card knowledge from knowledge_store:' as info;
SELECT key, confidence, LEFT(value::text, 100) as value_preview
FROM knowledge_store
WHERE (key ILIKE '%gift%' OR value::text ILIKE '%gift%')
  AND superseded_by IS NULL
LIMIT 3;
