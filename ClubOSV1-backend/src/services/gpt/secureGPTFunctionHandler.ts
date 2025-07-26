// src/services/gpt/secureGPTFunctionHandler.ts

import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
// JSON operations removed - using PostgreSQL
import { slackFallback } from '../slackFallback';

interface GPTFunctionCall {
  name: string;
  arguments: Record<string, any>;
  assistant_id: string;
  thread_id?: string;
  user_id?: string;
}

interface FunctionDefinition {
  handler: Function;
  requiredParams: string[];
  assistantIds: string[]; // Which assistants can call this function
  rateLimit?: number; // Calls per minute
}

export class SecureGPTFunctionHandler {
  private functionMap: Map<string, FunctionDefinition>;
  private rateLimiters: Map<string, RateLimiterMemory>;
  private metrics: Map<string, any>;

  constructor() {
    this.functionMap = new Map();
    this.rateLimiters = new Map();
    this.metrics = new Map();
    
    this.initializeFunctions();
    this.initializeRateLimiters();
  }

  private initializeFunctions() {
    // Skip GPT function initialization in demo mode
    if (process.env.ENABLE_DEMO_MODE === 'true') {
      logger.info('Skipping GPT function initialization in demo mode');
      return;
    }

    // Check if required GPT IDs are present
    const requiredIds = [
      'BOOKING_ACCESS_GPT_ID',
      'EMERGENCY_GPT_ID',
      'TECH_SUPPORT_GPT_ID',
      'BRAND_MARKETING_GPT_ID'
    ];

    const missingIds = requiredIds.filter(id => !process.env[id]);
    if (missingIds.length > 0) {
      logger.warn('GPT function initialization skipped - missing assistant IDs:', missingIds);
      return;
    }
    // Booking functions
    this.registerFunction('get_booking_status', {
      handler: this.getBookingStatus.bind(this),
      requiredParams: ['bay_id'],
      assistantIds: [process.env.BOOKING_ACCESS_GPT_ID!].filter(Boolean),
      rateLimit: 60
    });

    this.registerFunction('check_availability', {
      handler: this.checkAvailability.bind(this),
      requiredParams: ['date', 'duration'],
      assistantIds: [process.env.BOOKING_ACCESS_GPT_ID!],
      rateLimit: 30
    });

    this.registerFunction('create_booking', {
      handler: this.createBooking.bind(this),
      requiredParams: ['customer_name', 'customer_email', 'bay_id', 'date', 'start_time', 'duration'],
      assistantIds: [process.env.BOOKING_ACCESS_GPT_ID!],
      rateLimit: 10
    });

    this.registerFunction('modify_booking', {
      handler: this.modifyBooking.bind(this),
      requiredParams: ['booking_id'],
      assistantIds: [process.env.BOOKING_ACCESS_GPT_ID!],
      rateLimit: 10
    });

    this.registerFunction('cancel_booking', {
      handler: this.cancelBooking.bind(this),
      requiredParams: ['booking_id'],
      assistantIds: [process.env.BOOKING_ACCESS_GPT_ID!],
      rateLimit: 10
    });

    // Emergency functions
    this.registerFunction('create_emergency_alert', {
      handler: this.createEmergencyAlert.bind(this),
      requiredParams: ['location', 'type', 'severity', 'description'],
      assistantIds: [process.env.EMERGENCY_GPT_ID!].filter(Boolean),
      rateLimit: 100 // High limit for emergencies
    });

    this.registerFunction('get_emergency_procedures', {
      handler: this.getEmergencyProcedures.bind(this),
      requiredParams: ['emergency_type'],
      assistantIds: [process.env.EMERGENCY_GPT_ID!],
      rateLimit: 100
    });

    // Tech support functions
    this.registerFunction('create_support_ticket', {
      handler: this.createSupportTicket.bind(this),
      requiredParams: ['title', 'description', 'priority', 'issue_type'],
      assistantIds: [process.env.TECH_SUPPORT_GPT_ID!].filter(Boolean),
      rateLimit: 20
    });

    this.registerFunction('check_equipment_status', {
      handler: this.checkEquipmentStatus.bind(this),
      requiredParams: ['equipment_id'],
      assistantIds: [process.env.TECH_SUPPORT_GPT_ID!],
      rateLimit: 30
    });

    // Brand/Marketing functions
    this.registerFunction('get_membership_info', {
      handler: this.getMembershipInfo.bind(this),
      requiredParams: [],
      assistantIds: [process.env.BRAND_MARKETING_GPT_ID!].filter(Boolean),
      rateLimit: 60
    });

    this.registerFunction('check_current_promotions', {
      handler: this.checkCurrentPromotions.bind(this),
      requiredParams: [],
      assistantIds: [process.env.BRAND_MARKETING_GPT_ID!],
      rateLimit: 60
    });
  }

