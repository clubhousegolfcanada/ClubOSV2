import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clubhouse247golf.clubos',
  appName: 'ClubOS',
  webDir: 'out',
  server: {
    url: 'https://club-osv-2-owqx.vercel.app',
    cleartext: true
  },
  ios: {
    preferredContentMode: 'mobile'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
