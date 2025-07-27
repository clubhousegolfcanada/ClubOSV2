import { logger } from '../utils/logger';
import { db } from '../utils/database';

interface RoutingPattern {
  pattern: string;
  currentRoute: string;
  suggestedRoute: string;
  confidence: number;
  occurrences: number;
}

interface RoutingOptimization {
  patterns: RoutingPattern[];
  keywordAdjustments: Record<string, { add: string[], remove: string[] }>;
  confidenceThresholds: Record<string, number>;
}

export class RoutingOptimizer {
  private static instance: RoutingOptimizer;

  private constructor() {}

  static getInstance(): RoutingOptimizer {
    if (!RoutingOptimizer.instance) {
      RoutingOptimizer.instance = new RoutingOptimizer();
    }
    return RoutingOptimizer.instance;
  }

  /**
   * Analyze feedback to identify routing improvements
   */
  async analyzeRoutingFeedback(days: number = 30): Promise<RoutingOptimization> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get unhelpful feedback with request patterns
    const unhelpfulPatterns = await db.query(`
      WITH feedback_patterns AS (
        SELECT 
          f.route,
          f.request_description,
          f.confidence,
          -- Extract key phrases (3-4 word combinations)
          regexp_split_to_array(LOWER(f.request_description), '\\s+') as words
        FROM feedback f
        WHERE f.is_useful = false
          AND f.timestamp >= $1
      ),
      phrase_analysis AS (
        SELECT 
          route,
          ARRAY_TO_STRING(words[i:i+2], ' ') as phrase,
          COUNT(*) as occurrences,
          AVG(confidence) as avg_confidence
        FROM feedback_patterns,
          generate_series(1, array_length(words, 1) - 2) as i
        WHERE array_length(words, 1) >= 3
        GROUP BY route, phrase
        HAVING COUNT(*) >= 2
      )
      SELECT * FROM phrase_analysis
      ORDER BY occurrences DESC, avg_confidence ASC
    `, [startDate]);

    // Analyze cross-route patterns
    const crossRoutePatterns = await db.query(`
      WITH request_analysis AS (
        SELECT 
          ci.request_text,
          ci.route as assigned_route,
          f.is_useful,
          COUNT(*) as feedback_count,
          SUM(CASE WHEN f.is_useful = false THEN 1 ELSE 0 END) as unhelpful_count
        FROM customer_interactions ci
        LEFT JOIN feedback f ON f.request_description = ci.request_text
        WHERE ci."createdAt" >= $1
        GROUP BY ci.request_text, ci.route, f.is_useful
      )
      SELECT 
        assigned_route,
        request_text,
        unhelpful_count,
        feedback_count,
        ROUND(100.0 * unhelpful_count / NULLIF(feedback_count, 0), 2) as unhelpful_rate
      FROM request_analysis
      WHERE feedback_count > 0 AND unhelpful_count > 0
      ORDER BY unhelpful_rate DESC, unhelpful_count DESC
      LIMIT 50
    `, [startDate]);

    // Generate optimization suggestions
    const patterns = this.identifyMisroutedPatterns(unhelpfulPatterns.rows, crossRoutePatterns.rows);
    const keywordAdjustments = this.suggestKeywordAdjustments(patterns);
    const confidenceThresholds = await this.calculateOptimalConfidenceThresholds();