  private registerFunction(name: string, definition: FunctionDefinition) {
    this.functionMap.set(name, definition);
    
    // Initialize metrics for this function
    this.metrics.set(name, {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalDuration: 0,
      lastError: null,
      lastCall: null
    });
  }

  private initializeRateLimiters() {
    for (const [name, def] of this.functionMap) {
      if (def.rateLimit) {
        this.rateLimiters.set(name, new RateLimiterMemory({
          points: def.rateLimit,
          duration: 60, // Per minute
          blockDuration: 60 // Block for 1 minute if exceeded
        }));
      }
    }
  }

  async handleFunctionCall(call: GPTFunctionCall): Promise<any> {
    const startTime = Date.now();
    const executionId = uuidv4();
    
    try {
      // 1. Validate function exists
      const functionDef = this.functionMap.get(call.name);
      if (!functionDef) {
        throw new AppError('UNKNOWN_FUNCTION', `Function ${call.name} not found`, 404);
      }

      // 2. Validate assistant authorization
      if (!functionDef.assistantIds.includes(call.assistant_id)) {
        logger.warn('Unauthorized function call attempt', {
          function: call.name,
          assistant: call.assistant_id,
          executionId
        });
        throw new AppError('UNAUTHORIZED', 'Assistant not authorized for this function', 403);
      }

      // 3. Check rate limits
      const rateLimiter = this.rateLimiters.get(call.name);
      if (rateLimiter) {
        try {
          await rateLimiter.consume(call.assistant_id);
        } catch (rejRes) {
          throw new AppError('RATE_LIMIT', 'Rate limit exceeded', 429);
        }
      }

      // 4. Validate required parameters
      for (const param of functionDef.requiredParams) {
        if (!(param in call.arguments)) {
          throw new AppError('MISSING_PARAMETER', `Required parameter missing: ${param}`, 400);
        }
      }

      // 5. Log the function call
      logger.info('GPT function call started', {
        executionId,
        function: call.name,
        assistant: call.assistant_id,
        thread: call.thread_id,
        timestamp: new Date().toISOString()
      });

      // 6. Execute the function
      const result = await functionDef.handler(call.arguments, {
        executionId,
        assistantId: call.assistant_id,
        threadId: call.thread_id,
        userId: call.user_id
      });

      // 7. Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(call.name, true, duration);

      // 8. Log success
      logger.info('GPT function call completed', {
        executionId,
        function: call.name,
        duration,
        success: true
      });

      // 9. Audit log for sensitive operations
      if (['create_booking', 'cancel_booking', 'create_emergency_alert'].includes(call.name)) {
        await this.auditLog({
          executionId,
          functionName: call.name,
          assistantId: call.assistant_id,
          arguments: call.arguments,
          result: result,
          duration,
          timestamp: new Date()
        });
      }

      return {
        success: true,
        data: result,
        executionId,
        duration
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.updateMetrics(call.name, false, duration, error);

      logger.error('GPT function call failed', {
        executionId,
        function: call.name,
        error: error.message,
        duration
      });

      // Don't expose internal errors to GPT
      if (error instanceof AppError) {
        throw error;
      } else {
        throw new AppError('INTERNAL_ERROR', 'Function execution failed', 500);
      }
    }
  }

  private updateMetrics(functionName: string, success: boolean, duration: number, error?: any) {
    const metrics = this.metrics.get(functionName);
    if (metrics) {
      metrics.totalCalls++;
      if (success) {
        metrics.successfulCalls++;
      } else {
        metrics.failedCalls++;
        metrics.lastError = error?.message || 'Unknown error';
      }
      metrics.totalDuration += duration;
      metrics.lastCall = new Date();
      metrics.averageDuration = metrics.totalDuration / metrics.totalCalls;
    }
  }

  private async auditLog(entry: any) {
    // Implement audit logging to database or file
    // This is critical for compliance and debugging
    try {
      await appendToJsonArray('gpt-audit-log.json', entry);
    } catch (error) {
      logger.error('Failed to write audit log', error);
    }
  }

  // Function Implementations

  private async getBookingStatus(args: any, context: any) {
    const { bay_id, date = new Date().toISOString().split('T')[0] } = args;
    
    // Implement actual booking status check
    const bookings = await readJsonFile<any[]>('bookings.json');
    const bayBookings = bookings.filter(b => 
      b.simulatorId === bay_id && 
      b.startTime.startsWith(date) &&
      b.status !== 'cancelled'
    );

    return {
      bay_id,
      date,
      total_bookings: bayBookings.length,
      bookings: bayBookings.map(b => ({
        booking_id: b.id,
        start_time: b.startTime,
        duration: b.duration,
        customer_name: b.customerName
      })),
      available_slots: this.calculateAvailableSlots(bayBookings, date)
    };
  }

  private async checkAvailability(args: any, context: any) {
    const { date, start_time, duration, bay_type = 'standard' } = args;
    
    // Get all bookings for the date
    const bookings = await readJsonFile<any[]>('bookings.json');
    const dateBookings = bookings.filter(b => 
      b.startTime.startsWith(date) && 
      b.status !== 'cancelled'
    );

    // Get available bays of the requested type
    const bays = await this.getAvailableBays(bay_type);
    
    // Calculate availability for each bay
    const availability = bays.map(bay => {
      const bayBookings = dateBookings.filter(b => b.simulatorId === bay.id);
      const slots = this.calculateAvailableSlots(bayBookings, date, duration);
      
      return {
        bay_id: bay.id,
        bay_name: bay.name,
        bay_type: bay.type,
        available_slots: slots.filter(slot => 
          !start_time || slot.start_time >= start_time
        )
      };
    });

    return {
      date,
      duration,
      bay_type,
      available_bays: availability.filter(bay => bay.available_slots.length > 0),
      fully_booked_bays: availability.filter(bay => bay.available_slots.length === 0).length
    };
  }

  private async createBooking(args: any, context: any) {
    const { customer_name, customer_email, bay_id, date, start_time, duration } = args;
    
    // Validate the booking doesn't conflict
    const startDateTime = `${date}T${start_time}:00`;
    const hasConflict = await this.checkBookingConflict(bay_id, startDateTime, duration);
    
    if (hasConflict) {
      throw new AppError('BOOKING_CONFLICT', 'Time slot is already booked', 409);
    }

    // Create the booking
    const booking = {
      id: `BK-${Date.now()}`,
      customerName: customer_name,
      customerEmail: customer_email,
      simulatorId: bay_id,
      startTime: startDateTime,
      duration: duration,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      createdBy: context.assistantId,
      type: 'single'
    };

    await appendToJsonArray('bookings.json', booking);

    // Send confirmation email (implement this)
    await this.sendBookingConfirmation(booking);

    return {
      booking_id: booking.id,
      status: 'confirmed',
      details: {
        bay: bay_id,
        date: date,
        time: start_time,
        duration: `${duration} minutes`,
        customer: customer_name
      },
      confirmation_sent: true
    };
  }

  private async modifyBooking(args: any, context: any) {
    // Implementation for modifying bookings
    const { booking_id, new_date, new_time, new_duration } = args;
    
    // Load and find booking
    const bookings = await readJsonFile<any[]>('bookings.json');
    const bookingIndex = bookings.findIndex(b => b.id === booking_id);
    
    if (bookingIndex === -1) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    // Apply modifications
    const updatedBooking = { ...bookings[bookingIndex] };
    
    if (new_date || new_time) {
      const date = new_date || updatedBooking.startTime.split('T')[0];
      const time = new_time || updatedBooking.startTime.split('T')[1].substring(0, 5);
      updatedBooking.startTime = `${date}T${time}:00`;
    }
    
    if (new_duration) {
      updatedBooking.duration = new_duration;
    }

    // Check for conflicts
    const hasConflict = await this.checkBookingConflict(
      updatedBooking.simulatorId, 
      updatedBooking.startTime, 
      updatedBooking.duration,
      booking_id // Exclude current booking
    );
    
    if (hasConflict) {
      throw new AppError('BOOKING_CONFLICT', 'New time slot conflicts with existing booking', 409);
    }

    // Update booking
    updatedBooking.updatedAt = new Date().toISOString();
    updatedBooking.updatedBy = context.assistantId;
    bookings[bookingIndex] = updatedBooking;
    
    await writeJsonFile('bookings.json', bookings);

    return {
      booking_id: booking_id,
      status: 'modified',
      changes: {
        new_date: new_date || 'unchanged',
        new_time: new_time || 'unchanged',
        new_duration: new_duration || 'unchanged'
      }
    };
  }

  private async cancelBooking(args: any, context: any) {
    const { booking_id, reason } = args;
    
    const bookings = await readJsonFile<any[]>('bookings.json');
    const bookingIndex = bookings.findIndex(b => b.id === booking_id);
    
    if (bookingIndex === -1) {
      throw new AppError('BOOKING_NOT_FOUND', 'Booking not found', 404);
    }

    // Update status
    bookings[bookingIndex].status = 'cancelled';
    bookings[bookingIndex].cancelledAt = new Date().toISOString();
    bookings[bookingIndex].cancelledBy = context.assistantId;
    bookings[bookingIndex].cancellationReason = reason;
    
    await writeJsonFile('bookings.json', bookings);

    // Send cancellation email
    await this.sendCancellationConfirmation(bookings[bookingIndex]);

    return {
      booking_id: booking_id,
      status: 'cancelled',
      refund_status: 'pending_review',
      cancellation_time: new Date().toISOString()
    };
  }

  private async createEmergencyAlert(args: any, context: any) {
    const { location, type, severity, description, injuries } = args;
    
    const alert = {
      id: `EMRG-${Date.now()}`,
      location,
      type,
      severity,
      description,
      injuries: injuries || false,
      reportedAt: new Date().toISOString(),
      reportedBy: context.assistantId,
      status: 'active',
      responders: []
    };

    // Save alert
    await appendToJsonArray('emergency-alerts.json', alert);

    // Trigger notifications based on severity
    if (severity === 'critical' || severity === 'high') {
      await this.notifyEmergencyContacts(alert);
      await this.notifyManagement(alert);
    }

    // Send to Slack
    await slackFallback.sendMessage({
      channel: '#emergency-alerts',
      username: 'Emergency Bot',
      icon_emoji: ':warning:',
      text: `EMERGENCY ALERT: ${severity.toUpperCase()} - ${type}`,
      attachments: [{
        color: severity === 'critical' ? 'danger' : 'warning',
        title: 'Emergency Details',
        text: description,
        fields: [
          { title: 'Location', value: location, short: true },
          { title: 'Injuries', value: injuries ? 'Yes' : 'No', short: true }
        ],
        footer: 'ClubOS Emergency System',
        ts: Date.now() / 1000
      }]
    });

    return {
      alert_id: alert.id,
      status: 'alert_created',
      notifications_sent: true,
      response_team_notified: severity === 'critical' || severity === 'high',
      next_steps: this.getEmergencyNextSteps(type, severity)
    };
  }

  private async getEmergencyProcedures(args: any, context: any) {
    const { emergency_type } = args;
    
    const procedures = {
      medical: {
        immediate_actions: [
          "Call 911 if life-threatening",
          "Do not move injured person unless in immediate danger",
          "Apply first aid if trained",
          "Clear area around injured person"
        ],
        contact_numbers: {
          emergency: "911",
          facility_manager: process.env.FACILITY_MANAGER_PHONE,
          first_aid_team: process.env.FIRST_AID_TEAM_PHONE
        },
        equipment_locations: {
          first_aid_kit: "Behind each bay counter",
          AED: "Main lobby and pro shop",
          emergency_phone: "Every bay has emergency button"
        }
      },
      fire: {
        immediate_actions: [
          "Activate fire alarm",
          "Evacuate all personnel via nearest exit",
          "Call 911",
          "Do not use elevators",
          "Meet at designated assembly point"
        ],
        assembly_point: "Parking lot section A",
        fire_extinguisher_locations: [
          "Each bay entrance",
          "Kitchen area",
          "Pro shop",
          "Equipment rooms"
        ]
      },
      evacuation: {
        immediate_actions: [
          "Announce evacuation over PA system",
          "Direct customers to nearest exits",
          "Check all bays and restrooms",
          "Account for all staff at assembly point"
        ],
        exit_routes: {
          main_entrance: "Primary exit for lobby and pro shop",
          bay_exits: "Each bay has emergency exit",
          back_exit: "Kitchen and staff areas"
        }
      }
    };

    return procedures[emergency_type] || {
      message: "No specific procedures found",
      general_guidance: "Contact facility manager immediately"
    };
  }

  private async createSupportTicket(args: any, context: any) {
    const { title, description, bay_id, priority, issue_type } = args;
    
    const ticket = {
      id: `TKT-${Date.now()}`,
      title,
      description,
      bayId: bay_id,
      priority,
      issueType: issue_type,
      status: 'open',
      createdAt: new Date().toISOString(),
      createdBy: context.assistantId,
      assignedTo: null,
      updates: []
    };

    await appendToJsonArray('support-tickets.json', ticket);

    // Auto-assign based on issue type and priority
    if (priority === 'urgent' || priority === 'high') {
      await this.notifyOnCallTechnician(ticket);
    }

    return {
      ticket_id: ticket.id,
      status: 'created',
      priority: priority,
      estimated_response_time: this.getEstimatedResponseTime(priority),
      assigned_to: ticket.assignedTo || 'Pending assignment'
    };
  }

  private async checkEquipmentStatus(args: any, context: any) {
    const { equipment_id, include_diagnostics } = args;
    
    // This would connect to actual equipment monitoring
    // For now, return mock data
    const status: any = {
      equipment_id,
      online: true,
      last_heartbeat: new Date(Date.now() - 30000).toISOString(),
      current_status: 'operational',
      uptime_hours: 127.5,
      last_maintenance: '2024-01-15',
      error_count_24h: 0
    };

    if (include_diagnostics) {
      status['diagnostics'] = {
        cpu_usage: '45%',
        memory_usage: '62%',
        temperature: '72°F',
        network_latency: '12ms',
        last_error: null
      };
    }

    return status;
  }

  private async getMembershipInfo(args: any, context: any) {
    const { membership_type = 'all', include_pricing = true } = args;
    
    const memberships: any = {
      individual: {
        name: 'Individual Membership',
        description: 'Perfect for the avid golfer',
        benefits: [
          'Unlimited simulator time during off-peak hours',
          '20% discount on peak hours',
          '4 guest passes per month',
          'Free club storage',
          'Priority booking up to 14 days in advance',
          '10% off lessons and clinics'
        ],
        pricing: include_pricing ? {
          monthly: 199,
          annual: 1999,
          initiation_fee: 99
        } : undefined
      },
      corporate: {
        name: 'Corporate Membership',
        description: 'Ideal for businesses and teams',
        benefits: [
          '5 simultaneous user accounts',
          'Unlimited simulator time',
          'Private bay reservations',
          'Quarterly team events included',
          'Dedicated account manager',
          '20% off catering',
          'Custom branded leagues'
        ],
        pricing: include_pricing ? {
          monthly: 899,
          annual: 8999,
          initiation_fee: 499
        } : undefined
      },
      student: {
        name: 'Student Membership',
        description: 'For full-time students with valid ID',
        benefits: [
          '50% off regular rates',
          'Unlimited off-peak access',
          'Free group clinics',
          '2 guest passes per month'
        ],
        pricing: include_pricing ? {
          monthly: 79,
          annual: 799,
          initiation_fee: 0
        } : undefined
      }
    };

    if (membership_type === 'all') {
      return { memberships: Object.values(memberships) };
    } else {
      return memberships[membership_type] || { error: 'Membership type not found' };
    }
  }

  private async checkCurrentPromotions(args: any, context: any) {
    const { category = 'all' } = args;
    
    const promotions = [
      {
        id: 'NEWYEAR2024',
        name: 'New Year Special',
        description: 'Start your golf year right!',
        discount: '25% off first month',
        valid_until: '2024-02-29',
        category: 'membership',
        conditions: 'New members only'
      },
      {
        id: 'HAPPY_HOUR',
        name: 'Weekday Happy Hour',
        description: 'Half price simulator time',
        discount: '50% off',
        valid_days: 'Monday-Thursday, 2pm-5pm',
        category: 'booking',
        conditions: 'Walk-ins only, subject to availability'
      },
      {
        id: 'LESSON_PACK',
        name: 'Lesson Package Deal',
        description: 'Buy 5 lessons, get 1 free',
        discount: '1 free lesson',
        valid_until: '2024-03-31',
        category: 'lessons',
        conditions: 'Must be used within 6 months'
      }
    ];

    const filtered = category === 'all' 
      ? promotions 
      : promotions.filter(p => p.category === category);

    return {
      active_promotions: filtered,
      total_count: filtered.length,
      categories_available: [...new Set(promotions.map(p => p.category))]
    };
  }

  // Helper methods
  private calculateAvailableSlots(bookings: any[], date: string, duration: number = 60): any[] {
    const slots = [];
    const openTime = 8; // 8 AM
    const closeTime = 22; // 10 PM
    
    for (let hour = openTime; hour < closeTime; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const startDateTime = `${date}T${startTime}:00`;
        
        if (!this.hasConflict(bookings, startDateTime, duration)) {
          slots.push({
            start_time: startTime,
            end_time: this.addMinutes(startTime, duration),
            duration: duration
          });
        }
      }
    }
    
    return slots;
  }

