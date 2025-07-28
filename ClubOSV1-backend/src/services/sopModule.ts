# ClubOS V1 SOP Module Integration: Full Technical Audit

## Current Architecture Analysis

### LLM Service Flow
```typescript
// Current flow in /api/llm/request
1. Request → llmService.processRequest() [determines route]
2. Route → assistantService.getAssistantResponse() [gets OpenAI Assistant response]
3. Response → Client (with Slack fallback if needed)
```

### Key Files
- `llmService.ts` - Routes requests using GPT-4 or local fallback
- `assistantService.ts` - Calls OpenAI Assistants API
- `llm.ts` - Provider abstraction (OpenAI, Anthropic, Local)

### Assistant IDs (Environment Variables)
```bash
BOOKING_ACCESS_GPT_ID=asst_E2CrYEtb5CKJGPZYdE7z7VAq
EMERGENCY_GPT_ID=asst_jOWRzC9eOMRsupRqMWR5hc89
TECH_SUPPORT_GPT_ID=asst_Xax6THdGRHYJwPbRi9OoQrRF
BRAND_MARKETING_GPT_ID=asst_1vMUEQ7oTIYrCFG1BhgpwMkw
```

## Plan Corrections & Considerations

### 1. **Path/System Issues**
- ✅ Routes are correctly named: `'Booking & Access'`, `'Emergency'`, `'TechSupport'`, `'BrandTone'`
- ✅ PostgreSQL with `pg` library (not Sequelize as I initially noted)
- ❌ No existing vector search (would need pgvector extension)
- ✅ Existing fallback mechanism in `assistantService.getFallbackResponse()`

### 2. **Integration Points**
The plan correctly identifies the replacement point:
```typescript
// In assistantService.ts, replace getAssistantResponse() internals
// Keep the same interface to avoid breaking changes
```

### 3. **Database Considerations**
Current schema uses standard PostgreSQL. For SOP storage:
```sql
-- Add to existing database
CREATE TABLE sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  keywords TEXT[], -- PostgreSQL array for keyword matching
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sop_system_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant VARCHAR(50) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  tone_modifiers JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sops_assistant ON sops(assistant);
CREATE INDEX idx_sops_keywords ON sops USING GIN(keywords);
CREATE INDEX idx_sops_metadata ON sops USING GIN(metadata);
```

## Revised Implementation Plan

### Phase 1: Create SOP Module (Non-Breaking)

<function_calls>
<invoke name="Filesystem:write_file">
<parameter name="content">import { logger } from '../utils/logger';
import { db } from '../utils/database';
import fs from 'fs/promises';
import path from 'path';

interface SOP {
  id: string;
  assistant: string;
  title: string;
  keywords: string[];
  body: string;
  metadata?: any;
}

interface SOPSystemInstructions {
  assistant: string;
  content: string;
  tone_modifiers?: any;
}

interface SOPResponse {
  success: boolean;
  response?: string;
  confidence: number;
  source: 'sop' | 'fallback';
  metadata?: any;
}

export class SOPModule {
  private sopsCache: Map<string, SOP[]> = new Map();
  private instructionsCache: Map<string, SOPSystemInstructions> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly SOP_DIR = path.join(__dirname, '../../sops');
  
  constructor() {
    this.initializeSOPDirectory();
  }

  private async initializeSOPDirectory() {
    try {
      await fs.mkdir(this.SOP_DIR, { recursive: true });
      const assistants = ['booking', 'emergency', 'tech', 'brand'];
      
      for (const assistant of assistants) {
        const assistantDir = path.join(this.SOP_DIR, assistant);
        await fs.mkdir(assistantDir, { recursive: true });
        
        // Create default system_instructions.md if not exists
        const instructionsPath = path.join(assistantDir, 'system_instructions.md');
        try {
          await fs.access(instructionsPath);
        } catch {
          await fs.writeFile(instructionsPath, this.getDefaultInstructions(assistant));
        }
      }
    } catch (error) {
      logger.error('Failed to initialize SOP directory:', error);
    }
  }

  private getDefaultInstructions(assistant: string): string {
    const instructions: Record<string, string> = {
      booking: `You are the Booking & Access Assistant for ClubOS.
Tone: Professional, helpful, solution-oriented
Focus: Booking issues, access problems, refunds, customer disputes
Always provide clear next steps and reference specific systems when applicable.`,
      
      emergency: `You are the Emergency Response Assistant for ClubOS.
Tone: Direct, clear, no-nonsense, action-oriented
Focus: Safety first, clear protocols, immediate actions
Format responses as numbered steps when providing emergency procedures.`,
      
      tech: `You are the Technical Support Assistant for ClubOS.
Tone: Technical but accessible, patient, thorough
Focus: Equipment troubleshooting, system diagnostics, step-by-step fixes
Include specific error codes, restart procedures, and escalation paths.`,
      
      brand: `You are the Brand & Marketing Assistant for ClubOS.
Tone: Friendly, enthusiastic, on-brand
Focus: Customer communications, promotional content, member engagement
Maintain consistent brand voice while being helpful and informative.`
    };
    
    return instructions[assistant] || 'You are a ClubOS assistant.';
  }

