#!/usr/bin/env python3
"""
ChatGPT Conversation Analyzer
Extracts and consolidates thinking patterns from ChatGPT conversation history
"""

import json
import sys
from datetime import datetime
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Set
import re
import os

class ConversationAnalyzer:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.conversations = []
        self.themes = defaultdict(list)
        self.patterns = defaultdict(int)
        self.vocabulary = Counter()
        self.temporal_patterns = defaultdict(list)
        
    def load_conversations(self):
        """Load and parse the JSON file"""
        print(f"Loading conversations from: {self.file_path}")
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                self.conversations = json.load(f)
            print(f"Loaded {len(self.conversations)} conversations")
        except Exception as e:
            print(f"Error loading file: {e}")
            return False
        return True
    
    def extract_messages(self, conversation: dict) -> List[dict]:
        """Extract all messages from a conversation"""
        messages = []
        mapping = conversation.get('mapping', {})
        
        for node_id, node in mapping.items():
            if node.get('message'):
                msg = node['message']
                if msg.get('content') and msg['content'].get('parts'):
                    # Handle different content structures
                    parts = msg['content']['parts']
                    content_text = []
                    
                    for part in parts:
                        if isinstance(part, str):
                            content_text.append(part)
                        elif isinstance(part, dict):
                            # Handle complex content like images or attachments
                            if part.get('text'):
                                content_text.append(part['text'])
                            elif part.get('content'):
                                content_text.append(str(part['content']))
                    
                    if content_text:
                        messages.append({
                            'role': msg['author']['role'],
                            'content': ' '.join(content_text),
                            'timestamp': msg.get('create_time'),
                            'node_id': node_id
                        })
        
        return messages
    
    def analyze_conversation_metadata(self):
        """Extract basic metadata from conversations"""
        print("\n=== CONVERSATION METADATA ===")
        
        total_messages = 0
        date_range = []
        titles = []
        
        for conv in self.conversations:
            title = conv.get('title', 'Untitled')
            titles.append(title)
            
            create_time = conv.get('create_time')
            if create_time:
                date_range.append(create_time)
            
            messages = self.extract_messages(conv)
            total_messages += len(messages)
        
        if date_range:
            min_date = datetime.fromtimestamp(min(date_range))
            max_date = datetime.fromtimestamp(max(date_range))
            print(f"Date range: {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")
        
        print(f"Total conversations: {len(self.conversations)}")
        print(f"Total messages: {total_messages}")
        print(f"Average messages per conversation: {total_messages / len(self.conversations):.1f}")
        
        return titles
    
    def identify_themes(self):
        """Identify common themes and topics"""
        print("\n=== THEME IDENTIFICATION ===")
        
        theme_keywords = {
            'automation': ['automat', 'workflow', 'system', 'process', 'efficiency'],
            'ai_development': ['ai', 'llm', 'gpt', 'claude', 'model', 'prompt'],
            'business': ['business', 'customer', 'revenue', 'scale', 'growth'],
            'coding': ['code', 'function', 'api', 'database', 'backend', 'frontend'],
            'golf': ['golf', 'simulator', 'clubhouse', 'booking', 'facility'],
            'philosophy': ['think', 'mental', 'recursive', 'upstream', 'logic'],
            'learning': ['learn', 'understand', 'knowledge', 'pattern', 'insight']
        }
        
        theme_counts = defaultdict(int)
        theme_examples = defaultdict(list)
        
        for conv in self.conversations:
            messages = self.extract_messages(conv)
            conv_title = conv.get('title', 'Untitled')
            
            for msg in messages:
                if msg['role'] == 'user':
                    content_lower = msg['content'].lower()
                    
                    for theme, keywords in theme_keywords.items():
                        if any(kw in content_lower for kw in keywords):
                            theme_counts[theme] += 1
                            if len(theme_examples[theme]) < 3:  # Keep top 3 examples
                                theme_examples[theme].append({
                                    'title': conv_title,
                                    'excerpt': msg['content'][:200] + '...'
                                })
        
        # Print theme analysis
        sorted_themes = sorted(theme_counts.items(), key=lambda x: x[1], reverse=True)
        for theme, count in sorted_themes:
            print(f"\n{theme.upper()} ({count} occurrences)")
            for example in theme_examples[theme][:2]:
                print(f"  - {example['title']}: {example['excerpt']}")
    
    def extract_thinking_patterns(self):
        """Extract unique thinking patterns and mental models"""
        print("\n=== THINKING PATTERNS ===")
        
        patterns = {
            'recursive_thinking': r'recurs\w+|loop|iterate|feedback',
            'upstream_logic': r'upstream|downstream|root cause|first principle',
            'modular_design': r'modular|component|building block|compose',
            'compression': r'compress|simplif|abstract|distill',
            'system_thinking': r'system|holistic|interconnect|ecosystem',
            'data_driven': r'data|metric|measure|track|analyz'
        }
        
        pattern_counts = defaultdict(int)
        pattern_examples = defaultdict(list)
        
        for conv in self.conversations:
            messages = self.extract_messages(conv)
            
            for msg in messages:
                if msg['role'] == 'user':
                    content = msg['content']
                    
                    for pattern_name, pattern_regex in patterns.items():
                        if re.search(pattern_regex, content, re.IGNORECASE):
                            pattern_counts[pattern_name] += 1
                            if len(pattern_examples[pattern_name]) < 3:
                                pattern_examples[pattern_name].append(content[:300] + '...')
        
        # Print pattern analysis
        sorted_patterns = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)
        for pattern, count in sorted_patterns:
            print(f"\n{pattern.replace('_', ' ').title()} ({count} instances)")
            if pattern_examples[pattern]:
                print(f"  Example: {pattern_examples[pattern][0]}")
    
    def analyze_evolution(self):
        """Analyze how thinking evolved over time"""
        print("\n=== THINKING EVOLUTION ===")
        
        # Group conversations by month
        monthly_conversations = defaultdict(list)
        
        for conv in self.conversations:
            create_time = conv.get('create_time')
            if create_time:
                date = datetime.fromtimestamp(create_time)
                month_key = date.strftime('%Y-%m')
                monthly_conversations[month_key].append(conv)
        
        # Analyze complexity and topics over time
        for month in sorted(monthly_conversations.keys()):
            convs = monthly_conversations[month]
            
            total_length = 0
            topics = []
            
            for conv in convs:
                messages = self.extract_messages(conv)
                total_length += sum(len(msg['content']) for msg in messages if msg['role'] == 'user')
                topics.append(conv.get('title', 'Untitled'))
            
            avg_length = total_length / len(convs) if convs else 0
            
            print(f"\n{month}:")
            print(f"  Conversations: {len(convs)}")
            print(f"  Avg message length: {avg_length:.0f} chars")
            print(f"  Sample topics: {', '.join(topics[:3])}")
    
    def generate_summary_report(self):
        """Generate a comprehensive summary report"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/CHATGPT-ANALYSIS-REPORT.md"
        
        with open(output_path, 'w') as f:
            f.write("# ChatGPT Conversation Analysis Report\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # We'll add more to this report as we analyze
            f.write("## Overview\n\n")
            f.write(f"- Total conversations analyzed: {len(self.conversations)}\n")
            f.write(f"- Analysis file: {self.file_path}\n\n")
            
            f.write("## Key Findings\n\n")
            f.write("*Full analysis in progress...*\n")
        
        print(f"\nReport started at: {output_path}")
        return output_path

def main():
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    analyzer = ConversationAnalyzer(file_path)
    
    if analyzer.load_conversations():
        analyzer.analyze_conversation_metadata()
        analyzer.identify_themes()
        analyzer.extract_thinking_patterns()
        analyzer.analyze_evolution()
        analyzer.generate_summary_report()
    else:
        print("Failed to load conversations")

if __name__ == "__main__":
    main()