  private hasConflict(bookings: any[], startTime: string, duration: number): boolean {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    
    return bookings.some(booking => {
      const bookingStart = new Date(booking.startTime);
      const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
      
      return (start < bookingEnd && end > bookingStart);
    });
  }

  private addMinutes(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  private getEstimatedResponseTime(priority: string): string {
    const times: any = {
      urgent: '15 minutes',
      high: '1 hour',
      medium: '4 hours',
      low: '24 hours'
    };
    return times[priority] || '24 hours';
  }

  private getEmergencyNextSteps(type: string, severity: string): string[] {
    if (severity === 'critical') {
      return [
        'Emergency services have been notified',
        'Facility manager is being contacted',
        'Clear the affected area',
        'Await emergency responders'
      ];
    }
    
    return [
      'Monitor the situation',
      'Document any changes',
      'Keep area clear',
      'Update alert if severity changes'
    ];
  }

  // Stub methods for external integrations
  private async getAvailableBays(type: string): Promise<any[]> {
    // Would connect to bay management system
    return [
      { id: 'bay-1', name: 'Bay 1', type: 'standard' },
      { id: 'bay-2', name: 'Bay 2', type: 'standard' },
      { id: 'bay-3', name: 'Bay 3', type: 'premium' },
      { id: 'bay-vip', name: 'VIP Suite', type: 'vip' }
    ];
  }

  private async checkBookingConflict(bayId: string, startTime: string, duration: number, excludeBookingId?: string): Promise<boolean> {
    const bookings = await db.getBookings({ simulatorId: bayId });
    const bayBookings = bookings.filter((b: any) => 
      b.status !== 'cancelled' &&
      b.id !== excludeBookingId
    );
    
    return this.hasConflict(bayBookings, startTime, duration);
  }

  private async sendBookingConfirmation(booking: any): Promise<void> {
    // Implement email sending
    logger.info('Booking confirmation sent', { bookingId: booking.id });
  }

  private async sendCancellationConfirmation(booking: any): Promise<void> {
    // Implement email sending
    logger.info('Cancellation confirmation sent', { bookingId: booking.id });
  }

  private async notifyEmergencyContacts(alert: any): Promise<void> {
    // Implement emergency notification system
    logger.info('Emergency contacts notified', { alertId: alert.id });
  }

  private async notifyManagement(alert: any): Promise<void> {
    // Implement management notification
    logger.info('Management notified', { alertId: alert.id });
  }

  private async notifyOnCallTechnician(ticket: any): Promise<void> {
    // Implement technician notification
    logger.info('On-call technician notified', { ticketId: ticket.id });
  }

  // Public methods for monitoring
  public getMetrics(): Map<string, any> {
    return this.metrics;
  }

  public getHealthStatus(): any {
    const totalCalls = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.totalCalls, 0);
    const failedCalls = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.failedCalls, 0);
    
    return {
      status: failedCalls / totalCalls < 0.1 ? 'healthy' : 'degraded',
      totalCalls,
      failedCalls,
      errorRate: (failedCalls / totalCalls * 100).toFixed(2) + '%',
      functionMetrics: Object.fromEntries(this.metrics)
    };
  }
}

// Export singleton instance with delayed initialization
let gptFunctionHandler: SecureGPTFunctionHandler | null = null;

export const getGPTFunctionHandler = () => {
  if (!gptFunctionHandler) {
    gptFunctionHandler = new SecureGPTFunctionHandler();
  }
  return gptFunctionHandler;
};

// For backward compatibility
export { getGPTFunctionHandler as gptFunctionHandler };
