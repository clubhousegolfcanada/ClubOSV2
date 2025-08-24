import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Target, Crown, Award, X, Sparkles, Palette, Save } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AchievementBadge } from './AchievementBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CustomAchievementCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userToken: string;
  onSuccess?: () => void;
}

const presetColors = [
  { name: 'Gold', bg: '#FEF3C7', color: '#F59E0B', glow: 'rgba(245,158,11,0.5)' },
  { name: 'Purple', bg: '#EDE9FE', color: '#8B5CF6', glow: 'rgba(139,92,246,0.5)' },
  { name: 'Blue', bg: '#DBEAFE', color: '#3B82F6', glow: 'rgba(59,130,246,0.5)' },
  { name: 'Green', bg: '#D1FAE5', color: '#059669', glow: 'rgba(5,150,105,0.5)' },
  { name: 'Red', bg: '#FEE2E2', color: '#DC2626', glow: 'rgba(220,38,38,0.5)' },
  { name: 'Pink', bg: '#FCE7F3', color: '#EC4899', glow: 'rgba(236,72,153,0.5)' },
  { name: 'Amber', bg: '#FEF3C7', color: '#D97706', glow: 'rgba(217,119,6,0.5)' },
  { name: 'Teal', bg: '#CCFBF1', color: '#0D9488', glow: 'rgba(13,148,136,0.5)' },
  { name: 'Indigo', bg: '#E0E7FF', color: '#6366F1', glow: 'rgba(99,102,241,0.5)' },
  { name: 'Rose', bg: '#FFE4E6', color: '#F43F5E', glow: 'rgba(244,63,94,0.5)' }
];

const iconOptions = [
  '🏆', '⭐', '🎯', '👑', '🥇', '🥈', '🥉', '💎', '🔥', '⚡',
  '🎖️', '🏅', '🌟', '✨', '💫', '🌠', '🎪', '🎨', '🎭', '🎬',
  '⛳', '🏌️', '🏌️‍♂️', '🏌️‍♀️', '🔴', '🟢', '🔵', '🟡', '🟣', '🟠',
  '📌', '🎯', '🎪', '🎨', '🎭', '🎬', '🎮', '🎲', '🎰', '🃏'
];

const animationTypes = [
  { value: 'none', label: 'None' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'spin', label: 'Spin' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'shake', label: 'Shake' },
  { value: 'float', label: 'Float' },
  { value: 'glow', label: 'Glow' },
  { value: 'sparkle', label: 'Sparkle' }
];

