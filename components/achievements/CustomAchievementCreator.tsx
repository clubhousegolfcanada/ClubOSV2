import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Palette, Sparkles, Type, Trophy, Star, Medal, Crown, Target, Zap, Heart, Flag, Shield, Gem, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/utils/api';
import { useAuth } from '@/utils/auth';

interface CustomAchievementCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

const popularEmojis = [
  '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '💫', '🎯', '🎖️',
  '🏅', '👑', '💎', '💪', '🔥', '⚡', '🚀', '🦅', '🏌️', '⛳',
  '🎉', '🎊', '🎁', '🏁', '📈', '💯', '🌈', '☀️', '🌙', '⚔️',
  '🛡️', '🗿', '🦁', '🐅', '🐉', '🦄', '🌸', '🍀', '🌺', '🌻'
];

const presetColors = [
  { name: 'Gold', bg: '#FEF3C7', color: '#F59E0B', glow: 'rgba(245,158,11,0.5)' },
  { name: 'Silver', bg: '#F3F4F6', color: '#6B7280', glow: 'rgba(107,114,128,0.5)' },
  { name: 'Bronze', bg: '#FED7AA', color: '#EA580C', glow: 'rgba(234,88,12,0.5)' },
  { name: 'Diamond', bg: '#DBEAFE', color: '#3B82F6', glow: 'rgba(59,130,246,0.5)' },
  { name: 'Emerald', bg: '#D1FAE5', color: '#10B981', glow: 'rgba(16,185,129,0.5)' },
  { name: 'Ruby', bg: '#FEE2E2', color: '#EF4444', glow: 'rgba(239,68,68,0.5)' },
  { name: 'Amethyst', bg: '#EDE9FE', color: '#8B5CF6', glow: 'rgba(139,92,246,0.5)' },
  { name: 'Obsidian', bg: '#1F2937', color: '#F9FAFB', glow: 'rgba(31,41,55,0.8)' },
  { name: 'Rose Gold', bg: '#FDF2F8', color: '#EC4899', glow: 'rgba(236,72,153,0.5)' },
  { name: 'Platinum', bg: '#E5E7EB', color: '#374151', glow: 'rgba(229,231,235,0.7)' }
];

const animations = [
  { value: 'none', label: 'None' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'spin', label: 'Spin' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'glow', label: 'Glow' },
  { value: 'float', label: 'Float' },
  { value: 'shake', label: 'Shake' },
  { value: 'ping', label: 'Ping' }
];

const categories = [
  'Tournament', 'Special', 'Milestone', 'Recognition', 
  'Achievement', 'Award', 'Honor', 'Custom'
];

const rarities = [
  'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 
  'Mythic', 'Special', 'Limited', 'Exclusive'
];

