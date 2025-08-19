# Knowledge Toggle Implementation Plan
## Unifying Knowledge Management with Dashboard Input

### Executive Summary
This plan details the implementation of a 4-way toggle system on the main dashboard to consolidate knowledge upload functionality with the existing LLM request interface. This will eliminate the need for separate knowledge management pages and create a unified interface for all AI operations.

## Current State Analysis

### Existing 3-Way Toggle System
1. **Smart Assist Mode** - Routes to LLM assistants
2. **Ticket Mode** - Creates support tickets
3. **Tone Conversion Mode** - Converts text tone/style

### Current Knowledge Management
- Separate KnowledgeRouterPanel component in operations
- Multiple knowledge-related routes (18 files!)
- GPT-4o parsing for natural language knowledge updates
- Stores in `knowledge_items` and `sop_documents` tables
- Used by AI automations to answer before hitting OpenAI

## Proposed 4-Way Toggle System

### Toggle Options
1. **🤖 Smart Assist** (Default) - Current LLM request routing
2. **🎫 Create Ticket** - Current ticket creation
3. **🎨 Tone Convert** - Current tone conversion
4. **📚 Knowledge Upload** (NEW) - Natural language knowledge entry

## Detailed Implementation Plan (30 Steps)

### Phase 1: Frontend UI Changes (Steps 1-10)

#### Step 1: Update Toggle State Management
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
// Add new state
const [mode, setMode] = useState<'assist' | 'ticket' | 'tone' | 'knowledge'>('assist');
const [knowledgeCategory, setKnowledgeCategory] = useState<string>('general');
const [knowledgeConfidence, setKnowledgeConfidence] = useState<number>(1.0);
```

#### Step 2: Create Mode Toggle Component
**File**: `ClubOSV1-frontend/src/components/ModeToggle.tsx` (NEW)
```typescript
interface ModeToggleProps {
  mode: 'assist' | 'ticket' | 'tone' | 'knowledge';
  onChange: (mode: 'assist' | 'ticket' | 'tone' | 'knowledge') => void;
  disabled?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange, disabled }) => {
  const modes = [
    { id: 'assist', label: 'Smart Assist', icon: '🤖', tooltip: 'Get AI assistance' },
    { id: 'ticket', label: 'Create Ticket', icon: '🎫', tooltip: 'Submit support ticket' },
    { id: 'tone', label: 'Tone Convert', icon: '🎨', tooltip: 'Convert text tone' },
    { id: 'knowledge', label: 'Knowledge', icon: '📚', tooltip: 'Add knowledge to system' }
  ];
  
  return (
    <div className="flex space-x-2 mb-4">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id as any)}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
            mode === m.id 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title={m.tooltip}
        >
          <span>{m.icon}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
};
```

#### Step 3: Update RequestForm Layout
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
// Replace existing toggle sections with unified ModeToggle
import { ModeToggle } from './ModeToggle';

// In render:
<ModeToggle 
  mode={mode} 
  onChange={setMode}
  disabled={isProcessing}
/>
```

