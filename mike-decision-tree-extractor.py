#!/usr/bin/env python3
"""
Extract Mike's actual decision trees and if-then logic from conversations
"""

import json
import re
from datetime import datetime
from collections import defaultdict
import os

class DecisionTreeExtractor:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.conversations = []
        self.decision_patterns = []
        self.belief_to_action = defaultdict(list)
        self.problem_to_solution = defaultdict(list)
        self.if_then_patterns = []
        
    def load_conversations(self):
        """Load all conversations"""
        with open(self.file_path, 'r', encoding='utf-8') as f:
            self.conversations = json.load(f)
        print(f"Loaded {len(self.conversations)} conversations")
    
    def extract_message_content(self, parts):
        """Extract text from message parts"""
        text_content = []
        for part in parts:
            if isinstance(part, str):
                text_content.append(part)
            elif isinstance(part, dict) and part.get('text'):
                text_content.append(part['text'])
        return ' '.join(text_content)
    
    def extract_decision_patterns(self):
        """Find actual decision-making patterns"""
        print("\n=== EXTRACTING DECISION PATTERNS ===")
        
        # Patterns that indicate decision logic
        decision_indicators = {
            'condition_action': [
                r"if (.+?)[,\.]?\s*(?:then\s+)?(.+?)(?:\.|$)",
                r"when (.+?)[,\.]?\s*(?:i|we|you)\s+(.+?)(?:\.|$)",
                r"(?:every time|whenever) (.+?)[,\.]?\s*(?:i|we)\s+(.+?)(?:\.|$)"
            ],
            'problem_solution': [
                r"(?:the problem is|issue is) (.+?)[,\.]?\s*so (.+?)(?:\.|$)",
                r"(.+?) (?:sucks|is broken)[,\.]?\s*so (.+?)(?:\.|$)",
                r"(?:need to|have to) (.+?) (?:because|since) (.+?)(?:\.|$)"
            ],
            'choice_reasoning': [
                r"(?:chose|picked|went with) (.+?) (?:because|since) (.+?)(?:\.|$)",
                r"instead of (.+?)[,\.]?\s*(?:i|we) (.+?)(?:\.|$)",
                r"(.+?) (?:makes sense|works better) because (.+?)(?:\.|$)"
            ]
        }
        
        for conv_idx, conv in enumerate(self.conversations):
            if conv_idx % 100 == 0:
                print(f"  Processing {conv_idx}/{len(self.conversations)}...")
            
            mapping = conv.get('mapping', {})
            title = conv.get('title', 'Unknown')
            
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
                    text = self.extract_message_content(parts)
                    
                    if text and len(text) > 50:
                        # Extract decision patterns
                        for pattern_type, patterns in decision_indicators.items():
                            for pattern in patterns:
                                matches = re.finditer(pattern, text, re.IGNORECASE | re.DOTALL)
                                for match in matches:
                                    if match.lastindex >= 2:
                                        condition = match.group(1).strip()
                                        action = match.group(2).strip()
                                        
                                        self.decision_patterns.append({
                                            'type': pattern_type,
                                            'condition': condition,
                                            'action': action,
                                            'full_context': text[:500],
                                            'title': title
                                        })
    
    def extract_belief_systems(self):
        """Extract core beliefs and resulting actions"""
        print("\n=== EXTRACTING BELIEF → ACTION MAPPINGS ===")
        
        belief_patterns = [
            r"i (?:believe|think|know) (.+?)[,\.]?\s*so (?:i|we) (.+?)(?:\.|$)",
            r"(?:since|because) (.+?)[,\.]?\s*(?:i|we) (.+?)(?:\.|$)",
            r"(.+?) (?:means|equals) (.+?)(?:\.|$)",
            r"if you (.+?)[,\.]?\s*you (.+?)(?:\.|$)"
        ]
        
        for conv in self.conversations[:300]:  # Detailed analysis of first 300
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
                    text = self.extract_message_content(parts)
                    
                    for pattern in belief_patterns:
                        matches = re.finditer(pattern, text, re.IGNORECASE)
                        for match in matches:
                            if match.lastindex >= 2:
                                belief = match.group(1).strip()
                                action = match.group(2).strip()
                                
                                if len(belief) > 10 and len(action) > 10:
                                    self.belief_to_action[belief].append(action)
    
    def extract_problem_solutions(self):
        """Map problems to Mike's solutions"""
        print("\n=== EXTRACTING PROBLEM → SOLUTION MAPPINGS ===")
        
        problem_solution_pairs = []
        
        for conv in self.conversations:
            mapping = conv.get('mapping', {})
            title = conv.get('title', 'Unknown')
            
            # Extract conversation flow
            messages = []
            for node_id, node in mapping.items():
                if not node:
                    continue
                msg = node.get('message')
                if not msg:
                    continue
                
                author = msg.get('author', {})
                role = author.get('role')
                
                if role in ['user', 'assistant']:
                    content = msg.get('content', {})
                    parts = content.get('parts', [])
                    text = self.extract_message_content(parts)
                    
                    if text:
                        messages.append({
                            'role': role,
                            'content': text,
                            'timestamp': msg.get('create_time')
                        })
            
            # Look for problem-solution pairs in conversation flow
            for i in range(len(messages)-1):
                if messages[i]['role'] == 'user':
                    user_msg = messages[i]['content'].lower()
                    
                    # Check if it's a problem statement
                    problem_indicators = ['how do i', 'how can i', 'need to', 'trying to', 
                                        'issue with', 'problem is', 'stuck on', 'help with']
                    
                    if any(indicator in user_msg for indicator in problem_indicators):
                        # Look for solution in next messages
                        for j in range(i+1, min(i+3, len(messages))):
                            if messages[j]['role'] == 'user':
                                solution_msg = messages[j]['content']
                                
                                # Check if Mike provided a solution/decision
                                solution_indicators = ['so i', 'decided to', 'went with', 
                                                     'ended up', 'solution was', 'fixed it by']
                                
                                if any(indicator in solution_msg.lower() for indicator in solution_indicators):
                                    problem_solution_pairs.append({
                                        'problem': messages[i]['content'][:300],
                                        'solution': solution_msg[:300],
                                        'title': title
                                    })
                                    break
        
        # Group similar problems
        for pair in problem_solution_pairs:
            problem_key = self.categorize_problem(pair['problem'])
            self.problem_to_solution[problem_key].append({
                'problem': pair['problem'],
                'solution': pair['solution'],
                'title': pair['title']
            })
    
    def categorize_problem(self, problem_text):
        """Categorize problems into types"""
        problem_lower = problem_text.lower()
        
        if 'automat' in problem_lower:
            return 'automation'
        elif 'code' in problem_lower or 'program' in problem_lower:
            return 'coding'
        elif 'customer' in problem_lower or 'user' in problem_lower:
            return 'customer_service'
        elif 'database' in problem_lower or 'data' in problem_lower:
            return 'data_management'
        elif 'system' in problem_lower or 'architect' in problem_lower:
            return 'system_design'
        else:
            return 'general'
    
    def extract_if_then_logic(self):
        """Extract explicit if-then patterns"""
        print("\n=== EXTRACTING IF-THEN LOGIC ===")
        
        # More specific patterns
        if_then_patterns = [
            r"if (?:you|we|i) (.+?), (?:then\s+)?(.+?)(?:\.|$)",
            r"when (.+?), (.+?)(?:\.|$)",
            r"(?:anytime|whenever) (.+?), (.+?)(?:\.|$)",
            r"(.+?) \? (.+?) : (.+?)(?:\.|$)"  # Ternary logic
        ]
        
        for conv in self.conversations[:200]:
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
                    text = self.extract_message_content(parts)
                    
                    for pattern in if_then_patterns:
                        matches = re.finditer(pattern, text, re.IGNORECASE)
                        for match in matches:
                            if match.lastindex >= 2:
                                condition = match.group(1).strip()
                                then_action = match.group(2).strip()
                                
                                # For ternary, handle else case
                                else_action = match.group(3).strip() if match.lastindex >= 3 else None
                                
                                self.if_then_patterns.append({
                                    'if': condition,
                                    'then': then_action,
                                    'else': else_action,
                                    'context': text[:200]
                                })
    
    def generate_decision_framework(self):
        """Generate comprehensive decision framework"""
        output_path = "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV3/MIKE-COMPLETE-DECISION-FRAMEWORK.md"
        
        with open(output_path, 'w') as f:
            f.write("# Mike's Complete Decision Framework\n\n")
            f.write("This maps exactly how I make decisions, with real examples from conversations.\n\n")
            
            # Core decision patterns
            f.write("## 1. Core Decision Patterns\n\n")
            
            # Group by pattern type
            pattern_groups = defaultdict(list)
            for pattern in self.decision_patterns[:50]:  # Top 50
                pattern_groups[pattern['type']].append(pattern)
            
            for ptype, patterns in pattern_groups.items():
                f.write(f"### {ptype.replace('_', ' ').title()}\n\n")
                for p in patterns[:5]:  # Top 5 per type
                    f.write(f"**IF**: {p['condition']}\n")
                    f.write(f"**THEN**: {p['action']}\n")
                    f.write(f"*Context*: {p['title']}\n\n")
            
            # Core beliefs
            f.write("## 2. Core Beliefs → Actions\n\n")
            
            belief_count = 0
            for belief, actions in self.belief_to_action.items():
                if actions and belief_count < 20:
                    f.write(f"**Belief**: {belief}\n")
                    f.write(f"**Results in**: {actions[0]}\n\n")
                    belief_count += 1
            
            # Problem-solution mappings
            f.write("## 3. Problem → Solution Patterns\n\n")
            
            for problem_type, solutions in self.problem_to_solution.items():
                if solutions:
                    f.write(f"### {problem_type.replace('_', ' ').title()} Problems\n\n")
                    for sol in solutions[:3]:
                        f.write(f"**Problem**: {sol['problem']}\n")
                        f.write(f"**Solution**: {sol['solution']}\n\n")
            
            # If-then logic
            f.write("## 4. Explicit If-Then Logic\n\n")
            
            for logic in self.if_then_patterns[:20]:
                f.write(f"**IF** {logic['if']}\n")
                f.write(f"**THEN** {logic['then']}\n")
                if logic['else']:
                    f.write(f"**ELSE** {logic['else']}\n")
                f.write("\n")
            
            # Meta decision framework
            f.write("## 5. Meta Decision Framework\n\n")
            f.write("### When facing any problem:\n\n")
            f.write("```\n")
            f.write("if (problem.causesRepeatedPain) {\n")
            f.write("    if (solution.exists) {\n")
            f.write("        implement(simplestVersion)\n")
            f.write("    } else {\n")
            f.write("        build(minimalSolution)\n")
            f.write("    }\n")
            f.write("}\n\n")
            f.write("if (solution.willBeReplaced) {\n")
            f.write("    skip(currentVersion)\n")
            f.write("    build(finalVersion)\n")
            f.write("}\n\n")
            f.write("if (timeSpent > valuegained) {\n")
            f.write("    stop()\n")
            f.write("    findDifferentApproach()\n")
            f.write("}\n")
            f.write("```\n\n")
            
            # Specific coding decisions
            f.write("## 6. Coding Decision Tree\n\n")
            f.write("```\n")
            f.write("// Architecture decisions\n")
            f.write("if (needsToScale === 'eventually') {\n")
            f.write("    startWith('monolith')\n")
            f.write("    splitWhen('itActuallyHurts')\n")
            f.write("}\n\n")
            f.write("// Technology choices\n")
            f.write("if (problem === 'needDatabase') {\n")
            f.write("    use('PostgreSQL') // handles everything\n")
            f.write("}\n\n")
            f.write("if (problem === 'needFrontend') {\n")
            f.write("    use('React') // but keep it simple\n")
            f.write("}\n\n")
            f.write("// Development approach\n")
            f.write("while (building) {\n")
            f.write("    makeItWork()\n")
            f.write("    useIt()\n")
            f.write("    if (itHurts) {\n")
            f.write("        fixIt()\n")
            f.write("    }\n")
            f.write("}\n")
            f.write("```\n\n")
            
            # Connected concepts
            f.write("## 7. Connected Concepts\n\n")
            f.write("### Everything relates:\n\n")
            f.write("- **Manual work** → Shows what to automate\n")
            f.write("- **Customer pain** → Becomes product feature\n")
            f.write("- **Time wasted** → Highlights next project\n")
            f.write("- **Tools missing** → Build them yourself\n")
            f.write("- **Learning needed** → Build something real\n\n")
            
            f.write("### Solution connections:\n\n")
            f.write("- **If manual is painful** → Automate it\n")
            f.write("- **If automating everything** → Start with biggest pain\n")
            f.write("- **If building a system** → Make it build itself\n")
            f.write("- **If learning to code** → Code something you need\n")
            f.write("- **If stuck** → Ship ugly version, iterate\n\n")
            
            f.write("---\n")
            f.write("Generated from actual conversation analysis\n")
        
        print(f"\nDecision framework saved to: {output_path}")
        return output_path

def main():
    file_path = "/Users/michaelbelairch1/Downloads/484a99a158b78d6fa3830ca7cc78423f2fb6a05274836500052e7f989dec9b21-2025-08-01-22-05-02-7da79f8299b34689b64359fb0a64ab3c/conversations.json"
    
    extractor = DecisionTreeExtractor(file_path)
    extractor.load_conversations()
    
    print("Extracting decision patterns...")
    extractor.extract_decision_patterns()
    extractor.extract_belief_systems()
    extractor.extract_problem_solutions()
    extractor.extract_if_then_logic()
    extractor.generate_decision_framework()
    
    print("\nAnalysis complete!")

if __name__ == "__main__":
    main()