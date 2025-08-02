#!/usr/bin/env python3
"""
Real Mike Analysis - No ChatGPT BS
Extracts actual thinking patterns in simple terms
"""

import json
import re
from datetime import datetime
from collections import defaultdict, Counter
import os

class RealAnalyzer:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.conversations = []
        # Track what Mike actually says, not ChatGPT's interpretation
        self.mike_phrases = Counter()
        self.decision_patterns = []
        self.problem_approaches = []
        self.actual_words = Counter()
        
    def load_data(self):
        """Load the JSON file"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.conversations = json.load(f)
        print(f"Loaded {len(self.conversations)} conversations")
        
    def extract_mike_messages(self, conv):
        """Get only Mike's actual messages, not ChatGPT responses"""
        messages = []
        mapping = conv.get('mapping', {})
        
        # Track conversation flow to understand context
        nodes_in_order = []
        
        for node_id, node in mapping.items():
            if not node or not node.get('message'):
                continue
                
            msg = node['message']
            if msg.get('author', {}).get('role') == 'user':
                content = msg.get('content', {})
                parts = content.get('parts', [])
                
                # Extract text content
                text_content = []
                for part in parts:
                    if isinstance(part, str):
                        text_content.append(part)
                    elif isinstance(part, dict) and part.get('text'):
                        text_content.append(part['text'])
                
                full_text = ' '.join(text_content)
                if full_text and len(full_text) > 20:
                    messages.append({
                        'content': full_text,
                        'timestamp': msg.get('create_time'),
                        'parent': node.get('parent')
                    })
        
        return messages
    
    def analyze_actual_language(self):
        """Look at how Mike actually talks, not ChatGPT's fancy terms"""
        print("\n=== HOW MIKE ACTUALLY TALKS ===")
        
        # Common patterns in Mike's actual speech
        real_patterns = {
            'figuring_things_out': [
                r"i don't know",
                r"who knows",
                r"hard to say",
                r"might as well",
                r"we'll see"
            ],
            'building_stuff': [
                r"build",
                r"make",
                r"create",
                r"automate",
                r"set up"
            ],
            'thinking_process': [
                r"think about",
                r"if you think",
                r"the way i see it",
                r"basically",
                r"to be honest"
            ],
            'time_and_efficiency': [
                r"waste of time",
                r"save time",
                r"spend time",
                r"take.{0,10}time",
                r"right now"
            ],
            'learning_approach': [
                r"learn",
                r"figure out",
                r"understand",
                r"know how",
                r"never.{0,10}before"
            ]
        }
        
        pattern_examples = defaultdict(list)
        
        # Analyze first 200 conversations in detail
        for conv in self.conversations[:200]:
            messages = self.extract_mike_messages(conv)
            
            for msg in messages:
                content = msg['content'].lower()
                
                # Extract actual phrases Mike uses
                for category, patterns in real_patterns.items():
                    for pattern in patterns:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            # Get surrounding context
                            start = max(0, match.start() - 50)
                            end = min(len(content), match.end() + 50)
                            context = content[start:end]
                            
                            pattern_examples[category].append({
                                'phrase': match.group(),
                                'context': f"...{context}...",
                                'timestamp': msg['timestamp']
                            })
        
        # Print real examples
        for category, examples in pattern_examples.items():
            if examples:
                print(f"\n{category.replace('_', ' ').upper()}:")
                # Show variety
                seen_phrases = set()
                for ex in examples[:10]:
                    if ex['phrase'] not in seen_phrases:
                        print(f"  \"{ex['phrase']}\" - {ex['context']}")
                        seen_phrases.add(ex['phrase'])
    
    def analyze_problem_solving(self):
        """How Mike actually approaches problems"""
        print("\n=== HOW MIKE SOLVES PROBLEMS ===")
        
        problem_indicators = [
            r"how (?:do|can|should) (?:i|we)",
            r"the problem is",
            r"issue is",
            r"need to",
            r"have to",
            r"trying to",
            r"want to"
        ]
        
        solution_indicators = [
            r"so (?:i|we)",
            r"instead",
            r"what if",
            r"could",
            r"maybe",
            r"let's",
            r"might as well"
        ]
        
        problems_and_solutions = []
        
        for conv in self.conversations[:150]:
            messages = self.extract_mike_messages(conv)
            title = conv.get('title', 'Unknown')
            
            for msg in messages:
                content = msg['content']
                
                # Look for problem statements
                for pattern in problem_indicators:
                    if re.search(pattern, content, re.IGNORECASE):
                        problems_and_solutions.append({
                            'type': 'problem',
                            'content': content[:300],
                            'title': title,
                            'timestamp': msg['timestamp']
                        })
                        break
                
                # Look for solution approaches
                for pattern in solution_indicators:
                    if re.search(pattern, content, re.IGNORECASE):
                        problems_and_solutions.append({
                            'type': 'solution',
                            'content': content[:300],
                            'title': title,
                            'timestamp': msg['timestamp']
                        })
                        break
        
        # Group and display
        print("\nPROBLEM → SOLUTION PATTERNS:")
        for i in range(0, min(10, len(problems_and_solutions)-1)):
            item = problems_and_solutions[i]
            if item['type'] == 'problem':
                print(f"\nProblem: {item['content']}")
                # Look for next solution
                for j in range(i+1, min(i+5, len(problems_and_solutions))):
                    if problems_and_solutions[j]['type'] == 'solution':
                        print(f"Approach: {problems_and_solutions[j]['content']}")
                        break
    
    def analyze_evolution(self):
        """Track how thinking actually evolved over time"""
        print("\n=== HOW THINKING EVOLVED ===")
        
        # Group by month
        monthly_stats = defaultdict(lambda: {
            'message_count': 0,
            'total_length': 0,
            'topics': [],
            'key_phrases': Counter()
        })
        
        for conv in self.conversations:
            timestamp = conv.get('create_time')
            if not timestamp:
                continue
                
            date = datetime.fromtimestamp(timestamp)
            month_key = date.strftime('%Y-%m')
            
            messages = self.extract_mike_messages(conv)
            monthly_stats[month_key]['message_count'] += len(messages)
            monthly_stats[month_key]['topics'].append(conv.get('title', 'Unknown'))
            
            for msg in messages:
                content = msg['content']
                monthly_stats[month_key]['total_length'] += len(content)
                
                # Extract key phrases (2-3 word combinations)
                words = content.lower().split()
                for i in range(len(words)-2):
                    phrase = f"{words[i]} {words[i+1]}"
                    if len(words[i]) > 3 and len(words[i+1]) > 3:  # Skip short words
                        monthly_stats[month_key]['key_phrases'][phrase] += 1
        
        # Show evolution
        for month in sorted(monthly_stats.keys()):
            stats = monthly_stats[month]
            if stats['message_count'] > 0:
                avg_length = stats['total_length'] / stats['message_count']
                top_phrases = stats['key_phrases'].most_common(5)
                
                print(f"\n{month}:")
                print(f"  Messages: {stats['message_count']}")
                print(f"  Avg length: {avg_length:.0f} chars")
                print(f"  Top phrases: {', '.join([p[0] for p in top_phrases])}")
                print(f"  Sample topics: {', '.join(stats['topics'][:3])}")
    
    def extract_core_beliefs(self):
        """Find Mike's actual core beliefs from what he says repeatedly"""
        print("\n=== CORE BELIEFS (FROM REPETITION) ===")
        
        # Patterns that indicate beliefs/philosophy
        belief_patterns = [
            r"i (?:think|believe|feel|know) (?:that )?(.{10,100})",
            r"(?:always|never) (.{10,100})",
            r"the (?:way|thing) is (.{10,100})",
            r"(?:everything|nothing) is (.{10,100})",
            r"you (?:have to|need to|should) (.{10,100})",
            r"(?:i've|we've) learned (.{10,100})"
        ]
        
        beliefs = Counter()
        
        for conv in self.conversations:
            messages = self.extract_mike_messages(conv)
            
            for msg in messages:
                content = msg['content']
                
                for pattern in belief_patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        belief = match.group(1) if match.lastindex else match.group(0)
                        # Clean up
                        belief = belief.strip().rstrip('.').lower()
                        if 20 < len(belief) < 100:
                            beliefs[belief] += 1
        
        # Show top beliefs
        print("\nMOST REPEATED BELIEFS/STATEMENTS:")
        for belief, count in beliefs.most_common(20):
            if count > 1:  # Only show repeated ones
                print(f"  ({count}x) \"{belief}\"")
    
    def generate_simple_framework(self):
        """Create framework in Mike's actual language"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/MIKE-ACTUAL-FRAMEWORK.md"
        
        with open(output_path, 'w') as f:
            f.write("# How Mike Actually Thinks (No BS Version)\n\n")
            f.write("From 903 conversations, here's how I actually think and talk.\n\n")
            
            f.write("## The Real Patterns\n\n")
            
            f.write("### 1. I Build Things That Build Themselves\n")
            f.write("- Start manual, collect data\n")
            f.write("- See what sucks, automate it\n")
            f.write("- Skip versions that won't matter\n")
            f.write("- Let the system teach itself\n\n")
            
            f.write("### 2. Everything's Connected\n")
            f.write("- Don't learn one thing at a time\n")
            f.write("- Jump between ideas\n")
            f.write("- Use what you know from other stuff\n")
            f.write("- It all feeds into itself\n\n")
            
            f.write("### 3. Time Is A Tool\n")
            f.write("- Don't build what you'll throw away\n")
            f.write("- Think about future you\n")
            f.write("- Skip steps when you can see the end\n")
            f.write("- V1 to V3, forget V2\n\n")
            
            f.write("### 4. Learn By Doing\n")
            f.write("- Don't wait for permission\n")
            f.write("- Build real stuff, not exercises\n")
            f.write("- Break things to understand them\n")
            f.write("- If no tools exist, make them\n\n")
            
            f.write("### 5. Keep It Simple\n")
            f.write("- No fancy words\n")
            f.write("- Say what you mean\n")
            f.write("- Build what works\n")
            f.write("- Compress ideas, not complicate them\n\n")
            
            f.write("## How I Actually Talk\n\n")
            f.write("- \"I don't know\" - and that's fine\n")
            f.write("- \"Might as well\" - when the path is clear\n")
            f.write("- \"Waste of time\" - skip what doesn't matter\n")
            f.write("- \"Who knows\" - embrace uncertainty\n")
            f.write("- \"To be honest\" - always\n\n")
            
            f.write("## How I Solve Problems\n\n")
            f.write("1. What's actually broken?\n")
            f.write("2. What's the simplest fix?\n")
            f.write("3. Can it fix itself next time?\n")
            f.write("4. What else does this solve?\n")
            f.write("5. Move on\n\n")
            
            f.write("## What Matters\n\n")
            f.write("- Build because you need it\n")
            f.write("- Automate because manual sucks\n")
            f.write("- Learn because you're building\n")
            f.write("- Share because others need it too\n")
            f.write("- Keep moving\n\n")
            
            f.write("## The Evolution\n\n")
            f.write("- Started: Just trying to run a golf sim business\n")
            f.write("- Learned: Manual work teaches you what to automate\n")
            f.write("- Built: Tools that didn't exist\n")
            f.write("- Realized: The process is the product\n")
            f.write("- Now: Building systems that build systems\n\n")
            
            f.write("## For the LLM\n\n")
            f.write("Stop using fancy words. Talk normal. Build useful stuff. ")
            f.write("Help people save time. Don't explain everything. ")
            f.write("Get to the point. Make it work. Move on.\n\n")
            
            f.write("---\n")
            f.write("That's it. No fluff.\n")
        
        print(f"\nReal framework saved to: {output_path}")
        return output_path

def main():
    file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    analyzer = RealAnalyzer(file_path)
    analyzer.load_data()
    
    print("Starting deep analysis...")
    analyzer.analyze_actual_language()
    analyzer.analyze_problem_solving()
    analyzer.analyze_evolution()
    analyzer.extract_core_beliefs()
    analyzer.generate_simple_framework()
    
    print("\nAnalysis complete. Check MIKE-ACTUAL-FRAMEWORK.md for the real version.")

if __name__ == "__main__":
    main()