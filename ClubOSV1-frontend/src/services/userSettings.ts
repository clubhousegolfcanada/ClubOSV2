import axios from 'axios';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

export interface UserSettings {
  external_links?: Record<string, string>;
  [key: string]: any;
}

export const userSettingsApi = {
  // Get all settings or specific setting
  async getSettings(key?: string): Promise<any> {
    const token = localStorage.getItem('clubos_token');
    const url = key ? `${API_URL}/user-settings/settings/${key}` : `${API_URL}/user-settings/settings`;
    
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    return response.data.data;
  },

  // Update a specific setting
  async updateSetting(key: string, value: any): Promise<void> {
    const token = localStorage.getItem('clubos_token');
    
    await axios.put(
      `${API_URL}/user-settings/settings/${key}`,
      { value },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },

  // Delete a specific setting
  async deleteSetting(key: string): Promise<void> {
    const token = localStorage.getItem('clubos_token');
    
    await axios.delete(`${API_URL}/user-settings/settings/${key}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  // Convenience methods for external links
  async getExternalLinks(): Promise<Record<string, string> | null> {
    return this.getSettings('external_links');
  },

  async saveExternalLinks(links: Record<string, string>): Promise<void> {
    return this.updateSetting('external_links', links);
  }
};
