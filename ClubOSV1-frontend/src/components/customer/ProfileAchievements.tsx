import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Target, Award, Star, Crown, Sparkles, ChevronRight } from 'lucide-react';
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

const categoryColors: Record<string, string> = {
  tournament: 'text-yellow-600 bg-yellow-50',
  championship: 'text-purple-600 bg-purple-50',
  ctp: 'text-blue-600 bg-blue-50',
  special: 'text-pink-600 bg-pink-50',
  custom: 'text-gray-600 bg-gray-50'
};

export function ProfileAchievements({ userId }: ProfileAchievementsProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

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
  const categoryStats = Object.entries(groupedAchievements).map(([category, items]) => ({
    category,
    count: items.length,
    icon: categoryIcons[category] || categoryIcons.custom,
    color: categoryColors[category] || categoryColors.custom
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3D3A]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Tournament Achievements
            </h3>
            <p className="text-white/80 mt-1">
              Your collection of awards and special recognitions
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{achievements.length}</div>
            <div className="text-sm text-white/80">Total Awards</div>
          </div>
        </div>

        {/* Category Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {categoryStats.map((stat) => (
            <div key={stat.category} className="bg-white/10 backdrop-blur rounded-lg p-3">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${stat.color}`}>
                {stat.icon}
                <span className="capitalize">{stat.category}</span>
              </div>
              <div className="text-2xl font-bold mt-2">{stat.count}</div>
            </div>
          ))}
        </div>
      </div>

      {achievements.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Achievements Yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Participate in tournaments and events to earn special achievements and recognition!
          </p>
        </div>
      ) : (
        <>
          {/* Featured Achievements */}
          {achievements.filter(a => a.rarity === 'legendary' || a.rarity === 'epic').length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Featured Achievements
              </h4>
              <div className="flex flex-wrap gap-4">
                {achievements
                  .filter(a => a.rarity === 'legendary' || a.rarity === 'epic')
                  .slice(0, 3)
                  .map((achievement) => (
                    <motion.div
                      key={achievement.id}
                      whileHover={{ scale: 1.05 }}
                      className="cursor-pointer"
                      onClick={() => setSelectedAchievement(achievement)}
                    >
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                        <AchievementBadge
                          icon={achievement.icon}
                          name={achievement.name}
                          description={achievement.description}
                          rarity={achievement.rarity}
                          size="lg"
                          color={achievement.color}
                          backgroundColor={achievement.backgroundColor}
                          glowColor={achievement.glowColor}
                          animationType={achievement.animationType}
                        />
                        <div>
                          <div className="font-semibold text-gray-900">{achievement.name}</div>
                          <div className="text-xs text-gray-500">{achievement.description}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(achievement.awarded_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}

          {/* All Achievements Grid */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">All Achievements</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-[#0B3D3A] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {Object.keys(groupedAchievements).map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                      selectedCategory === category
                        ? 'bg-[#0B3D3A] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredAchievements.map((achievement, index) => (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.1 }}
                    className="cursor-pointer"
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
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </>
      )}

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
                    <div className="text-xs text-gray-500 mb-1">Award Reason</div>
                    <div className="text-sm text-gray-700">{selectedAchievement.reason}</div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <div>
                    <span className="font-medium capitalize">{selectedAchievement.rarity}</span>
                  </div>
                  <div>•</div>
                  <div>
                    <span className="font-medium">{selectedAchievement.points} points</span>
                  </div>
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
    </div>
  );
}