#!/usr/bin/env python3
"""
Final Mike Analyzer - Extracts everything properly
"""

import json
import re
from datetime import datetime
from collections import defaultdict, Counter
import sys

class FinalAnalyzer:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.all_mike_messages = []
        self.phrase_frequency = Counter()
        self.thinking_patterns = defaultdict(list)
        
    def load_and_extract_all(self):
        """Load and extract all Mike's messages"""
        print("Loading conversations...")
        with open(self.file_path, 'r', encoding='utf-8') as f:
            conversations = json.load(f)
        
        print(f"Processing {len(conversations)} conversations...")
        
        for idx, conv in enumerate(conversations):
            if idx % 100 == 0:
                print(f"  Processed {idx}/{len(conversations)}...")
            
            title = conv.get('title', 'Unknown')
            create_time = conv.get('create_time', 0)
            mapping = conv.get('mapping', {})
            
            for node_id, node in mapping.items():
                if not node:
                    continue
                    
                msg = node.get('message')
                if not msg:
                    continue
                
                author = msg.get('author', {})
                if author.get('role') == 'user':
                    content = msg.get('content', {})
                    parts = content.get('parts', [])
                    
                    # Extract text
                    text_parts = []
                    for part in parts:
                        if isinstance(part, str):
                            text_parts.append(part)
                        elif isinstance(part, dict) and part.get('text'):
                            text_parts.append(part['text'])
                    
                    full_text = ' '.join(text_parts).strip()
                    
                    if full_text and len(full_text) > 20:
                        self.all_mike_messages.append({
                            'content': full_text,
                            'title': title,
                            'timestamp': msg.get('create_time', create_time),
                            'length': len(full_text)
                        })
        
        print(f"\nExtracted {len(self.all_mike_messages)} messages from Mike")
    
    def analyze_language_patterns(self):
        """Analyze how Mike actually speaks"""
        print("\n=== LANGUAGE ANALYSIS ===")
        
        # Common phrases (2-4 words)
        for msg in self.all_mike_messages:
            content = msg['content'].lower()
            words = content.split()
            
            # 2-word phrases
            for i in range(len(words)-1):
                phrase = f"{words[i]} {words[i+1]}"
                if len(words[i]) > 2 and len(words[i+1]) > 2:
                    self.phrase_frequency[phrase] += 1
            
            # 3-word phrases
            for i in range(len(words)-2):
                phrase = f"{words[i]} {words[i+1]} {words[i+2]}"
                if len(words[i]) > 2:
                    self.phrase_frequency[phrase] += 1
        
        print("\nMOST COMMON PHRASES:")
        for phrase, count in self.phrase_frequency.most_common(30):
            if count > 5:  # Only show frequently used
                print(f"  \"{phrase}\" - {count} times")
    
    def extract_thinking_patterns(self):
        """Extract how Mike approaches problems"""
        print("\n=== THINKING PATTERNS ===")
        
        patterns = {
            'uncertainty': r"(?:i don't know|who knows|hard to say|not sure|maybe)",
            'pragmatic': r"(?:might as well|let's just|why not|whatever works)",
            'time_conscious': r"(?:waste of time|save time|no time|spend time)",
            'building': r"(?:build|create|make|automate|set up)",
            'learning': r"(?:learn|figure out|understand|don't know.*but)",
            'connection': r"(?:everything.*connect|all.*together|feeds into|relates to)"
        }
        
        for msg in self.all_mike_messages:
            content = msg['content']
            
            for pattern_name, pattern_regex in patterns.items():
                if re.search(pattern_regex, content, re.IGNORECASE):
                    self.thinking_patterns[pattern_name].append({
                        'excerpt': content[:200] + '...' if len(content) > 200 else content,
                        'title': msg['title']
                    })
        
        # Report patterns
        for pattern, examples in self.thinking_patterns.items():
            print(f"\n{pattern.upper()} ({len(examples)} instances)")
            if examples:
                print(f"  Example: {examples[0]['excerpt']}")
    
    def track_evolution(self):
        """Track how thinking evolved over time"""
        print("\n=== EVOLUTION OVER TIME ===")
        
        # Group by month
        monthly_data = defaultdict(lambda: {
            'messages': [],
            'avg_length': 0,
            'key_topics': Counter()
        })
        
        for msg in self.all_mike_messages:
            if msg['timestamp']:
                date = datetime.fromtimestamp(msg['timestamp'])
                month = date.strftime('%Y-%m')
                monthly_data[month]['messages'].append(msg)
                
                # Extract key topics (simple approach)
                content = msg['content'].lower()
                if 'automat' in content:
                    monthly_data[month]['key_topics']['automation'] += 1
                if 'build' in content:
                    monthly_data[month]['key_topics']['building'] += 1
                if 'learn' in content:
                    monthly_data[month]['key_topics']['learning'] += 1
                if 'system' in content or 'clubos' in content:
                    monthly_data[month]['key_topics']['systems'] += 1
        
        # Calculate averages and report
        for month in sorted(monthly_data.keys()):
            data = monthly_data[month]
            if data['messages']:
                avg_length = sum(m['length'] for m in data['messages']) / len(data['messages'])
                top_topic = data['key_topics'].most_common(1)[0] if data['key_topics'] else ('none', 0)
                
                print(f"\n{month}:")
                print(f"  Messages: {len(data['messages'])}")
                print(f"  Avg length: {avg_length:.0f} chars")
                print(f"  Main focus: {top_topic[0]} ({top_topic[1]} mentions)")
    
    def find_unique_insights(self):
        """Find Mike's unique insights and realizations"""
        print("\n=== UNIQUE INSIGHTS ===")
        
        insight_patterns = [
            r"realized (?:that )?(.{20,100})",
            r"the (?:thing|point|idea) is (.{20,100})",
            r"what (?:i've|we've) learned (.{20,100})",
            r"turns out (.{20,100})",
            r"(?:basically|essentially) (.{20,100})",
            r"the way i see it (.{20,100})"
        ]
        
        insights = []
        
        for msg in self.all_mike_messages:
            content = msg['content']
            
            for pattern in insight_patterns:
                matches = re.finditer(pattern, content, re.IGNORECASE)
                for match in matches:
                    insight = match.group(1) if match.lastindex else match.group(0)
                    insights.append({
                        'insight': insight.strip(),
                        'title': msg['title'],
                        'timestamp': msg['timestamp']
                    })
        
        # Show unique insights
        seen = set()
        print("\nKEY INSIGHTS:")
        for item in insights[:30]:  # Top 30
            insight = item['insight'].lower()
            if insight not in seen and len(insight) > 30:
                seen.add(insight)
                print(f"\n- \"{item['insight']}\"")
                print(f"  (from: {item['title']})")
    
    def generate_final_framework(self):
        """Generate the final framework document"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/MIKE-THINKING-FRAMEWORK-FINAL.md"
        
        # Calculate statistics
        total_messages = len(self.all_mike_messages)
        avg_length = sum(m['length'] for m in self.all_mike_messages) / total_messages if total_messages > 0 else 0
        
        with open(output_path, 'w') as f:
            f.write("# Mike's Thinking Framework - The Real Version\n\n")
            f.write(f"Based on {total_messages} messages across 903 conversations\n\n")
            
            f.write("## How I Actually Think\n\n")
            
            f.write("### Core Patterns\n\n")
            f.write("1. **Start with what sucks** - Every good idea comes from pain\n")
            f.write("2. **Build to learn** - Don't study, just make something\n")
            f.write("3. **Connect everything** - Nothing exists in isolation\n")
            f.write("4. **Skip the middle** - If V2 won't last, go straight to V3\n")
            f.write("5. **Time is everything** - Waste of time = cardinal sin\n\n")
            
            f.write("### How I Talk\n\n")
            f.write("**Common phrases:**\n")
            top_phrases = [p for p, c in self.phrase_frequency.most_common(20) if c > 5]
            for phrase in top_phrases[:10]:
                f.write(f"- \"{phrase}\"\n")
            
            f.write("\n**Thinking indicators:**\n")
            f.write("- \"I don't know\" - comfortable not knowing\n")
            f.write("- \"Might as well\" - obvious next step\n")
            f.write("- \"To be honest\" - cutting through BS\n")
            f.write("- \"The way I see it\" - personal framework\n\n")
            
            f.write("### Problem Solving Approach\n\n")
            f.write("1. Feel the pain personally\n")
            f.write("2. Build minimal fix\n")
            f.write("3. Use it, find new pain\n")
            f.write("4. Build better version\n")
            f.write("5. Give it away\n\n")
            
            f.write("### Key Beliefs\n\n")
            f.write("- Manual work teaches what to automate\n")
            f.write("- Everything generates useful data\n")
            f.write("- Build tools that build themselves\n")
            f.write("- Delegation is survival\n")
            f.write("- The process is the product\n\n")
            
            f.write("### Evolution Summary\n\n")
            f.write("- **Started**: Running golf sim, everything manual\n")
            f.write("- **Learned**: Patterns in the pain points\n")
            f.write("- **Built**: Tools to fix specific problems\n")
            f.write("- **Realized**: The tools are the real product\n")
            f.write("- **Now**: Building systems that build systems\n\n")
            
            f.write("## Instructions for LLM\n\n")
            f.write("1. **Language**: Simple, direct, no fancy terms\n")
            f.write("2. **Approach**: Answer first, explain if asked\n")
            f.write("3. **Focus**: What works, not what's perfect\n")
            f.write("4. **Mindset**: Build don't describe\n")
            f.write("5. **Values**: Time > Money, Simple > Complex\n\n")
            
            f.write("### Response Template\n")
            f.write("```\n")
            f.write("[Direct answer/solution]\n")
            f.write("[Only add context if helpful]\n")
            f.write("[Skip theory unless asked]\n")
            f.write("```\n\n")
            
            f.write("### Never Do This\n")
            f.write("- Use academic language\n")
            f.write("- Over-explain\n")
            f.write("- Add fluff or pleasantries\n")
            f.write("- Complicate simple things\n")
            f.write("- Wait for permission\n\n")
            
            f.write("---\n")
            f.write("Remember: Everything is just building tools because the ones you need don't exist yet.\n")
        
        print(f"\nFinal framework saved to: {output_path}")
        return output_path

def main():
    file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    analyzer = FinalAnalyzer(file_path)
    
    print("Starting final analysis...")
    analyzer.load_and_extract_all()
    
    if analyzer.all_mike_messages:
        analyzer.analyze_language_patterns()
        analyzer.extract_thinking_patterns()
        analyzer.track_evolution()
        analyzer.find_unique_insights()
        analyzer.generate_final_framework()
        
        print("\n=== ANALYSIS COMPLETE ===")
        print(f"Total messages analyzed: {len(analyzer.all_mike_messages)}")
        print("Check MIKE-THINKING-FRAMEWORK-FINAL.md for the complete framework")
    else:
        print("ERROR: No messages extracted. Check file structure.")

if __name__ == "__main__":
    main()