  async tryHandle(query: string, assistant: string, context?: any): Promise<SOPResponse> {
    try {
      // Normalize assistant name
      const normalizedAssistant = this.normalizeAssistantName(assistant);
      
      // Try database first
      let sop = await this.findSOPInDatabase(query, normalizedAssistant);
      
      // If not found in DB, try filesystem
      if (!sop && process.env.USE_FILESYSTEM_SOPS !== 'false') {
        sop = await this.findSOPInFilesystem(query, normalizedAssistant);
      }
      
      if (!sop) {
        return {
          success: false,
          confidence: 0,
          source: 'fallback'
        };
      }
      
      // Get system instructions
      const instructions = await this.getSystemInstructions(normalizedAssistant);
      
      // Format the response with context
      const formattedResponse = this.formatSOPResponse(sop, instructions, query, context);
      
      return {
        success: true,
        response: formattedResponse,
        confidence: this.calculateConfidence(query, sop),
        source: 'sop',
        metadata: {
          sopId: sop.id,
          title: sop.title,
          keywords: sop.keywords
        }
      };
      
    } catch (error) {
      logger.error('SOP module error:', error);
      return {
        success: false,
        confidence: 0,
        source: 'fallback'
      };
    }
  }

  private normalizeAssistantName(assistant: string): string {
    const mapping: Record<string, string> = {
      'Booking & Access': 'booking',
      'Emergency': 'emergency',
      'TechSupport': 'tech',
      'BrandTone': 'brand'
    };
    return mapping[assistant] || assistant.toLowerCase();
  }

  private async findSOPInDatabase(query: string, assistant: string): Promise<SOP | null> {
    if (!db.initialized) return null;
    
    try {
      const queryLower = query.toLowerCase();
      const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);
      
      // Search by keywords
      const result = await db.query(`
        SELECT * FROM sops 
        WHERE assistant = $1 
        AND (
          LOWER(title) LIKE ANY($2::text[])
          OR keywords && $3::text[]
          OR LOWER(body) LIKE ANY($2::text[])
        )
        ORDER BY 
          CASE WHEN LOWER(title) LIKE $4 THEN 1 ELSE 2 END,
          array_length(keywords & $3::text[], 1) DESC NULLS LAST
        LIMIT 1
      `, [
        assistant,
        keywords.map(k => `%${k}%`),
        keywords,
        `%${queryLower}%`
      ]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Database SOP search failed:', error);
      return null;
    }
  }

  private async findSOPInFilesystem(query: string, assistant: string): Promise<SOP | null> {
    try {
      const assistantDir = path.join(this.SOP_DIR, assistant);
      const files = await fs.readdir(assistantDir);
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'system_instructions.md');
      
      const queryLower = query.toLowerCase();
      const queryKeywords = queryLower.split(/\s+/).filter(w => w.length > 3);
      
      let bestMatch: { sop: SOP; score: number } | null = null;
      
      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(assistantDir, file), 'utf-8');
        const sop = this.parseSOPFile(content, file, assistant);
        
        if (!sop) continue;
        
