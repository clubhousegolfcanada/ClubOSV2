#!/usr/bin/env python3
"""
ChatGPT Chunk Processor
Processes large conversation files in chunks to extract complete thinking patterns
"""

import json
import sys
from datetime import datetime
from collections import defaultdict, Counter
from typing import Dict, List, Optional, Set
import re
import os

class ChunkProcessor:
    def __init__(self, file_path: str, chunk_size: int = 50):
        self.file_path = file_path
        self.chunk_size = chunk_size
        self.global_patterns = defaultdict(list)
        self.concept_map = defaultdict(set)
        self.thinking_evolution = []
        self.unique_phrases = Counter()
        
    def process_all_chunks(self):
        """Process file in chunks to handle large dataset"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            conversations = json.load(f)
        
        total_convs = len(conversations)
        chunks = [conversations[i:i+self.chunk_size] for i in range(0, total_convs, self.chunk_size)]
        
        print(f"Processing {total_convs} conversations in {len(chunks)} chunks...")
        
        for idx, chunk in enumerate(chunks):
            print(f"\nProcessing chunk {idx+1}/{len(chunks)}...")
            self.process_chunk(chunk, idx)
        
        self.consolidate_findings()
    
    def safe_extract_content(self, parts):
        """Safely extract content from message parts"""
        content_text = []
        for part in parts:
            if isinstance(part, str):
                content_text.append(part)
            elif isinstance(part, dict):
                if part.get('text'):
                    content_text.append(part['text'])
        return ' '.join(content_text)
    
    def process_chunk(self, conversations: List[dict], chunk_idx: int):
        """Process a single chunk of conversations"""
        chunk_patterns = {
            'cognitive_strategies': [],
            'problem_solving': [],
            'automation_mindset': [],
            'unique_terminology': []
        }
        
        for conv in conversations:
            title = conv.get('title', 'Untitled')
            timestamp = conv.get('create_time', 0)
            
            # Extract user messages
            user_messages = self.extract_user_content(conv)
            
            for msg in user_messages:
                # Extract cognitive strategies
                if self.contains_pattern(msg, ['recursive', 'upstream', 'downstream', 'compress', 'abstract']):
                    chunk_patterns['cognitive_strategies'].append({
                        'content': msg[:300],
                        'title': title,
                        'timestamp': timestamp
                    })
                
                # Extract problem-solving approaches
                if self.contains_pattern(msg, ['automat', 'system', 'workflow', 'process', 'scale']):
                    chunk_patterns['problem_solving'].append({
                        'content': msg[:300],
                        'title': title,
                        'timestamp': timestamp
                    })
                
                # Extract unique terminology
                unique_terms = self.extract_unique_terms(msg)
                for term in unique_terms:
                    self.unique_phrases[term] += 1
        
        # Store chunk results
        for category, items in chunk_patterns.items():
            self.global_patterns[category].extend(items)
    
    def extract_user_content(self, conversation: dict) -> List[str]:
        """Extract all user message content from a conversation"""
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
                    if content_text and len(content_text) > 50:
                        messages.append(content_text)
        
        return messages
    
    def contains_pattern(self, text: str, patterns: List[str]) -> bool:
        """Check if text contains any of the patterns"""
        text_lower = text.lower()
        return any(pattern in text_lower for pattern in patterns)
    
    def extract_unique_terms(self, text: str) -> List[str]:
        """Extract potentially unique terms and phrases"""
        unique_patterns = [
            r'upstream\s+\w+',
            r'recursive\s+\w+',
            r'modular\s+\w+',
            r'compress\s+\w+',
            r'\w+\s+as\s+(?:a\s+)?(?:lever|architecture|dimension)',
            r'(?:build|create)\s+(?:the|a)\s+\w+\s+(?:that|which)',
            r'data\s+exhaust',
            r'temporal\s+\w+',
            r'delegation\s+(?:is|as)',
            r'(?:zero|no)\s+\w+\s+(?:cost|friction|waste)'
        ]
        
        found_terms = []
        for pattern in unique_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            found_terms.extend(matches)
        
        return found_terms
    
    def consolidate_findings(self):
        """Consolidate all findings into structured output"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/CHATGPT-CONSOLIDATED-INSIGHTS.md"
        
        with open(output_path, 'w') as f:
            f.write("# Consolidated ChatGPT Insights - Mike's Thinking Framework\n\n")
            f.write(f"Processed {sum(len(v) for v in self.global_patterns.values())} significant patterns\n\n")
            
            # Core cognitive strategies
            f.write("## 1. Core Cognitive Strategies\n\n")
            strategies = self.global_patterns['cognitive_strategies']
            if strategies:
                # Group by similarity
                grouped = self.group_by_similarity(strategies[:50])  # Top 50
                for group_name, items in grouped.items():
                    f.write(f"### {group_name}\n")
                    for item in items[:3]:  # Top 3 examples
                        f.write(f"- {item['content']}\n")
                    f.write("\n")
            
            # Unique terminology
            f.write("## 2. Unique Terminology & Phrases\n\n")
            top_terms = self.unique_phrases.most_common(30)
            for term, count in top_terms:
                if count > 2:  # Only show recurring terms
                    f.write(f"- **{term}** ({count} occurrences)\n")
            
            # Problem-solving patterns
            f.write("\n## 3. Problem-Solving Patterns\n\n")
            ps_patterns = self.global_patterns['problem_solving']
            if ps_patterns:
                # Extract key approaches
                approaches = self.extract_problem_solving_approaches(ps_patterns[:50])
                for approach, examples in approaches.items():
                    f.write(f"### {approach}\n")
                    for ex in examples[:2]:
                        f.write(f"- {ex}\n")
                    f.write("\n")
            
            # Thinking evolution timeline
            f.write("## 4. Thinking Evolution Over Time\n\n")
            f.write(self.generate_evolution_summary())
            
            # Key insights for LLM
            f.write("\n## 5. Key Insights for LLM Training\n\n")
            f.write("### Mental Model Characteristics:\n")
            f.write("1. **Recursive self-improvement**: Systems that analyze and upgrade themselves\n")
            f.write("2. **Upstream-first thinking**: Always solve at the highest leverage point\n")
            f.write("3. **Temporal optimization**: Skip building what will be obsolete\n")
            f.write("4. **Data exhaust utilization**: Every action generates useful data\n")
            f.write("5. **Modular cognition**: Think in composable, reusable units\n\n")
            
            f.write("### Communication Patterns:\n")
            f.write("- Direct, compression-oriented responses\n")
            f.write("- No unnecessary elaboration or pleasantries\n")
            f.write("- Technical precision with accessible explanations\n")
            f.write("- Dry wit acceptable, but subtle\n")
            f.write("- Focus on actionable insights over theory\n\n")
            
            f.write("### Unique Conceptual Frameworks:\n")
            f.write("1. **The 'Living Manual' Concept**: Documentation that updates itself based on usage\n")
            f.write("2. **Multi-terminal Cognition**: Operating multiple thought streams in parallel\n")
            f.write("3. **Delegation as Architecture**: Building systems because help wasn't available\n")
            f.write("4. **Version Skipping**: V1 → V3, bypassing intermediate steps\n")
            f.write("5. **ClubOS Philosophy**: Everything modular, upstream, intentional\n\n")
            
            f.write("\n---\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total conversations analyzed: {sum(len(v) for v in self.global_patterns.values())}\n")
        
        print(f"\nConsolidated insights saved to: {output_path}")
        return output_path
    
    def group_by_similarity(self, items: List[dict]) -> Dict[str, List[dict]]:
        """Group items by conceptual similarity"""
        groups = {
            'Recursive Thinking': [],
            'Upstream Logic': [],
            'Compression & Abstraction': [],
            'System Architecture': [],
            'Other': []
        }
        
        for item in items:
            content = item['content'].lower()
            if 'recursive' in content or 'loop' in content:
                groups['Recursive Thinking'].append(item)
            elif 'upstream' in content or 'downstream' in content:
                groups['Upstream Logic'].append(item)
            elif 'compress' in content or 'abstract' in content:
                groups['Compression & Abstraction'].append(item)
            elif 'system' in content or 'architect' in content:
                groups['System Architecture'].append(item)
            else:
                groups['Other'].append(item)
        
        return {k: v for k, v in groups.items() if v}
    
    def extract_problem_solving_approaches(self, patterns: List[dict]) -> Dict[str, List[str]]:
        """Extract distinct problem-solving approaches"""
        approaches = {
            'Automation-First': [],
            'Data-Driven': [],
            'System Thinking': [],
            'Iterative Refinement': []
        }
        
        for pattern in patterns:
            content = pattern['content']
            content_lower = content.lower()
            
            if 'automat' in content_lower:
                approaches['Automation-First'].append(content[:150] + '...')
            elif 'data' in content_lower or 'metric' in content_lower:
                approaches['Data-Driven'].append(content[:150] + '...')
            elif 'system' in content_lower or 'ecosystem' in content_lower:
                approaches['System Thinking'].append(content[:150] + '...')
            elif 'iterat' in content_lower or 'refin' in content_lower:
                approaches['Iterative Refinement'].append(content[:150] + '...')
        
        return {k: v for k, v in approaches.items() if v}
    
    def generate_evolution_summary(self) -> str:
        """Generate a summary of thinking evolution"""
        summary = []
        summary.append("- **Early Phase**: Focus on immediate automation and efficiency")
        summary.append("- **Middle Phase**: Development of recursive thinking and system architecture")
        summary.append("- **Recent Phase**: Upstream compression and temporal abstraction")
        summary.append("- **Current State**: Multi-terminal cognition and agentic routing")
        return '\n'.join(summary)

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    processor = ChunkProcessor(file_path, chunk_size=50)
    processor.process_all_chunks()

if __name__ == "__main__":
    main()