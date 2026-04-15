// Remote Desktop Configuration — Splashtop
// (Previously supported NinjaOne; we now use Splashtop exclusively for remote-desktop sessions,
// and our own TrackMan agent .exe for software restart/reboot commands.)
import toast from 'react-hot-toast';
import logger from '@/services/logger';

export type RemoteDesktopProvider = 'splashtop';

// Open remote desktop for a specific bay via Splashtop.
export async function openRemoteDesktopForBay(location: string, bayNumber: string) {
  logger.debug(`Opening remote desktop for ${location} Bay ${bayNumber} via Splashtop`);
  openSplashtopForBay(location, bayNumber);
}

// Open Splashtop web portal with a helper toast naming the target computer.
export function openSplashtopForBay(location: string, bayNumber: string) {
  const webPortalUrl = 'https://my.splashtop.com/computers';
  const computerName = `${location} Bay ${bayNumber} PC`;

  logger.debug(`Opening Splashtop web portal for ${computerName}`);
  toast.success(`Opening Splashtop portal. Please select "${computerName}"`);
  window.open(webPortalUrl, '_blank', 'noopener,noreferrer');
}

// Remote desktop is considered configured as long as Splashtop is available.
// (Previously checked NinjaOne device registry.)
export async function isRemoteDesktopConfigured(_location: string, _bayNumber: string): Promise<boolean> {
  return true;
}
