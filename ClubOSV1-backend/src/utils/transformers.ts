import { DbUser, DbTicket, DbFeedback, DbBooking } from './database';
import { dbToApi, COMMON_DB_TO_API_OPTIONS } from './caseConverters';

// Transform database user to API user format
export function transformUser(dbUser: DbUser): any {
  const { password, ...userWithoutPassword } = dbUser;
  return dbToApi(userWithoutPassword, COMMON_DB_TO_API_OPTIONS);
}

// Transform database ticket to API ticket format
export function transformTicket(dbTicket: DbTicket): any {
  const transformed = dbToApi(dbTicket, {
    ...COMMON_DB_TO_API_OPTIONS,
    nestedFields: {
      'created_by': ['id', 'name', 'email', 'phone'],
      'assigned_to': ['id', 'name', 'email']
    }
  });

  // Explicitly preserve photo_urls as photoUrls
  // The dbToApi converter should handle this, but we're being explicit
  // to ensure the PostgreSQL array field is properly transformed
  if (dbTicket.photo_urls !== undefined) {
    transformed.photoUrls = dbTicket.photo_urls;
  }

  return transformed;
}

// Transform database feedback to API feedback format
export function transformFeedback(dbFeedback: DbFeedback): any {
  return dbToApi(dbFeedback, {
    ...COMMON_DB_TO_API_OPTIONS,
    dateFields: [...COMMON_DB_TO_API_OPTIONS.dateFields, 'timestamp']
  });
}

// Transform database booking to API booking format
export function transformBooking(dbBooking: DbBooking): any {
  return dbToApi(dbBooking, {
    ...COMMON_DB_TO_API_OPTIONS,
    dateFields: [...COMMON_DB_TO_API_OPTIONS.dateFields, 'start_time', 'cancelled_at']
  });
}