#### Step 4: Add Knowledge-Specific UI Elements
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
// Add conditional rendering for knowledge mode
{mode === 'knowledge' && (
  <div className="space-y-4">
    {/* Knowledge Category Selector */}
    <div>
      <label className="block text-sm font-medium mb-2">Knowledge Category</label>
      <select 
        value={knowledgeCategory}
        onChange={(e) => setKnowledgeCategory(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
      >
        <option value="general">General Information</option>
        <option value="booking">Booking & Reservations</option>
        <option value="tech">Technical Support</option>
        <option value="emergency">Emergency Procedures</option>
        <option value="pricing">Pricing & Membership</option>
        <option value="equipment">Equipment & Facilities</option>
        <option value="policies">Policies & Rules</option>
      </select>
    </div>
    
    {/* Confidence Score */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Confidence Level: {(knowledgeConfidence * 100).toFixed(0)}%
      </label>
      <input
        type="range"
        min="0.5"
        max="1"
        step="0.05"
        value={knowledgeConfidence}
        onChange={(e) => setKnowledgeConfidence(parseFloat(e.target.value))}
        className="w-full"
      />
      <div className="text-xs text-gray-500 mt-1">
        How certain is this information? (affects when AI uses it)
      </div>
    </div>
    
    {/* Knowledge Preview */}
    <div className="bg-blue-50 p-3 rounded-lg">
      <div className="text-sm font-medium mb-1">AI will learn:</div>
      <div className="text-sm text-gray-700">
        {parseKnowledgePreview(requestDescription)}
      </div>
    </div>
  </div>
)}
```

#### Step 5: Update Input Placeholder and Labels
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
const getPlaceholder = () => {
  switch(mode) {
    case 'assist':
      return "What can I help you with today?";
    case 'ticket':
      return "Describe the issue that needs attention...";
    case 'tone':
      return "Enter text to convert to a different tone...";
    case 'knowledge':
      return "Enter knowledge in natural language, e.g., 'Gift cards can be purchased at website.com/giftcards for $25, $50, or $100'";
    default:
      return "Enter your request...";
  }
};

const getSubmitLabel = () => {
  switch(mode) {
    case 'assist':
      return isProcessing ? "Processing..." : "Get Assistance";
    case 'ticket':
      return isProcessing ? "Creating..." : "Create Ticket";
    case 'tone':
      return isProcessing ? "Converting..." : "Convert Tone";
    case 'knowledge':
      return isProcessing ? "Learning..." : "Add Knowledge";
    default:
      return "Submit";
  }
};
```

#### Step 6: Implement Knowledge Preview Parser
**File**: `ClubOSV1-frontend/src/utils/knowledgeParser.ts` (NEW)
```typescript
export function parseKnowledgePreview(input: string): string {
  if (!input) return "Enter information above...";
  
  // Detect common patterns
  const patterns = {
    url: /(?:can be|available at|found at|visit)\s+(https?:\/\/[^\s]+)/i,
    price: /\$[\d,]+(?:\.\d{2})?/g,
    hours: /\d{1,2}(?::\d{2})?\s*(?:am|pm)/gi,
    phone: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    email: /[\w.-]+@[\w.-]+\.\w+/g,
  };
  
  const detected = [];
  
  if (patterns.url.test(input)) {
    detected.push("URL/Website");
  }
  if (patterns.price.test(input)) {
    detected.push("Pricing Information");
  }
  if (patterns.hours.test(input)) {
    detected.push("Business Hours");
  }
  if (patterns.phone.test(input)) {
    detected.push("Phone Number");
  }
  if (patterns.email.test(input)) {
    detected.push("Email Address");
  }
  
  if (detected.length === 0) {
    return "General information about: " + input.substring(0, 100) + "...";
  }
  
  return `Detected: ${detected.join(", ")} - ${input.substring(0, 80)}...`;
}
```

#### Step 7: Add Visual Feedback for Knowledge Mode
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
// Add knowledge-specific styling
const getInputClassName = () => {
  const base = "w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all";
  
  switch(mode) {
    case 'knowledge':
      return `${base} border-purple-300 focus:ring-purple-500 bg-purple-50/50`;
    case 'ticket':
      return `${base} border-orange-300 focus:ring-orange-500 bg-orange-50/50`;
    case 'tone':
      return `${base} border-green-300 focus:ring-green-500 bg-green-50/50`;
    default:
      return `${base} border-gray-300 focus:ring-blue-500`;
  }
};
```

#### Step 8: Add Knowledge Success Feedback
**File**: `ClubOSV1-frontend/src/components/KnowledgeSuccessModal.tsx` (NEW)
```typescript
interface KnowledgeSuccessModalProps {
  show: boolean;
  onClose: () => void;
  knowledgeAdded: {
    category: string;
    key: string;
    value: string;
    confidence: number;
  };
}

export const KnowledgeSuccessModal: React.FC<KnowledgeSuccessModalProps> = ({
  show, onClose, knowledgeAdded
}) => {
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            ✅
          </div>
          <h3 className="ml-3 text-lg font-semibold">Knowledge Added Successfully!</h3>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Category</div>
            <div className="font-medium">{knowledgeAdded.category}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Knowledge Key</div>
            <div className="font-medium">{knowledgeAdded.key}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Value</div>
            <div className="text-sm">{knowledgeAdded.value}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Confidence</div>
            <div className="font-medium">{(knowledgeAdded.confidence * 100).toFixed(0)}%</div>
          </div>
        </div>
        
        <div className="text-sm text-gray-600 mb-4">
          The AI will now use this information when answering related questions.
        </div>
        
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add More Knowledge
        </button>
      </div>
    </div>
  );
};
```

#### Step 9: Update Form Submission Logic
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
const onSubmit = async (data: FormData) => {
  try {
    setIsProcessing(true);
    setError(null);
    
    switch(mode) {
      case 'knowledge':
        await handleKnowledgeSubmit(data);
        break;
      case 'ticket':
        await handleTicketSubmit(data);
        break;
      case 'tone':
        await handleToneSubmit(data);
        break;
      default:
        await handleAssistSubmit(data);
    }
  } catch (error) {
    console.error('Submission error:', error);
    setError(error.message);
  } finally {
    setIsProcessing(false);
  }
};

const handleKnowledgeSubmit = async (data: FormData) => {
  const token = localStorage.getItem('clubos_token');
  
  const payload = {
    input: data.requestDescription,
    category: knowledgeCategory,
    confidence: knowledgeConfidence,
    source: 'dashboard_input',
    user_context: {
      location: data.location || 'Not specified',
      user_id: user?.id,
      user_name: user?.username
    }
  };
  
  const response = await axios.post(
    `${API_URL}/knowledge/unified-add`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  if (response.data.success) {
    setKnowledgeSuccess({
      show: true,
      data: response.data.data
    });
    reset(); // Clear form
    notify('Knowledge added successfully!', 'success');
  } else {
    throw new Error(response.data.error || 'Failed to add knowledge');
  }
};
```

#### Step 10: Add Keyboard Shortcuts
**File**: `ClubOSV1-frontend/src/components/RequestForm.tsx`
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Alt + 1-4 to switch modes
    if (e.altKey && !isProcessing) {
      switch(e.key) {
        case '1':
          setMode('assist');
          break;
        case '2':
          setMode('ticket');
          break;
        case '3':
          setMode('tone');
          break;
        case '4':
          setMode('knowledge');
          break;
      }
    }
    
    // Cmd/Ctrl + K to focus input in knowledge mode
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setMode('knowledge');
      inputRef.current?.focus();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isProcessing]);
```

### Phase 2: Backend API Changes (Steps 11-20)

#### Step 11: Create Unified Knowledge Endpoint
**File**: `ClubOSV1-backend/src/routes/knowledge-unified.ts` (NEW)
```typescript
import express from 'express';
import { authenticate } from '../middleware/auth';
import { knowledgeService } from '../services/knowledgeService';
import { aiService } from '../services/aiService';

const router = express.Router();

router.post('/unified-add', authenticate, async (req, res) => {
  try {
    const { input, category, confidence, source, user_context } = req.body;
    
    // Step 1: Parse with GPT-4o
    const parsed = await aiService.parseKnowledgeInput(input);
    
    // Step 2: Validate parsed data
    if (!parsed.key || !parsed.value) {
      return res.json({
        success: false,
        error: 'Could not extract knowledge from input'
      });
    }
    
    // Step 3: Check for duplicates
    const existing = await knowledgeService.findSimilar(parsed.key, category);
    if (existing && existing.confidence >= confidence) {
      return res.json({
        success: false,
        error: 'Similar knowledge already exists with higher confidence',
        existing
      });
    }
    
    // Step 4: Store in database
    const result = await knowledgeService.add({
      category: category || parsed.detected_category || 'general',
      key: parsed.key,
      value: parsed.value,
      confidence: confidence || parsed.confidence || 0.8,
      metadata: {
        source,
        user_id: req.user.id,
        user_name: req.user.username,
        original_input: input,
        ...user_context
      },
      assistant_target: parsed.assistant_target || 'all'
    });
    
    // Step 5: Update assistant if needed
    if (parsed.requires_assistant_update) {
      await aiService.updateAssistantKnowledge(
        parsed.assistant_target,
        parsed.key,
        parsed.value
      );
    }
    
    // Step 6: Log for analytics
    await knowledgeService.logActivity({
      action: 'add',
      category,
      key: parsed.key,
      user_id: req.user.id,
      source: 'dashboard_toggle'
    });
    
    return res.json({
      success: true,
      data: {
        id: result.id,
        category,
        key: parsed.key,
        value: parsed.value,
        confidence,
        assistant_target: parsed.assistant_target
      }
    });
    
  } catch (error) {
    console.error('Knowledge add error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process knowledge'
    });
  }
});

