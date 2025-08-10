import React from 'react';
import { ExternalLink, Monitor, Calendar, Users, Shield, CreditCard, Activity, HardDrive } from 'lucide-react';

// External tool links - can be moved to environment variables
const EXTERNAL_TOOLS = {
  REMOTE_DESKTOP: process.env.NEXT_PUBLIC_SPLASHTOP_URL || 'https://my.splashtop.com/computers',
  BOOKING_SITE: process.env.NEXT_PUBLIC_SKEDDA_URL || 'https://clubhouse247golf.skedda.com/booking',
  CUSTOMER_INFO: process.env.NEXT_PUBLIC_HUBSPOT_URL || 'https://app.hubspot.com',
  ACCESS_CAMERAS: process.env.NEXT_PUBLIC_UNIFI_URL || 'https://unifi.ui.com',
  STRIPE_RETURNS: process.env.NEXT_PUBLIC_STRIPE_URL || 'https://dashboard.stripe.com',
  TRACKMAN_PORTAL: process.env.NEXT_PUBLIC_TRACKMAN_URL || 'https://login.trackmangolf.com/Account/Login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Ddr-web.4633fada-3b16-490f-8de7-2aa67158a1d6%26scope%3Dopenid%2520profile%2520email%2520offline_access%2520https%253A%252F%252Fauth.trackman.com%252Fdr%252Fcloud%2520https%253A%252F%252Fauth.trackman.com%252Fauthorization%2520https%253A%252F%252Fauth.trackman.com%252Fproamevent%26response_type%3Dcode%26redirect_uri%3Dhttps%253A%252F%252Fportal.trackmangolf.com%252Faccount%252Fcallback%26nonce%3D08fBNss-AVg9eR2T8pu2JKKfZGk8sWH9vzCqjPrG8z8%26state%3DeyJyZXR1cm5UbyI6Ii8ifQ%26code_challenge_method%3DS256%26code_challenge%3D06sJEm0-gkB1i-I4J_FdgtLpWCeNkX4OWn2CmMmEmcY',
  GOOGLE_DRIVE: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_URL || 'https://drive.google.com'
};

const ExternalTools: React.FC = () => {
  const tools = [
    {
      name: 'Remote Desktop',
      subtitle: 'Splashtop',
      url: EXTERNAL_TOOLS.REMOTE_DESKTOP,
      icon: Monitor,
      color: '#FFFFFF' // White
    },
    {
      name: 'Booking Site',
      subtitle: 'Skedda',
      url: EXTERNAL_TOOLS.BOOKING_SITE,
      icon: Calendar,
      color: '#FFFFFF' // White
    },
    {
      name: 'Customer Info',
      subtitle: 'HubSpot',
      url: EXTERNAL_TOOLS.CUSTOMER_INFO,
      icon: Users,
      color: '#FFFFFF' // White
    },
    {
      name: 'Access & Cameras',
      subtitle: 'UniFi',
      url: EXTERNAL_TOOLS.ACCESS_CAMERAS,
      icon: Shield,
      color: '#FFFFFF' // White
    },
    {
      name: 'Returns',
      subtitle: 'Stripe',
      url: EXTERNAL_TOOLS.STRIPE_RETURNS,
      icon: CreditCard,
      color: '#FFFFFF' // White
    },
    {
      name: 'Simulator Portal',
      subtitle: 'Trackman',
      url: EXTERNAL_TOOLS.TRACKMAN_PORTAL,
      icon: Activity,
      color: '#FF9800' // Orange
    },
    {
      name: 'File Search',
      subtitle: 'Google Drive',
      url: EXTERNAL_TOOLS.GOOGLE_DRIVE,
      icon: HardDrive,
      color: '#FFFFFF' // White
    }
  ];

  const handleToolClick = (url: string, toolName?: string) => {
    // Special handling for Splashtop on all platforms
    if (toolName === 'Remote Desktop') {
      const userAgent = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/.test(userAgent) && !/Mac/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      const isMac = /Mac/.test(userAgent) && !isIOS;
      const isWindows = /Windows/.test(userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    window.matchMedia('(display-mode: minimal-ui)').matches ||
                    window.matchMedia('(display-mode: fullscreen)').matches;
      
      console.log(`Platform detection - iOS: ${isIOS}, Android: ${isAndroid}, Mac: ${isMac}, Windows: ${isWindows}, PWA: ${isPWA}`);
      
      if (isIOS) {
        // iOS: Try multiple URL schemes for Splashtop Business app
        console.log('iOS detected - attempting to open Splashtop Business app...');
        
        // Try different URL schemes
        const schemes = [
          'splashtopbusiness://',  // Splashtop Business specific
          'splashtop://',          // Generic Splashtop
          'stbusiness://'          // Alternative Business scheme
        ];
        
        let schemeIndex = 0;
        const tryNextScheme = () => {
          if (schemeIndex < schemes.length) {
            const scheme = schemes[schemeIndex];
            console.log(`Trying iOS scheme: ${scheme}`);
            
            // Create invisible iframe to attempt app launch
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = scheme;
            document.body.appendChild(iframe);
            
            setTimeout(() => {
              document.body.removeChild(iframe);
              schemeIndex++;
              
              // Check if page is still visible (app didn't open)
              if (!document.hidden && schemeIndex < schemes.length) {
                tryNextScheme();
              } else if (!document.hidden && schemeIndex >= schemes.length) {
                // All schemes failed, fallback to web
                console.log('No iOS app found, opening web portal...');
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }, 500);
          }
        };
        
        tryNextScheme();
        
      } else if (isAndroid) {
        // Android: Use intent for Splashtop Business app
        console.log('Android detected - attempting to open Splashtop Business app...');
        
        // Try Splashtop Business package first
        const businessIntent = `intent://open#Intent;scheme=splashtopbusiness;package=com.splashtop.remote.business;S.browser_fallback_url=${encodeURIComponent(url)};end`;
        window.location.href = businessIntent;
        
      } else if (isMac || isWindows) {
        // Desktop: Try to open desktop app first, then fallback to web
        console.log(`Desktop ${isMac ? 'Mac' : 'Windows'} detected - attempting to open Splashtop Business desktop app...`);
        
        // Try desktop URL schemes
        const desktopScheme = 'splashtopbusiness://';
        
        // Create invisible iframe to attempt desktop app launch
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = desktopScheme;
        document.body.appendChild(iframe);
        
        // Set up fallback to web portal
        setTimeout(() => {
          document.body.removeChild(iframe);
          // Always open web portal as backup on desktop
          console.log('Opening web portal as fallback/primary option...');
          window.open(url, '_blank', 'noopener,noreferrer');
        }, 1000);
        
      } else {
        // Unknown platform: Open web portal
        console.log('Unknown platform - opening web portal...');
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      // For all other tools, use standard web opening
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">External Tools</h3>
      <div className="grid grid-cols-1 gap-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.name}
              onClick={() => handleToolClick(tool.url, tool.name)}
              className="w-full p-4 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 w-full">
                <div 
                  className="p-2 rounded-lg bg-[var(--bg-tertiary)]"
                  style={{ color: tool.color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm text-[var(--text-primary)]">{
                    tool.name
                  }</p>
                  <p className="text-xs text-[var(--text-secondary)]">{
                    tool.subtitle
                  }</p>
                </div>
                <ExternalLink className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExternalTools;
