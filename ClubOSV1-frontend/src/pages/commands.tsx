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
  
  // Automated Simulator Resets
  {
    id: 'reset-trackman-bay1',
    name: 'Reset TrackMan - Bay 1',
    description: 'Remotely restart TrackMan software for Bay 1',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bay 1'],
    action: 'ninjaone'
  },
  {
    id: 'reset-trackman-bay2',
    name: 'Reset TrackMan - Bay 2',
    description: 'Remotely restart TrackMan software for Bay 2',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bay 2'],
    action: 'ninjaone'
  },
  {
    id: 'reset-trackman-bay3',
    name: 'Reset TrackMan - Bay 3',
    description: 'Remotely restart TrackMan software for Bay 3',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bay 3'],
    action: 'ninjaone'
  },
  {
    id: 'reset-trackman-bay4',
    name: 'Reset TrackMan - Bay 4',
    description: 'Remotely restart TrackMan software for Bay 4',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bay 4'],
    action: 'ninjaone'
  },
  {
    id: 'reset-trackman-bay5',
    name: 'Reset TrackMan - Bay 5',
    description: 'Remotely restart TrackMan software for Bay 5',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bay 5'],
    action: 'ninjaone'
  },
  {
    id: 'reset-trackman-bay6',
    name: 'Reset TrackMan - Bay 6',
    description: 'Remotely restart TrackMan software for Bay 6',
    category: 'resets',
    type: 'action',
    keywords: ['reset', 'restart', 'trackman', 'bay 6'],
    action: 'ninjaone'
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
    'global-resets': true,
    'individual-bays': false,
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
                {/* Global Resets */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('global-resets')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">Global Resets</h3>
                    {expandedSections['global-resets'] ? (
                      <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </button>
                  
                  {expandedSections['global-resets'] && (
                    <div className="p-6 pt-0 space-y-4">
                      {filteredTriggers.filter(t => t.id === 'reset-all-trackman').map((trigger) => (
                        <div
                          key={trigger.id}
                          className="bg-[var(--bg-tertiary)] rounded-xl p-6 border border-[var(--border-secondary)]"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-base font-medium text-[var(--text-primary)] mb-2">
                                {trigger.name}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] font-light">
                                {trigger.description}
                              </p>
                            </div>
                            <button
                              onClick={() => handleExecuteReset(trigger)}
                              className="ml-6 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-medium transition-all flex items-center gap-2 group"
                            >
                              <Zap className="w-4 h-4 group-hover:animate-pulse" />
                              Execute Reset
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Bay Resets */}
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('individual-bays')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">Individual Bay Resets</h3>
                    {expandedSections['individual-bays'] ? (
                      <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </button>
                  
                  {expandedSections['individual-bays'] && (
                    <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTriggers.filter(t => t.name.includes('Bay') && t.name.includes('TrackMan')).map((trigger) => (
                        <div
                          key={trigger.id}
                          className="bg-[var(--bg-tertiary)] rounded-xl p-4 border border-[var(--border-secondary)]"
                        >
                          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                            {trigger.name}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] font-light mb-4">
                            {trigger.description}
                          </p>
                          <button
                            onClick={() => handleExecuteReset(trigger)}
                            className="w-full px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 group"
                          >
                            <Zap className="w-3.5 h-3.5 group-hover:animate-pulse" />
                            Execute
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Other System Resets */}
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
                      {filteredTriggers.filter(t => t.id === 'reboot-simulator-pc').map((trigger) => (
                        <div
                          key={trigger.id}
                          className="bg-[var(--bg-tertiary)] rounded-xl p-6 border border-[var(--border-secondary)]"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-base font-medium text-[var(--text-primary)] mb-2">
                                {trigger.name}
                              </h4>
                              <p className="text-sm text-[var(--text-secondary)] font-light">
                                {trigger.description}
                              </p>
                            </div>
                            <button
                              onClick={() => handleExecuteReset(trigger)}
                              className="ml-6 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg font-medium transition-all flex items-center gap-2 group"
                            >
                              <Power className="w-4 h-4 group-hover:animate-pulse" />
                              Execute Reboot
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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