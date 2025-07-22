// src/knowledge-base/knowledgeLoader.ts

import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface KnowledgeBase {
  route: string;
  description: string;
  version: string;
  lastUpdated: string;
  knowledgeBase: any;
  quickReference?: any;
  [key: string]: any;
}

export class KnowledgeLoader {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private knowledgeBaseDir: string;

  constructor() {
    this.knowledgeBaseDir = join(__dirname);
    this.loadAllKnowledgeBases();
  }

  private loadAllKnowledgeBases() {
    const knowledgeFiles = [
      'booking-knowledge-v2.json',
      'emergency-knowledge-v2.json',
      'general-knowledge-v2.json',
      'tone-knowledge-v2.json',
      'trackman-knowledge-v2.json'
    ];

    for (const file of knowledgeFiles) {
      try {
        const content = readFileSync(join(this.knowledgeBaseDir, file), 'utf-8');
        const knowledge = JSON.parse(content) as KnowledgeBase;
        this.knowledgeBases.set(knowledge.route, knowledge);
        logger.info(`Loaded knowledge base: ${knowledge.route} (${knowledge.description})`);
      } catch (error) {
        logger.error(`Failed to load knowledge base ${file}:`, error);
      }
    }

    logger.info(`Loaded ${this.knowledgeBases.size} knowledge bases`);
  }

  getKnowledgeBase(route: string): KnowledgeBase | undefined {
    return this.knowledgeBases.get(route);
  }

  getAllKnowledgeBases(): KnowledgeBase[] {
    return Array.from(this.knowledgeBases.values());
  }

  searchKnowledge(query: string): any[] {
    const results: any[] = [];
    const searchQuery = query.toLowerCase();

    for (const [route, kb] of this.knowledgeBases) {
      const searchInObject = (obj: any, path: string[] = []): void => {
        if (!obj || typeof obj !== 'object') return;

        for (const [key, value] of Object.entries(obj)) {
          const currentPath = [...path, key];
          
          if (typeof value === 'string' && value.toLowerCase().includes(searchQuery)) {
            results.push({
              knowledgeBase: route,
              path: currentPath.join('.'),
              value,
              context: obj
            });
          } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (typeof item === 'string' && item.toLowerCase().includes(searchQuery)) {
                results.push({
                  knowledgeBase: route,
                  path: [...currentPath, index.toString()].join('.'),
                  value: item,
                  context: value
                });
              } else if (typeof item === 'object') {
                searchInObject(item, [...currentPath, index.toString()]);
              }
            });
          } else if (typeof value === 'object') {
            searchInObject(value, currentPath);
          }
        }
      };

      searchInObject(kb.knowledgeBase);
    }

    return results;
  }

  findSolution(symptoms: string[]): any[] {
    const solutions: any[] = [];
    const searchTerms = symptoms.map(s => s.toLowerCase().trim());

    for (const [route, kb] of this.knowledgeBases) {
      const searchForSolutions = (obj: any, path: string[] = []): void => {
        if (!obj || typeof obj !== 'object') return;

        // Look for objects with 'symptoms' and 'solutions' properties
        if (obj.symptoms && obj.solutions) {
          let matchScore = 0;
          let matchedSymptom = '';
          
          for (const symptom of obj.symptoms) {
            const symptomLower = symptom.toLowerCase().trim();
            
            for (const searchTerm of searchTerms) {
              // Exact match (highest priority)
              if (symptomLower === searchTerm) {
                matchScore = 3;
                matchedSymptom = symptom;
                break;
              }
              // Contains the full search term (medium priority)
              else if (symptomLower.includes(searchTerm) && searchTerm.length > 3) {
                if (matchScore < 2) {
                  matchScore = 2;
                  matchedSymptom = symptom;
                }
              }
              // Word-level match (lower priority)
              else if (matchScore < 1) {
                const symptomWords = symptomLower.split(' ');
                const searchWords = searchTerm.split(' ');
                if (searchWords.every(sw => symptomWords.some(w => w === sw))) {
                  matchScore = 1;
                  matchedSymptom = symptom;
                }
              }
            }
            
            if (matchScore === 3) break; // Exit early for exact matches
          }

          if (matchScore > 0) {
            solutions.push({
              knowledgeBase: route,
              issue: path[path.length - 1],
              symptoms: obj.symptoms,
              solutions: obj.solutions,
              timeEstimate: obj.timeEstimate,
              customerScript: obj.customerScript,
              escalation: obj.escalation,
              priority: obj.priority,
              matchScore,
              matchedSymptom
            });
          }
        }

        // Recursively search nested objects
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            searchForSolutions(value, [...path, key]);
          }
        }
      };

      searchForSolutions(kb.knowledgeBase);
    }

    return solutions;
  }

  getToneExample(toneType: string, situation: string): string | undefined {
    const toneKB = this.knowledgeBases.get('ResponseToneLLM');
    if (!toneKB) return undefined;

    const toneProfile = toneKB.knowledgeBase.toneProfiles[toneType];
    if (!toneProfile || !toneProfile.examples) return undefined;

    return toneProfile.examples[situation];
  }

  getQuickReference(route: string): any {
    const kb = this.knowledgeBases.get(route);
    return kb?.quickReference || kb?.knowledgeBase?.quickReference;
  }
}

// Singleton instance
export const knowledgeLoader = new KnowledgeLoader();