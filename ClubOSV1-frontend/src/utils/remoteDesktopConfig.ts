// Remote Desktop Configuration - Supports NinjaOne and Splashtop
import { ninjaoneRemoteAPI } from '@/api/ninjaoneRemote';
import toast from 'react-hot-toast';
import logger from '@/services/logger';

export type RemoteDesktopProvider = 'ninjaone' | 'splashtop' | 'auto';

// Get the configured remote desktop provider
export function getRemoteDesktopProvider(): RemoteDesktopProvider {
  return (process.env.NEXT_PUBLIC_REMOTE_DESKTOP_PROVIDER as RemoteDesktopProvider) || 'auto';
}

// Open remote desktop for a specific bay
export async function openRemoteDesktopForBay(location: string, bayNumber: string) {
  const provider = getRemoteDesktopProvider();
  
  logger.debug(`Opening remote desktop for ${location} Bay ${bayNumber} using provider: ${provider}`);
  
  // Show loading toast
  const toastId = toast.loading(`Connecting to ${location} Bay ${bayNumber}...`);
  
  try {
    // Try NinjaOne first if available
    if (provider === 'ninjaone' || provider === 'auto') {
      try {
        const session = await ninjaoneRemoteAPI.createRemoteSession(location, bayNumber);
        
        if (session.method === 'ninjaone' && session.sessionUrl) {
          // NinjaOne session created successfully
          toast.success('Remote session created!', { id: toastId });
          window.open(session.sessionUrl, '_blank', 'noopener,noreferrer');
          return;
        } else if (session.ninjaConsoleUrl) {
          // Open NinjaOne console as fallback
          toast.success('Opening NinjaOne console...', { id: toastId });
          window.open(session.ninjaConsoleUrl, '_blank', 'noopener,noreferrer');
          return;
        } else if (session.fallbackUrl) {
          // Use fallback URL (likely Splashtop)
          toast.success(`Opening ${session.deviceName || 'remote desktop'}...`, { id: toastId });
          if (session.message) {
            setTimeout(() => {
              toast(session.message!);
            }, 500);
          }
          window.open(session.fallbackUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch (ninjaError) {
        logger.error('NinjaOne error:', ninjaError);
        // Fall through to Splashtop
      }
    }
    
    // Fallback to Splashtop
    if (provider === 'splashtop' || provider === 'auto') {
      toast.dismiss(toastId);
      openSplashtopForBay(location, bayNumber);
      return;
    }
    
    // No provider available
    toast.error('No remote desktop provider configured', { id: toastId });
    
  } catch (error) {
    logger.error('Remote desktop error:', error);
    toast.error('Failed to open remote desktop', { id: toastId });
  }
}

// Legacy Splashtop function (imported from splashtopConfig.ts)
export function openSplashtopForBay(location: string, bayNumber: string) {
  const webPortalUrl = 'https://my.splashtop.com/computers';
  
  // Since we don't have MAC addresses configured yet, just open the web portal
  const computerName = `${location} Bay ${bayNumber} PC`;
  
  logger.debug(`Opening Splashtop web portal for ${computerName}`);
  
  // Show helpful message
  toast.success(`Opening Splashtop portal. Please select "${computerName}"`);
  
  // Open Splashtop web portal
  window.open(webPortalUrl, '_blank', 'noopener,noreferrer');
}

// Check if remote desktop is configured for a bay
export async function isRemoteDesktopConfigured(location: string, bayNumber: string): Promise<boolean> {
  try {
    const deviceInfo = await ninjaoneRemoteAPI.getDeviceInfo(location, bayNumber);
    return deviceInfo.configured;
  } catch (error) {
    logger.error('Error checking device configuration:', error);
    return false;
  }
}