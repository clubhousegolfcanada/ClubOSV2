import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Medal, Award, Crown, Shield, Star,
  Target, Zap, Flame, Diamond, Gem, X, 
  Save, Palette, Sparkles
} from 'lucide-react';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { AchievementBadge } from './AchievementBadge';

// API URL is now handled by http client

interface CustomAchievementCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userToken: string;
  onSuccess?: () => void;
}

// Professional color schemes for real achievements
const presetColors = [
  { name: 'Gold', bg: '#FEF3C7', color: '#F59E0B', glow: 'rgba(245,158,11,0.5)' },
  { name: 'Silver', bg: '#F3F4F6', color: '#6B7280', glow: 'rgba(107,114,128,0.5)' },
  { name: 'Bronze', bg: '#FED7AA', color: '#C2410C', glow: 'rgba(194,65,12,0.5)' },
  { name: 'Platinum', bg: '#E5E7EB', color: '#374151', glow: 'rgba(55,65,81,0.5)' },
  { name: 'Diamond', bg: '#DBEAFE', color: '#3B82F6', glow: 'rgba(59,130,246,0.5)' },
  { name: 'Emerald', bg: '#D1FAE5', color: '#059669', glow: 'rgba(5,150,105,0.5)' },
  { name: 'Ruby', bg: '#FEE2E2', color: '#DC2626', glow: 'rgba(220,38,38,0.5)' },
  { name: 'Obsidian', bg: '#1F2937', color: '#F9FAFB', glow: 'rgba(31,41,55,0.8)' },
  { name: 'Champion', bg: '#8B5CF6', color: '#FFFFFF', glow: 'rgba(139,92,246,0.7)' },
  { name: 'Master', bg: 'var(--accent)', color: '#FFFFFF', glow: 'rgba(11,61,58,0.7)' }
];

// Professional icon options - actual trophy/medal icons
const iconTypes = [
  { value: 'trophy', label: 'Trophy', Icon: Trophy },
  { value: 'medal', label: 'Medal', Icon: Medal },
  { value: 'award', label: 'Award', Icon: Award },
  { value: 'crown', label: 'Crown', Icon: Crown },
  { value: 'shield', label: 'Shield', Icon: Shield },
  { value: 'star', label: 'Star', Icon: Star },
  { value: 'target', label: 'Target', Icon: Target },
  { value: 'zap', label: 'Lightning', Icon: Zap },
  { value: 'flame', label: 'Flame', Icon: Flame },
  { value: 'diamond', label: 'Diamond', Icon: Diamond },
  { value: 'gem', label: 'Gem', Icon: Gem }
];

// Achievement categories - real competitive categories
const achievementCategories = [
  { value: 'tournament_champion', label: 'Tournament Champion' },
  { value: 'tournament_finalist', label: 'Tournament Finalist' },
  { value: 'tournament_semifinalist', label: 'Tournament Semi-Finalist' },
  { value: 'championship_winner', label: 'Championship Winner' },
  { value: 'ctp_winner', label: 'Closest to Pin Winner' },
  { value: 'longest_drive', label: 'Longest Drive' },
  { value: 'best_score', label: 'Best Score' },
  { value: 'season_champion', label: 'Season Champion' },
  { value: 'special_recognition', label: 'Special Recognition' },
  { value: 'founding_member', label: 'Founding Member' },
  { value: 'vip_member', label: 'VIP Member' },
  { value: 'custom', label: 'Custom Achievement' }
];

