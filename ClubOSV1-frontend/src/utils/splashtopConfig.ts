// Splashtop Bay Computer Configuration
// Uses device names from Splashtop (e.g., DESKTOP-Q4Q4KE3)

export interface BayComputer {
  deviceName?: string;  // Device name shown in Splashtop (e.g., DESKTOP-Q4Q4KE3)
  mac?: string;         // Optional: MAC address for deep linking
  name: string;         // Friendly name for display
  splashtopId?: string; // Optional: Splashtop computer ID
}

// Configuration for bay computers at each location
// Use device names from Splashtop (visible in Computer Info as "Device Name")
export const BAY_COMPUTERS: Record<string, Record<string, BayComputer>> = {
  'Bedford': {
    '1': { 
      deviceName: process.env.NEXT_PUBLIC_BEDFORD_BAY1_DEVICE || '',
      mac: process.env.NEXT_PUBLIC_BEDFORD_BAY1_MAC || '', 
      name: 'Bedford Bay 1 PC' 
    },
    '2': { 
      deviceName: process.env.NEXT_PUBLIC_BEDFORD_BAY2_DEVICE || '',
      mac: process.env.NEXT_PUBLIC_BEDFORD_BAY2_MAC || '', 
      name: 'Bedford Bay 2 PC' 
    },
    '3': { 
      deviceName: process.env.NEXT_PUBLIC_BEDFORD_BAY3_DEVICE || '',
      mac: process.env.NEXT_PUBLIC_BEDFORD_BAY3_MAC || '', 
      name: 'Bedford Bay 3 PC' 
    },
    '4': { 
      deviceName: process.env.NEXT_PUBLIC_BEDFORD_BAY4_DEVICE || '',
      mac: process.env.NEXT_PUBLIC_BEDFORD_BAY4_MAC || '', 
      name: 'Bedford Bay 4 PC' 
    },
    'backwall': { 
      deviceName: process.env.NEXT_PUBLIC_BEDFORD_BACKWALL_DEVICE || 'DESKTOP-Q4Q4KE3',
      name: 'Bedford Backwall Sign' 
    }
  },
  'Dartmouth': {
    '1': { 
      mac: process.env.NEXT_PUBLIC_DARTMOUTH_BAY1_MAC || '', 
      name: 'Dartmouth Bay 1 PC' 
    },
    '2': { 
      mac: process.env.NEXT_PUBLIC_DARTMOUTH_BAY2_MAC || '', 
      name: 'Dartmouth Bay 2 PC' 
    },
    '3': { 
      mac: process.env.NEXT_PUBLIC_DARTMOUTH_BAY3_MAC || '', 
      name: 'Dartmouth Bay 3 PC' 
    },
    '4': { 
      mac: process.env.NEXT_PUBLIC_DARTMOUTH_BAY4_MAC || '', 
      name: 'Dartmouth Bay 4 PC' 
    }
  },
  'Stratford': {
    '1': { 
      mac: process.env.NEXT_PUBLIC_STRATFORD_BAY1_MAC || '', 
      name: 'Stratford Bay 1 PC' 
    },
    '2': { 
      mac: process.env.NEXT_PUBLIC_STRATFORD_BAY2_MAC || '', 
      name: 'Stratford Bay 2 PC' 
    },
    '3': { 
      mac: process.env.NEXT_PUBLIC_STRATFORD_BAY3_MAC || '', 
      name: 'Stratford Bay 3 PC' 
    }
  },
  'Bayers Lake': {
    '1': { 
      mac: process.env.NEXT_PUBLIC_BAYERSLAKE_BAY1_MAC || '', 
      name: 'Bayers Lake Bay 1 PC' 
    },
    '2': { 
      mac: process.env.NEXT_PUBLIC_BAYERSLAKE_BAY2_MAC || '', 
      name: 'Bayers Lake Bay 2 PC' 
    },
    '3': { 
      mac: process.env.NEXT_PUBLIC_BAYERSLAKE_BAY3_MAC || '', 
      name: 'Bayers Lake Bay 3 PC' 
    },
    '4': { 
      mac: process.env.NEXT_PUBLIC_BAYERSLAKE_BAY4_MAC || '', 
      name: 'Bayers Lake Bay 4 PC' 
    },
    '5': { 
      mac: process.env.NEXT_PUBLIC_BAYERSLAKE_BAY5_MAC || '', 
      name: 'Bayers Lake Bay 5 PC' 
    }
  },
  'Truro': {
    '1': { 
      mac: process.env.NEXT_PUBLIC_TRURO_BAY1_MAC || '', 
      name: 'Truro Bay 1 PC' 
    },
    '2': { 
      mac: process.env.NEXT_PUBLIC_TRURO_BAY2_MAC || '', 
      name: 'Truro Bay 2 PC' 
    },
    '3': { 
      mac: process.env.NEXT_PUBLIC_TRURO_BAY3_MAC || '', 
      name: 'Truro Bay 3 PC' 
    }
  }
};

