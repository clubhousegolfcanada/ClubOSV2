import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Medal, Award, Star, Target, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/utils/api';
import { useAuth } from '@/utils/auth';

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  rarity: string;
  points: number;
}

interface AchievementSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onAward?: () => void;
}

const rarityColors: Record<string, string> = {
  common: 'bg-gray-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-yellow-500'
};

const categoryIcons: Record<string, React.ReactNode> = {
  tournament: <Trophy className="w-4 h-4" />,
  seasonal: <Medal className="w-4 h-4" />,
  special: <Award className="w-4 h-4" />,
  milestone: <Target className="w-4 h-4" />,
  challenge: <Star className="w-4 h-4" />
};

export function AchievementSelector({ isOpen, onClose, userId, userName, onAward }: AchievementSelectorProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reason, setReason] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [loading, setLoading] = useState(false);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchAchievements();
    }
  }, [isOpen]);

  const fetchAchievements = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/achievements`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setAchievements(data);
    } catch (error) {
      console.error('Error fetching achievements:', error);
      toast.error('Failed to load achievements');
    }
  };

  const handleAward = async () => {
    if (!selectedAchievement) {
      toast.error('Please select an achievement');
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/achievements/award`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          achievementId: selectedAchievement.id,
          reason,
          tournamentId: tournamentId || undefined
        })
      });

      if (response.ok) {
        toast.success(`${selectedAchievement.name} awarded to ${userName}!`);
        onAward?.();
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to award achievement');
      }
    } catch (error) {
      console.error('Error awarding achievement:', error);
      toast.error('Failed to award achievement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAchievement(null);
    setReason('');
    setTournamentId('');
    setSelectedCategory('all');
    onClose();
  };

  const filteredAchievements = achievements.filter(a => 
    selectedCategory === 'all' || a.category === selectedCategory
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Award Achievement to {userName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="tournament">
                {categoryIcons.tournament}
                <span className="ml-1">Tournament</span>
              </TabsTrigger>
              <TabsTrigger value="seasonal">
                {categoryIcons.seasonal}
                <span className="ml-1">Seasonal</span>
              </TabsTrigger>
              <TabsTrigger value="special">
                {categoryIcons.special}
                <span className="ml-1">Special</span>
              </TabsTrigger>
              <TabsTrigger value="milestone">
                {categoryIcons.milestone}
                <span className="ml-1">Milestone</span>
              </TabsTrigger>
              <TabsTrigger value="challenge">
                {categoryIcons.challenge}
                <span className="ml-1">Challenge</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                <AnimatePresence>
                  {filteredAchievements.map(achievement => (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div
                        className={`
                          p-3 rounded-lg border cursor-pointer transition-all
                          ${selectedAchievement?.id === achievement.id
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }
                        `}
                        onClick={() => setSelectedAchievement(achievement)}
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">{achievement.icon}</div>
                          <div className="text-xs font-medium">{achievement.name}</div>
                          <Badge className={`mt-1 text-xs ${rarityColors[achievement.rarity]}`}>
                            {achievement.rarity}
                          </Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            {achievement.points} pts
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </TabsContent>
          </Tabs>

          {selectedAchievement && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-gray-50 rounded-lg space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{selectedAchievement.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedAchievement.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedAchievement.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className={rarityColors[selectedAchievement.rarity]}>
                      {selectedAchievement.rarity}
                    </Badge>
                    <Badge variant="outline">{selectedAchievement.points} points</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Tournament ID (Optional)</label>
                  <Input
                    placeholder="e.g., summer_2024"
                    value={tournamentId}
                    onChange={(e) => setTournamentId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason / Notes (Optional)</label>
                  <Textarea
                    placeholder="Why is this achievement being awarded?"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAward}
            disabled={!selectedAchievement || loading}
          >
            <Gift className="w-4 h-4 mr-2" />
            Award Achievement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}