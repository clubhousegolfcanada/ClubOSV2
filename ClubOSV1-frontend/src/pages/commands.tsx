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
  Check
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'commands' | 'remote-actions'>('commands');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'other-systems': false
  });

  // Check authentication
  useEffect(() => {
    if (!user || !hasMinimumRole(user?.role, 'operator')) {
      router.push('/login');
    }
  }, [user, router]);

  // Separate triggers (resets) from regular commands
  const triggers = commands.filter(cmd => cmd.category === 'resets');
  const regularCommands = commands.filter(cmd => cmd.category !== 'resets');

  // Filter commands based on search and category
  const filteredCommands = regularCommands.filter(command => {
    const matchesSearch = command.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         command.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || command.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredTriggers = triggers.filter(trigger => {
    return trigger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           trigger.description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleCopyExample = (command: Command) => {
    if (command.example) {
      navigator.clipboard.writeText(command.example);
      setCopiedCommand(command.id);
      toast.success('Example copied to clipboard');
      setTimeout(() => setCopiedCommand(null), 2000);
    }
  };

  const handleExecuteReset = (trigger: Command) => {
    toast.success(`Executing: ${trigger.name}`);
    // TODO: Implement actual NinjaOne API call
    console.log('Execute NinjaOne reset:', trigger.id);
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
      
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-6 mb-6">
              <button
                onClick={() => setActiveTab('commands')}
                className={`text-2xl font-semibold transition-all relative pb-1 ${
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
              <button
                onClick={() => setActiveTab('remote-actions')}
                className={`text-2xl font-semibold transition-all relative pb-1 ${
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
            </div>
            
            <p className="text-[var(--text-secondary)] text-sm font-light max-w-3xl">
              {activeTab === 'commands' 
                ? 'Common commands that ClubOS can help with. Responses are dynamic and always current.'
                : 'Remote actions and automated controls for simulator and facility management.'}
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'commands' ? 'commands' : 'actions'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl pl-12 pr-4 py-4 text-sm font-light text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all"
              />
            </div>
          </div>

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
              <div className="space-y-4">
                {filteredCommands.map((command) => {
                  const config = categoryConfig[command.category];
                  const Icon = config.icon;
                  
                  return (
                    <div
                      key={command.id}
                      className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl p-6 hover:border-[var(--accent)] transition-all group"
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
              <div className="space-y-6">
                {/* Quick Bay Resets - Grouped by Location */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl p-6">
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">Quick Bay Resets</h3>
                  <p className="text-sm text-[var(--text-secondary)] font-light mb-6">
                    Click any bay to instantly reset TrackMan software
                  </p>
                  
                  {/* Group triggers by location */}
                  {(() => {
                    const groupedByLocation = filteredTriggers
                      .filter(t => t.location && t.bayNumber)
                      .reduce((acc, trigger) => {
                        if (!acc[trigger.location!]) {
                          acc[trigger.location!] = [];
                        }
                        acc[trigger.location!].push(trigger);
                        return acc;
                      }, {} as Record<string, Command[]>);
                    
                    const locationOrder = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake', 'Truro'];
                    
                    return (
                      <div className="space-y-6">
                        {locationOrder.map(location => {
                          const triggers = groupedByLocation[location];
                          if (!triggers || triggers.length === 0) return null;
                          
                          return (
                            <div key={location}>
                              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{location}</h4>
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {triggers.sort((a, b) => parseInt(a.bayNumber!) - parseInt(b.bayNumber!)).map((trigger) => (
                                  <button
                                    key={trigger.id}
                                    onClick={() => handleExecuteReset(trigger)}
                                    className="relative group"
                                  >
                                    <div className="bg-[var(--bg-tertiary)] hover:bg-[var(--accent)] border border-[var(--border-secondary)] hover:border-[var(--accent)] rounded-lg p-3 transition-all duration-200 cursor-pointer">
                                      <div className="text-center">
                                        <div className="text-xl font-semibold text-[var(--text-primary)] group-hover:text-white transition-colors">
                                          {trigger.bayNumber}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] group-hover:text-white/80 mt-0.5 transition-colors">
                                          Bay {trigger.bayNumber}
                                        </div>
                                      </div>
                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Zap className="w-4 h-4 text-white animate-pulse" />
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

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
            </>
          )}

          {/* Empty State */}
          {((activeTab === 'commands' && filteredCommands.length === 0) || 
            (activeTab === 'remote-actions' && filteredTriggers.length === 0)) && 
            searchTerm && (
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-secondary)]">
                No {activeTab === 'commands' ? 'commands' : 'actions'} found matching "{searchTerm}".
              </p>
            </div>
          )}

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