export default router;
```

#### Step 12: Enhance Knowledge Parser Service
**File**: `ClubOSV1-backend/src/services/knowledgeParserService.ts` (NEW)
```typescript
import OpenAI from 'openai';

export class KnowledgeParserService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async parseKnowledgeInput(input: string) {
    const prompt = `
    Parse this knowledge input and extract structured information.
    Input: "${input}"
    
    Extract:
    1. Key (identifier for this knowledge)
    2. Value (the actual information)
    3. Category (booking, tech, emergency, pricing, general, etc.)
    4. Confidence (0.5-1.0 based on clarity)
    5. Assistant target (which assistant should use this)
    6. Requires assistant update (boolean)
    
    Examples:
    Input: "Gift cards can be purchased at website.com/giftcards"
    Output: {
      key: "giftcard.purchase.url",
      value: "Gift cards can be purchased at website.com/giftcards",
      category: "pricing",
      confidence: 1.0,
      assistant_target: "brand",
      requires_assistant_update: true
    }
    
    Return as JSON.
    `;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a knowledge parser. Extract structured data from natural language.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
  
  async detectDuplicates(key: string, category: string) {
    // Check for similar keys in database
    const similar = await db.query(`
      SELECT * FROM knowledge_items
      WHERE category = $1
      AND (
        key ILIKE $2
        OR levenshtein(key, $2) < 3
      )
      ORDER BY confidence DESC
      LIMIT 5
    `, [category, `%${key}%`]);
    
    return similar.rows;
  }
  
  async suggestCategory(input: string): Promise<string> {
    const categories = {
      booking: ['book', 'reserve', 'cancel', 'schedule', 'appointment'],
      pricing: ['price', 'cost', 'fee', 'payment', 'gift card', 'membership'],
      tech: ['trackman', 'simulator', 'frozen', 'reset', 'technical'],
      emergency: ['fire', 'injury', 'emergency', 'urgent', 'accident'],
      equipment: ['club', 'ball', 'gear', 'equipment', 'rental'],
      policies: ['rule', 'policy', 'allowed', 'prohibited', 'requirement']
    };
    
    const lowerInput = input.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerInput.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }
}
```

#### Step 13: Update Knowledge Service
**File**: `ClubOSV1-backend/src/services/knowledgeService.ts`
```typescript
export class KnowledgeService {
  async add(data: {
    category: string;
    key: string;
    value: string;
    confidence: number;
    metadata?: any;
    assistant_target?: string;
  }) {
    // Store in knowledge_items table
    const result = await db.query(`
      INSERT INTO knowledge_items 
      (category, key, value, confidence, metadata, assistant_target, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (key, category) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        confidence = GREATEST(knowledge_items.confidence, EXCLUDED.confidence),
        metadata = knowledge_items.metadata || EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `, [
      data.category,
      data.key,
      data.value,
      data.confidence,
      JSON.stringify(data.metadata || {}),
      data.assistant_target || 'all'
    ]);
    
    // Also store in knowledge_patterns for pattern matching
    await this.addPattern(data);
    
    // Update vector embeddings for semantic search
    await this.updateEmbeddings(data);
    
    return result.rows[0];
  }
  
  async addPattern(data: any) {
    // Extract patterns from the value
    const patterns = this.extractPatterns(data.value);
    
    for (const pattern of patterns) {
      await db.query(`
        INSERT INTO knowledge_patterns
        (pattern, response, category, confidence, context)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (pattern) DO UPDATE SET
          response = EXCLUDED.response,
          confidence = GREATEST(knowledge_patterns.confidence, EXCLUDED.confidence)
      `, [
        pattern,
        data.value,
        data.category,
        data.confidence,
        JSON.stringify({ key: data.key, ...data.metadata })
      ]);
    }
  }
  
  extractPatterns(text: string): string[] {
    // Generate various patterns for matching
    const patterns = [];
    
    // Direct match
    patterns.push(text.toLowerCase());
    
    // Question forms
    if (text.includes('gift card')) {
      patterns.push('how do i buy a gift card');
      patterns.push('where can i get gift cards');
      patterns.push('do you sell gift cards');
    }
    
    // Add more pattern generation logic
    
    return patterns;
  }
}
```

#### Step 14: Integrate with LLM Request Flow
**File**: `ClubOSV1-backend/src/routes/llm.ts`
```typescript
// Update the /request endpoint to check knowledge first
router.post('/request', authenticate, async (req, res) => {
  try {
    const { description, route, location, isFromDashboard } = req.body;
    
    // ALWAYS check knowledge store first
    const knowledgeResult = await knowledgeService.search(description, {
      category: route?.toLowerCase(),
      minConfidence: 0.7,
      location
    });
    
    if (knowledgeResult.found && knowledgeResult.confidence > 0.85) {
      // Return knowledge-based response
      return res.json({
        success: true,
        data: {
          response: knowledgeResult.answer,
          confidence: knowledgeResult.confidence,
          source: 'knowledge_store',
          route: route || 'Auto',
          metadata: {
            knowledge_key: knowledgeResult.key,
            knowledge_id: knowledgeResult.id
          }
        }
      });
    }
    
    // Continue with normal LLM processing if no knowledge found
    // ... existing LLM code
  } catch (error) {
    // ... error handling
  }
});
```

#### Step 15: Add Knowledge Search Optimization
**File**: `ClubOSV1-backend/src/services/knowledgeSearchService.ts` (NEW)
```typescript
export class KnowledgeSearchService {
  private cache: Map<string, any> = new Map();
  
