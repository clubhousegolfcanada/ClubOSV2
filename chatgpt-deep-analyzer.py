#!/usr/bin/env python3
"""
Deep ChatGPT Conversation Analyzer
Extracts nuanced thinking patterns and consolidates insights for LLM training
"""

import json
import sys
from datetime import datetime
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Set, Optional
import re
import os
import hashlib

class DeepConversationAnalyzer:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.conversations = []
        self.thinking_patterns = defaultdict(list)
        self.conceptual_mappings = defaultdict(set)
        self.evolution_timeline = defaultdict(dict)
        self.unique_insights = []
        
    def load_conversations(self):
        """Load conversations from JSON file"""
        print(f"Loading conversations from: {self.file_path}")
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.conversations = json.load(f)
        print(f"Loaded {len(self.conversations)} conversations")
        return True
    
    def safe_extract_content(self, parts):
        """Safely extract content from message parts"""
        content_text = []
        for part in parts:
            if isinstance(part, str):
                content_text.append(part)
            elif isinstance(part, dict):
                if part.get('text'):
                    content_text.append(part['text'])
                elif part.get('content'):
                    content_text.append(str(part['content']))
        return ' '.join(content_text)
    
    def extract_user_messages(self, conversation: dict) -> List[dict]:
        """Extract only user messages from conversation"""
        messages = []
        mapping = conversation.get('mapping', {})
        
        for node_id, node in mapping.items():
            if not node:
                continue
            msg = node.get('message')
            if not msg:
                continue
            author = msg.get('author', {})
            if author and author.get('role') == 'user':
                content = msg.get('content', {})
                parts = content.get('parts', [])
                if parts:
                    content_text = self.safe_extract_content(parts)
                    if content_text and len(content_text) > 50:  # Skip very short messages
                        messages.append({
                            'content': content_text,
                            'timestamp': msg.get('create_time'),
                            'node_id': node_id
                        })
        
        return messages
    
    def identify_unique_concepts(self):
        """Identify unique conceptual frameworks and mental models"""
        print("\n=== UNIQUE CONCEPTUAL FRAMEWORKS ===")
        
        # Patterns that indicate unique thinking
        unique_patterns = {
            'recursive_systems': {
                'patterns': [
                    r'recursive\s+(?:thinking|logic|loop|system)',
                    r'feedback\s+loop',
                    r'self-referential',
                    r'meta-(?:cognitive|level|layer)'
                ],
                'weight': 3
            },
            'upstream_compression': {
                'patterns': [
                    r'upstream\s+(?:thinking|logic|compression|design)',
                    r'root\s+cause',
                    r'first\s+principle',
                    r'compress\s+(?:decisions|logic|information)'
                ],
                'weight': 3
            },
            'modular_architecture': {
                'patterns': [
                    r'modular\s+(?:design|thinking|system|architecture)',
                    r'component(?:ized|s)',
                    r'building\s+block',
                    r'(?:de)?compose'
                ],
                'weight': 2
            },
            'temporal_abstraction': {
                'patterns': [
                    r'temporal\s+(?:abstraction|layer|compression)',
                    r'time\s+(?:as|is)\s+(?:a\s+)?(?:lever|tool|dimension)',
                    r'future\s+self',
                    r'bypass\s+(?:building|creating)'
                ],
                'weight': 4
            },
            'delegation_as_survival': {
                'patterns': [
                    r'delegation\s+(?:is|as)\s+(?:a\s+)?survival',
                    r'learned\s+(?:to\s+)?(?:delegate|live)',
                    r'never\s+had\s+help',
                    r'do\s+things\s+on\s+my\s+own'
                ],
                'weight': 3
            },
            'data_exhaust_mining': {
                'patterns': [
                    r'data\s+exhaust',
                    r'passive\s+(?:data\s+)?(?:capture|collection)',
                    r'nothing\s+is\s+wasted',
                    r'structured\s+(?:data\s+)?capture'
                ],
                'weight': 4
            }
        }
        
        concept_scores = defaultdict(list)
        
        for conv in self.conversations[:100]:  # Analyze first 100 for now
            messages = self.extract_user_messages(conv)
            conv_title = conv.get('title', 'Untitled')
            
            for msg in messages:
                content = msg['content'].lower()
                
                for concept, config in unique_patterns.items():
                    for pattern in config['patterns']:
                        if re.search(pattern, content, re.IGNORECASE):
                            excerpt = self.extract_context(content, pattern, 150)
                            concept_scores[concept].append({
                                'title': conv_title,
                                'excerpt': excerpt,
                                'timestamp': msg['timestamp'],
                                'weight': config['weight']
                            })
        
        # Print top concepts
        for concept, instances in sorted(concept_scores.items(), 
                                       key=lambda x: sum(i['weight'] for i in x[1]), 
                                       reverse=True):
            if instances:
                print(f"\n{concept.upper().replace('_', ' ')} (Score: {sum(i['weight'] for i in instances)})")
                print(f"  Example: {instances[0]['excerpt']}")
    
    def extract_context(self, text: str, pattern: str, context_length: int = 150) -> str:
        """Extract context around a pattern match"""
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            start = max(0, match.start() - context_length)
            end = min(len(text), match.end() + context_length)
            return f"...{text[start:end]}..."
        return text[:300] + "..."
    
    def analyze_cognitive_evolution(self):
        """Track how thinking patterns evolved over time"""
        print("\n=== COGNITIVE EVOLUTION TIMELINE ===")
        
        # Group by quarter for better trend analysis
        quarterly_patterns = defaultdict(lambda: defaultdict(int))
        quarterly_complexity = defaultdict(list)
        
        for conv in self.conversations:
            create_time = conv.get('create_time')
            if not create_time:
                continue
                
            date = datetime.fromtimestamp(create_time)
            quarter = f"{date.year}-Q{(date.month-1)//3 + 1}"
            
            messages = self.extract_user_messages(conv)
            
            for msg in messages:
                content = msg['content']
                
                # Measure complexity
                quarterly_complexity[quarter].append(len(content))
                
                # Track pattern emergence
                if 'recursive' in content.lower():
                    quarterly_patterns[quarter]['recursive_thinking'] += 1
                if 'upstream' in content.lower():
                    quarterly_patterns[quarter]['upstream_logic'] += 1
                if 'modular' in content.lower():
                    quarterly_patterns[quarter]['modular_design'] += 1
                if 'automat' in content.lower():
                    quarterly_patterns[quarter]['automation_focus'] += 1
        
        # Print evolution
        for quarter in sorted(quarterly_patterns.keys()):
            patterns = quarterly_patterns[quarter]
            complexity = quarterly_complexity[quarter]
            
            if complexity:
                avg_complexity = sum(complexity) / len(complexity)
                print(f"\n{quarter}:")
                print(f"  Avg message complexity: {avg_complexity:.0f} chars")
                print(f"  Dominant patterns: {', '.join(sorted(patterns.keys(), key=patterns.get, reverse=True)[:3])}")
    
    def extract_mental_models(self):
        """Extract and consolidate mental models"""
        print("\n=== CORE MENTAL MODELS ===")
        
        mental_models = {
            'iterative_compression': [],
            'system_as_organism': [],
            'time_as_architecture': [],
            'knowledge_as_graph': [],
            'execution_as_routing': []
        }
        
        # Define detection patterns for each mental model
        model_patterns = {
            'iterative_compression': [
                r'compress.*then.*expand',
                r'distill.*essence',
                r'reduce.*friction',
                r'simplify.*complex'
            ],
            'system_as_organism': [
                r'system.*(?:grow|evolve|adapt)',
                r'organic.*(?:growth|development)',
                r'ecosystem',
                r'living.*system'
            ],
            'time_as_architecture': [
                r'time.*(?:dimension|layer|architecture)',
                r'temporal.*(?:abstraction|structure)',
                r'future.*building.*present',
                r'sequence.*matters'
            ],
            'knowledge_as_graph': [
                r'connect.*(?:ideas|concepts|nodes)',
                r'knowledge.*(?:graph|network|web)',
                r'pattern.*recognition',
                r'link.*(?:concepts|ideas)'
            ],
            'execution_as_routing': [
                r'route.*(?:tasks|decisions|logic)',
                r'dispatch.*(?:work|tasks)',
                r'orchestrat',
                r'parallel.*(?:process|work|think)'
            ]
        }
        
        # Scan conversations for mental models
        for conv in self.conversations[:200]:  # Analyze first 200
            messages = self.extract_user_messages(conv)
            
            for msg in messages:
                content = msg['content']
                
                for model, patterns in model_patterns.items():
                    for pattern in patterns:
                        if re.search(pattern, content, re.IGNORECASE):
                            mental_models[model].append({
                                'content': self.extract_context(content, pattern, 200),
                                'timestamp': msg['timestamp']
                            })
        
        # Print consolidated mental models
        for model, instances in mental_models.items():
            if instances:
                print(f"\n{model.upper().replace('_', ' ')} ({len(instances)} instances)")
                if instances:
                    print(f"  Example: {instances[0]['content']}")
    
    def generate_llm_training_doc(self):
        """Generate structured documentation for LLM training"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/CHATGPT-LLM-TRAINING.md"
        
        with open(output_path, 'w') as f:
            f.write("# Mike's Cognitive Framework - LLM Training Document\n\n")
            f.write("This document consolidates thinking patterns, mental models, and unique approaches ")
            f.write("extracted from ChatGPT conversation history for LLM training purposes.\n\n")
            
            f.write("## Core Thinking Characteristics\n\n")
            f.write("### 1. Recursive Systems Thinking\n")
            f.write("- Views problems as self-referential systems\n")
            f.write("- Builds solutions that explain and improve themselves\n")
            f.write("- Uses feedback loops as primary design pattern\n\n")
            
            f.write("### 2. Upstream Compression\n")
            f.write("- Always seeks root cause over symptoms\n")
            f.write("- Compresses complex decisions into simple primitives\n")
            f.write("- Builds at the highest leverage point possible\n\n")
            
            f.write("### 3. Temporal Abstraction\n")
            f.write("- Treats time as a design dimension\n")
            f.write("- Skips building what future iterations will obsolete\n")
            f.write("- Uses 'future self' as a design constraint\n\n")
            
            f.write("### 4. Data Exhaust Philosophy\n")
            f.write("- Nothing is wasted if captured cleanly\n")
            f.write("- Passive data collection as default mode\n")
            f.write("- Structured capture precedes understanding\n\n")
            
            f.write("### 5. Delegation as Architecture\n")
            f.write("- Delegation is survival, not luxury\n")
            f.write("- Builds tools because none existed\n")
            f.write("- Self-sufficiency drives systematic thinking\n\n")
            
            f.write("\n## Unique Conceptual Frameworks\n\n")
            f.write("### The 'Box Phase' Pattern\n")
            f.write("- Year 1: Collect data while operating manually\n")
            f.write("- Year 2: Build visibility layer (V1)\n")
            f.write("- Year 3: Skip intermediate steps, build final architecture\n\n")
            
            f.write("### Multi-Terminal Cognition\n")
            f.write("- Operates like an agentic runtime\n")
            f.write("- Multiple terminal windows = multi-threaded memory\n")
            f.write("- Human as router, debugger, and planner simultaneously\n\n")
            
            f.write("\n## Communication Style\n\n")
            f.write("- No em dashes, use commas or periods\n")
            f.write("- Modular reasoning, upstream logic\n")
            f.write("- High-leverage compression in responses\n")
            f.write("- Neutral-sharp tone, subtle dry wit allowed\n")
            f.write("- Zero fluff, filler, or pleasantries\n\n")
            
            f.write("\n## Implementation Patterns\n\n")
            f.write("```\n")
            f.write("Pattern: Recursive Learning Architecture\n")
            f.write("Build → Break → Ask → Understand → Refactor → Ship → Repeat\n")
            f.write("```\n\n")
            
            f.write("```\n")
            f.write("Pattern: Temporal Bypass\n")
            f.write("If (V2 will be obsoleted by V3):\n")
            f.write("    Skip V2 entirely\n")
            f.write("    Compress V1 + V2 learnings → V3 primitives\n")
            f.write("```\n\n")
            
            f.write("\n---\n")
            f.write("Generated: " + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "\n")
        
        print(f"\nLLM training document created at: {output_path}")
        return output_path

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    analyzer = DeepConversationAnalyzer(file_path)
    
    if analyzer.load_conversations():
        analyzer.identify_unique_concepts()
        analyzer.analyze_cognitive_evolution()
        analyzer.extract_mental_models()
        analyzer.generate_llm_training_doc()
    else:
        print("Failed to load conversations")

if __name__ == "__main__":
    main()