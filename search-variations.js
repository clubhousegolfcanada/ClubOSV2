// Add to a route to test different search patterns
router.post('/search-variations', authenticate, async (req, res) => {
  const { term } = req.body;
  
  const variations = [
    term,
    term.toLowerCase(),
    term.toUpperCase(),
    term.replace(/[^a-zA-Z0-9]/g, ''),
    `%${term}%`,
    `% ${term} %`,
    `%${term.replace(' ', '%')}%`
  ];
  
  const results = {};
  
  for (const variation of variations) {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count,
               array_agg(DISTINCT substring(content, position(lower($1) in lower(content)) - 20, 100)) as snippets
        FROM sop_embeddings 
        WHERE lower(content) LIKE lower($1)
           OR lower(title) LIKE lower($1)
      `, [variation]);
      
      results[variation] = {
        count: result.rows[0].count,
        snippets: result.rows[0].snippets || []
      };
    } catch (err) {
      results[variation] = { error: err.message };
    }
  }
  
  res.json({ term, results });
});
