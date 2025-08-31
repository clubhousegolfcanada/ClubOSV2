import axios from 'axios';
import { API_URL } from '@/utils/apiUrl';


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
