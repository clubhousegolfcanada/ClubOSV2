import { DbUser, DbTicket, DbFeedback, DbBooking } from './database';

// Transform database user to API user format
export function transformUser(dbUser: DbUser): any {
  const { password, ...userWithoutPassword } = dbUser;
  return {
    id: userWithoutPassword.id,
    email: userWithoutPassword.email,
    name: userWithoutPassword.name,
    role: userWithoutPassword.role,
    phone: userWithoutPassword.phone,
    createdAt: userWithoutPassword.createdAt.toISOString(),
    updatedAt: userWithoutPassword.updatedAt.toISOString(),
    lastLogin: userWithoutPassword.lastLogin?.toISOString(),
    isActive: userWithoutPassword.isActive
  };
}

// Transform database ticket to API ticket format
export function transformTicket(dbTicket: DbTicket): any {
  return {
    id: dbTicket.id,
    title: dbTicket.title,
    description: dbTicket.description,
    category: dbTicket.category,
    status: dbTicket.status,
    priority: dbTicket.priority,
    location: dbTicket.location,
    createdBy: {
      id: dbTicket.created_by_id,
      name: dbTicket.created_by_name,
      email: dbTicket.created_by_email,
      phone: dbTicket.created_by_phone
    },
    assignedTo: dbTicket.assigned_to_id ? {
      id: dbTicket.assigned_to_id,
      name: dbTicket.assigned_to_name!,
      email: dbTicket.assigned_to_email!
    } : undefined,
    createdAt: dbTicket.createdAt.toISOString(),
    updatedAt: dbTicket.updatedAt.toISOString(),
    resolvedAt: dbTicket.resolved_at?.toISOString(),
    metadata: dbTicket.metadata
  };
}

// Transform database feedback to API feedback format
export function transformFeedback(dbFeedback: DbFeedback): any {
  return {
    id: dbFeedback.id,
    timestamp: dbFeedback.timestamp.toISOString(),
    userId: dbFeedback.user_id,
    userEmail: dbFeedback.user_email,
    requestDescription: dbFeedback.request_description,
    location: dbFeedback.location,
    route: dbFeedback.route,
    response: dbFeedback.response,
    confidence: dbFeedback.confidence,
    isUseful: dbFeedback.is_useful,
    feedbackType: dbFeedback.feedback_type,
    feedbackSource: dbFeedback.feedback_source,
    slackThreadTs: dbFeedback.slack_thread_ts,
    slackUserName: dbFeedback.slack_user_name,
    slackUserId: dbFeedback.slack_user_id,
    slackChannel: dbFeedback.slack_channel,
    originalRequestId: dbFeedback.original_request_id,
    createdAt: dbFeedback.createdAt.toISOString()
  };
}

// Transform database booking to API booking format
export function transformBooking(dbBooking: DbBooking): any {
  return {
    id: dbBooking.id,
    userId: dbBooking.user_id,
    simulatorId: dbBooking.simulator_id,
    startTime: dbBooking.start_time.toISOString(),
    duration: dbBooking.duration,
    type: dbBooking.type,
    recurringDays: dbBooking.recurring_days,
    status: dbBooking.status,
    createdAt: dbBooking.createdAt.toISOString(),
    updatedAt: dbBooking.updatedAt.toISOString(),
    cancelledAt: dbBooking.cancelled_at?.toISOString(),
    metadata: dbBooking.metadata
  };
}