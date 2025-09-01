import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star, Target, Crown, Gift, Users, Search, Filter } from 'lucide-react';
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
  is_active: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface AchievementStats {
  stats: {
    total_users_with_achievements: number;
    total_awards: number;
    most_awarded_achievement: string;
    most_awarded_icon: string;
    award_count: number;
  };
  recentAwards: Array<{
    awarded_at: string;
    user_name: string;
    achievement_name: string;
    achievement_icon: string;
    rarity: string;
  }>;
}

const rarityColors: Record<string, string> = {
  common: 'bg-gray-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-yellow-500'
};

const categoryIcons: Record<string, React.ReactNode> = {
  tournament: <Trophy className="w-5 h-5" />,
  seasonal: <Medal className="w-5 h-5" />,
  special: <Award className="w-5 h-5" />,
  milestone: <Target className="w-5 h-5" />,
  challenge: <Star className="w-5 h-5" />
};

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [awardReason, setAwardReason] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [bulkAwardMode, setBulkAwardMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    fetchAchievements();
    fetchStats();
  }, []);

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

  const fetchStats = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/achievements/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query) {
      setUserSearchResults([]);
      return;
    }

    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/admin/users/search?q=${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setUserSearchResults(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const awardAchievement = async () => {
    if (!selectedAchievement || (!selectedUser && selectedUsers.length === 0)) {
      toast.error('Please select an achievement and user(s)');
      return;
    }

    try {
      const token = await getAccessToken();
      
      if (bulkAwardMode && selectedUsers.length > 0) {
        // Bulk award
        const awards = selectedUsers.map(user => ({
          userId: user.id,
          achievementId: selectedAchievement.id,
          reason: awardReason,
          tournamentId: tournamentId || undefined
        }));

        const response = await fetch(`${API_BASE_URL}/achievements/bulk-award`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ awards })
        });

        if (response.ok) {
          toast.success(`Achievement awarded to ${selectedUsers.length} users!`);
          setSelectedUsers([]);
          setBulkAwardMode(false);
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to award achievements');
        }
      } else if (selectedUser) {
        // Single award
        const response = await fetch(`${API_BASE_URL}/achievements/award`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            achievementId: selectedAchievement.id,
            reason: awardReason,
            tournamentId: tournamentId || undefined
          })
        });

        if (response.ok) {
          toast.success(`${selectedAchievement.name} awarded to ${selectedUser.name}!`);
          setSelectedUser(null);
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to award achievement');
        }
      }

      // Reset form
      setAwardReason('');
      setTournamentId('');
      setSelectedAchievement(null);
      fetchStats(); // Refresh stats
    } catch (error) {
      console.error('Error awarding achievement:', error);
      toast.error('Failed to award achievement');
    }
  };

  const filteredAchievements = achievements.filter(a => 
    selectedCategory === 'all' || a.category === selectedCategory
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Achievement Management</h1>
        <p className="text-gray-600">Award and manage user achievements</p>
      </div>

      <Tabs defaultValue="award" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="award">Award Achievement</TabsTrigger>
          <TabsTrigger value="tournament">Tournament Mode</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="award" className="space-y-6">
          {/* User Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select User(s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={!bulkAwardMode ? 'default' : 'outline'}
                  onClick={() => setBulkAwardMode(false)}
                >
                  Single User
                </Button>
                <Button
                  variant={bulkAwardMode ? 'default' : 'outline'}
                  onClick={() => setBulkAwardMode(true)}
                >
                  Multiple Users
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search users by name or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>

              {userSearchResults.length > 0 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {userSearchResults.map(user => (
                    <div
                      key={user.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => {
                        if (bulkAwardMode) {
                          if (!selectedUsers.find(u => u.id === user.id)) {
                            setSelectedUsers([...selectedUsers, user]);
                          }
                        } else {
                          setSelectedUser(user);
                        }
                        setUserSearch('');
                        setUserSearchResults([]);
                      }}
                    >
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <Button size="sm" variant="ghost">Select</Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Users Display */}
              {!bulkAwardMode && selectedUser && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="font-medium">{selectedUser.name}</div>
                  <div className="text-sm text-gray-600">{selectedUser.email}</div>
                </div>
              )}

              {bulkAwardMode && selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Selected Users ({selectedUsers.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(user => (
                      <Badge
                        key={user.id}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))}
                      >
                        {user.name} ×
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievement Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Achievement</CardTitle>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </Button>
                {['tournament', 'seasonal', 'special', 'milestone', 'challenge'].map(cat => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {categoryIcons[cat]}
                    <span className="ml-1 capitalize">{cat}</span>
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredAchievements.map(achievement => (
                  <motion.div
                    key={achievement.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all ${
                        selectedAchievement?.id === achievement.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:shadow-lg'
                      }`}
                      onClick={() => setSelectedAchievement(achievement)}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-3xl mb-2">{achievement.icon}</div>
                        <div className="font-medium text-sm">{achievement.name}</div>
                        <Badge className={`mt-2 ${rarityColors[achievement.rarity]}`}>
                          {achievement.rarity}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          {achievement.points} points
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Award Details */}
          {selectedAchievement && (
            <Card>
              <CardHeader>
                <CardTitle>Award Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    value={awardReason}
                    onChange={(e) => setAwardReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  onClick={awardAchievement}
                  disabled={!selectedAchievement || (!selectedUser && selectedUsers.length === 0)}
                  className="w-full"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Award Achievement
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tournament" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Tournament Awards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tournament Name</label>
                <Input placeholder="e.g., Summer Championship 2024" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">🥇 1st Place</label>
                  <Input placeholder="Search user..." />
                </div>
                <div>
                  <label className="text-sm font-medium">🥈 2nd Place</label>
                  <Input placeholder="Search user..." />
                </div>
                <div>
                  <label className="text-sm font-medium">🥉 3rd Place</label>
                  <Input placeholder="Search user..." />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Special Awards</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">⛳ Hole-in-One</Badge>
                  <Badge variant="outline">💪 Longest Drive</Badge>
                  <Badge variant="outline">🎯 Closest to Pin</Badge>
                  <Badge variant="outline">🦅 Eagle Club</Badge>
                </div>
              </div>
              <Button className="w-full">
                <Trophy className="w-4 h-4 mr-2" />
                Award All Tournament Achievements
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">{stats.stats.total_users_with_achievements}</div>
                    <div className="text-sm text-gray-500">Users with Achievements</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-2xl font-bold">{stats.stats.total_awards}</div>
                    <div className="text-sm text-gray-500">Total Awards</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{stats.stats.most_awarded_icon}</span>
                      <div>
                        <div className="font-medium">{stats.stats.most_awarded_achievement}</div>
                        <div className="text-sm text-gray-500">Most Awarded</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Awards</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.recentAwards.map((award, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{award.achievement_icon}</span>
                          <div>
                            <div className="font-medium">{award.user_name}</div>
                            <div className="text-sm text-gray-500">{award.achievement_name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={rarityColors[award.rarity]}>{award.rarity}</Badge>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(award.awarded_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}