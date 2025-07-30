// Add this to a route to test
router.get('/test-query', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT assistant) as assistants,
             array_agg(DISTINCT assistant) as assistant_list
      FROM sop_embeddings
    `);
    
    const sample = await db.query(`
      SELECT id, assistant, title, substring(content, 1, 100) as content_preview
      FROM sop_embeddings
      WHERE content ILIKE '%7iron%' OR title ILIKE '%7iron%'
      LIMIT 5
    `);
    
    res.json({
      summary: result.rows[0],
      matches: sample.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