  async search(query: string, options: {
    category?: string;
    minConfidence?: number;
    location?: string;
    useCache?: boolean;
  } = {}) {
    const cacheKey = `${query}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (options.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 min cache
        return cached.data;
      }
    }
    
    // Try exact match first
    const exactMatch = await this.exactMatch(query, options);
    if (exactMatch) {
      const result = {
        found: true,
        answer: exactMatch.value,
        confidence: exactMatch.confidence,
        key: exactMatch.key,
        id: exactMatch.id
      };
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    
    // Try pattern matching
    const patternMatch = await this.patternMatch(query, options);
    if (patternMatch) {
      const result = {
        found: true,
        answer: patternMatch.response,
        confidence: patternMatch.confidence,
        key: patternMatch.pattern,
        id: patternMatch.id
      };
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    
    // Try semantic search with embeddings
    const semanticMatch = await this.semanticSearch(query, options);
    if (semanticMatch && semanticMatch.similarity > 0.8) {
      const result = {
        found: true,
        answer: semanticMatch.value,
        confidence: semanticMatch.similarity,
        key: semanticMatch.key,
        id: semanticMatch.id
      };
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }
    
    return { found: false };
  }
  
  private async exactMatch(query: string, options: any) {
    const result = await db.query(`
      SELECT * FROM knowledge_items
      WHERE LOWER(key) = LOWER($1)
      ${options.category ? 'AND category = $2' : ''}
      AND confidence >= $3
      ORDER BY confidence DESC
      LIMIT 1
    `, [
      query,
      ...(options.category ? [options.category] : []),
      options.minConfidence || 0.5
    ]);
    
    return result.rows[0];
  }
  
  private async patternMatch(query: string, options: any) {
    const result = await db.query(`
      SELECT * FROM knowledge_patterns
      WHERE $1 ILIKE '%' || pattern || '%'
      OR pattern ILIKE '%' || $1 || '%'
      ${options.category ? 'AND category = $2' : ''}
      AND confidence >= $3
      ORDER BY confidence DESC, LENGTH(pattern) DESC
      LIMIT 1
    `, [
      query.toLowerCase(),
      ...(options.category ? [options.category] : []),
      options.minConfidence || 0.5
    ]);
    
    return result.rows[0];
  }
  
  private async semanticSearch(query: string, options: any) {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Search by cosine similarity
    const result = await db.query(`
      SELECT 
        *,
        1 - (embedding <=> $1::vector) as similarity
      FROM knowledge_items
      WHERE embedding IS NOT NULL
      ${options.category ? 'AND category = $2' : ''}
      AND confidence >= $3
      ORDER BY similarity DESC
      LIMIT 1
    `, [
      queryEmbedding,
      ...(options.category ? [options.category] : []),
      options.minConfidence || 0.5
    ]);
    
    return result.rows[0];
  }
}
```

#### Step 16: Add Knowledge Analytics
**File**: `ClubOSV1-backend/src/routes/knowledge-analytics.ts` (NEW)
```typescript
router.get('/analytics/usage', authenticate, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_knowledge_items,
        COUNT(DISTINCT category) as categories,
        AVG(confidence) as avg_confidence,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '${period}' THEN 1 END) as recent_additions,
        COUNT(CASE WHEN last_used > NOW() - INTERVAL '24 hours' THEN 1 END) as used_today
      FROM knowledge_items
    `);
    
    const categoryBreakdown = await db.query(`
      SELECT 
        category,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        MAX(created_at) as last_added
      FROM knowledge_items
      GROUP BY category
      ORDER BY count DESC
    `);
    
    const topUsed = await db.query(`
      SELECT 
        key,
        value,
        category,
        use_count,
        last_used
      FROM knowledge_items
      WHERE use_count > 0
      ORDER BY use_count DESC
      LIMIT 10
    `);
    
    return res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        categories: categoryBreakdown.rows,
        topUsed: topUsed.rows
      }
    });
  } catch (error) {
    console.error('Knowledge analytics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});
```

#### Step 17: Add Bulk Knowledge Import
**File**: `ClubOSV1-backend/src/routes/knowledge-import.ts` (NEW)
```typescript
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const upload = multer({ memory: true });

router.post('/import/csv', authenticate, upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const errors = [];
    
    const stream = Readable.from(req.file.buffer.toString());
    
    stream
      .pipe(csv())
      .on('data', async (row) => {
        try {
          // Expected CSV format: category,key,value,confidence
          const result = await knowledgeService.add({
            category: row.category || 'general',
            key: row.key,
            value: row.value,
            confidence: parseFloat(row.confidence) || 0.8,
            metadata: {
              source: 'csv_import',
              imported_by: req.user.username,
              imported_at: new Date()
            }
          });
          results.push(result);
        } catch (error) {
          errors.push({ row, error: error.message });
        }
      })
      .on('end', () => {
        res.json({
          success: true,
          data: {
            imported: results.length,
            failed: errors.length,
            errors: errors.slice(0, 10) // First 10 errors
          }
        });
      });
  } catch (error) {
    console.error('CSV import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import CSV'
    });
  }
});

