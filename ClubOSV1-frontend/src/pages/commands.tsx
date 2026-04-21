import { useState, useEffect } from 'react';
import { hasMinimumRole } from '@/utils/roleUtils';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import {
  Search,
  Zap,
  Loader2,
  AlertCircle,
  Terminal,
  Shield,
  Building,
  Palette,
  RefreshCw,
  Power,
  Copy,
  Check,
  Music,
  Tv,
  MapPin,
  Lock,
  Unlock,
  DoorOpen,
  Monitor as MonitorIcon,
  MonitorSmartphone
} from 'lucide-react';
import { remoteActionsAPI, actionWarnings } from '@/api/remoteActions';
import { doorAccessAPI } from '@/api/doorAccess';
import { unifiDoorsAPI } from '@/api/unifiDoors';
import { openRemoteDesktopForBay } from '@/utils/remoteDesktopConfig';
import OperatorLayout from '@/components/OperatorLayout';
import SubNavigation, { SubNavTab } from '@/components/SubNavigation';

interface Command {
  id: string;
  name: string;
  description: string;
  category: 'techsupport' | 'policies' | 'brand' | 'facilities' | 'resets';
  type: string;
  example?: string;
  keywords?: string[];
  usageCount?: number;
  action?: string;
  location?: string;
  bayNumber?: string;
  systemType?: 'music' | 'tv';
}

