import { http } from '@/api/http';


export interface UserSettings {
  external_links?: Record<string, string>;
  [key: string]: any;
}

export const userSettingsApi = {
  // Get all settings or specific setting
  async getSettings(key?: string): Promise<any> {
    const url = key ? `user-settings/settings/${key}` : `user-settings/settings`;
    
    const response = await http.get(url);
    
    return response.data.data;
  },

  // Update a specific setting
  async updateSetting(key: string, value: any): Promise<void> {
    await http.put(
      `user-settings/settings/${key}`,
      { value }
    );
  },

  // Delete a specific setting
  async deleteSetting(key: string): Promise<void> {
    await http.delete(`user-settings/settings/${key}`);
  },

  // Convenience methods for external links
  async getExternalLinks(): Promise<Record<string, string> | null> {
    return this.getSettings('external_links');
  },

  async saveExternalLinks(links: Record<string, string>): Promise<void> {
    return this.updateSetting('external_links', links);
  }
};
