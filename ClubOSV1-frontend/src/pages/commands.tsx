import { useState, useEffect } from 'react';
import Head from 'next/head';
import { hasMinimumRole } from '@/utils/roleUtils';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { 
  Search, 
  Zap, 
  Loader2, 
  ChevronDown, 
  ChevronRight,
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
  Projector,
  Monitor as MonitorIcon,
  Maximize2,
  MonitorSmartphone
} from 'lucide-react';
import { remoteActionsAPI, actionWarnings } from '@/api/remoteActions';
import { doorAccessAPI } from '@/api/doorAccess';
import { openSplashtopForBay, isSplashtopConfigured } from '@/utils/splashtopConfig';

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
    description: 'Screen is black or not displaying properly in one of the simulator bays',
    category: 'techsupport',
    type: 'issue-report',
    example: 'The screen is black in bay 4',
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
    description: 'No sound or audio problems in simulator bays',
    category: 'techsupport',
    type: 'issue-report',
    example: 'No sound coming from bay 2',
    keywords: ['no sound', 'audio', 'speakers', 'volume'],
    usageCount: 12
  },
  {
    id: 'calibration-off',
    name: 'Calibration Problems',
    description: 'Ball flight or distances seem incorrect',
    category: 'techsupport',
    type: 'issue-report',
    example: 'Shots are showing way too short in bay 5',
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
    example: 'Bay 3 is too cold',
    keywords: ['temperature', 'cold', 'hot', 'hvac', 'ac', 'heat'],
    usageCount: 34
  },
  {
    id: 'lost-found',
    name: 'Lost & Found',
    description: 'Report or inquire about lost items',
    category: 'facilities',
    type: 'action-request',
    example: 'I left my phone in bay 2',
    keywords: ['lost', 'found', 'missing', 'left behind'],
    usageCount: 23
  },
  
  // Automated Simulator Resets - Bedford
  {
    id: 'reset-bedford-bay1',
    name: 'Bedford Bay 1',
    description: 'Reset TrackMan at Bedford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bedford', 'bay 1'],
    action: 'ninjaone',
    location: 'Bedford',
    bayNumber: '1'
  },
  {
    id: 'reset-bedford-bay2',
    name: 'Bedford Bay 2',
    description: 'Reset TrackMan at Bedford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bedford', 'bay 2'],
    action: 'ninjaone',
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
    action: 'ninjaone',
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
    action: 'ninjaone',
    location: 'Bedford',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Dartmouth
  {
    id: 'reset-dartmouth-bay1',
    name: 'Dartmouth Bay 1',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 1'],
    action: 'ninjaone',
    location: 'Dartmouth',
    bayNumber: '1'
  },
  {
    id: 'reset-dartmouth-bay2',
    name: 'Dartmouth Bay 2',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 2'],
    action: 'ninjaone',
    location: 'Dartmouth',
    bayNumber: '2'
  },
  {
    id: 'reset-dartmouth-bay3',
    name: 'Dartmouth Bay 3',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 3'],
    action: 'ninjaone',
    location: 'Dartmouth',
    bayNumber: '3'
  },
  {
    id: 'reset-dartmouth-bay4',
    name: 'Dartmouth Bay 4',
    description: 'Reset TrackMan at Dartmouth location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'dartmouth', 'bay 4'],
    action: 'ninjaone',
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
    action: 'ninjaone',
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
    action: 'ninjaone',
    location: 'Dartmouth',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Stratford
  {
    id: 'reset-stratford-bay1',
    name: 'Stratford Bay 1',
    description: 'Reset TrackMan at Stratford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'stratford', 'bay 1'],
    action: 'ninjaone',
    location: 'Stratford',
    bayNumber: '1'
  },
  {
    id: 'reset-stratford-bay2',
    name: 'Stratford Bay 2',
    description: 'Reset TrackMan at Stratford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'stratford', 'bay 2'],
    action: 'ninjaone',
    location: 'Stratford',
    bayNumber: '2'
  },
  {
    id: 'reset-stratford-bay3',
    name: 'Stratford Bay 3',
    description: 'Reset TrackMan at Stratford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'stratford', 'bay 3'],
    action: 'ninjaone',
    location: 'Stratford',
    bayNumber: '3'
  },
  {
    id: 'reset-stratford-music',
    name: 'Stratford Music',
    description: 'Reset music system at Stratford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'stratford', 'audio'],
    action: 'ninjaone',
    location: 'Stratford',
    systemType: 'music'
  },
  {
    id: 'reset-stratford-tv',
    name: 'Stratford Tournament TV',
    description: 'Reset tournament TV at Stratford location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'tv', 'tournament', 'stratford'],
    action: 'ninjaone',
    location: 'Stratford',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Bayers Lake
  {
    id: 'reset-bayerslake-bay1',
    name: 'Bayers Lake Bay 1',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 1'],
    action: 'ninjaone',
    location: 'Bayers Lake',
    bayNumber: '1'
  },
  {
    id: 'reset-bayerslake-bay2',
    name: 'Bayers Lake Bay 2',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 2'],
    action: 'ninjaone',
    location: 'Bayers Lake',
    bayNumber: '2'
  },
  {
    id: 'reset-bayerslake-bay3',
    name: 'Bayers Lake Bay 3',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 3'],
    action: 'ninjaone',
    location: 'Bayers Lake',
    bayNumber: '3'
  },
  {
    id: 'reset-bayerslake-bay4',
    name: 'Bayers Lake Bay 4',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 4'],
    action: 'ninjaone',
    location: 'Bayers Lake',
    bayNumber: '4'
  },
  {
    id: 'reset-bayerslake-bay5',
    name: 'Bayers Lake Bay 5',
    description: 'Reset TrackMan at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bayers lake', 'bay 5'],
    action: 'ninjaone',
    location: 'Bayers Lake',
    bayNumber: '5'
  },
  {
    id: 'reset-bayerslake-music',
    name: 'Bayers Lake Music',
    description: 'Reset music system at Bayers Lake location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'music', 'bayers lake', 'audio'],
    action: 'ninjaone',
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
    action: 'ninjaone',
    location: 'Bayers Lake',
    systemType: 'tv'
  },
  
  // Automated Simulator Resets - Truro
  {
    id: 'reset-truro-bay1',
    name: 'Truro Bay 1',
    description: 'Reset TrackMan at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'truro', 'bay 1'],
    action: 'ninjaone',
    location: 'Truro',
    bayNumber: '1'
  },
  {
    id: 'reset-truro-bay2',
    name: 'Truro Bay 2',
    description: 'Reset TrackMan at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'truro', 'bay 2'],
    action: 'ninjaone',
    location: 'Truro',
    bayNumber: '2'
  },
  {
    id: 'reset-truro-bay3',
    name: 'Truro Bay 3',
    description: 'Reset TrackMan at Truro location',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'truro', 'bay 3'],
    action: 'ninjaone',
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
    action: 'ninjaone',
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
    action: 'ninjaone',
    location: 'Truro',
    systemType: 'tv'
  },
  {
    id: 'reset-all-trackman',
    name: 'Reset All TrackMan Systems',
    description: 'Remotely restart all TrackMan software across all bays',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'all bays'],
    action: 'ninjaone'
  },
  {
    id: 'reboot-simulator-pc',
    name: 'Reboot Simulator PC',
    description: 'Fully reboot a simulator PC (specify bay in request)',
    category: 'resets',
    type: 'action',
    keywords: ['reboot', 'restart', 'pc', 'computer'],
    action: 'ninjaone'
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'other-systems': false
  });
  const [executingDoorAction, setExecutingDoorAction] = useState<Set<string>>(new Set());

  // Check authentication
  useEffect(() => {
    if (!user || !hasMinimumRole(user?.role, 'operator')) {
      router.push('/login');
    }
  }, [user, router]);

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
      ? `Reset TrackMan on ${trigger.location} Bay ${trigger.bayNumber}?`
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Commands & Actions - ClubOS</title>
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)] pb-12">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Header Section */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              Commands & Actions
            </h1>
            <p className="text-[var(--text-secondary)] text-sm font-light max-w-3xl">
              Remote actions and automated controls for simulator and facility management.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-4 mb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('remote-actions')}
              className={`text-lg md:text-xl font-semibold transition-all relative pb-1 whitespace-nowrap ${
                activeTab === 'remote-actions' 
                  ? 'text-[var(--text-primary)]' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Remote Actions
              {activeTab === 'remote-actions' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('commands')}
              className={`text-lg md:text-xl font-semibold transition-all relative pb-1 whitespace-nowrap ${
                activeTab === 'commands' 
                  ? 'text-[var(--text-primary)]' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Commands
              {activeTab === 'commands' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]"></div>
              )}
            </button>
          </div>

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
                  
                  const locationOrder = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];
                  
                  return (
                    <>
                      {locationOrder.map(location => {
                        const locationData = groupedByLocation[location];
                        if (!locationData) return null;
                        
                        return (
                          <div key={location} className="card group p-3 sm:p-4">
                            {/* Location Header */}
                            <div className="flex items-center gap-2 mb-3">
                              <MapPin className="w-4 h-4 text-[var(--accent)]" />
                              <h3 className="text-base font-medium text-[var(--text-primary)]">{location}</h3>
                            </div>
                            
                            {/* Door Access Controls - NEW */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <DoorOpen className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-500">Door Access</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <button
                                  onClick={async () => {
                                    const actionKey = `door-${location}-main`;
                                    if (executingDoorAction.has(actionKey)) return;
                                    
                                    setExecutingDoorAction(prev => new Set(prev).add(actionKey));
                                    const toastId = toast.loading('Unlocking main door...');
                                    
                                    try {
                                      await doorAccessAPI.unlock({
                                        location,
                                        doorKey: 'main-entrance',
                                        duration: 30
                                      });
                                      toast.success('Main door unlocked for 30 seconds', { id: toastId });
                                    } catch (error: any) {
                                      toast.error(error.response?.data?.message || 'Failed to unlock door', { id: toastId });
                                    } finally {
                                      setExecutingDoorAction(prev => {
                                        const next = new Set(prev);
                                        next.delete(actionKey);
                                        return next;
                                      });
                                    }
                                  }}
                                  disabled={executingDoorAction.has(`door-${location}-main`)}
                                  className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-primary)] hover:bg-blue-500 hover:text-white border border-blue-500/50 rounded text-xs transition-all disabled:opacity-50"
                                >
                                  {executingDoorAction.has(`door-${location}-main`) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Unlock className="w-3 h-3" />
                                  )}
                                  <span className="text-[10px]">Main</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    const actionKey = `door-${location}-staff`;
                                    if (executingDoorAction.has(actionKey)) return;
                                    
                                    setExecutingDoorAction(prev => new Set(prev).add(actionKey));
                                    const toastId = toast.loading('Unlocking staff door...');
                                    
                                    try {
                                      await doorAccessAPI.unlock({
                                        location,
                                        doorKey: 'staff-door',
                                        duration: 30
                                      });
                                      toast.success('Staff door unlocked for 30 seconds', { id: toastId });
                                    } catch (error: any) {
                                      toast.error(error.response?.data?.message || 'Failed to unlock door', { id: toastId });
                                    } finally {
                                      setExecutingDoorAction(prev => {
                                        const next = new Set(prev);
                                        next.delete(actionKey);
                                        return next;
                                      });
                                    }
                                  }}
                                  disabled={executingDoorAction.has(`door-${location}-staff`)}
                                  className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-primary)] hover:bg-blue-500 hover:text-white border border-blue-500/50 rounded text-xs transition-all disabled:opacity-50"
                                >
                                  {executingDoorAction.has(`door-${location}-staff`) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Unlock className="w-3 h-3" />
                                  )}
                                  <span className="text-[10px]">Staff</span>
                                </button>
                                {(location === 'Dartmouth' || location === 'Bayers Lake' || location === 'Truro') && (
                                  <button
                                    onClick={async () => {
                                      const doorKey = location === 'Dartmouth' ? 'bay-access' : location === 'Truro' ? 'emergency-exit' : 'loading-door';
                                      const doorName = location === 'Dartmouth' ? 'Bay' : location === 'Truro' ? 'Emergency' : 'Loading';
                                      const actionKey = `door-${location}-${doorKey}`;
                                      if (executingDoorAction.has(actionKey)) return;
                                      
                                      setExecutingDoorAction(prev => new Set(prev).add(actionKey));
                                      const toastId = toast.loading(`Unlocking ${doorName.toLowerCase()} door...`);
                                      
                                      try {
                                        await doorAccessAPI.unlock({
                                          location,
                                          doorKey,
                                          duration: 30
                                        });
                                        toast.success(`${doorName} door unlocked for 30 seconds`, { id: toastId });
                                      } catch (error: any) {
                                        toast.error(error.response?.data?.message || 'Failed to unlock door', { id: toastId });
                                      } finally {
                                        setExecutingDoorAction(prev => {
                                          const next = new Set(prev);
                                          next.delete(actionKey);
                                          return next;
                                        });
                                      }
                                    }}
                                    disabled={executingDoorAction.has(`door-${location}-${location === 'Dartmouth' ? 'bay-access' : location === 'Truro' ? 'emergency-exit' : 'loading-door'}`)}
                                    className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-primary)] hover:bg-blue-500 hover:text-white border border-blue-500/50 rounded text-xs transition-all disabled:opacity-50"
                                  >
                                    {executingDoorAction.has(`door-${location}-${location === 'Dartmouth' ? 'bay-access' : location === 'Truro' ? 'emergency-exit' : 'loading-door'}`) ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Unlock className="w-3 h-3" />
                                    )}
                                    <span className="text-[10px]">{location === 'Dartmouth' ? 'Bay' : location === 'Truro' ? 'Emrg' : 'Load'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Bay Controls */}
                            {locationData.bays.length > 0 && (
                              <div className="space-y-2 mb-3">
                                <p className="text-xs text-[var(--text-secondary)] font-light">Bay Controls</p>
                                <div className="space-y-1.5">
                                  {locationData.bays.sort((a, b) => parseInt(a.bayNumber!) - parseInt(b.bayNumber!)).map((trigger) => (
                                    <div key={trigger.id} className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg p-2">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-medium text-[var(--text-primary)]">Bay {trigger.bayNumber}</span>
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
                                            if (!confirm(`⚠️ This will fully restart the PC for ${trigger.location} Bay ${trigger.bayNumber}. The bay will be unavailable for 3-5 minutes. Continue?`)) {
                                              return;
                                            }
                                            const toastId = toast.loading(`Rebooting PC...`);
                                            try {
                                              const result = await remoteActionsAPI.execute({
                                                action: 'reboot-pc',
                                                location: trigger.location!,
                                                bayNumber: trigger.bayNumber || ''
                                              });
                                              toast.success('PC reboot initiated. Bay will be back online in 3-5 minutes.', { 
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
                                            openSplashtopForBay(trigger.location!, trigger.bayNumber!);
                                          }}
                                          className="flex flex-col items-center gap-0.5 p-1.5 bg-[var(--bg-secondary)] hover:bg-blue-500 border border-blue-500/50 hover:border-blue-500 rounded transition-all group/btn text-xs"
                                          title={`Remote desktop to ${trigger.location} Bay ${trigger.bayNumber}`}
                                        >
                                          <MonitorSmartphone className="w-3 h-3 text-[var(--text-muted)] group-hover/btn:text-white" />
                                          <span className="text-[10px] text-[var(--text-secondary)] group-hover/btn:text-white">Remote</span>
                                        </button>
                                      </div>
                                      {/* Projector Controls - Compact Row */}
                                      <div className="mt-1.5 pt-1.5 border-t border-[var(--border-secondary)]">
                                        <div className="flex items-center gap-1">
                                          <Projector className="w-3 h-3 text-[var(--text-muted)]" />
                                          <div className="flex-1 grid grid-cols-3 gap-1">
                                            <button
                                              onClick={async () => {
                                                const toastId = toast.loading('Toggling projector power...');
                                                try {
                                                  await remoteActionsAPI.execute({
                                                    action: 'projector-power',
                                                    location: trigger.location!,
                                                    bayNumber: trigger.bayNumber || ''
                                                  });
                                                  toast.success('Projector power command sent', { id: toastId });
                                                } catch (error) {
                                                  toast.error('Failed to control projector', { id: toastId });
                                                }
                                              }}
                                              className="px-1 py-0.5 bg-[var(--bg-primary)] hover:bg-purple-500 hover:text-white border border-purple-500/30 rounded text-[9px] transition-all"
                                              title="Projector Power"
                                            >
                                              Pwr
                                            </button>
                                            <button
                                              onClick={async () => {
                                                const toastId = toast.loading('Switching projector input...');
                                                try {
                                                  await remoteActionsAPI.execute({
                                                    action: 'projector-input',
                                                    location: trigger.location!,
                                                    bayNumber: trigger.bayNumber || ''
                                                  });
                                                  toast.success('Projector input switched', { id: toastId });
                                                } catch (error) {
                                                  toast.error('Failed to switch input', { id: toastId });
                                                }
                                              }}
                                              className="px-1 py-0.5 bg-[var(--bg-primary)] hover:bg-purple-500 hover:text-white border border-purple-500/30 rounded text-[9px] transition-all"
                                              title="Switch Input"
                                            >
                                              Input
                                            </button>
                                            <button
                                              onClick={async () => {
                                                const toastId = toast.loading('Auto-sizing projector...');
                                                try {
                                                  await remoteActionsAPI.execute({
                                                    action: 'projector-autosize',
                                                    location: trigger.location!,
                                                    bayNumber: trigger.bayNumber || ''
                                                  });
                                                  toast.success('Projector auto-size adjusted', { id: toastId });
                                                } catch (error) {
                                                  toast.error('Failed to auto-size', { id: toastId });
                                                }
                                              }}
                                              className="px-1 py-0.5 bg-[var(--bg-primary)] hover:bg-purple-500 hover:text-white border border-purple-500/30 rounded text-[9px] transition-all"
                                              title="Auto Size"
                                            >
                                              Auto
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* System Controls Card */}
                            {(locationData.music || locationData.tv) && (
                              <div className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg p-2">
                                <p className="text-xs text-[var(--text-secondary)] font-light mb-1.5">System Controls</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {/* Music Reset */}
                                  {locationData.music && (
                                    <button
                                      onClick={() => handleExecuteReset(locationData.music!)}
                                      className="flex items-center justify-center gap-1 bg-[var(--bg-secondary)] hover:bg-[var(--accent)] border border-[var(--border-secondary)] hover:border-[var(--accent)] rounded p-1.5 transition-all group/btn text-xs"
                                    >
                                      <Music className="w-3 h-3 text-[var(--text-muted)] group-hover/btn:text-white" />
                                      <span className="text-[10px] font-medium text-[var(--text-primary)] group-hover/btn:text-white">Music</span>
                                    </button>
                                  )}
                                  
                                  {/* TV Reset */}
                                  {locationData.tv && (
                                    <button
                                      onClick={() => handleExecuteReset(locationData.tv!)}
                                      className="flex items-center justify-center gap-1 bg-[var(--bg-secondary)] hover:bg-[var(--accent)] border border-[var(--border-secondary)] hover:border-[var(--accent)] rounded p-1.5 transition-all group/btn text-xs"
                                    >
                                      <Tv className="w-3 h-3 text-[var(--text-muted)] group-hover/btn:text-white" />
                                      <span className="text-[10px] font-medium text-[var(--text-primary)] group-hover/btn:text-white">TV</span>
                                    </button>
                                  )}
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
                  {/* Other System Actions */}
                  <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('other-systems')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">Other System Actions</h3>
                    {expandedSections['other-systems'] ? (
                      <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </button>
                  
                  {expandedSections['other-systems'] && (
                    <div className="p-6 pt-0 space-y-4">
                      {/* PC Reboot */}
                      {filteredTriggers.filter(t => t.id === 'reboot-simulator-pc').map((trigger) => (
                        <div
                          key={trigger.id}
                          className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-secondary)] flex items-center justify-between"
                        >
                          <div>
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">
                              {trigger.name}
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] font-light mt-1">
                              {trigger.description}
                            </p>
                          </div>
                          <button
                            onClick={() => handleExecuteReset(trigger)}
                            className="ml-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 group"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Reboot PC
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

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
                    When reporting issues, always include the bay number or location
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
                    TrackMan resets will close and restart the software on the specified bay
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
        </div>
      </main>
    </>
  );
}