        // Calculate match score
        const score = this.calculateMatchScore(queryKeywords, sop);
        
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { sop, score };
        }
      }
      
      return bestMatch?.sop || null;
      
    } catch (error) {
      logger.error('Filesystem SOP search failed:', error);
      return null;
    }
  }

  private parseSOPFile(content: string, filename: string, assistant: string): SOP | null {
    try {
      const lines = content.split('\n');
      const title = lines.find(l => l.startsWith('# '))?.replace('# ', '') || filename.replace('.md', '');
      
      // Extract keywords from frontmatter or first keywords line
      let keywords: string[] = [];
      const keywordsLine = lines.find(l => l.toLowerCase().startsWith('keywords:'));
      if (keywordsLine) {
        keywords = keywordsLine
          .replace(/keywords:/i, '')
          .split(',')
          .map(k => k.trim().toLowerCase())
          .filter(k => k.length > 0);
      }
      
      // Extract body (everything after the title and metadata)
      const bodyStartIndex = lines.findIndex(l => l.trim() && !l.startsWith('#') && !l.toLowerCase().includes('keywords'));
      const body = lines.slice(bodyStartIndex).join('\n').trim();
      
      return {
        id: `file-${filename}`,
        assistant,
        title,
        keywords,
        body
      };
      
    } catch (error) {
      logger.error('Failed to parse SOP file:', error);
      return null;
    }
  }

  private calculateMatchScore(queryKeywords: string[], sop: SOP): number {
    let score = 0;
    
    for (const keyword of queryKeywords) {
      // Check title
      if (sop.title.toLowerCase().includes(keyword)) score += 3;
      
      // Check keywords
      if (sop.keywords.some(k => k.includes(keyword))) score += 2;
      
      // Check body
      if (sop.body.toLowerCase().includes(keyword)) score += 1;
    }
    
    return score;
  }

  private calculateConfidence(query: string, sop: SOP): number {
    const queryLower = query.toLowerCase();
    const queryKeywords = queryLower.split(/\s+/).filter(w => w.length > 3);
    const matchScore = this.calculateMatchScore(queryKeywords, sop);
    
    // Normalize to 0-1 range
    const maxPossibleScore = queryKeywords.length * 6; // 3 + 2 + 1 per keyword
    return Math.min(matchScore / maxPossibleScore, 1);
  }

  private async getSystemInstructions(assistant: string): Promise<SOPSystemInstructions> {
    // Check cache first
    if (this.instructionsCache.has(assistant)) {
      return this.instructionsCache.get(assistant)!;
    }
    
    // Try database
    if (db.initialized) {
      try {
        const result = await db.query(
          'SELECT * FROM sop_system_instructions WHERE assistant = $1',
          [assistant]
        );
        
        if (result.rows[0]) {
          const instructions = result.rows[0];
          this.instructionsCache.set(assistant, instructions);
          return instructions;
        }
      } catch (error) {
        logger.error('Failed to load system instructions from DB:', error);
      }
    }
    
    // Try filesystem
    try {
      const instructionsPath = path.join(this.SOP_DIR, assistant, 'system_instructions.md');
      const content = await fs.readFile(instructionsPath, 'utf-8');
      
      const instructions = {
        assistant,
        content,
        tone_modifiers: {}
      };
      
      this.instructionsCache.set(assistant, instructions);
      return instructions;
      
    } catch (error) {
      logger.error('Failed to load system instructions from filesystem:', error);
      
      // Return default
      return {
        assistant,
        content: this.getDefaultInstructions(assistant),
        tone_modifiers: {}
      };
    }
  }

  private formatSOPResponse(
    sop: SOP, 
    instructions: SOPSystemInstructions, 
    query: string, 
    context?: any
  ): string {
    // Build the response with proper context
    let response = sop.body;
    
    // Apply any tone modifiers
    if (instructions.tone_modifiers?.prefix) {
      response = instructions.tone_modifiers.prefix + '\n\n' + response;
    }
    
    if (instructions.tone_modifiers?.suffix) {
      response = response + '\n\n' + instructions.tone_modifiers.suffix;
    }
    
    // Add context-specific information
    if (context?.location) {
      response = response.replace(/\{location\}/g, context.location);
    }
    
    return response;
  }

  // Admin methods for Claude to use
  async createSOP(sop: Omit<SOP, 'id'>): Promise<void> {
    if (db.initialized) {
      await db.query(`
        INSERT INTO sops (assistant, title, keywords, body, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [sop.assistant, sop.title, sop.keywords, sop.body, sop.metadata || {}]);
    }
    
    // Also save to filesystem
    const filename = sop.title.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
    const content = `# ${sop.title}\nKeywords: ${sop.keywords.join(', ')}\n\n${sop.body}`;
    const filepath = path.join(this.SOP_DIR, sop.assistant, filename);
    
    await fs.writeFile(filepath, content);
    
    // Clear cache
    this.sopsCache.delete(sop.assistant);
  }

  async updateSOP(id: string, updates: Partial<SOP>): Promise<void> {
    if (db.initialized && !id.startsWith('file-')) {
      const setClause = Object.keys(updates)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
      
      await db.query(
        `UPDATE sops SET ${setClause}, updated_at = NOW() WHERE id = $1`,
        [id, ...Object.values(updates)]
      );
    }
    
    // Clear cache
    this.sopsCache.clear();
  }

  async listSOPs(assistant?: string): Promise<SOP[]> {
    const sops: SOP[] = [];
    
    // Get from database
    if (db.initialized) {
      const query = assistant 
        ? 'SELECT * FROM sops WHERE assistant = $1 ORDER BY title'
        : 'SELECT * FROM sops ORDER BY assistant, title';
      
      const result = await db.query(query, assistant ? [assistant] : []);
      sops.push(...result.rows);
    }
    
    // Get from filesystem
    try {
      const dirs = assistant ? [assistant] : await fs.readdir(this.SOP_DIR);
      
      for (const dir of dirs) {
        const assistantDir = path.join(this.SOP_DIR, dir);
        const files = await fs.readdir(assistantDir);
        
        for (const file of files) {
          if (file.endsWith('.md') && file !== 'system_instructions.md') {
            const content = await fs.readFile(path.join(assistantDir, file), 'utf-8');
            const sop = this.parseSOPFile(content, file, dir);
            if (sop) sops.push(sop);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list filesystem SOPs:', error);
    }
    
    return sops;
  }
}

export const sopModule = new SOPModule();
