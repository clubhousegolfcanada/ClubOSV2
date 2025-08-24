import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Target, Award, Star, Crown, Sparkles, ChevronRight, Filter } from 'lucide-react';
import { AchievementBadge } from '@/components/achievements/AchievementBadge';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Fix for double /api/ issue
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points: number;
  awarded_at: string;
  tournament_id?: string;
  reason?: string;
  // Custom style fields
  color?: string;
  backgroundColor?: string;
  glowColor?: string;
  animationType?: string;
}

interface ProfileAchievementsProps {
  userId: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  tournament: <Trophy className="w-4 h-4" />,
  championship: <Crown className="w-4 h-4" />,
  ctp: <Target className="w-4 h-4" />,
  special: <Star className="w-4 h-4" />,
  custom: <Sparkles className="w-4 h-4" />
};

const categoryNames: Record<string, string> = {
  tournament: 'Tournaments',
  championship: 'Championships',
  ctp: 'Closest to Pin',
  special: 'Special',
  custom: 'Custom'
};

export function ProfileAchievements({ userId }: ProfileAchievementsProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);

  useEffect(() => {
    fetchAchievements();
  }, [userId]);

  const fetchAchievements = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/api/achievements/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAchievements(response.data || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAchievements = achievements.filter(a => 
    selectedCategory === 'all' || a.category === selectedCategory
  );

  // Group achievements by category
  const groupedAchievements = achievements.reduce((acc, achievement) => {
    const category = achievement.category || 'custom';
    if (!acc[category]) acc[category] = [];
    acc[category].push(achievement);
    return acc;
  }, {} as Record<string, Achievement[]>);

  // Calculate stats
  const totalPoints = achievements.reduce((sum, a) => sum + (a.points || 0), 0);
  const legendaryCount = achievements.filter(a => a.rarity === 'legendary').length;
  const epicCount = achievements.filter(a => a.rarity === 'epic').length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3D3A]"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (achievements.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Tournament Achievements
          </h3>
        </div>
        <div className="p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Achievements Yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Participate in tournaments and events to earn special achievements and recognition!
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Compact Achievement Card */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Tournament Achievements
            </h3>
            <div className="flex items-center gap-4 text-white">
              <div className="text-right">
                <div className="text-2xl font-bold">{achievements.length}</div>
                <div className="text-xs opacity-80">Total</div>
              </div>
              {totalPoints > 0 && (
                <div className="text-right border-l border-white/20 pl-4">
                  <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
                  <div className="text-xs opacity-80">Points</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Breakdown - Compact Grid */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(groupedAchievements).map(([category, items]) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category === selectedCategory ? 'all' : category);
                  setShowAllAchievements(true);
                }}
                className={`p-3 rounded-lg border transition-all ${
                  selectedCategory === category
                    ? 'bg-[#0B3D3A] text-white border-[#0B3D3A]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-[#0B3D3A]/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={selectedCategory === category ? 'text-white' : 'text-[#0B3D3A]'}>
                    {categoryIcons[category]}
                  </span>
                  <span className="text-lg font-bold">{items.length}</span>
                </div>
                <div className="text-xs text-left">
                  {categoryNames[category] || category}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Achievements - Horizontal Scroll */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              {selectedCategory === 'all' ? 'Recent Awards' : categoryNames[selectedCategory]}
            </h4>
            {filteredAchievements.length > 6 && (
              <button
                onClick={() => setShowAllAchievements(!showAllAchievements)}
                className="text-xs text-[#0B3D3A] hover:text-[#084a45] flex items-center gap-1"
              >
                {showAllAchievements ? 'Show Less' : `View All (${filteredAchievements.length})`}
                <ChevronRight className={`w-3 h-3 transition-transform ${showAllAchievements ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>

          {/* Achievement Display */}
          <div className={`grid gap-3 ${
            showAllAchievements 
              ? 'grid-cols-3 md:grid-cols-6 lg:grid-cols-8' 
              : 'grid-cols-3 md:grid-cols-6'
          }`}>
            <AnimatePresence mode="popLayout">
              {(showAllAchievements ? filteredAchievements : filteredAchievements.slice(0, 6)).map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ scale: 1.1 }}
                  className="cursor-pointer flex flex-col items-center gap-1"
                  onClick={() => setSelectedAchievement(achievement)}
                >
                  <AchievementBadge
                    icon={achievement.icon}
                    name={achievement.name}
                    description={achievement.description}
                    rarity={achievement.rarity}
                    size="md"
                    color={achievement.color}
                    backgroundColor={achievement.backgroundColor}
                    glowColor={achievement.glowColor}
                    animationType={achievement.animationType}
                    showTooltip={false}
                  />
                  <span className="text-xs text-gray-600 text-center line-clamp-1">
                    {achievement.name}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Legendary & Epic Highlight */}
          {(legendaryCount > 0 || epicCount > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
              {legendaryCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-xs text-gray-600">
                    {legendaryCount} Legendary
                  </span>
                </div>
              )}
              {epicCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-xs text-gray-600">
                    {epicCount} Epic
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Achievement Detail Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedAchievement(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center mb-4">
                <AchievementBadge
                  icon={selectedAchievement.icon}
                  name={selectedAchievement.name}
                  description={selectedAchievement.description}
                  rarity={selectedAchievement.rarity}
                  size="xl"
                  color={selectedAchievement.color}
                  backgroundColor={selectedAchievement.backgroundColor}
                  glowColor={selectedAchievement.glowColor}
                  animationType={selectedAchievement.animationType}
                  showTooltip={false}
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {selectedAchievement.name}
                </h3>
                <p className="text-gray-600 mb-4">
                  {selectedAchievement.description}
                </p>
                {selectedAchievement.reason && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="text-xs text-gray-500 mb-1">Personal Message</div>
                    <div className="text-sm text-gray-700 italic">"{selectedAchievement.reason}"</div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                      selectedAchievement.rarity === 'legendary' ? 'bg-yellow-500' :
                      selectedAchievement.rarity === 'epic' ? 'bg-purple-500' :
                      selectedAchievement.rarity === 'rare' ? 'bg-blue-500' :
                      'bg-gray-500'
                    }`}>
                      {selectedAchievement.rarity}
                    </span>
                  </div>
                  {selectedAchievement.points > 0 && (
                    <>
                      <div>•</div>
                      <div>
                        <span className="font-medium">{selectedAchievement.points} pts</span>
                      </div>
                    </>
                  )}
                  <div>•</div>
                  <div>
                    {new Date(selectedAchievement.awarded_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAchievement(null)}
                className="w-full mt-6 px-4 py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}