// Splashtop account email
export const SPLASHTOP_ACCOUNT_EMAIL = process.env.NEXT_PUBLIC_SPLASHTOP_EMAIL || '';

// Generate Splashtop deep link for a specific bay
export function generateSplashtopLink(location: string, bayNumber: string): string | null {
  const computer = BAY_COMPUTERS[location]?.[bayNumber];
  
  if (!computer || !computer.mac || !SPLASHTOP_ACCOUNT_EMAIL) {
    return null;
  }
  
  // Format MAC address (remove colons/dashes)
  const formattedMac = computer.mac.replace(/[:-]/g, '').toUpperCase();
  
  // Generate deep link URL for Splashtop Business
  return `st-business://com.splashtop.business?account=${encodeURIComponent(SPLASHTOP_ACCOUNT_EMAIL)}&mac=${formattedMac}`;
}

// Open Splashtop for a specific bay with intelligent fallback
export function openSplashtopForBay(location: string, bayNumber: string) {
  const userAgent = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(userAgent) && !/Mac/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isMac = /Mac/.test(userAgent) && !isIOS;
  const isWindows = /Windows/.test(userAgent);
  
  const deepLink = generateSplashtopLink(location, bayNumber);
  const webPortalUrl = 'https://my.splashtop.com/computers';
  const computer = BAY_COMPUTERS[location]?.[bayNumber];
  
  console.log(`Opening Splashtop for ${location} Bay ${bayNumber}`, {
    platform: isIOS ? 'iOS' : isAndroid ? 'Android' : isMac ? 'Mac' : isWindows ? 'Windows' : 'Unknown',
    deepLink,
    computerName: computer?.name
  });
  
  // If we have a deep link with MAC address, try it first
  if (deepLink) {
    if (isIOS || isMac || isWindows) {
      // Use iframe method for iOS and desktop
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      
      // Fallback to web portal after timeout
      setTimeout(() => {
        document.body.removeChild(iframe);
        if (!document.hidden) {
          console.log(`Deep link may have failed, opening web portal for ${computer?.name}`);
          window.open(webPortalUrl, '_blank', 'noopener,noreferrer');
        }
      }, 1500);
      
    } else if (isAndroid) {
      // Android: Try intent with the deep link
      const intentUrl = `intent://open#Intent;scheme=st-business;S.account=${encodeURIComponent(SPLASHTOP_ACCOUNT_EMAIL)};S.mac=${computer?.mac.replace(/[:-]/g, '').toUpperCase()};S.browser_fallback_url=${encodeURIComponent(webPortalUrl)};end`;
      window.location.href = intentUrl;
      
    } else {
      // Unknown platform: Open web portal
      window.open(webPortalUrl, '_blank', 'noopener,noreferrer');
    }
  } else {
    // No MAC address configured, open web portal with a helpful message
    console.log(`No MAC address configured for ${location} Bay ${bayNumber}. Opening web portal.`);
    alert(`Please select "${computer?.name || location + ' Bay ' + bayNumber}" from the computer list.`);
    window.open(webPortalUrl, '_blank', 'noopener,noreferrer');
  }
}

// Check if a bay has Splashtop configured
export function isSplashtopConfigured(location: string, bayNumber: string): boolean {
  const computer = BAY_COMPUTERS[location]?.[bayNumber];
  return !!(computer?.mac && SPLASHTOP_ACCOUNT_EMAIL);
}