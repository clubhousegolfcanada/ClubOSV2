// Add this endpoint to test SOP search
router.get('/test-sop-search/:query', authenticate, async (req, res) => {
  const { query } = req.params;
  
  try {
    // Direct database query
    const dbResult = await db.query(`
      SELECT id, assistant, title, 
             substring(content, 1, 200) as content_preview
      FROM sop_embeddings 
      WHERE content ILIKE $1 OR title ILIKE $1
      LIMIT 10
    `, [`%${query}%`]);
    
    // Test intelligent SOP module
    const sopDocs = await intelligentSOPModule.findRelevantContext(query, 'brand');
    
    // Test knowledge loader
    const knowledgeResults = await knowledgeLoader.unifiedSearch(query, {
      includeSOPEmbeddings: true,
      assistant: 'brand'
    });
    
    res.json({
      query,
      directDbResults: dbResult.rows.length,
      sopModuleResults: sopDocs.length,
      knowledgeLoaderResults: knowledgeResults.length,
      details: {
        db: dbResult.rows,
        sopModule: sopDocs.map(d => ({ id: d.id, title: d.title })),
        knowledgeLoader: knowledgeResults.map(k => ({ id: k.id, issue: k.issue }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
