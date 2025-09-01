/**
 * Conversation State Machine
 * 
 * Manages multi-step conversation flows and pattern chaining
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { patternLearningService } from './patternLearningService';
import { EventEmitter } from 'events';

interface ConversationState {
  conversationId: string;
  currentStep: string;
  context: Map<string, any>;
  patternChain: string[];
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'waiting' | 'completed' | 'escalated' | 'abandoned';
  customerPhone: string;
  nextExpectedPatterns?: string[];
  escalationReason?: string;
}

interface PatternFlow {
  id: string;
  name: string;
  steps: FlowStep[];
  entryPatterns: string[];
  exitConditions: ExitCondition[];
}

interface FlowStep {
  stepId: string;
  patternType: string;
  requiredContext?: string[];
  collectContext?: string[];
  transitions: StepTransition[];
  timeout?: number;
  fallbackStep?: string;
}

interface StepTransition {
  condition: string;
  nextStep: string;
  probability?: number;
}

interface ExitCondition {
  type: 'success' | 'escalation' | 'timeout' | 'customer_request';
  condition: string;
  action: string;
}

export class ConversationStateMachine extends EventEmitter {
  private activeConversations: Map<string, ConversationState> = new Map();
  private flows: Map<string, PatternFlow> = new Map();
  private timeoutCheckInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.loadFlows();
    this.startTimeoutMonitor();
  }

  /**
   * Load conversation flows from database
   */
  private async loadFlows() {
    try {
      // Define common conversation flows
      const bookingFlow: PatternFlow = {
        id: 'booking_flow',
        name: 'Bay Booking Flow',
        steps: [
          {
            stepId: 'greeting',
            patternType: 'booking_intent',
            collectContext: ['preferred_date', 'preferred_time'],
            transitions: [
              { condition: 'has_datetime', nextStep: 'check_availability' },
              { condition: 'missing_datetime', nextStep: 'ask_datetime' }
            ]
          },
          {
            stepId: 'ask_datetime',
            patternType: 'request_datetime',
            collectContext: ['preferred_date', 'preferred_time'],
            transitions: [
              { condition: 'datetime_provided', nextStep: 'check_availability' },
              { condition: 'unclear', nextStep: 'clarify_datetime' }
            ],
            timeout: 300, // 5 minutes
            fallbackStep: 'escalate'
          },
          {
            stepId: 'check_availability',
            patternType: 'availability_check',
            requiredContext: ['preferred_date', 'preferred_time'],
            transitions: [
              { condition: 'available', nextStep: 'confirm_booking' },
              { condition: 'unavailable', nextStep: 'offer_alternatives' }
            ]
          },
          {
            stepId: 'offer_alternatives',
            patternType: 'suggest_alternatives',
            collectContext: ['alternative_accepted'],
            transitions: [
              { condition: 'alternative_accepted', nextStep: 'confirm_booking' },
              { condition: 'alternatives_rejected', nextStep: 'escalate' }
            ]
          },
          {
            stepId: 'confirm_booking',
            patternType: 'booking_confirmation',
            requiredContext: ['preferred_date', 'preferred_time'],
            transitions: [
              { condition: 'confirmed', nextStep: 'complete' }
            ]
          }
        ],
        entryPatterns: ['booking', 'reservation', 'book a bay'],
        exitConditions: [
          { type: 'success', condition: 'booking_confirmed', action: 'send_confirmation' },
          { type: 'escalation', condition: 'customer_frustrated', action: 'transfer_to_human' },
          { type: 'timeout', condition: 'inactive_10min', action: 'send_followup' }
        ]
      };

      this.flows.set('booking_flow', bookingFlow);

      // Load custom flows from database
      const customFlows = await db.query(`
        SELECT * FROM conversation_flows WHERE is_active = true
      `);

      for (const flow of customFlows.rows) {
        this.flows.set(flow.id, flow.flow_definition);
      }

      logger.info(`Loaded ${this.flows.size} conversation flows`);
    } catch (error) {
      logger.error('Failed to load conversation flows:', error);
    }
  }

  /**
   * Process incoming message through state machine
   */
  async processMessage(
    conversationId: string,
    message: string,
    phoneNumber: string,
    context?: any
  ): Promise<{
    response?: string;
    nextAction?: string;
    shouldEscalate?: boolean;
    currentStep?: string;
  }> {
    try {
      // Get or create conversation state
      let state = this.activeConversations.get(conversationId);
      
      if (!state) {
        // Try to match entry pattern to a flow
        const flow = await this.matchFlow(message);
        if (!flow) {
          // No flow matched, use single-step pattern
          return this.processSingleStep(message, phoneNumber, conversationId);
        }

        // Initialize new conversation state
        state = {
          conversationId,
          currentStep: flow.steps[0].stepId,
          context: new Map(Object.entries(context || {})),
          patternChain: [],
          startTime: new Date(),
          lastActivity: new Date(),
          status: 'active',
          customerPhone: phoneNumber
        };

        this.activeConversations.set(conversationId, state);
        this.emit('conversation:started', { conversationId, flow: flow.id });
      }

      // Update last activity
      state.lastActivity = new Date();

      // Check for escalation triggers
      if (this.shouldEscalate(message)) {
        state.status = 'escalated';
        state.escalationReason = 'customer_request';
        this.emit('conversation:escalated', { conversationId, reason: 'customer_request' });
        return {
          shouldEscalate: true,
          currentStep: state.currentStep
        };
      }

      // Get current flow and step
      const flow = await this.getFlowForState(state);
      if (!flow) {
        return this.handleUnknownFlow(state, message);
      }

      const currentStep = flow.steps.find(s => s.stepId === state.currentStep);
      if (!currentStep) {
        logger.error('Current step not found in flow', { 
          conversationId, 
          stepId: state.currentStep 
        });
        return this.escalate(state, 'invalid_step');
      }

      // Collect context from message
      if (currentStep.collectContext) {
        await this.extractContext(message, currentStep.collectContext, state);
      }

      // Check required context
      if (currentStep.requiredContext) {
        const missingContext = currentStep.requiredContext.filter(
          key => !state.context.has(key)
        );
        
        if (missingContext.length > 0) {
          return this.requestMissingContext(missingContext, state);
        }
      }

      // Process through pattern learning
      const patternResult = await patternLearningService.processMessage(
        message,
        phoneNumber,
        conversationId,
        state.context.get('customer_name')
      );

      // Add to pattern chain
      if (patternResult.pattern) {
        state.patternChain.push(patternResult.pattern.id.toString());
      }

      // Determine next step based on transitions
      const nextStep = await this.determineNextStep(
        currentStep,
        message,
        state,
        patternResult
      );

      if (nextStep === 'complete') {
        state.status = 'completed';
        this.emit('conversation:completed', { conversationId });
        this.activeConversations.delete(conversationId);
        return {
          response: patternResult.suggestedAction?.response || 'Thank you! Is there anything else I can help with?',
          currentStep: 'completed'
        };
      }

      if (nextStep === 'escalate') {
        return this.escalate(state, 'flow_requires_escalation');
      }

      // Update state
      state.currentStep = nextStep;

      // Generate response
      const response = await this.generateResponse(state, patternResult);

      return {
        response,
        nextAction: nextStep,
        currentStep: state.currentStep
      };
    } catch (error) {
      logger.error('Error in conversation state machine:', error);
      return {
        shouldEscalate: true,
        currentStep: 'error'
      };
    }
  }

  /**
   * Check if message indicates customer wants human
   */
  private shouldEscalate(message: string): boolean {
    const escalationPhrases = [
      'speak to human',
      'talk to someone',
      'operator',
      'real person',
      'manager',
      'this is wrong',
      'doesn\'t help',
      'frustrated',
      'angry'
    ];

    const lower = message.toLowerCase();
    return escalationPhrases.some(phrase => lower.includes(phrase));
  }

  /**
   * Match message to a conversation flow
   */
  private async matchFlow(message: string): Promise<PatternFlow | null> {
    const lower = message.toLowerCase();
    
    for (const [flowId, flow] of this.flows) {
      if (flow.entryPatterns.some(pattern => lower.includes(pattern))) {
        return flow;
      }
    }
    
    return null;
  }

  /**
   * Process single-step pattern (no flow)
   */
  private async processSingleStep(
    message: string,
    phoneNumber: string,
    conversationId: string
  ): Promise<any> {
    const result = await patternLearningService.processMessage(
      message,
      phoneNumber,
      conversationId
    );

    if (result.action === 'auto_execute' && result.suggestedAction) {
      return {
        response: result.suggestedAction.response,
        currentStep: 'single_step_complete'
      };
    }

    return {
      shouldEscalate: result.action === 'escalate',
      currentStep: 'single_step'
    };
  }

  /**
   * Get flow for current state
   */
  private async getFlowForState(state: ConversationState): Promise<PatternFlow | null> {
    // For now, return first flow - should match based on pattern chain
    return this.flows.values().next().value;
  }

  /**
   * Handle unknown flow
   */
  private handleUnknownFlow(state: ConversationState, message: string): any {
    logger.warn('Unknown flow for conversation', { 
      conversationId: state.conversationId 
    });
    
    return {
      shouldEscalate: true,
      currentStep: 'unknown'
    };
  }

  /**
   * Escalate conversation to human
   */
  private escalate(state: ConversationState, reason: string): any {
    state.status = 'escalated';
    state.escalationReason = reason;
    
    this.emit('conversation:escalated', {
      conversationId: state.conversationId,
      reason,
      context: Array.from(state.context.entries())
    });

    // Save escalation to database
    db.query(`
      INSERT INTO conversation_escalations
      (conversation_id, reason, context, pattern_chain, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [
      state.conversationId,
      reason,
      JSON.stringify(Array.from(state.context.entries())),
      state.patternChain
    ]).catch(err => logger.error('Failed to save escalation:', err));

    return {
      shouldEscalate: true,
      response: 'I\'ll connect you with a team member who can better assist you.',
      currentStep: 'escalated'
    };
  }

  /**
   * Extract context from message
   */
  private async extractContext(
    message: string,
    contextKeys: string[],
    state: ConversationState
  ): Promise<void> {
    // Extract date/time
    if (contextKeys.includes('preferred_date') || contextKeys.includes('preferred_time')) {
      const dateTimeRegex = /(\d{1,2}[\/\-]\d{1,2}|\btomorrow\b|\btoday\b).*?(\d{1,2}:\d{2}|\d{1,2}\s*[ap]m)/i;
      const match = message.match(dateTimeRegex);
      
      if (match) {
        state.context.set('preferred_date', match[1]);
        state.context.set('preferred_time', match[2]);
      }
    }

    // Extract number of people
    if (contextKeys.includes('party_size')) {
      const numberMatch = message.match(/(\d+)\s*(people|players|guests)/i);
      if (numberMatch) {
        state.context.set('party_size', parseInt(numberMatch[1]));
      }
    }

    // Extract duration
    if (contextKeys.includes('duration')) {
      const durationMatch = message.match(/(\d+)\s*(hour|hr|minute|min)/i);
      if (durationMatch) {
        state.context.set('duration', durationMatch[0]);
      }
    }
  }

  /**
   * Request missing context from customer
   */
  private requestMissingContext(
    missingKeys: string[],
    state: ConversationState
  ): any {
    const questions: Record<string, string> = {
      preferred_date: 'What date would you like to book?',
      preferred_time: 'What time works best for you?',
      party_size: 'How many people will be playing?',
      duration: 'How long would you like to book for?'
    };

    const response = questions[missingKeys[0]] || 'Could you provide more details?';

    return {
      response,
      currentStep: state.currentStep,
      waitingFor: missingKeys[0]
    };
  }

  /**
   * Determine next step based on transitions
   */
  private async determineNextStep(
    currentStep: FlowStep,
    message: string,
    state: ConversationState,
    patternResult: any
  ): Promise<string> {
    // Check each transition condition
    for (const transition of currentStep.transitions) {
      if (await this.evaluateCondition(transition.condition, message, state)) {
        return transition.nextStep;
      }
    }

    // No transition matched, use fallback
    return currentStep.fallbackStep || 'escalate';
  }

  /**
   * Evaluate transition condition
   */
  private async evaluateCondition(
    condition: string,
    message: string,
    state: ConversationState
  ): Promise<boolean> {
    switch (condition) {
      case 'has_datetime':
        return state.context.has('preferred_date') && state.context.has('preferred_time');
      
      case 'datetime_provided':
        return message.match(/\d{1,2}[\/\-:]\d{1,2}/) !== null;
      
      case 'available':
        // Would check actual availability
        return Math.random() > 0.3; // Mock 70% availability
      
      case 'confirmed':
        return message.toLowerCase().includes('yes') || 
               message.toLowerCase().includes('confirm');
      
      default:
        return false;
    }
  }

  /**
   * Generate response for current state
   */
  private async generateResponse(
    state: ConversationState,
    patternResult: any
  ): Promise<string> {
    if (patternResult.response) {
      // Replace context variables
      let response = patternResult.response;
      
      for (const [key, value] of state.context) {
        response = response.replace(`{{${key}}}`, value);
      }
      
      return response;
    }

    // Default responses based on step
    const defaults: Record<string, string> = {
      greeting: 'Hi! I can help you book a bay. When would you like to play?',
      ask_datetime: 'What date and time would work for you?',
      check_availability: 'Let me check availability...',
      offer_alternatives: 'That time isn\'t available. How about these alternatives?',
      confirm_booking: 'Great! Shall I confirm this booking for you?'
    };

    return defaults[state.currentStep] || 'How can I help you?';
  }

  /**
   * Monitor for timeout conversations
   */
  private startTimeoutMonitor() {
    this.timeoutCheckInterval = setInterval(() => {
      const now = new Date();
      
      for (const [conversationId, state] of this.activeConversations) {
        const inactiveMinutes = (now.getTime() - state.lastActivity.getTime()) / 1000 / 60;
        
        if (inactiveMinutes > 10 && state.status === 'active') {
          state.status = 'abandoned';
          this.emit('conversation:timeout', { conversationId });
          
          // Clean up after 30 minutes
          if (inactiveMinutes > 30) {
            this.activeConversations.delete(conversationId);
          }
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get active conversation count
   */
  getActiveConversationCount(): number {
    return Array.from(this.activeConversations.values())
      .filter(s => s.status === 'active').length;
  }

  /**
   * Get conversation state
   */
  getConversationState(conversationId: string): ConversationState | undefined {
    return this.activeConversations.get(conversationId);
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
    }
    this.removeAllListeners();
  }
}

export const conversationStateMachine = new ConversationStateMachine();