export function CustomAchievementCreator({
  isOpen,
  onClose,
  userId,
  userName,
  userToken,
  onSuccess
}: CustomAchievementCreatorProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);

  // Form state - focused on real achievement details
  const [achievementName, setAchievementName] = useState('');
  const [achievementTitle, setAchievementTitle] = useState(''); // e.g., "2024 Spring Tournament"
  const [category, setCategory] = useState('tournament_champion');
  const [placement, setPlacement] = useState(''); // e.g., "1st Place", "Runner Up"
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  
  // Visual customization
  const [selectedIcon, setSelectedIcon] = useState('trophy');
  const [selectedColor, setSelectedColor] = useState(presetColors[0]);
  const [rarity, setRarity] = useState('legendary');

  const handleCreate = async () => {
    if (!achievementName || !achievementTitle) {
      toast.error('Please provide the achievement name and title');
      return;
    }

    setLoading(true);
    try {
      // Create the full achievement name with placement if provided
      const fullName = placement 
        ? `${placement} - ${achievementTitle}`
        : achievementTitle;

      const response = await http.post(
        `achievements/create-custom`,
        {
          user_id: userId,
          name: fullName,
          description: description || `Awarded for ${achievementName}`,
          category: category.split('_')[0], // Extract base category
          rarity,
          points: rarity === 'legendary' ? 1000 : rarity === 'epic' ? 500 : 250,
          icon: selectedIcon, // We'll store the icon type, not emoji
          color: selectedColor.color,
          backgroundColor: selectedColor.bg,
          glowColor: selectedColor.glow,
          animationType: 'none', // Professional - no silly animations
          message: personalMessage,
          metadata: {
            achievementName,
            achievementTitle,
            placement,
            date,
            awardedBy: 'Operator'
          }
        },
        {

        }
      );

      if (response.data.success) {
        toast.success(`Achievement "${fullName}" awarded to ${userName}`);
        onSuccess?.();
        onClose();
        // Reset form
        setAchievementName('');
        setAchievementTitle('');
        setPlacement('');
        setDescription('');
        setPersonalMessage('');
        setActiveTab('details');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create achievement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const SelectedIconComponent = iconTypes.find(i => i.value === selectedIcon)?.Icon || Trophy;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Award Achievement</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Recognize {userName}'s accomplishment
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'details'
                    ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Achievement Details
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'appearance'
                    ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Palette className="w-4 h-4 inline mr-2" />
                Appearance
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Fields */}
              <div>
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    {/* Achievement Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Achievement Type *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        {achievementCategories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Achievement Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Achievement Name *
                      </label>
                      <input
                        type="text"
                        value={achievementName}
                        onChange={(e) => setAchievementName(e.target.value)}
                        placeholder="e.g., Spring Championship, Monthly Tournament"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>

                    {/* Title/Event */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event/Competition Title *
                      </label>
                      <input
                        type="text"
                        value={achievementTitle}
                        onChange={(e) => setAchievementTitle(e.target.value)}
                        placeholder="e.g., 2024 Spring Championship"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>

                    {/* Placement */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placement/Result
                      </label>
                      <input
                        type="text"
                        value={placement}
                        onChange={(e) => setPlacement(e.target.value)}
                        placeholder="e.g., 1st Place, Champion, Winner"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date Achieved
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Achievement Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Details about this achievement..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>

                    {/* Personal Message */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Personal Congratulations
                      </label>
                      <textarea
                        value={personalMessage}
                        onChange={(e) => setPersonalMessage(e.target.value)}
                        placeholder="Congratulations message to the winner..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>

                    {/* Rarity/Significance */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Significance
                      </label>
                      <select
                        value={rarity}
                        onChange={(e) => setRarity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      >
                        <option value="legendary">Legendary (Major Championship)</option>
                        <option value="epic">Epic (Tournament Win)</option>
                        <option value="rare">Rare (Special Achievement)</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className="space-y-4">
                    {/* Icon Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trophy Style
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {iconTypes.map((iconType) => (
                          <button
                            key={iconType.value}
                            onClick={() => setSelectedIcon(iconType.value)}
                            className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                              selectedIcon === iconType.value
                                ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <iconType.Icon className={`w-6 h-6 ${
                              selectedIcon === iconType.value ? 'text-[var(--accent)]' : 'text-gray-600'
                            }`} />
                            <span className="text-xs">{iconType.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Achievement Color
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {presetColors.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => setSelectedColor(preset)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              selectedColor.name === preset.name
                                ? 'ring-2 ring-[var(--accent)] ring-offset-2'
                                : ''
                            }`}
                            style={{
                              backgroundColor: preset.bg,
                              borderColor: preset.color,
                              color: preset.color
                            }}
                          >
                            <span className="text-xs font-medium">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Preview</h3>
                
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
                  {/* Achievement Badge Preview */}
                  <div 
                    className="relative w-32 h-32 rounded-full flex items-center justify-center shadow-lg"
                    style={{
                      backgroundColor: selectedColor.bg,
                      boxShadow: `0 0 30px ${selectedColor.glow}`
                    }}
                  >
                    <SelectedIconComponent 
                      className="w-16 h-16"
                      style={{ color: selectedColor.color }}
                    />
                  </div>

                  {/* Achievement Text */}
                  <div className="text-center space-y-2">
                    <h4 className="text-xl font-bold text-gray-900">
                      {placement && `${placement} - `}
                      {achievementTitle || 'Achievement Title'}
                    </h4>
                    {achievementName && (
                      <p className="text-sm text-gray-600">{achievementName}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                        rarity === 'legendary' ? 'bg-yellow-500' :
                        rarity === 'epic' ? 'bg-purple-500' :
                        'bg-blue-500'
                      }`}>
                        {rarity === 'legendary' ? 'Legendary' :
                         rarity === 'epic' ? 'Epic' : 'Rare'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {date}
                      </span>
                    </div>
                  </div>

                  {/* Personal Message Preview */}
                  {personalMessage && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200 max-w-sm">
                      <p className="text-sm text-gray-700 italic">"{personalMessage}"</p>
                      <p className="text-xs text-gray-500 mt-2 text-right">- Clubhouse Golf</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !achievementName || !achievementTitle}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Award Achievement
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CustomAchievementCreator;