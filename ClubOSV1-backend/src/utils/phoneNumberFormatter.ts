import { logger } from './logger';

/**
 * Formats a phone number to E.164 format
 * E.164 format: +[country code][number] (e.g., +14155552671)
 * Note: defaultCountryCode should be set based on your primary market
 */
export function formatToE164(phoneNumber: string, defaultCountryCode?: string): string | null {
  if (!phoneNumber) {
    return null;
  }

  // Remove all non-numeric characters except + at the beginning
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it already starts with +, assume it's already in E.164 format
  if (cleaned.startsWith('+')) {
    // Validate that it has the correct format
    if (/^\+\d{10,15}$/.test(cleaned)) {
      return cleaned;
    }
    logger.warn('Invalid E.164 format', { phoneNumber: cleaned });
    return null;
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Handle different formats
  if (defaultCountryCode && cleaned.length === 10) {
    // Number without country code - use provided default
    cleaned = defaultCountryCode + cleaned;
  } else if (cleaned.length >= 10 && cleaned.length <= 15) {
    // Likely already includes country code
    // Just validate the length
  } else {
    logger.warn('Unable to format phone number - invalid length', { 
      phoneNumber, 
      cleaned,
      length: cleaned.length 
    });
    return null;
  }
  
  return '+' + cleaned;
}

/**
 * Validates if a phone number is in E.164 format
 */
export function isValidE164(phoneNumber: string): boolean {
  // E.164 format: + followed by 1-15 digits
  return /^\+\d{1,15}$/.test(phoneNumber);
}

/**
 * Extracts the country code from an E.164 formatted number
 */
export function extractCountryCode(phoneNumber: string): string | null {
  if (!isValidE164(phoneNumber)) {
    return null;
  }
  
  // Common country codes - can be customized based on your market
  const countryCodes = [
    '1',      // North America (US/Canada)
    '44',     // UK
    '61',     // Australia
    '64',     // New Zealand
    '91',     // India
    '86',     // China
    '81',     // Japan
    '49',     // Germany
    '33',     // France
    '39',     // Italy
    '34',     // Spain
    '52',     // Mexico
    '55',     // Brazil
    '27',     // South Africa
    '82',     // South Korea
    '65',     // Singapore
    '31',     // Netherlands
    '46',     // Sweden
    '47',     // Norway
    '45',     // Denmark
    '358',    // Finland
    '353',    // Ireland
    '41',     // Switzerland
    '43',     // Austria
    '32',     // Belgium
  ];
  
  for (const code of countryCodes) {
    if (phoneNumber.startsWith('+' + code)) {
      return code;
    }
  }
  
  // If no common country code found, assume it's the first 1-3 digits
  const match = phoneNumber.match(/^\+(\d{1,3})/);
  return match ? match[1] : null;
}

/**
 * Formats a phone number for display (with country-specific formatting)
 */
export function formatForDisplay(phoneNumber: string): string {
  if (!isValidE164(phoneNumber)) {
    return phoneNumber; // Return as-is if not valid E.164
  }
  
  const countryCode = extractCountryCode(phoneNumber);
  const numberWithoutCountry = phoneNumber.substring(countryCode ? countryCode.length + 1 : 1);
  
  // Format based on country code
  switch (countryCode) {
    case '1': // North America
      if (numberWithoutCountry.length === 10) {
        const areaCode = numberWithoutCountry.substring(0, 3);
        const firstPart = numberWithoutCountry.substring(3, 6);
        const secondPart = numberWithoutCountry.substring(6);
        return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
      }
      break;
    case '44': // UK
      // UK mobile numbers typically start with 07
      if (numberWithoutCountry.startsWith('7') && numberWithoutCountry.length === 10) {
        return `+${countryCode} ${numberWithoutCountry.substring(0, 4)} ${numberWithoutCountry.substring(4, 7)} ${numberWithoutCountry.substring(7)}`;
      }
      break;
    case '61': // Australia
      if (numberWithoutCountry.length === 9) {
        return `+${countryCode} ${numberWithoutCountry.substring(0, 3)} ${numberWithoutCountry.substring(3, 6)} ${numberWithoutCountry.substring(6)}`;
      }
      break;
    // Add more country-specific formatting as needed
  }
  
  // Default formatting: add spaces every 3-4 digits for readability
  if (numberWithoutCountry.length >= 6) {
    const parts = [];
    let remaining = numberWithoutCountry;
    
    // First part: 3-4 digits
    parts.push(remaining.substring(0, remaining.length > 7 ? 4 : 3));
    remaining = remaining.substring(parts[0].length);
    
    // Remaining parts: groups of 3
    while (remaining.length > 0) {
      parts.push(remaining.substring(0, 3));
      remaining = remaining.substring(3);
    }
    
    return `+${countryCode} ${parts.join(' ')}`;
  }
  
  return phoneNumber;
}

/**
 * Validates if a phone number can receive SMS (basic validation)
 */
export function canReceiveSMS(phoneNumber: string): boolean {
  if (!isValidE164(phoneNumber)) {
    return false;
  }
  
  // Basic checks - OpenPhone or other services can provide more accurate validation
  
  // Check for common toll-free prefixes (various countries)
  const tollFreePatterns = [
    /^\+1(800|888|877|866|855|844|833)/, // North America
    /^\+44(800|808)/,                      // UK
    /^\+61(1800)/,                         // Australia
    /^\+64(800)/,                          // New Zealand
    // Add more patterns as needed
  ];
  
  for (const pattern of tollFreePatterns) {
    if (pattern.test(phoneNumber)) {
      return false;
    }
  }
  
  // Most numbers can receive SMS, so default to true
  return true;
}