export function CustomAchievementCreator({
  isOpen,
  onClose,
  userId,
  userName,
  userToken,
  onSuccess
}: CustomAchievementCreatorProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('special');
  const [rarity, setRarity] = useState('epic');
  const [points, setPoints] = useState(100);
  const [icon, setIcon] = useState('🏆');
  const [color, setColor] = useState('#F59E0B');
  const [backgroundColor, setBackgroundColor] = useState('#FEF3C7');
  const [glowColor, setGlowColor] = useState('rgba(245,158,11,0.5)');
  const [animationType, setAnimationType] = useState('pulse');
  const [message, setMessage] = useState('');

  const handleColorPreset = (preset: typeof presetColors[0]) => {
    setColor(preset.color);
    setBackgroundColor(preset.bg);
    setGlowColor(preset.glow);
  };

  const handleCreate = async () => {
    if (!name || !icon) {
      toast.error('Please provide a name and icon for the achievement');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/achievements/create-custom`,
        {
          user_id: userId,
          name,
          description,
          category,
          rarity,
          points,
          icon,
          color,
          backgroundColor,
          glowColor,
          animationType,
          message
        },
        {
          headers: { Authorization: `Bearer ${userToken}` }
        }
      );

      if (response.data.success) {
        toast.success(`Achievement awarded to ${userName}!`);
        onSuccess?.();
        onClose();
        // Reset form
        setName('');
        setDescription('');
        setMessage('');
        setPoints(100);
        setActiveTab('basic');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create achievement');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Create Custom Achievement</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Award a unique achievement to <span className="font-semibold">{userName}</span>
            </p>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
              {['basic', 'appearance', 'effects'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-[#0B3D3A] border-b-2 border-[#0B3D3A]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'basic' && <Trophy className="w-4 h-4 inline mr-2" />}
                  {tab === 'appearance' && <Palette className="w-4 h-4 inline mr-2" />}
                  {tab === 'effects' && <Sparkles className="w-4 h-4 inline mr-2" />}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Fields */}
              <div>
                {activeTab === 'basic' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Achievement Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Tournament Champion 2024"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what this achievement represents..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Personal Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Add a personal congratulations message..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                        >
                          <option value="tournament">Tournament</option>
                          <option value="championship">Championship</option>
                          <option value="ctp">Closest to Pin</option>
                          <option value="special">Special</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rarity
                        </label>
                        <select
                          value={rarity}
                          onChange={(e) => setRarity(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                        >
                          <option value="common">Common</option>
                          <option value="rare">Rare</option>
                          <option value="epic">Epic</option>
                          <option value="legendary">Legendary</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Points: {points}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1000"
                        step="50"
                        value={points}
                        onChange={(e) => setPoints(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Icon
                      </label>
                      <div className="grid grid-cols-10 gap-2">
                        {iconOptions.map((iconOption) => (
                          <button
                            key={iconOption}
                            onClick={() => setIcon(iconOption)}
                            className={`p-2 text-xl rounded-lg transition-all ${
                              icon === iconOption
                                ? 'bg-[#0B3D3A] scale-110'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {iconOption}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Color Preset
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {presetColors.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => handleColorPreset(preset)}
                            className="p-2 rounded-lg border-2 hover:scale-105 transition-transform"
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Colors
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-12 h-12 rounded border border-gray-300"
                          />
                          <span className="text-sm text-gray-600">Icon Color</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={backgroundColor}
                            onChange={(e) => setBackgroundColor(e.target.value)}
                            className="w-12 h-12 rounded border border-gray-300"
                          />
                          <span className="text-sm text-gray-600">Background</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'effects' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Animation
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {animationTypes.map((anim) => (
                          <button
                            key={anim.value}
                            onClick={() => setAnimationType(anim.value)}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              animationType === anim.value
                                ? 'bg-[#0B3D3A] text-white border-[#0B3D3A]'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {anim.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Glow Effect
                      </label>
                      <input
                        type="text"
                        value={glowColor}
                        onChange={(e) => setGlowColor(e.target.value)}
                        placeholder="e.g., rgba(245,158,11,0.5)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use RGBA format for transparency
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Live Preview</h3>
                
                <div className="flex flex-col items-center justify-center min-h-[300px] space-y-6">
                  <AchievementBadge
                    icon={icon}
                    name={name || 'Achievement Name'}
                    description={description}
                    rarity={rarity}
                    size="xl"
                    animate={true}
                    color={color}
                    backgroundColor={backgroundColor}
                    glowColor={glowColor}
                    animationType={animationType}
                  />

                  <div className="text-center space-y-2">
                    <h4 className="font-semibold text-gray-900">{name || 'Achievement Name'}</h4>
                    {description && (
                      <p className="text-sm text-gray-600">{description}</p>
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        rarity === 'common' ? 'bg-gray-500' :
                        rarity === 'rare' ? 'bg-blue-500' :
                        rarity === 'epic' ? 'bg-purple-500' :
                        'bg-yellow-500'
                      } text-white`}>
                        {rarity}
                      </span>
                      <span className="text-xs text-gray-500">
                        {points} points
                      </span>
                    </div>
                  </div>

                  {message && (
                    <div className="bg-white rounded-lg p-3 border border-gray-200 max-w-xs">
                      <p className="text-sm text-gray-700 italic">"{message}"</p>
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
                disabled={loading || !name || !icon}
                className="px-4 py-2 bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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