// Sample commands data (same as original)
const commands: Command[] = [
  // TechSupport Commands
  {
    id: 'black-screen',
    name: 'Black Screen Issue',
    description: 'Screen is black or not displaying properly in one of the simulator boxes',
    category: 'techsupport',
    type: 'issue-report',
    example: 'The screen is black in box 4',
    keywords: ['black screen', 'no display', 'monitor off'],
    usageCount: 45
  },
  {
    id: 'trackman-error',
    name: 'TrackMan Error Messages',
    description: 'Getting error messages or issues with TrackMan software',
    category: 'techsupport',
    type: 'issue-report',
    example: 'TrackMan shows "No club detected" error',
    keywords: ['error', 'trackman issue', 'software problem'],
    usageCount: 38
  },
  {
    id: 'no-sound',
    name: 'Audio/Sound Issues',
    description: 'No sound or audio problems in simulator boxes',
    category: 'techsupport',
    type: 'issue-report',
    example: 'No sound coming from box 2',
    keywords: ['no sound', 'audio', 'speakers', 'volume'],
    usageCount: 12
  },
  {
    id: 'calibration-off',
    name: 'Calibration Problems',
    description: 'Ball flight or distances seem incorrect',
    category: 'techsupport',
    type: 'issue-report',
    example: 'Shots are showing way too short in box 5',
    keywords: ['calibration', 'wrong distance', 'inaccurate'],
    usageCount: 28
  },
  {
    id: 'wifi-password',
    name: 'WiFi Password',
    description: 'Get the current WiFi password for customers',
    category: 'techsupport',
    type: 'information',
    example: 'What is the WiFi password?',
    keywords: ['wifi', 'wi-fi', 'internet', 'password', 'network'],
    usageCount: 95
  },
  
  // Policies Commands
  {
    id: 'cancellation-policy',
    name: 'Cancellation Policy',
    description: 'Information about booking cancellation policies and timeframes',
    category: 'policies',
    type: 'information',
    example: 'What is your cancellation policy?',
    keywords: ['cancel', 'cancellation', 'refund', 'policy'],
    usageCount: 67
  },
  {
    id: 'equipment-damage',
    name: 'Equipment Damage Policy',
    description: 'Policy regarding damaged equipment or property',
    category: 'policies',
    type: 'information',
    example: 'What happens if I damage equipment?',
    keywords: ['damage', 'broken', 'equipment', 'liability'],
    usageCount: 15
  },
  {
    id: 'food-beverage',
    name: 'Food & Beverage Rules',
    description: 'Policies about outside food, alcohol service, and dining',
    category: 'policies',
    type: 'information',
    example: 'Can we bring our own food?',
    keywords: ['food', 'drinks', 'alcohol', 'restaurant'],
    usageCount: 89
  },
  
  // Brand Commands
  {
    id: 'membership-info',
    name: 'Membership Information',
    description: 'Details about membership options, benefits, and pricing',
    category: 'brand',
    type: 'information',
    example: 'What membership options do you offer?',
    keywords: ['membership', 'member', 'benefits', 'pricing'],
    usageCount: 124
  },
  {
    id: 'hours-operation',
    name: 'Hours of Operation',
    description: 'Current operating hours and holiday schedules',
    category: 'brand',
    type: 'information',
    example: 'What are your hours today?',
    keywords: ['hours', 'open', 'closed', 'schedule'],
    usageCount: 156
  },
  {
    id: 'pricing-rates',
    name: 'Pricing & Rates',
    description: 'Current simulator rental rates and package pricing',
    category: 'brand',
    type: 'information',
    example: 'How much does it cost per hour?',
    keywords: ['price', 'cost', 'rates', 'pricing'],
    usageCount: 203
  },
  {
    id: 'gift-cards',
    name: 'Gift Cards',
    description: 'Information about purchasing and redeeming gift cards',
    category: 'brand',
    type: 'information',
    example: 'Do you sell gift cards?',
    keywords: ['gift card', 'gift certificate', 'present'],
    usageCount: 45
  },
  
  // Facilities Commands
  {
    id: 'parking-info',
    name: 'Parking Information',
    description: 'Details about parking availability and locations',
    category: 'facilities',
    type: 'information',
    example: 'Where can I park?',
    keywords: ['parking', 'park', 'lot', 'garage'],
    usageCount: 78
  },
  {
    id: 'hvac-control',
    name: 'Temperature Control',
    description: 'Adjust heating or cooling in specific areas',
    category: 'facilities',
    type: 'action-request',
    example: 'Box 3 is too cold',
    keywords: ['temperature', 'cold', 'hot', 'hvac', 'ac', 'heat'],
    usageCount: 34
  },
  {
    id: 'lost-found',
    name: 'Lost & Found',
    description: 'Report or inquire about lost items',
    category: 'facilities',
    type: 'action-request',
    example: 'I left my phone in box 2',
    keywords: ['lost', 'found', 'missing', 'left behind'],
    usageCount: 23
  },
  
  // Automated Simulator Resets - Bedford
  {
    id: 'reset-bedford-bay1',
    name: 'Bedford Box 1',
    description: 'Reset TrackMan at Bedford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bedford', 'bay 1'],
    action: 'trackman-agent',
    location: 'Bedford',
    bayNumber: '1'
  },
  {
    id: 'reset-bedford-bay2',
    name: 'Bedford Box 2',
    description: 'Reset TrackMan at Bedford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bedford', 'bay 2'],
    action: 'trackman-agent',
    location: 'Bedford',
    bayNumber: '2'
  },
  {
    id: 'reset-bedford-music',
    name: 'Bedford Music',
    description: 'Reset music system at Bedford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'bedford', 'audio'],
    action: 'trackman-agent',
    location: 'Bedford',
    systemType: 'music'
  },
  {
    id: 'reset-bedford-tv',
    name: 'Bedford Tournament TV',
    description: 'Reset tournament TV at Bedford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'tv', 'tournament', 'bedford'],
    action: 'trackman-agent',
    location: 'Bedford',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Dartmouth
  {
    id: 'reset-dartmouth-bay1',
    name: 'Dartmouth Box 1',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 1'],
    action: 'trackman-agent',
    location: 'Dartmouth',
    bayNumber: '1'
  },
  {
    id: 'reset-dartmouth-bay2',
    name: 'Dartmouth Box 2',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 2'],
    action: 'trackman-agent',
    location: 'Dartmouth',
    bayNumber: '2'
  },
  {
    id: 'reset-dartmouth-bay3',
    name: 'Dartmouth Box 3',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 3'],
    action: 'trackman-agent',
    location: 'Dartmouth',
    bayNumber: '3'
  },
  {
    id: 'reset-dartmouth-bay4',
    name: 'Dartmouth Box 4',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 4'],
    action: 'trackman-agent',
    location: 'Dartmouth',
    bayNumber: '4'
  },
  {
    id: 'reset-dartmouth-music',
    name: 'Dartmouth Music',
    description: 'Reset music system at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'dartmouth', 'audio'],
    action: 'trackman-agent',
    location: 'Dartmouth',
    systemType: 'music'
  },
  {
    id: 'reset-dartmouth-tv',
    name: 'Dartmouth Tournament TV',
    description: 'Reset tournament TV at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'tv', 'tournament', 'dartmouth'],
    action: 'trackman-agent',
    location: 'Dartmouth',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Truro (formerly Stratford)
  // (Truro commands defined later in the file)
  
  // Automated Simulator Resets - Bayers Lake
  {
    id: 'reset-bayerslake-bay1',
    name: 'Bayers Lake Box 1',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 1'],
    action: 'trackman-agent',
    location: 'Bayers Lake',
    bayNumber: '1'
  },
  {
    id: 'reset-bayerslake-bay2',
    name: 'Bayers Lake Box 2',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 2'],
    action: 'trackman-agent',
    location: 'Bayers Lake',
    bayNumber: '2'
  },
  {
    id: 'reset-bayerslake-bay3',
    name: 'Bayers Lake Box 3',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 3'],
    action: 'trackman-agent',
    location: 'Bayers Lake',
    bayNumber: '3'
  },
  {
    id: 'reset-bayerslake-bay4',
    name: 'Bayers Lake Box 4',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 4'],
    action: 'trackman-agent',
    location: 'Bayers Lake',
    bayNumber: '4'
  },
  {
    id: 'reset-bayerslake-music',
    name: 'Bayers Lake Music',
    description: 'Reset music system at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'bayers lake', 'audio'],
    action: 'trackman-agent',
    location: 'Bayers Lake',
    systemType: 'music'
  },
  {
    id: 'reset-bayerslake-tv',
    name: 'Bayers Lake Tournament TV',
    description: 'Reset tournament TV at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'tv', 'tournament', 'bayers lake'],
    action: 'trackman-agent',
    location: 'Bayers Lake',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Truro
  {
    id: 'reset-truro-bay1',
    name: 'Truro Box 1',
    description: 'Reset TrackMan at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'truro', 'bay 1'],
    action: 'trackman-agent',
    location: 'Truro',
    bayNumber: '1'
  },
  {
    id: 'reset-truro-bay2',
    name: 'Truro Box 2',
    description: 'Reset TrackMan at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'truro', 'bay 2'],
    action: 'trackman-agent',
    location: 'Truro',
    bayNumber: '2'
  },
  {
    id: 'reset-truro-bay3',
    name: 'Truro Box 3',
    description: 'Reset TrackMan at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'truro', 'bay 3'],
    action: 'trackman-agent',
    location: 'Truro',
    bayNumber: '3'
  },
  {
    id: 'reset-truro-music',
    name: 'Truro Music',
    description: 'Reset music system at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'truro', 'audio'],
    action: 'trackman-agent',
    location: 'Truro',
    systemType: 'music'
  },
  {
    id: 'reset-truro-tv',
    name: 'Truro Tournament TV',
    description: 'Reset tournament TV at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'tv', 'tournament', 'truro'],
    action: 'trackman-agent',
    location: 'Truro',
    systemType: 'tv'
  },

  // Automated Simulator Resets - River Oaks
  {
    id: 'reset-riveroaks-bay1',
    name: 'River Oaks Box 1',
    description: 'Reset TrackMan at River Oaks location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'river oaks', 'bay 1'],
    action: 'trackman-agent',
    location: 'River Oaks',
    bayNumber: '1'
  },
  {
    id: 'reset-riveroaks-music',
    name: 'River Oaks Music',
    description: 'Reset music system at River Oaks location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'river oaks', 'audio'],
    action: 'trackman-agent',
    location: 'River Oaks',
    systemType: 'music'
  },
  {
    id: 'reset-all-trackman',
    name: 'Reset All TrackMan Systems',
    description: 'Remotely restart all TrackMan software across all boxes',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'all bays', 'all boxes'],
    action: 'trackman-agent'
  }
];

// Category styling configuration
const categoryConfig = {
  techsupport: {
    label: 'TechSupport',
    icon: Terminal,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20'
  },
  policies: {
    label: 'Policies',
    icon: Shield,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20'
  },
  brand: {
    label: 'Brand',
    icon: Palette,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20'
  },
  facilities: {
    label: 'Facilities',
    icon: Building,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20'
  },
  resets: {
    label: 'Remote Actions',
    icon: Power,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20'
  }
};

export default function CommandsRedesigned() {
  const router = useRouter();
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'commands' | 'remote-actions'>('remote-actions');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // Search removed for cleaner UI
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [executingDoorAction, setExecutingDoorAction] = useState<Set<string>>(new Set());

  // SECURITY: Check authentication and block customer role
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        // Redirect customers to their dashboard
        router.push('/customer/');
        return;
      }
      if (!hasMinimumRole(user?.role, 'operator')) {
        router.push('/login');
      }
    } else if (user === null) {
      // User is not authenticated
      router.push('/login');
    }
  }, [user, router]);
  
  // Handle location query parameter
  useEffect(() => {
    if (router.query.location && typeof router.query.location === 'string') {
      // Set active tab to remote-actions
      setActiveTab('remote-actions');
      
      // Scroll to the location section after a short delay to ensure DOM is ready
      setTimeout(() => {
        const locationElement = document.getElementById(`location-${router.query.location}`);
        if (locationElement) {
          locationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a highlight effect
          locationElement.classList.add('ring-2', 'ring-[var(--accent)]', 'ring-opacity-50');
          setTimeout(() => {
            locationElement.classList.remove('ring-2', 'ring-[var(--accent)]', 'ring-opacity-50');
          }, 2000);
        }
      }, 100);
    }
  }, [router.query.location]);

  // Separate triggers (resets) from regular commands
  const triggers = commands.filter(cmd => cmd.category === 'resets');
  const regularCommands = commands.filter(cmd => cmd.category !== 'resets');

  // Filter commands based on category only
  const filteredCommands = regularCommands.filter(command => {
    const matchesCategory = selectedCategory === 'all' || command.category === selectedCategory;
    return matchesCategory;
  });

  // No filtering for triggers - show all
  const filteredTriggers = triggers;

  const handleCopyExample = (command: Command) => {
    if (command.example) {
      navigator.clipboard.writeText(command.example);
      setCopiedCommand(command.id);
      toast.success('Example copied to clipboard');
      setTimeout(() => setCopiedCommand(null), 2000);
    }
  };

  const handleExecuteReset = async (trigger: Command) => {
    const confirmMessage = trigger.bayNumber 
      ? `Reset TrackMan on ${trigger.location} Box ${trigger.bayNumber}?`
      : `Reset ${trigger.systemType} system at ${trigger.location}?`;
      
    if (!confirm(confirmMessage)) return;

    const toastId = toast.loading(`Executing ${trigger.name}...`);
    
    try {
      // Determine action type
      let action = 'restart-trackman';
      if (trigger.systemType === 'music') action = 'restart-music';
      if (trigger.systemType === 'tv') action = 'restart-tv';
      
      const result = await remoteActionsAPI.execute({
        action: action as any,
        location: trigger.location!,
        bayNumber: trigger.bayNumber || ''
      });
      
      toast.success(result.message, { id: toastId });
      
      // Start polling for job status if not simulated
      if (result.jobId && !result.simulated) {
        pollJobStatus(result.jobId, result.device);
      }
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute action', { 
        id: toastId 
      });
    }
  };

  const pollJobStatus = async (jobId: string, deviceName: string) => {
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes (5 second intervals)
    
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        const status = await remoteActionsAPI.getStatus(jobId);
        
        if (status.status === 'completed') {
          toast.success(`✅ ${deviceName} action completed successfully`);
          clearInterval(interval);
        } else if (status.status === 'failed') {
          toast.error(`❌ ${deviceName} action failed`);
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          toast(`⏱️ ${deviceName} action is taking longer than expected`, {
            icon: '⚠️',
            duration: 5000
          });
          clearInterval(interval);
        }
      } catch (error) {
        // Stop polling on error
        clearInterval(interval);
      }
    }, 5000);
  };

  if (!user) {
    return null;
  }

  // Define tabs for SubNavigation
  const tabs: SubNavTab[] = [
    { id: 'remote-actions', label: 'Remote Actions', icon: Power },
    { id: 'commands', label: 'Commands', icon: Terminal }
  ];

  return (
    <OperatorLayout
      title="Commands & Actions - ClubOS"
      description="Manage remote actions and system commands"
      subNavigation={
        <SubNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as 'commands' | 'remote-actions')}
        />
      }
    >

          {/* Search removed for cleaner UI */}

          {activeTab === 'commands' ? (
            <>
              {/* Category Pills */}
              <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  All Commands
                </button>
                {Object.entries(categoryConfig).map(([key, config]) => {
                  if (key === 'resets') return null;
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`px-6 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                        selectedCategory === key
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>

              {/* Commands List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {filteredCommands.map((command) => {
                  const config = categoryConfig[command.category];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={command.id}
                      className="card group h-full flex flex-col"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-base font-medium text-[var(--text-primary)]">
                              {command.name}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                              <Icon className="w-3 h-3" />
                              {config.label}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] font-light mb-3">
                            {command.description}
                          </p>
                          {command.example && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[var(--text-muted)]">Example:</span>
                              <code className="text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded text-[var(--text-secondary)]">
                                "{command.example}"
                              </code>
                            </div>
                          )}
                        </div>
                        {command.example && (
                          <button
                            onClick={() => handleCopyExample(command)}
                            className="ml-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            {copiedCommand === command.id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Remote Actions Tab */}
              <div>
                {/* Location Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {(() => {
                  const groupedByLocation = filteredTriggers
                    .filter(t => t.location)
                    .reduce((acc, trigger) => {
                      if (!acc[trigger.location!]) {
                        acc[trigger.location!] = {
                          bays: [],
                          music: null,
                          tv: null
                        };
                      }
                      if (trigger.bayNumber) {
                        acc[trigger.location!].bays.push(trigger);
                      } else if (trigger.systemType === 'music') {
                        acc[trigger.location!].music = trigger;
                      } else if (trigger.systemType === 'tv') {
                        acc[trigger.location!].tv = trigger;
                      }
                      return acc;
                    }, {} as Record<string, { bays: Command[], music: Command | null, tv: Command | null }>);
                  
                  const locationOrder = ['Bedford', 'Dartmouth', 'Bayers Lake', 'Truro', 'River Oaks'];
                  
                  return (
                    <>
                      {locationOrder.map(location => {
                        const locationData = groupedByLocation[location];
                        if (!locationData) return null;
                        
                        return (
                          <div key={location} id={`location-${location}`} className="card group p-3 sm:p-4 transition-all">
                            {/* Location Header */}
                            <div className="flex items-center gap-2 mb-3">
                              <MapPin className="w-4 h-4 text-[var(--accent)]" />
                              <h3 className="text-base font-medium text-[var(--text-primary)]">{location}</h3>
                            </div>
                            
                            {/* Box Controls */}
                            {locationData.bays.length > 0 && (
                              <div className="space-y-2 mb-3">
                                <p className="text-xs text-[var(--text-secondary)] font-light">Box Controls</p>
                                <div className="space-y-1.5">
                                  {locationData.bays.sort((a, b) => parseInt(a.bayNumber!) - parseInt(b.bayNumber!)).map((trigger) => (
                                    <div key={trigger.id} className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg p-2">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-[var(--text-primary)]">Box {trigger.bayNumber}</span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        <button
                                          onClick={() => handleExecuteReset(trigger)}
                                          className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-secondary)] hover:bg-orange-500 border border-orange-500/50 hover:border-orange-500 rounded transition-all group/btn text-xs"
                                        >
                                          <RefreshCw className="w-3 h-3 text-[var(--text-muted)] group-hover/btn:text-white" />
                                          <span className="text-[10px] text-[var(--text-secondary)] group-hover/btn:text-white">Sim</span>
                                        </button>
                                        <button
                                          onClick={async () => {
                                            if (!confirm(`⚠️ This will fully restart the PC for ${trigger.location} Box ${trigger.bayNumber}. The box will be unavailable for 3-5 minutes. Continue?`)) {
                                              return;
                                            }
                                            const toastId = toast.loading(`Rebooting PC...`);
                                            try {
                                              const result = await remoteActionsAPI.execute({
                                                action: 'reboot-pc',
                                                location: trigger.location!,
                                                bayNumber: trigger.bayNumber || ''
                                              });
                                              toast.success('PC reboot initiated. Box will be back online in 3-5 minutes.', { 
                                                id: toastId,
                                                duration: 10000 
                                              });
                                            } catch (error) {
                                              toast.error('Failed to reboot PC', { id: toastId });
                                            }
                                          }}
                                          className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-secondary)] hover:bg-red-500 border border-red-500/50 hover:border-red-500 rounded transition-all group/btn text-xs"
                                        >
                                          <Power className="w-3 h-3 text-[var(--text-muted)] group-hover/btn:text-white" />
                                          <span className="text-[10px] text-[var(--text-secondary)] group-hover/btn:text-white">PC</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            openRemoteDesktopForBay(trigger.location!, trigger.bayNumber!);
                                          }}
                                          className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-secondary)] hover:bg-blue-500 border border-blue-500/50 hover:border-blue-500 rounded transition-all group/btn text-xs"
                                          title={`Remote desktop to ${trigger.location} Box ${trigger.bayNumber}`}
                                        >
                                          <MonitorSmartphone className="w-3 h-3 text-[var(--text-muted)] group-hover/btn:text-white" />
                                          <span className="text-[10px] text-[var(--text-secondary)] group-hover/btn:text-white">Remote</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
                </div>

                {/* Additional Controls */}
                <div className="mt-6 space-y-6">
                  {/* Reset All Bays - Less Prominent */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium text-[var(--text-primary)]">Reset All TrackMan Systems</h3>
                      <p className="text-sm text-[var(--text-secondary)] font-light mt-1">
                        Restart TrackMan software on all bays simultaneously
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const resetAllTrigger = filteredTriggers.find(t => t.id === 'reset-all-trackman');
                        if (resetAllTrigger) {
                          if (confirm('Are you sure you want to reset ALL TrackMan systems? This will affect all bays.')) {
                            handleExecuteReset(resetAllTrigger);
                          }
                        }
                      }}
                      className="ml-4 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset All Bays
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </>
          )}

          {/* Empty State */}

          {/* Usage Tips */}
          <div className="mt-12 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl p-8">
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
              {activeTab === 'commands' ? 'Command Usage Tips' : 'Remote Action Guidelines'}
            </h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)] font-light">
              {activeTab === 'commands' ? (
                <>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    When reporting issues, always include the box number or location
                  </li>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    Be specific about the problem to get the most accurate assistance
                  </li>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    Commands can be typed naturally - ClubOS understands context
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    All actions execute immediately when clicked - use with caution
                  </li>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    TrackMan resets will close and restart the software on the specified box
                  </li>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    PC reboots take 3-5 minutes - inform customers before executing
                  </li>
                  <li className="flex items-start">
                    <span className="text-[var(--accent)] mr-2">•</span>
                    Contact IT support if an action fails or for adding new systems
                  </li>
                </>
              )}
            </ul>
          </div>
    </OperatorLayout>
  );
}