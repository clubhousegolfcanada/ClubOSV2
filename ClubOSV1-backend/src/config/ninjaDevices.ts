// Device registry mapping ClubOS locations to NinjaOne device IDs
// Replace these with actual NinjaOne device IDs after setup

export interface DeviceInfo {
  deviceId: string;
  name: string;
  type: 'trackman' | 'music' | 'tv' | 'other';
}

export interface LocationDevices {
  [key: string]: DeviceInfo;
}

export const DEVICE_REGISTRY: Record<string, LocationDevices> = {
  'Bedford': {
    'bay-1': { 
      deviceId: 'BEDFORD_BAY1_DEVICE_ID', 
      name: 'BEDFORD-BAY1-PC',
      type: 'trackman'
    },
    'bay-2': { 
      deviceId: 'BEDFORD_BAY2_DEVICE_ID', 
      name: 'BEDFORD-BAY2-PC',
      type: 'trackman'
    },
    'music': { 
      deviceId: 'BEDFORD_MUSIC_DEVICE_ID', 
      name: 'BEDFORD-MUSIC-PC',
      type: 'music'
    },
    'tv': { 
      deviceId: 'BEDFORD_TV_DEVICE_ID', 
      name: 'BEDFORD-TV-PC',
      type: 'tv'
    }
  },
  'Dartmouth': {
    'bay-1': { 
      deviceId: 'DARTMOUTH_BAY1_DEVICE_ID', 
      name: 'DART-BAY1-PC',
      type: 'trackman'
    },
    'bay-2': { 
      deviceId: 'DARTMOUTH_BAY2_DEVICE_ID', 
      name: 'DART-BAY2-PC',
      type: 'trackman'
    },
    'bay-3': { 
      deviceId: 'DARTMOUTH_BAY3_DEVICE_ID', 
      name: 'DART-BAY3-PC',
      type: 'trackman'
    },
    'bay-4': { 
      deviceId: 'DARTMOUTH_BAY4_DEVICE_ID', 
      name: 'DART-BAY4-PC',
      type: 'trackman'
    },
    'music': { 
      deviceId: 'DARTMOUTH_MUSIC_DEVICE_ID', 
      name: 'DART-MUSIC-PC',
      type: 'music'
    },
    'tv': { 
      deviceId: 'DARTMOUTH_TV_DEVICE_ID', 
      name: 'DART-TV-PC',
      type: 'tv'
    }
  },
  'Stratford': {
    'bay-1': { 
      deviceId: 'STRATFORD_BAY1_DEVICE_ID', 
      name: 'STRAT-BAY1-PC',
      type: 'trackman'
    },
    'bay-2': { 
      deviceId: 'STRATFORD_BAY2_DEVICE_ID', 
      name: 'STRAT-BAY2-PC',
      type: 'trackman'
    },
    'bay-3': { 
      deviceId: 'STRATFORD_BAY3_DEVICE_ID', 
      name: 'STRAT-BAY3-PC',
      type: 'trackman'
    },
    'music': { 
      deviceId: 'STRATFORD_MUSIC_DEVICE_ID', 
      name: 'STRAT-MUSIC-PC',
      type: 'music'
    },
    'tv': { 
      deviceId: 'STRATFORD_TV_DEVICE_ID', 
      name: 'STRAT-TV-PC',
      type: 'tv'
    }
  },
  'Bayers Lake': {
    'bay-1': { 
      deviceId: 'BAYERSLAKE_BAY1_DEVICE_ID', 
      name: 'BAYERS-BAY1-PC',
      type: 'trackman'
    },
    'bay-2': { 
      deviceId: 'BAYERSLAKE_BAY2_DEVICE_ID', 
      name: 'BAYERS-BAY2-PC',
      type: 'trackman'
    },
    'bay-3': { 
      deviceId: 'BAYERSLAKE_BAY3_DEVICE_ID', 
      name: 'BAYERS-BAY3-PC',
      type: 'trackman'
    },
    'bay-4': { 
      deviceId: 'BAYERSLAKE_BAY4_DEVICE_ID', 
      name: 'BAYERS-BAY4-PC',
      type: 'trackman'
    },
    'bay-5': { 
      deviceId: 'BAYERSLAKE_BAY5_DEVICE_ID', 
      name: 'BAYERS-BAY5-PC',
      type: 'trackman'
    },
    'music': { 
      deviceId: 'BAYERSLAKE_MUSIC_DEVICE_ID', 
      name: 'BAYERS-MUSIC-PC',
      type: 'music'
    },
    'tv': { 
      deviceId: 'BAYERSLAKE_TV_DEVICE_ID', 
      name: 'BAYERS-TV-PC',
      type: 'tv'
    }
  },
  'Truro': {
    'bay-1': { 
      deviceId: 'TRURO_BAY1_DEVICE_ID', 
      name: 'TRURO-BAY1-PC',
      type: 'trackman'
    },
    'bay-2': { 
      deviceId: 'TRURO_BAY2_DEVICE_ID', 
      name: 'TRURO-BAY2-PC',
      type: 'trackman'
    },
    'bay-3': { 
      deviceId: 'TRURO_BAY3_DEVICE_ID', 
      name: 'TRURO-BAY3-PC',
      type: 'trackman'
    },
    'music': { 
      deviceId: 'TRURO_MUSIC_DEVICE_ID', 
      name: 'TRURO-MUSIC-PC',
      type: 'music'
    },
    'tv': { 
      deviceId: 'TRURO_TV_DEVICE_ID', 
      name: 'TRURO-TV-PC',
      type: 'tv'
    }
  }
};

// Script registry mapping action types to NinjaOne script IDs
export const SCRIPT_REGISTRY: Record<string, string> = {
  'restart-trackman': 'SCRIPT_ID_RESTART_TRACKMAN',
  'reboot-pc': 'SCRIPT_ID_REBOOT_PC', 
  'restart-music': 'SCRIPT_ID_RESTART_MUSIC',
  'restart-tv': 'SCRIPT_ID_RESTART_TV',
  'restart-all-trackman': 'SCRIPT_ID_RESTART_ALL_TRACKMAN',
  'custom-script': 'SCRIPT_ID_CUSTOM'
};

// Action mapping for different device types
export const ACTION_MAP: Record<string, Record<string, string>> = {
  'trackman': {
    'restart': 'restart-trackman',
    'reboot': 'reboot-pc'
  },
  'music': {
    'restart': 'restart-music',
    'reboot': 'reboot-pc'
  },
  'tv': {
    'restart': 'restart-tv',
    'reboot': 'reboot-pc'
  }
};

// Helper function to get all devices of a specific type
export function getDevicesByType(type: 'trackman' | 'music' | 'tv'): Array<{location: string, device: DeviceInfo}> {
  const devices: Array<{location: string, device: DeviceInfo}> = [];
  
  Object.entries(DEVICE_REGISTRY).forEach(([location, locationDevices]) => {
    Object.entries(locationDevices).forEach(([key, device]) => {
      if (device.type === type) {
        devices.push({ location, device });
      }
    });
  });
  
  return devices;
}

// Helper to validate if a location/device combination exists
export function validateDevice(location: string, deviceKey: string): DeviceInfo | null {
  const locationDevices = DEVICE_REGISTRY[location];
  if (!locationDevices) return null;
  
  return locationDevices[deviceKey] || null;
}