router.post('/import/json', authenticate, async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items must be an array'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const item of items) {
      try {
        const result = await knowledgeService.add({
          category: item.category || 'general',
          key: item.key,
          value: item.value,
          confidence: item.confidence || 0.8,
          metadata: {
            source: 'json_import',
            imported_by: req.user.username,
            imported_at: new Date(),
            ...item.metadata
          }
        });
        results.push(result);
      } catch (error) {
        errors.push({ item, error: error.message });
      }
    }
    
    return res.json({
      success: true,
      data: {
        imported: results.length,
        failed: errors.length,
        errors: errors.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('JSON import error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import JSON'
    });
  }
});
```

#### Step 18: Add Knowledge Validation
**File**: `ClubOSV1-backend/src/services/knowledgeValidationService.ts` (NEW)
```typescript
export class KnowledgeValidationService {
  async validate(input: {
    category: string;
    key: string;
    value: string;
    confidence: number;
  }): Promise<{ valid: boolean; errors: string[] }> {
    const errors = [];
    
    // Validate category
    const validCategories = [
      'general', 'booking', 'tech', 'emergency', 
      'pricing', 'equipment', 'policies', 'hours'
    ];
    if (!validCategories.includes(input.category)) {
      errors.push(`Invalid category: ${input.category}`);
    }
    
    // Validate key format
    if (!input.key || input.key.length < 3) {
      errors.push('Key must be at least 3 characters');
    }
    if (!/^[a-z0-9._-]+$/i.test(input.key)) {
      errors.push('Key can only contain letters, numbers, dots, dashes, and underscores');
    }
    
    // Validate value
    if (!input.value || input.value.length < 10) {
      errors.push('Value must be at least 10 characters');
    }
    if (input.value.length > 2000) {
      errors.push('Value cannot exceed 2000 characters');
    }
    
    // Validate confidence
    if (input.confidence < 0.5 || input.confidence > 1) {
      errors.push('Confidence must be between 0.5 and 1.0');
    }
    
    // Check for spam/inappropriate content
    const spam = await this.checkSpam(input.value);
    if (spam) {
      errors.push('Content appears to be spam or inappropriate');
    }
    
    // Check for PII
    const pii = this.checkPII(input.value);
    if (pii.length > 0) {
      errors.push(`Potential PII detected: ${pii.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private checkPII(text: string): string[] {
    const piiTypes = [];
    
    // SSN pattern
    if (/\d{3}-\d{2}-\d{4}/.test(text)) {
      piiTypes.push('SSN');
    }
    
    // Credit card pattern
    if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)) {
      piiTypes.push('Credit Card');
    }
    
    // Email (in certain contexts)
    if (/@.*\.(com|org|net|edu)/.test(text) && text.includes('personal')) {
      piiTypes.push('Personal Email');
    }
    
    return piiTypes;
  }
  
  private async checkSpam(text: string): Promise<boolean> {
    // Simple spam detection
    const spamKeywords = [
      'viagra', 'casino', 'lottery', 'winner', 
      'click here', 'act now', 'limited time'
    ];
    
    const lowerText = text.toLowerCase();
    return spamKeywords.some(keyword => lowerText.includes(keyword));
  }
}
```

#### Step 19: Add Knowledge Versioning
**File**: `ClubOSV1-backend/src/services/knowledgeVersioningService.ts` (NEW)
```typescript
export class KnowledgeVersioningService {
  async createVersion(knowledgeId: string, userId: string) {
    // Get current version
    const current = await db.query(
      'SELECT * FROM knowledge_items WHERE id = $1',
      [knowledgeId]
    );
    
    if (!current.rows[0]) {
      throw new Error('Knowledge item not found');
    }
    
    // Store in history
    await db.query(`
      INSERT INTO knowledge_history
      (knowledge_id, category, key, value, confidence, metadata, version, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      knowledgeId,
      current.rows[0].category,
      current.rows[0].key,
      current.rows[0].value,
      current.rows[0].confidence,
      current.rows[0].metadata,
      current.rows[0].version || 1,
      userId
    ]);
    
    // Increment version
    await db.query(
      'UPDATE knowledge_items SET version = COALESCE(version, 1) + 1 WHERE id = $1',
      [knowledgeId]
    );
  }
  
  async rollback(knowledgeId: string, version: number) {
    // Get historical version
    const historical = await db.query(`
      SELECT * FROM knowledge_history 
      WHERE knowledge_id = $1 AND version = $2
    `, [knowledgeId, version]);
    
    if (!historical.rows[0]) {
      throw new Error('Version not found');
    }
    
    // Create new version from historical
    await this.createVersion(knowledgeId, 'system');
    
    // Update current with historical data
    await db.query(`
      UPDATE knowledge_items 
      SET category = $1, key = $2, value = $3, confidence = $4, metadata = $5
      WHERE id = $6
    `, [
      historical.rows[0].category,
      historical.rows[0].key,
      historical.rows[0].value,
      historical.rows[0].confidence,
      historical.rows[0].metadata,
      knowledgeId
    ]);
  }
}
```

#### Step 20: Add Knowledge Export
**File**: `ClubOSV1-backend/src/routes/knowledge-export.ts` (NEW)
```typescript
router.get('/export/:format', authenticate, async (req, res) => {
  try {
    const { format } = req.params;
    const { category, minConfidence } = req.query;
    
    let query = 'SELECT * FROM knowledge_items WHERE 1=1';
    const params = [];
    
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    if (minConfidence) {
      params.push(parseFloat(minConfidence));
      query += ` AND confidence >= $${params.length}`;
    }
    
    query += ' ORDER BY category, key';
    
    const result = await db.query(query, params);
    
    switch (format) {
      case 'json':
        res.json({
          success: true,
          data: result.rows,
          exported_at: new Date(),
          count: result.rows.length
        });
        break;
        
      case 'csv':
        const csv = [
          'category,key,value,confidence,created_at',
          ...result.rows.map(row => 
            `"${row.category}","${row.key}","${row.value}",${row.confidence},"${row.created_at}"`
          )
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=knowledge-export.csv');
        res.send(csv);
        break;
        
      case 'markdown':
        const markdown = result.rows.reduce((acc, row) => {
          if (!acc[row.category]) {
            acc[row.category] = [`## ${row.category}\n`];
          }
          acc[row.category].push(`- **${row.key}**: ${row.value} (${(row.confidence * 100).toFixed(0)}%)`);
          return acc;
        }, {});
        
        const mdContent = Object.values(markdown).flat().join('\n');
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', 'attachment; filename=knowledge-export.md');
        res.send(mdContent);
        break;
        
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid format. Use json, csv, or markdown'
        });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export knowledge'
    });
  }
});
```

### Phase 3: Database & Testing (Steps 21-30)

#### Step 21: Database Schema Updates
**File**: `ClubOSV1-backend/src/database/migrations/056_knowledge_toggle_support.sql` (NEW)
```sql
-- Add new columns for enhanced knowledge tracking
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS 
  source VARCHAR(50) DEFAULT 'manual',
  use_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES knowledge_items(id),
  is_active BOOLEAN DEFAULT true;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_items(source);