    return {
      patterns,
      keywordAdjustments,
      confidenceThresholds
    };
  }

  /**
   * Identify patterns that are consistently misrouted
   */
  private identifyMisroutedPatterns(
    unhelpfulPatterns: any[],
    crossRoutePatterns: any[]
  ): RoutingPattern[] {
    const patterns: RoutingPattern[] = [];
    
    // Analyze each unhelpful pattern
    for (const pattern of unhelpfulPatterns) {
      const suggestedRoute = this.suggestBetterRoute(pattern.phrase);
      
      if (suggestedRoute && suggestedRoute !== pattern.route) {
        patterns.push({
          pattern: pattern.phrase,
          currentRoute: pattern.route,
          suggestedRoute,
          confidence: pattern.avg_confidence,
          occurrences: pattern.occurrences
        });
      }
    }

    // Sort by impact (occurrences * confidence delta)
    return patterns.sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Suggest a better route based on keywords
   */
  private suggestBetterRoute(phrase: string): string | null {
    const lowerPhrase = phrase.toLowerCase();
    
    // Emergency indicators
    if (/(emergency|fire|injury|accident|smoke|hurt|danger|security)/.test(lowerPhrase)) {
      return 'Emergency';
    }
    
    // Booking & Access indicators
    if (/(book|reservation|cancel|refund|access|door|key|card|locked|payment|return)/.test(lowerPhrase)) {
      return 'Booking & Access';
    }
    
    // TechSupport indicators
    if (/(trackman|screen|equipment|tech|broken|restart|simulator|not working|frozen|calibrat|sensor|ball|tracking)/.test(lowerPhrase)) {
      return 'TechSupport';
    }
    
    // BrandTone indicators (very specific)
    if (/(membership|pricing|cost|promotion|hours|gift card|sign up|loyalty)/.test(lowerPhrase)) {
      return 'BrandTone';
    }
    
    return null;
  }

  /**
   * Suggest keyword adjustments for each route
   */
  private suggestKeywordAdjustments(patterns: RoutingPattern[]): Record<string, { add: string[], remove: string[] }> {
    const adjustments: Record<string, { add: string[], remove: string[] }> = {
      'Emergency': { add: [], remove: [] },
      'Booking & Access': { add: [], remove: [] },
      'TechSupport': { add: [], remove: [] },
      'BrandTone': { add: [], remove: [] }
    };

    // Analyze patterns to suggest keyword changes
    for (const pattern of patterns) {
      // Add keywords to suggested route
      if (adjustments[pattern.suggestedRoute]) {
        const keywords = pattern.pattern.split(' ').filter(w => w.length > 3);
        adjustments[pattern.suggestedRoute].add.push(...keywords);
      }
      
      // Remove keywords from current route
      if (adjustments[pattern.currentRoute]) {
        const keywords = pattern.pattern.split(' ').filter(w => w.length > 3);
        adjustments[pattern.currentRoute].remove.push(...keywords);
      }
    }

    // Deduplicate
    for (const route in adjustments) {
      adjustments[route].add = [...new Set(adjustments[route].add)];
      adjustments[route].remove = [...new Set(adjustments[route].remove)];
    }

    return adjustments;
  }

  /**
   * Calculate optimal confidence thresholds based on feedback
   */
  private async calculateOptimalConfidenceThresholds(): Promise<Record<string, number>> {
    const result = await db.query(`
      WITH confidence_analysis AS (
        SELECT 
          route,
          confidence,
          is_useful,
          COUNT(*) as count
        FROM feedback
        WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY route, confidence, is_useful
      ),
      threshold_calc AS (
        SELECT 
          route,
          confidence,
          SUM(CASE WHEN is_useful THEN count ELSE 0 END) as helpful_count,
          SUM(CASE WHEN NOT is_useful THEN count ELSE 0 END) as unhelpful_count,
          SUM(count) as total_count
        FROM confidence_analysis
        GROUP BY route, confidence
      )
      SELECT 
        route,
        MIN(confidence) as optimal_threshold
      FROM threshold_calc
      WHERE helpful_count > unhelpful_count
        AND total_count >= 5
      GROUP BY route
    `);

    const thresholds: Record<string, number> = {
      'Emergency': 0.7,
      'Booking & Access': 0.6,
      'TechSupport': 0.6,
      'BrandTone': 0.7
    };

    // Update with calculated thresholds
    for (const row of result.rows) {
      thresholds[row.route] = Math.max(parseFloat(row.optimal_threshold), 0.5);
    }

    return thresholds;
  }

  /**
   * Apply learned optimizations to routing rules
   */
  async applyOptimizations(optimization: RoutingOptimization): Promise<void> {
    logger.info('Applying routing optimizations', {
      patternCount: optimization.patterns.length,
      routes: Object.keys(optimization.keywordAdjustments)
    });

    // Store optimization history
    await db.query(`
      INSERT INTO routing_optimizations (
        optimization_data,
        created_at,
        applied_at
      ) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [JSON.stringify(optimization)]);

    // Log significant pattern discoveries
    for (const pattern of optimization.patterns.slice(0, 10)) {
      logger.info('Routing pattern discovered', {
        pattern: pattern.pattern,
        currentRoute: pattern.currentRoute,
        suggestedRoute: pattern.suggestedRoute,
        occurrences: pattern.occurrences
      });
    }
  }

  /**
   * Generate a report of routing performance
   */
  async generateRoutingReport(): Promise<any> {
    const report = await db.query(`
      WITH performance_metrics AS (
        SELECT 
          ci.route,
          COUNT(DISTINCT ci.id) as total_requests,
          COUNT(DISTINCT f.id) as feedback_count,
          SUM(CASE WHEN f.is_useful = false THEN 1 ELSE 0 END) as unhelpful_count,
          AVG(ci.confidence) as avg_confidence,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ci.confidence) as median_confidence
        FROM customer_interactions ci
        LEFT JOIN feedback f ON f.request_description = ci.request_text
        WHERE ci."createdAt" >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY ci.route
      )
      SELECT 
        route,
        total_requests,
        feedback_count,
        unhelpful_count,
        ROUND(avg_confidence::numeric, 3) as avg_confidence,
        ROUND(median_confidence::numeric, 3) as median_confidence,
        CASE 
          WHEN feedback_count > 0 
          THEN ROUND(100.0 * unhelpful_count / feedback_count, 2)
          ELSE 0
        END as unhelpful_rate
      FROM performance_metrics
      ORDER BY total_requests DESC
    `);

    return {
      routePerformance: report.rows,
      generatedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const routingOptimizer = RoutingOptimizer.getInstance();