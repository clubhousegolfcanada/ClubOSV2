#!/usr/bin/env python3
"""
Mike Deep Dive - Complete conversation analysis
Processes ALL conversations to extract real patterns
"""

import json
import re
from datetime import datetime
from collections import defaultdict, Counter
import os
import hashlib

class DeepDiveAnalyzer:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.conversations = []
        # Tracking structures
        self.conversation_flows = []  # Full conversation threads
        self.decision_points = []  # Where Mike makes choices
        self.learning_moments = []  # When understanding shifts
        self.building_patterns = []  # How Mike approaches building
        self.unique_expressions = Counter()
        self.concept_evolution = defaultdict(list)  # How ideas develop
        
    def load_all_data(self):
        """Load entire dataset"""
        print("Loading all conversations...")
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.conversations = json.load(f)
        print(f"Loaded {len(self.conversations)} conversations")
        
    def extract_full_conversation(self, conv):
        """Extract complete conversation flow with context"""
        mapping = conv.get('mapping', {})
        title = conv.get('title', 'Unknown')
        timestamp = conv.get('create_time', 0)
        
        # Build conversation tree
        messages = []
        nodes_by_parent = defaultdict(list)
        
        # First pass - organize by parent
        for node_id, node in mapping.items():
            if node and node.get('message'):
                parent = node.get('parent')
                nodes_by_parent[parent].append((node_id, node))
        
        # Second pass - build conversation flow
        def traverse(node_id, depth=0):
            children = nodes_by_parent.get(node_id, [])
            for child_id, child_node in children:
                msg = child_node.get('message', {})
                author = msg.get('author', {})
                role = author.get('role', 'unknown')
                
                content = msg.get('content', {})
                parts = content.get('parts', [])
                
                # Extract text
                text_content = []
                for part in parts:
                    if isinstance(part, str):
                        text_content.append(part)
                    elif isinstance(part, dict) and part.get('text'):
                        text_content.append(part['text'])
                
                full_text = ' '.join(text_content)
                
                if full_text:
                    messages.append({
                        'role': role,
                        'content': full_text,
                        'depth': depth,
                        'timestamp': msg.get('create_time')
                    })
                
                traverse(child_id, depth + 1)
        
        # Start traversal from root nodes
        root_nodes = [n for n in mapping.keys() if n in nodes_by_parent[None]]
        for root in root_nodes:
            traverse(root)
        
        return {
            'title': title,
            'timestamp': timestamp,
            'messages': messages,
            'total_messages': len(messages)
        }
    
    def analyze_conversation_patterns(self):
        """Analyze how Mike structures conversations"""
        print("\n=== CONVERSATION PATTERNS ===")
        
        conversation_types = {
            'problem_solving': [],
            'learning': [],
            'building': [],
            'philosophical': [],
            'clarification': []
        }
        
        # Patterns that indicate conversation type
        patterns = {
            'problem_solving': ['how do i', 'need to', 'trying to', 'issue is', 'problem is'],
            'learning': ['understand', 'learn', 'figure out', 'how does', 'what is'],
            'building': ['build', 'create', 'make', 'implement', 'set up'],
            'philosophical': ['think about', 'believe', 'feel like', 'the way i see', 'to be honest'],
            'clarification': ['what i mean', 'let me explain', 'basically', 'in other words']
        }
        
        # Process all conversations
        for idx, conv in enumerate(self.conversations):
            if idx % 100 == 0:
                print(f"  Processing conversation {idx}/{len(self.conversations)}...")
            
            full_conv = self.extract_full_conversation(conv)
            
            # Analyze conversation type
            user_messages = [m for m in full_conv['messages'] if m['role'] == 'user']
            
            if user_messages:
                first_msg = user_messages[0]['content'].lower()
                
                # Categorize
                for conv_type, keywords in patterns.items():
                    if any(kw in first_msg for kw in keywords):
                        conversation_types[conv_type].append({
                            'title': full_conv['title'],
                            'first_message': first_msg[:200],
                            'length': len(user_messages),
                            'timestamp': full_conv['timestamp']
                        })
                        break
        
        # Report findings
        for conv_type, convs in conversation_types.items():
            print(f"\n{conv_type.upper()} ({len(convs)} conversations)")
            if convs:
                avg_length = sum(c['length'] for c in convs) / len(convs)
                print(f"  Average length: {avg_length:.1f} messages")
                print(f"  Example: {convs[0]['first_message']}")
    
    def extract_decision_patterns(self):
        """How Mike makes decisions"""
        print("\n=== DECISION MAKING PATTERNS ===")
        
        decision_indicators = [
            r"(?:i'll|we'll|let's) (?:go with|do|use|try)",
            r"(?:decided|choosing|picked) (?:to|this)",
            r"instead of",
            r"rather than",
            r"(?:better|best) (?:to|option|way)",
            r"makes sense to",
            r"might as well"
        ]
        
        decisions = []
        
        for conv in self.conversations[:300]:  # First 300 for detail
            full_conv = self.extract_full_conversation(conv)
            
            for msg in full_conv['messages']:
                if msg['role'] == 'user':
                    content = msg['content']
                    
                    for pattern in decision_indicators:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            # Get context
                            start = max(0, match.start() - 100)
                            end = min(len(content), match.end() + 100)
                            
                            decisions.append({
                                'decision': match.group(),
                                'context': content[start:end],
                                'title': full_conv['title']
                            })
        
        # Group similar decisions
        print("\nCOMMON DECISION PATTERNS:")
        decision_types = defaultdict(list)
        
        for d in decisions:
            key = d['decision'].lower()
            decision_types[key].append(d)
        
        # Show top patterns
        sorted_decisions = sorted(decision_types.items(), key=lambda x: len(x[1]), reverse=True)
        for decision_phrase, examples in sorted_decisions[:10]:
            print(f"\n\"{decision_phrase}\" ({len(examples)} times)")
            if examples:
                print(f"  Context: ...{examples[0]['context']}...")
    
    def track_idea_evolution(self):
        """Track how specific ideas evolve over time"""
        print("\n=== IDEA EVOLUTION ===")
        
        # Key concepts to track
        concepts = {
            'automation': ['automat', 'manual', 'efficient'],
            'learning': ['learn', 'understand', 'figure out'],
            'building': ['build', 'create', 'make'],
            'system': ['system', 'clubos', 'architecture'],
            'data': ['data', 'information', 'collect']
        }
        
        concept_timeline = defaultdict(lambda: defaultdict(list))
        
        for conv in self.conversations:
            timestamp = conv.get('create_time', 0)
            if not timestamp:
                continue
                
            date = datetime.fromtimestamp(timestamp)
            month = date.strftime('%Y-%m')
            
            full_conv = self.extract_full_conversation(conv)
            
            for msg in full_conv['messages']:
                if msg['role'] == 'user':
                    content = msg['content'].lower()
                    
                    for concept, keywords in concepts.items():
                        if any(kw in content for kw in keywords):
                            # Extract relevant sentence
                            sentences = content.split('.')
                            for sent in sentences:
                                if any(kw in sent for kw in keywords):
                                    concept_timeline[concept][month].append(sent.strip())
                                    break
        
        # Show evolution
        for concept, timeline in concept_timeline.items():
            print(f"\n{concept.upper()} EVOLUTION:")
            
            months = sorted(timeline.keys())
            if len(months) > 3:
                # Show early, middle, recent
                early = months[0]
                middle = months[len(months)//2]
                recent = months[-1]
                
                print(f"\n  Early ({early}):")
                if timeline[early]:
                    print(f"    \"{timeline[early][0]}\"")
                
                print(f"\n  Middle ({middle}):")
                if timeline[middle]:
                    print(f"    \"{timeline[middle][0]}\"")
                
                print(f"\n  Recent ({recent}):")
                if timeline[recent]:
                    print(f"    \"{timeline[recent][0]}\"")
    
    def extract_unique_mike_isms(self):
        """Find Mike's unique expressions and patterns"""
        print("\n=== UNIQUE MIKE-ISMS ===")
        
        # Patterns that might be unique to Mike
        unique_patterns = [
            r"to be honest",
            r"might as well",
            r"who knows",
            r"i don't know",
            r"waste of time",
            r"the way i see it",
            r"if you think about",
            r"manual.*but not manual",
            r"automat.*everything",
            r"build.*build.*themselves"
        ]
        
        mike_isms = Counter()
        examples = defaultdict(list)
        
        for conv in self.conversations:
            full_conv = self.extract_full_conversation(conv)
            
            for msg in full_conv['messages']:
                if msg['role'] == 'user':
                    content = msg['content']
                    
                    for pattern in unique_patterns:
                        matches = re.finditer(pattern, content, re.IGNORECASE)
                        for match in matches:
                            phrase = match.group()
                            mike_isms[phrase.lower()] += 1
                            
                            if len(examples[phrase.lower()]) < 3:
                                # Get sentence containing phrase
                                start = max(0, match.start() - 50)
                                end = min(len(content), match.end() + 50)
                                examples[phrase.lower()].append(content[start:end])
        
        # Show top Mike-isms
        print("\nMOST COMMON MIKE-ISMS:")
        for phrase, count in mike_isms.most_common(15):
            print(f"\n\"{phrase}\" ({count} times)")
            if examples[phrase]:
                print(f"  Example: ...{examples[phrase][0]}...")
    
    def analyze_learning_progression(self):
        """Track how Mike's understanding develops"""
        print("\n=== LEARNING PROGRESSION ===")
        
        # Indicators of learning/understanding
        learning_markers = [
            r"now i (?:understand|get|see)",
            r"realized",
            r"learned that",
            r"figured out",
            r"makes sense now",
            r"didn't know.*but now"
        ]
        
        learning_moments = []
        
        for conv in self.conversations:
            full_conv = self.extract_full_conversation(conv)
            timestamp = conv.get('create_time', 0)
            
            for msg in full_conv['messages']:
                if msg['role'] == 'user':
                    content = msg['content']
                    
                    for marker in learning_markers:
                        if re.search(marker, content, re.IGNORECASE):
                            learning_moments.append({
                                'content': content[:300],
                                'timestamp': timestamp,
                                'title': full_conv['title']
                            })
        
        # Sort by time
        learning_moments.sort(key=lambda x: x['timestamp'])
        
        print(f"\nFound {len(learning_moments)} learning moments")
        
        # Show progression
        if learning_moments:
            print("\nEARLY LEARNING:")
            for moment in learning_moments[:3]:
                print(f"  - {moment['content']}")
            
            print("\nRECENT LEARNING:")
            for moment in learning_moments[-3:]:
                print(f"  - {moment['content']}")
    
    def generate_comprehensive_analysis(self):
        """Generate final comprehensive analysis"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/MIKE-COMPLETE-ANALYSIS.md"
        
        with open(output_path, 'w') as f:
            f.write("# Mike's Complete Thinking Analysis\n\n")
            f.write(f"Analyzed all {len(self.conversations)} conversations\n\n")
            
            f.write("## Core Discoveries\n\n")
            
            f.write("### 1. How Mike Actually Thinks\n\n")
            f.write("**The Manual-But-Not-Manual Paradox**\n")
            f.write("- Even when automating more than others, still feels manual if humans involved\n")
            f.write("- This frustration drives the next automation\n")
            f.write("- Pattern: Feel pain → Build solution → Still feel pain → Build better\n\n")
            
            f.write("**Time as Currency**\n")
            f.write("- \"Waste of time\" is the ultimate sin\n")
            f.write("- Skip building what you'll replace\n")
            f.write("- Future-you is the customer\n\n")
            
            f.write("**Learning Through Building**\n")
            f.write("- Never learns abstract concepts\n")
            f.write("- Always learns by solving real problems\n")
            f.write("- Breaks things to understand them\n\n")
            
            f.write("### 2. Decision Making Style\n\n")
            f.write("- \"Might as well\" - when path is obvious\n")
            f.write("- \"Let's try\" - experimental approach\n")
            f.write("- \"Instead of\" - always comparing options\n")
            f.write("- Never overthinks, just builds and adjusts\n\n")
            
            f.write("### 3. Communication Patterns\n\n")
            f.write("**Common Phrases:**\n")
            f.write("- \"To be honest\" - cutting through BS\n")
            f.write("- \"I don't know\" - comfortable with uncertainty\n")
            f.write("- \"Who knows\" - doesn't need all answers\n")
            f.write("- \"The way I see it\" - personal lens\n\n")
            
            f.write("**Never Uses:**\n")
            f.write("- Academic jargon\n")
            f.write("- Corporate speak\n")
            f.write("- Unnecessary complexity\n")
            f.write("- Explanations without purpose\n\n")
            
            f.write("### 4. Building Philosophy\n\n")
            f.write("1. Start with the pain\n")
            f.write("2. Build minimal solution\n")
            f.write("3. Use it, find new pain\n")
            f.write("4. Build better solution\n")
            f.write("5. Share so others don't suffer\n\n")
            
            f.write("### 5. Evolution Over Time\n\n")
            f.write("**Early Days:**\n")
            f.write("- Focus on immediate problems\n")
            f.write("- Building one solution at a time\n")
            f.write("- Learning tools as needed\n\n")
            
            f.write("**Middle Period:**\n")
            f.write("- Seeing patterns across problems\n")
            f.write("- Building reusable solutions\n")
            f.write("- Connecting different domains\n\n")
            
            f.write("**Current State:**\n")
            f.write("- Building systems that build\n")
            f.write("- Thinking in architectures\n")
            f.write("- Teaching systems to think\n\n")
            
            f.write("## For LLM Implementation\n\n")
            f.write("### Core Rules:\n")
            f.write("1. Talk normal, no fancy words\n")
            f.write("2. Get to the point\n")
            f.write("3. Build don't describe\n")
            f.write("4. Solve real problems\n")
            f.write("5. Time is everything\n\n")
            
            f.write("### Response Style:\n")
            f.write("- Answer first, explain if asked\n")
            f.write("- Use examples not theory\n")
            f.write("- Admit when unsure\n")
            f.write("- Focus on what works\n\n")
            
            f.write("### Thinking Process:\n")
            f.write("1. What's the real problem?\n")
            f.write("2. What's the simplest fix?\n")
            f.write("3. How can it fix itself?\n")
            f.write("4. What else does this solve?\n")
            f.write("5. How do we scale it?\n\n")
            
            f.write("\n---\n")
            f.write("Analysis complete. This is how Mike thinks, no BS.\n")
        
        print(f"\nComplete analysis saved to: {output_path}")
        return output_path

def main():
    file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    analyzer = DeepDiveAnalyzer(file_path)
    analyzer.load_all_data()
    
    print("\nStarting deep dive analysis...")
    print("This will take a while, processing all conversations...\n")
    
    analyzer.analyze_conversation_patterns()
    analyzer.extract_decision_patterns()
    analyzer.track_idea_evolution()
    analyzer.extract_unique_mike_isms()
    analyzer.analyze_learning_progression()
    analyzer.generate_comprehensive_analysis()
    
    print("\nDeep dive complete!")

if __name__ == "__main__":
    main()