export function CustomAchievementCreator({
  isOpen,
  onClose,
  userId,
  userName,
  onSuccess
}: CustomAchievementCreatorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏆');
  const [color, setColor] = useState('#F59E0B');
  const [backgroundColor, setBackgroundColor] = useState('#FEF3C7');
  const [glowColor, setGlowColor] = useState('rgba(245,158,11,0.5)');
  const [category, setCategory] = useState('Special');
  const [rarity, setRarity] = useState('Legendary');
  const [points, setPoints] = useState([500]);
  const [reason, setReason] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [animationType, setAnimationType] = useState('pulse');
  const [loading, setLoading] = useState(false);
  const { getAccessToken } = useAuth();

  const handleCreate = async () => {
    if (!name || !icon) {
      toast.error('Please provide a name and icon');
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/achievements/create-custom`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          name,
          description,
          icon,
          color,
          backgroundColor,
          category,
          rarity,
          points: points[0],
          reason,
          tournamentId: tournamentId || undefined,
          glowColor,
          animationType: animationType === 'none' ? undefined : animationType
        })
      });

      if (response.ok) {
        toast.success(`Custom achievement "${name}" created and awarded to ${userName}!`);
        onSuccess?.();
        handleClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create achievement');
      }
    } catch (error) {
      console.error('Error creating achievement:', error);
      toast.error('Failed to create achievement');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIcon('🏆');
    setColor('#F59E0B');
    setBackgroundColor('#FEF3C7');
    setGlowColor('rgba(245,158,11,0.5)');
    setCategory('Special');
    setRarity('Legendary');
    setPoints([500]);
    setReason('');
    setTournamentId('');
    setAnimationType('pulse');
    onClose();
  };

  const selectPresetColor = (preset: typeof presetColors[0]) => {
    setBackgroundColor(preset.bg);
    setColor(preset.color);
    setGlowColor(preset.glow);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Custom Achievement for {userName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">
                <Type className="w-4 h-4 mr-2" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <Palette className="w-4 h-4 mr-2" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="effects">
                <Sparkles className="w-4 h-4 mr-2" />
                Effects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div>
                <Label>Achievement Name*</Label>
                <Input
                  placeholder="e.g., Tournament Champion 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="What makes this achievement special?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Rarity</Label>
                  <Select value={rarity} onValueChange={setRarity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rarities.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Points Value: {points[0]}</Label>
                <Slider
                  value={points}
                  onValueChange={setPoints}
                  min={0}
                  max={5000}
                  step={50}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Award Reason (Optional)</Label>
                <Textarea
                  placeholder="Why is this achievement being awarded?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label>Tournament/Event ID (Optional)</Label>
                <Input
                  placeholder="e.g., summer_championship_2024"
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4 mt-4">
              <div>
                <Label>Icon</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="text-4xl p-4 rounded-lg border bg-white">
                    {icon}
                  </div>
                  <Input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="flex-1"
                    placeholder="Enter emoji or character"
                  />
                </div>
                <div className="grid grid-cols-10 gap-2 mt-3">
                  {popularEmojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setIcon(emoji)}
                      className="p-2 text-xl hover:bg-gray-100 rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Color Preset</Label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {presetColors.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => selectPresetColor(preset)}
                      className="p-3 rounded-lg border hover:scale-105 transition-transform"
                      style={{ backgroundColor: preset.bg }}
                    >
                      <div 
                        className="w-8 h-8 mx-auto rounded-full"
                        style={{ backgroundColor: preset.color }}
                      />
                      <div className="text-xs mt-1">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Icon Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-20"
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>

                <div>
                  <Label>Background Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-20"
                    />
                    <Input
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#FEF3C7"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Preview</Label>
                <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg mt-2">
                  <motion.div
                    className="relative w-24 h-24 rounded-full flex items-center justify-center border-2"
                    style={{
                      backgroundColor,
                      borderColor: color,
                      boxShadow: `0 0 20px ${glowColor}`,
                      color
                    }}
                    animate={animationType !== 'none' ? {
                      scale: animationType === 'pulse' ? [1, 1.1, 1] : 1,
                      rotate: animationType === 'spin' ? 360 : 0,
                      y: animationType === 'bounce' ? [0, -10, 0] : 0
                    } : {}}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <span className="text-4xl">{icon}</span>
                  </motion.div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="effects" className="space-y-4 mt-4">
              <div>
                <Label>Animation</Label>
                <Select value={animationType} onValueChange={setAnimationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {animations.map(anim => (
                      <SelectItem key={anim.value} value={anim.value}>
                        {anim.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Glow Effect</Label>
                <Input
                  value={glowColor}
                  onChange={(e) => setGlowColor(e.target.value)}
                  placeholder="rgba(245,158,11,0.5)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use CSS color format (e.g., rgba, hex with opacity)
                </p>
              </div>

              <div>
                <Label>Live Preview</Label>
                <div className="p-8 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg mt-2">
                  <div className="flex items-center justify-center">
                    <motion.div
                      className="relative w-32 h-32 rounded-full flex items-center justify-center border-2"
                      style={{
                        backgroundColor,
                        borderColor: color,
                        boxShadow: `0 0 30px ${glowColor}`,
                        color
                      }}
                      animate={animationType !== 'none' ? {
                        scale: animationType === 'pulse' ? [1, 1.1, 1] : 1,
                        rotate: animationType === 'spin' ? 360 : 0,
                        y: animationType === 'bounce' ? [0, -15, 0] : 0,
                        x: animationType === 'shake' ? [-2, 2, -2, 2, 0] : 0
                      } : {}}
                      transition={{
                        duration: animationType === 'spin' ? 3 : 2,
                        repeat: Infinity,
                        ease: animationType === 'bounce' ? "easeOut" : "easeInOut"
                      }}
                    >
                      <span className="text-5xl">{icon}</span>
                      {animationType === 'ping' && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2"
                          style={{ borderColor: color }}
                          animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  </div>
                  <div className="text-center mt-4 text-white">
                    <div className="font-bold text-lg">{name || 'Achievement Name'}</div>
                    <div className="text-sm opacity-75">{description || 'Description'}</div>
                    <div className="mt-2">
                      <span className="px-2 py-1 rounded text-xs" 
                        style={{ backgroundColor: color, color: backgroundColor }}>
                        {rarity} • {points[0]} points
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name || !icon || loading}
          >
            <Award className="w-4 h-4 mr-2" />
            Create & Award Achievement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}