CREATE INDEX IF NOT EXISTS idx_knowledge_use_count ON knowledge_items(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON knowledge_items(is_active);

-- Create knowledge history table
CREATE TABLE IF NOT EXISTS knowledge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_id UUID REFERENCES knowledge_items(id),
  category VARCHAR(100),
  key VARCHAR(255),
  value TEXT,
  confidence DECIMAL(3,2),
  metadata JSONB,
  version INTEGER,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create knowledge activity log
CREATE TABLE IF NOT EXISTS knowledge_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(50),
  knowledge_id UUID,
  user_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add vector column for semantic search (requires pgvector extension)
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS 
  embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding 
  ON knowledge_items USING ivfflat (embedding vector_cosine_ops);
```

#### Step 22: Add Knowledge Monitoring
**File**: `ClubOSV1-backend/src/services/knowledgeMonitoringService.ts` (NEW)
```typescript
export class KnowledgeMonitoringService {
  async trackUsage(knowledgeId: string) {
    await db.query(`
      UPDATE knowledge_items 
      SET use_count = use_count + 1,
          last_used = NOW()
      WHERE id = $1
    `, [knowledgeId]);
  }
  
  async getUnusedKnowledge(days: number = 30) {
    const result = await db.query(`
      SELECT * FROM knowledge_items
      WHERE (last_used IS NULL OR last_used < NOW() - INTERVAL '${days} days')
      AND is_active = true
      ORDER BY created_at DESC
    `);
    
    return result.rows;
  }
  
  async getPopularKnowledge(limit: number = 10) {
    const result = await db.query(`
      SELECT 
        k.*,
        COUNT(a.id) as activity_count
      FROM knowledge_items k
      LEFT JOIN knowledge_activity a ON k.id = a.knowledge_id
      WHERE k.is_active = true
      GROUP BY k.id
      ORDER BY k.use_count DESC, activity_count DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  }
  
  async auditKnowledge() {
    const issues = [];
    
    // Check for duplicates
    const duplicates = await db.query(`
      SELECT key, category, COUNT(*) as count
      FROM knowledge_items
      WHERE is_active = true
      GROUP BY key, category
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.rows.length > 0) {
      issues.push({
        type: 'duplicates',
        count: duplicates.rows.length,
        items: duplicates.rows
      });
    }
    
    // Check for low confidence items
    const lowConfidence = await db.query(`
      SELECT * FROM knowledge_items
      WHERE confidence < 0.6
      AND is_active = true
    `);
    
    if (lowConfidence.rows.length > 0) {
      issues.push({
        type: 'low_confidence',
        count: lowConfidence.rows.length,
        items: lowConfidence.rows.slice(0, 10)
      });
    }
    
    // Check for stale items
    const stale = await this.getUnusedKnowledge(60);
    if (stale.length > 0) {
      issues.push({
        type: 'stale',
        count: stale.length,
        items: stale.slice(0, 10)
      });
    }
    
    return issues;
  }
}
```

#### Step 23: Add Knowledge Testing Framework
**File**: `ClubOSV1-backend/src/tests/knowledge.test.ts` (NEW)
```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { KnowledgeService } from '../services/knowledgeService';
import { KnowledgeParserService } from '../services/knowledgeParserService';

describe('Knowledge System', () => {
  let knowledgeService: KnowledgeService;
  let parserService: KnowledgeParserService;
  
  beforeEach(() => {
    knowledgeService = new KnowledgeService();
    parserService = new KnowledgeParserService();
  });
  
  describe('Parser', () => {
    it('should parse gift card information', async () => {
      const input = 'Gift cards can be purchased at website.com/giftcards for $25, $50, or $100';
      const result = await parserService.parseKnowledgeInput(input);
      
      expect(result.key).toBe('giftcard.purchase.url');
      expect(result.category).toBe('pricing');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
    
    it('should parse business hours', async () => {
      const input = 'We are open Monday to Friday 9am-5pm, weekends 10am-4pm';
      const result = await parserService.parseKnowledgeInput(input);
      
      expect(result.category).toBe('hours');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
    
    it('should detect duplicate knowledge', async () => {
      const existing = await knowledgeService.add({
        category: 'pricing',
        key: 'giftcard.url',
        value: 'website.com/giftcards',
        confidence: 0.9
      });
      
      const duplicates = await parserService.detectDuplicates('giftcard.url', 'pricing');
      expect(duplicates.length).toBeGreaterThan(0);
    });
  });
  
  describe('Search', () => {
    it('should find knowledge by exact match', async () => {
      await knowledgeService.add({
        category: 'tech',
        key: 'trackman.reset',
        value: 'To reset Trackman, press and hold the power button for 10 seconds',
        confidence: 1.0
      });
      
      const result = await knowledgeService.search('trackman.reset');
      expect(result.found).toBe(true);
      expect(result.confidence).toBe(1.0);
    });
    
    it('should find knowledge by pattern', async () => {
      await knowledgeService.add({
        category: 'pricing',
        key: 'giftcard.info',
        value: 'Gift cards available at website.com',
        confidence: 0.9
      });
      
      const result = await knowledgeService.search('how do I buy a gift card');
      expect(result.found).toBe(true);
    });
    
    it('should respect confidence threshold', async () => {
      await knowledgeService.add({
        category: 'general',
        key: 'test.low',
        value: 'Low confidence info',
        confidence: 0.4
      });
      
      const result = await knowledgeService.search('test.low', {
        minConfidence: 0.5
      });
      expect(result.found).toBe(false);
    });
  });
  
  describe('Dashboard Integration', () => {
    it('should process knowledge from dashboard input', async () => {
      const input = {
        input: 'Our membership costs $99/month and includes unlimited play',
        category: 'pricing',
        confidence: 0.95,
        source: 'dashboard_input'
      };
      
      const result = await knowledgeService.processFromDashboard(input);
      expect(result.success).toBe(true);
      expect(result.data.key).toContain('membership');
    });
  });
});
```

#### Step 24: Add Integration Tests
**File**: `ClubOSV1-backend/src/tests/integration/knowledge-flow.test.ts` (NEW)
```typescript
describe('Knowledge Flow Integration', () => {
  it('should complete full knowledge flow', async () => {
    // 1. Add knowledge via dashboard
    const addResponse = await request(app)
      .post('/api/knowledge/unified-add')
      .set('Authorization', `Bearer ${token}`)
      .send({
        input: 'Gift cards are $50 at store.com/gift',
        category: 'pricing',
        confidence: 0.9
      });
    
    expect(addResponse.body.success).toBe(true);
    const knowledgeId = addResponse.body.data.id;
    
    // 2. Verify LLM uses the knowledge
    const llmResponse = await request(app)
      .post('/api/llm/request')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Where can I buy gift cards?',
        route: 'Auto'
      });
    
    expect(llmResponse.body.data.source).toBe('knowledge_store');
    expect(llmResponse.body.data.response).toContain('store.com/gift');
    
    // 3. Verify usage tracking
    const analyticsResponse = await request(app)
      .get('/api/knowledge/analytics/usage')
      .set('Authorization', `Bearer ${token}`);
    
    const usedItem = analyticsResponse.body.data.topUsed
      .find(item => item.id === knowledgeId);
    expect(usedItem.use_count).toBeGreaterThan(0);
  });
});
```

#### Step 25: Add Frontend Tests
**File**: `ClubOSV1-frontend/src/components/__tests__/ModeToggle.test.tsx` (NEW)
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeToggle } from '../ModeToggle';

describe('ModeToggle', () => {
  it('should render all four modes', () => {
    render(<ModeToggle mode="assist" onChange={() => {}} />);
    
    expect(screen.getByText('Smart Assist')).toBeInTheDocument();
    expect(screen.getByText('Create Ticket')).toBeInTheDocument();
    expect(screen.getByText('Tone Convert')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
  });
  
  it('should call onChange when mode clicked', () => {
    const onChange = jest.fn();
    render(<ModeToggle mode="assist" onChange={onChange} />);
    
    fireEvent.click(screen.getByText('Knowledge'));
    expect(onChange).toHaveBeenCalledWith('knowledge');
  });
  
  it('should highlight active mode', () => {
    render(<ModeToggle mode="knowledge" onChange={() => {}} />);
    
    const knowledgeButton = screen.getByText('Knowledge').parentElement;
    expect(knowledgeButton).toHaveClass('bg-blue-600');
  });
});
```

#### Step 26: Add Performance Monitoring
**File**: `ClubOSV1-backend/src/middleware/knowledgePerformance.ts` (NEW)
```typescript
export const knowledgePerformanceMiddleware = (req, res, next) => {
  if (!req.path.includes('/knowledge')) {
    return next();
  }
  
  const start = Date.now();
  
  // Override res.json to capture timing
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    
    // Log performance metrics
    logger.info('Knowledge API Performance', {
      path: req.path,
      method: req.method,
      duration,
      success: data?.success,
      cacheHit: data?.metadata?.cacheHit,
      resultCount: data?.data?.length || 1
    });
    
    // Add performance headers
    res.set('X-Response-Time', `${duration}ms`);
    res.set('X-Cache-Hit', data?.metadata?.cacheHit ? 'true' : 'false');
    
    // Track slow queries
    if (duration > 1000) {
      logger.warn('Slow knowledge query', {
        path: req.path,
        duration,
        query: req.body || req.query
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};
```

#### Step 27: Add Knowledge Backup & Recovery
**File**: `ClubOSV1-backend/src/services/knowledgeBackupService.ts` (NEW)
```typescript
export class KnowledgeBackupService {
  async createBackup(userId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup-${timestamp}`;
    
    // Export all knowledge
    const knowledge = await db.query(
      'SELECT * FROM knowledge_items WHERE is_active = true'
    );
    
    const patterns = await db.query(
      'SELECT * FROM knowledge_patterns'
    );
    
    const backup = {
      id: backupId,
      created_at: new Date(),
      created_by: userId,
      items_count: knowledge.rows.length,
      patterns_count: patterns.rows.length,
      data: {
        knowledge_items: knowledge.rows,
        knowledge_patterns: patterns.rows
      }
    };
    
    // Store backup
    await db.query(
      'INSERT INTO knowledge_backups (id, data, created_by) VALUES ($1, $2, $3)',
      [backupId, JSON.stringify(backup), userId]
    );
    
    return backupId;
  }
  
  async restore(backupId: string, userId: string): Promise<void> {
    const backup = await db.query(
      'SELECT * FROM knowledge_backups WHERE id = $1',
      [backupId]
    );
    
    if (!backup.rows[0]) {
      throw new Error('Backup not found');
    }
    
    const data = JSON.parse(backup.rows[0].data);
    
    // Begin transaction
    await db.query('BEGIN');
    
    try {
      // Clear existing data
      await db.query('UPDATE knowledge_items SET is_active = false');
      
      // Restore knowledge items
      for (const item of data.data.knowledge_items) {
        await db.query(`
          INSERT INTO knowledge_items 
          (category, key, value, confidence, metadata, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (key, category) DO UPDATE SET
            value = EXCLUDED.value,
            confidence = EXCLUDED.confidence,
            is_active = true
        `, [
          item.category,
          item.key,
          item.value,
          item.confidence,
          item.metadata
        ]);
      }
      
      // Restore patterns
      for (const pattern of data.data.knowledge_patterns) {
        await db.query(`
          INSERT INTO knowledge_patterns
          (pattern, response, category, confidence, context)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (pattern) DO UPDATE SET
            response = EXCLUDED.response,
            confidence = EXCLUDED.confidence
        `, [
          pattern.pattern,
          pattern.response,
          pattern.category,
          pattern.confidence,
          pattern.context
        ]);
      }
      
      await db.query('COMMIT');
      
      // Log restoration
      await db.query(`
        INSERT INTO knowledge_activity
        (action, user_id, details)
        VALUES ('restore', $1, $2)
      `, [userId, { backup_id: backupId, items_restored: data.items_count }]);
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
}
```

#### Step 28: Add Knowledge Sync Service
**File**: `ClubOSV1-backend/src/services/knowledgeSyncService.ts` (NEW)
```typescript
export class KnowledgeSyncService {
  async syncWithAssistants() {
    const assistants = [
      { id: process.env.EMERGENCY_ASSISTANT_ID, name: 'emergency' },
      { id: process.env.BOOKING_ASSISTANT_ID, name: 'booking' },
      { id: process.env.TECH_ASSISTANT_ID, name: 'tech' },
      { id: process.env.BRAND_ASSISTANT_ID, name: 'brand' }
    ];
    
    for (const assistant of assistants) {
      await this.syncAssistant(assistant);
    }
  }
  
  private async syncAssistant(assistant: { id: string; name: string }) {
    // Get knowledge for this assistant
    const knowledge = await db.query(`
      SELECT * FROM knowledge_items
      WHERE (assistant_target = $1 OR assistant_target = 'all')
      AND is_active = true
      ORDER BY confidence DESC
    `, [assistant.name]);
    
    // Format for assistant
    const instructions = knowledge.rows.map(item => 
      `${item.key}: ${item.value}`
    ).join('\n');
    
    // Update assistant via OpenAI API
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    await openai.beta.assistants.update(assistant.id, {
      instructions: `
        You are the ${assistant.name} assistant.
        
        IMPORTANT KNOWLEDGE:
        ${instructions}
        
        Always check this knowledge first before generating responses.
      `
    });
    
    console.log(`Synced ${knowledge.rows.length} items to ${assistant.name} assistant`);
  }
}
```

#### Step 29: Add Migration Script
**File**: `ClubOSV1-backend/src/scripts/migrate-knowledge-ui.ts` (NEW)
```typescript
#!/usr/bin/env node

/**
 * Migration script to consolidate knowledge management into dashboard
 * Run this after implementing the new toggle system
 */

async function migrateKnowledgeUI() {
  console.log('Starting knowledge UI migration...');
  
  // 1. Check existing knowledge data
  const existingCount = await db.query(
    'SELECT COUNT(*) FROM knowledge_items'
  );
  console.log(`Found ${existingCount.rows[0].count} existing knowledge items`);
  
  // 2. Update source field for existing items
  await db.query(`
    UPDATE knowledge_items 
    SET source = 'legacy_ui' 
    WHERE source IS NULL OR source = 'manual'
  `);
  
  // 3. Create default categories if missing
  const categories = [
    'general', 'booking', 'tech', 'emergency', 
    'pricing', 'equipment', 'policies', 'hours'
  ];
  
  for (const category of categories) {
    await db.query(`
      INSERT INTO knowledge_categories (name, description, is_active)
      VALUES ($1, $2, true)
      ON CONFLICT (name) DO NOTHING
    `, [category, `${category} knowledge items`]);
  }
  
  // 4. Update user permissions
  await db.query(`
    UPDATE user_permissions 
    SET can_manage_knowledge = true 
    WHERE role IN ('Admin', 'Operator')
  `);
  
  // 5. Create initial backup
  const backupService = new KnowledgeBackupService();
  const backupId = await backupService.createBackup('migration');
  console.log(`Created backup: ${backupId}`);
  
  // 6. Generate migration report
  const report = {
    timestamp: new Date(),
    items_migrated: existingCount.rows[0].count,
    backup_id: backupId,
    new_features: [
      'Dashboard toggle integration',
      'Natural language parsing',
      'Category auto-detection',
      'Confidence scoring',
      'Usage analytics'
    ]
  };
  
  await fs.writeFile(
    'knowledge-migration-report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('Migration completed successfully!');
  console.log('Report saved to knowledge-migration-report.json');
}

// Run migration
migrateKnowledgeUI().catch(console.error);
```

#### Step 30: Create Deployment Checklist
**File**: `KNOWLEDGE-TOGGLE-DEPLOYMENT.md` (NEW)
```markdown
# Knowledge Toggle Deployment Checklist

## Pre-Deployment (Dev Environment)

### Backend Preparation
- [ ] Run database migration 056_knowledge_toggle_support.sql
- [ ] Deploy all new backend services
- [ ] Test knowledge parser with GPT-4o
- [ ] Verify knowledge search performance
- [ ] Run integration tests
- [ ] Check API backwards compatibility

### Frontend Preparation
- [ ] Build and test ModeToggle component
- [ ] Update RequestForm with knowledge mode
- [ ] Test all 4 modes thoroughly
- [ ] Verify mobile responsiveness
- [ ] Test keyboard shortcuts
- [ ] Check accessibility

### Testing
- [ ] Add knowledge via dashboard toggle
- [ ] Verify knowledge appears in LLM responses
- [ ] Test knowledge categories
- [ ] Test confidence thresholds
- [ ] Test duplicate detection
- [ ] Test validation rules
- [ ] Test import/export functionality

## Staging Deployment

### Deploy Order
1. [ ] Database migrations
2. [ ] Backend services
3. [ ] Frontend application
4. [ ] Run migration script

### Smoke Tests
- [ ] Dashboard loads with 4-way toggle
- [ ] Can switch between all modes
- [ ] Knowledge submission works
- [ ] LLM uses knowledge store
- [ ] Analytics tracking works
- [ ] No console errors

### Performance Tests
- [ ] Knowledge search < 100ms
- [ ] Dashboard load time unchanged
- [ ] No memory leaks
- [ ] Cache working properly

## Production Deployment

### Pre-Deploy
- [ ] Backup production database
- [ ] Notify team of deployment
- [ ] Check system health
- [ ] Review error logs

### Deploy
- [ ] Run database migration
- [ ] Deploy backend (Railway)
- [ ] Deploy frontend (Vercel)
- [ ] Run migration script
- [ ] Clear caches

### Post-Deploy Verification
- [ ] All modes working
- [ ] Knowledge submission successful
- [ ] Test with real query
- [ ] Check analytics
- [ ] Monitor error rates
- [ ] Check response times

### Rollback Plan
If issues occur:
1. [ ] Revert frontend to previous version
2. [ ] Revert backend to previous version
3. [ ] Restore database from backup
4. [ ] Clear all caches
5. [ ] Notify team

## User Communication

### Documentation Updates
- [ ] Update user guide
- [ ] Create knowledge entry tutorial
- [ ] Document best practices
- [ ] Update API documentation

### Training Materials
- [ ] Create video walkthrough
- [ ] Write knowledge examples
- [ ] Prepare FAQ section

### Announcement
- [ ] Prepare feature announcement
- [ ] Highlight benefits
- [ ] Include examples
- [ ] Share in team channel

## Success Metrics (First Week)

### Usage Metrics
- [ ] Knowledge items added via toggle
- [ ] Reduction in separate knowledge page visits
- [ ] User engagement with new mode
- [ ] Knowledge hit rate in LLM requests

### Performance Metrics
- [ ] API response times
- [ ] Knowledge search performance
- [ ] Cache hit rates
- [ ] Error rates

### Quality Metrics
- [ ] Knowledge accuracy
- [ ] Duplicate rate
- [ ] Validation failures
- [ ] User feedback

## Long-term Monitoring

### Weekly Reviews
- [ ] Knowledge growth rate
- [ ] Most used categories
- [ ] Low confidence items
- [ ] Unused knowledge

### Monthly Tasks
- [ ] Knowledge audit
- [ ] Performance optimization
- [ ] Backup verification
- [ ] Usage report

### Quarterly Tasks
- [ ] Knowledge cleanup
- [ ] Category review
- [ ] Assistant sync audit
- [ ] Feature improvements
```

## Summary

This comprehensive 30-step plan will:

1. **Consolidate UI**: Merge knowledge management into the main dashboard with a 4-way toggle
2. **Enhance UX**: Natural language input with GPT-4o parsing
3. **Improve Performance**: Local knowledge checks before OpenAI calls
4. **Add Features**: Categories, confidence, versioning, import/export
5. **Ensure Quality**: Validation, testing, monitoring, backups

The implementation is designed to be thorough and production-ready, addressing the issue that "this has never truly worked" by:
- Complete integration with existing LLM flow
- Robust error handling and validation
- Comprehensive testing at every level
- Performance optimization with caching
- Full backup and recovery capabilities
- Detailed monitoring and analytics

This will successfully condense the program by eliminating separate knowledge pages while making knowledge management more accessible and intuitive.