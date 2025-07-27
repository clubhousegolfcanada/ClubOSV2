import Head from 'next/head';
import { useState } from 'react';
import Button from '@/components/Button';
import { toast } from 'react-hot-toast';

interface Command {
  id: string;
  name: string;
  description: string;
  category: 'techsupport' | 'policies' | 'brand' | 'facilities' | 'resets';
  type: string;
  example?: string;
  keywords?: string[];
  usageCount?: number;
  action?: 'ninjaone' | 'local'; // For automated actions
}

const commands: Command[] = [
  // Tech Support & Issue Reports
  {
    id: 'screen-black',
    name: 'Screen Black/No Display',
    description: 'Report when a simulator screen is not displaying anything',
    category: 'techsupport',
    type: 'issue-report',
    example: 'The screen is black in bay 4',
    keywords: ['black screen', 'no display', 'monitor off'],
    usageCount: 45 // For demo purposes
  },
  {
    id: 'trackman-frozen',
    name: 'TrackMan Frozen',
    description: 'Report when TrackMan software is unresponsive or frozen',
    category: 'techsupport',
    type: 'issue-report',
    example: 'TrackMan is frozen',
    keywords: ['frozen', 'stuck', 'not responding', 'crashed'],
    usageCount: 38
  },
  {
    id: 'ball-detection',
    name: 'Ball Detection Issues',
    description: 'Report when the system is not detecting golf balls',
    category: 'techsupport',
    type: 'issue-report',
    example: "It's not picking up balls",
    keywords: ['not detecting', 'missing shots', 'no ball flight'],
    usageCount: 52
  },
  {
    id: 'audio-issues',
    name: 'Sound/Audio Problems',
    description: 'Report audio or sound system issues',
    category: 'techsupport',
    type: 'issue-report',
    example: 'No sound coming from bay 2',
    keywords: ['no sound', 'audio', 'speakers', 'volume'],
    usageCount: 12
  },
  {
    id: 'calibration-off',
    name: 'Calibration Issues',
    description: 'Report when shot data seems incorrect or calibration is off',
    category: 'techsupport',
    type: 'issue-report',
    example: 'Shots are showing way too short in bay 5',
    keywords: ['calibration', 'wrong distance', 'inaccurate'],
    usageCount: 28
  },
  
  // Policy & Information Queries
  {
    id: 'return-policy',
    name: 'Return Policy',
    description: 'Information about refunds and cancellation policies',
    category: 'policies',
    type: 'information',
    example: 'What is the return policy?',
    keywords: ['refund', 'cancellation', 'money back'],
    usageCount: 15
  },
  {
    id: 'membership-benefits',
    name: 'Membership Benefits',
    description: 'Information about membership tiers and perks',
    category: 'policies',
    type: 'information',
    example: 'What are the VIP membership benefits?',
    keywords: ['membership', 'VIP', 'benefits', 'perks'],
    usageCount: 67
  },
  {
    id: 'age-requirements',
    name: 'Age Requirements',
    description: 'Age restrictions and requirements for facility use',
    category: 'policies',
    type: 'information',
    example: 'What is the minimum age to use the simulators?',
    keywords: ['age', 'minimum', 'kids', 'children'],
    usageCount: 8
  },
  {
    id: 'dress-code',
    name: 'Dress Code',
    description: 'Facility dress code and attire requirements',
    category: 'policies',
    type: 'information',
    example: 'Is there a dress code?',
    keywords: ['dress code', 'attire', 'clothing', 'shoes'],
    usageCount: 22
  },
  
  // Technical Information
  {
    id: 'wifi-password',
    name: 'WiFi Information',
    description: 'Guest WiFi network name and password (Staff Reference)',
    category: 'techsupport',
    type: 'information',
    example: 'WiFi Password: ClubGolf',
    keywords: ['wifi', 'internet', 'network', 'password', 'ClubGolf'],
    usageCount: 89
  },
  {
    id: 'simulator-specs',
    name: 'Simulator Specifications',
    description: 'Technical details about the simulator equipment',
    category: 'techsupport',
    type: 'information',
    example: 'What TrackMan model do you use?',
    keywords: ['specs', 'model', 'equipment', 'technology'],
    usageCount: 5
  },
  
  // Brand & Visual Information
  {
    id: 'brand-colors',
    name: 'Brand Colors',
    description: 'Official Clubhouse brand colors and color codes',
    category: 'brand',
    type: 'information',
    example: 'What are the Clubhouse brand colors?',
    keywords: ['colors', 'brand', 'hex', 'RGB']
  },
  {
    id: 'logo-usage',
    name: 'Logo Usage Guidelines',
    description: 'Guidelines for using the Clubhouse logo',
    category: 'brand',
    type: 'information',
    example: 'Can I use the logo on my tournament flyer?',
    keywords: ['logo', 'branding', 'usage', 'guidelines']
  },
  {
    id: 'social-media',
    name: 'Social Media Handles',
    description: 'Official social media accounts and handles',
    category: 'brand',
    type: 'information',
    example: 'What is your Instagram handle?',
    keywords: ['social media', 'instagram', 'facebook', 'twitter']
  },
  
  // Facility Information
  {
    id: 'equipment-rental',
    name: 'Equipment & Rental Info',
    description: 'Available rental equipment and pricing',
    category: 'facilities',
    type: 'information',
    example: 'Do you rent golf clubs?',
    keywords: ['rental', 'clubs', 'equipment', 'gear']
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

const categoryColors = {
  techsupport: 'bg-orange-500',
  policies: 'bg-blue-500',
  brand: 'bg-purple-500',
  facilities: 'bg-green-500',
  resets: 'bg-red-500'
};

// Command Card Component
function CommandCard({ command, copiedCommand, copyCommand }: {
  command: Command;
  copiedCommand: string | null;
  copyCommand: (command: Command) => void;
}) {
  return (
    <div className="group relative bg-[var(--bg-secondary)] border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-all">
      {/* Header Section */}
      <div className="mb-3">
        <h3 className="font-medium text-[var(--text-primary)] text-base mb-2">
          {command.name}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {command.description}
        </p>
        {/* Show WiFi password directly on the card */}
        {command.id === 'wifi-password' && (
          <p className="text-sm mt-2">
            <span className="text-[var(--text-muted)]">Password: </span>
            <span className="font-mono text-[#0B4E43] font-semibold">ClubGolf</span>
          </p>
        )}
      </div>
      
      {/* Keywords Tags */}
      {command.keywords && command.keywords.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {command.keywords.map((keyword, index) => (
            <span
              key={index}
              className="text-xs px-2.5 py-1 bg-[#0B4E43] bg-opacity-20 text-[var(--text-primary)] rounded-md border border-[#0B4E43] border-opacity-30"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
      
      {/* Action/Copy Button */}
      {command.category === 'resets' && command.action === 'ninjaone' ? (
        <button
          onClick={() => {
            toast.success(`Executing: ${command.name}`);
            // TODO: Implement NinjaOne API call
            console.log('Execute NinjaOne reset:', command.id);
          }}
          className="absolute top-4 right-4 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
          title="Execute reset"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Execute
        </button>
      ) : (
        <button
          onClick={() => copyCommand(command)}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-800 rounded transition-colors"
          title="Copy example"
        >
          {copiedCommand === command.id ? (
            <svg className="w-4 h-4 text-[#0B4E43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

export default function Commands() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'commands' | 'triggers'>('commands');
  
  const categories = ['all', 'techsupport', 'policies', 'brand', 'facilities'];
  
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    // Initialize all categories as expanded
    const initial: Record<string, boolean> = { all: true };
    categories.slice(1).forEach(cat => {
      initial[cat] = true;
    });
    return initial;
  });
  
  const categoryIcons: Record<string, string> = {
    all: 'All',
    techsupport: 'Tech',
    policies: 'Policies',
    brand: 'Brand',
    facilities: 'Facilities'
  };
  
  // Separate triggers (resets) from regular commands
  const triggers = commands.filter(cmd => cmd.category === 'resets');
  const regularCommands = commands.filter(cmd => cmd.category !== 'resets');

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filteredCommands = regularCommands.filter(command => {
    const matchesCategory = selectedCategory === 'all' || command.category === selectedCategory;
    const matchesSearch = command.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         command.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (command.example && command.example.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });
  
  const filteredTriggers = triggers.filter(trigger => {
    return trigger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           trigger.description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Get most used commands for the week (based on operations log data)
  const mostUsedCommands = [
    commands.find(cmd => cmd.id === 'screen-black'), // Most common issue in ops log
    commands.find(cmd => cmd.id === 'wifi-password')  // Second most requested
  ].filter(Boolean) as Command[];

  const copyCommand = (command: Command) => {
    // For WiFi command, copy the actual password
    const text = command.id === 'wifi-password' ? 'ClubGolf' : command.name;
    navigator.clipboard.writeText(text);
    setCopiedCommand(command.id);
    toast.success(command.id === 'wifi-password' ? 'WiFi password copied!' : 'Command copied to clipboard!');
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <>
      <Head>
        <title>ClubOS - Commands</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-6">
          {/* Header with Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setActiveTab('commands')}
                  className={`text-2xl font-bold transition-colors relative pb-2 ${
                    activeTab === 'commands' 
                      ? 'text-[var(--text-primary)]' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Commands
                  {activeTab === 'commands' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0B4E43]"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('triggers')}
                  className={`text-2xl font-bold transition-colors relative pb-2 ${
                    activeTab === 'triggers' 
                      ? 'text-[var(--text-primary)]' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  Triggers
                  {activeTab === 'triggers' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0B4E43]"></div>
                  )}
                </button>
              </div>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-800 rounded-md transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <p className="text-[var(--text-secondary)]">
              {activeTab === 'commands' 
                ? 'Common commands that ClubOS can help with. Responses are dynamic and always current.'
                : 'Remote triggers and automated actions for simulator and facility management.'}
            </p>
          </div>

          {/* Stats Cards and Most Asked - Only show for Commands tab */}
          {activeTab === 'commands' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Quick Stats</h2>
                <span className="text-xs text-[var(--text-muted)]">Most asked from operations log</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Stats Cards */}
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-gray-800">
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{regularCommands.filter(c => c.category === 'techsupport').length}</div>
                  <div className="text-xs text-[var(--text-muted)]">Tech Support</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-gray-800">
                  <div className="text-2xl font-bold text-[var(--text-primary)]">{regularCommands.length}</div>
                  <div className="text-xs text-[var(--text-muted)]">Total Commands</div>
                </div>
                
                {/* Most Asked Commands */}
                {mostUsedCommands.map((command, index) => (
                  <button
                    key={command.id}
                    onClick={() => copyCommand(command)}
                    className="bg-[var(--bg-secondary)] border border-gray-800 rounded-lg p-4 hover:border-[#0B4E43] transition-all text-left group relative"
                  >
                    <div className="absolute top-2 right-2 w-6 h-6 bg-[#0B4E43] bg-opacity-20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-[#0B4E43]">#{index + 1}</span>
                    </div>
                    
                    <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1 pr-8">
                      {command.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {index === 0 ? '47 this week' : '31 this week'}
                    </p>
                    
                    {/* Copy indicator on hover */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4 text-[#0B4E43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* Main Layout with Sidebar */}
          <div className="flex gap-6 relative">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}
            
            {/* Sidebar Navigation - Only show for Commands tab */}
            {activeTab === 'commands' && (
              <div className={`
                fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
                w-64 lg:w-48 flex-shrink-0 bg-[var(--bg-secondary)] lg:bg-transparent
                transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              `}>
                <div className="h-full overflow-y-auto p-4 lg:p-0 lg:sticky lg:top-6">
                  <div className="flex items-center justify-between mb-4 lg:hidden">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Categories</h3>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1 hover:bg-gray-800 rounded-md"
                    >
                      <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 hidden lg:block">Categories</h3>
                  <nav className="space-y-1">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCategory(category);
                          setIsSidebarOpen(false);
                        }}
                        className={`
                          w-full text-left px-3 py-2 rounded-md capitalize transition-all text-sm
                          ${selectedCategory === category
                            ? 'bg-[#0B4E43] text-white font-medium'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                          }
                        `}
                      >
                        {category}
                        {category !== 'all' && (
                          <span className="float-right text-xs opacity-60">
                            {regularCommands.filter(c => c.category === category).length}
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1">
              {activeTab === 'commands' ? (
                // Commands Tab Content
                selectedCategory === 'all' ? (
                  // Show all categories with collapsible sections
                  <div className="space-y-6">
                    {categories.slice(1).map((category) => {
                      const categoryCommands = filteredCommands.filter(c => c.category === category);
                      if (categoryCommands.length === 0) return null;
                      
                      return (
                        <div key={category} className="">
                          <button
                            onClick={() => toggleCategory(category)}
                            className="w-full flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-gray-800 transition-colors border border-gray-800"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400 text-sm font-medium uppercase">
                                {category}
                              </span>
                              <span className="text-xs text-gray-500">
                                {categoryCommands.length} commands
                              </span>
                            </div>
                            <svg
                              className={`w-5 h-5 text-gray-500 transition-transform ${
                                expandedCategories[category] ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {expandedCategories[category] && (
                            <div className="grid gap-3 lg:grid-cols-2 mt-3">
                              {categoryCommands.map((command) => (
                                <CommandCard key={command.id} command={command} copiedCommand={copiedCommand} copyCommand={copyCommand} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Show single category
                  <div>
                    <div className="mb-4">
                      <span className="text-gray-400 text-sm font-medium uppercase">
                        {selectedCategory}
                      </span>
                      <span className="ml-3 text-sm text-gray-500">
                        {filteredCommands.length} commands
                      </span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {filteredCommands.map((command) => (
                        <CommandCard key={command.id} command={command} copiedCommand={copiedCommand} copyCommand={copyCommand} />
                      ))}
                    </div>
                  </div>
                )
              ) : (
                // Triggers Tab Content
                <div>
                  <div className="grid gap-4">
                    {/* TrackMan Resets Section */}
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">TrackMan Simulator Resets</h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {filteredTriggers.filter(t => t.name.includes('TrackMan')).map((trigger) => (
                          <div key={trigger.id} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-gray-700">
                            <h4 className="font-medium text-[var(--text-primary)] mb-2">{trigger.name}</h4>
                            <p className="text-sm text-[var(--text-secondary)] mb-3">{trigger.description}</p>
                            <button
                              onClick={() => {
                                toast.success(`Executing: ${trigger.name}`);
                                // TODO: Implement NinjaOne API call
                                console.log('Execute NinjaOne reset:', trigger.id);
                              }}
                              className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Execute Reset
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Other PC Resets Section */}
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Other System Resets</h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {filteredTriggers.filter(t => !t.name.includes('TrackMan')).map((trigger) => (
                          <div key={trigger.id} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-gray-700">
                            <h4 className="font-medium text-[var(--text-primary)] mb-2">{trigger.name}</h4>
                            <p className="text-sm text-[var(--text-secondary)] mb-3">{trigger.description}</p>
                            <button
                              onClick={() => {
                                toast.success(`Executing: ${trigger.name}`);
                                // TODO: Implement NinjaOne API call
                                console.log('Execute NinjaOne reset:', trigger.id);
                              }}
                              className="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Execute Reset
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Add New System Triggers */}
                    <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Add New Triggers</h3>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <button className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-gray-700 hover:border-[#0B4E43] transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0B4E43] bg-opacity-20 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-[#0B4E43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-medium text-[var(--text-primary)]">Music PC Reset</h4>
                              <p className="text-xs text-[var(--text-muted)]">Add trigger for music system</p>
                            </div>
                          </div>
                        </button>
                        <button className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-gray-700 hover:border-[#0B4E43] transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0B4E43] bg-opacity-20 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-[#0B4E43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-medium text-[var(--text-primary)]">Scoreboard Display</h4>
                              <p className="text-xs text-[var(--text-muted)]">Add scoreboard PC trigger</p>
                            </div>
                          </div>
                        </button>
                        <button className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-gray-700 hover:border-[#0B4E43] transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0B4E43] bg-opacity-20 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-[#0B4E43]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-medium text-[var(--text-primary)]">Custom Trigger</h4>
                              <p className="text-xs text-[var(--text-muted)]">Add any PC or system</p>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {filteredTriggers.length === 0 && searchTerm && (
                    <div className="text-center py-12">
                      <p className="text-gray-400">
                        No triggers found matching "{searchTerm}".
                      </p>
                    </div>
                  )}
                </div>
              )}

              {filteredCommands.length === 0 && activeTab === 'commands' && (
                <div className="text-center py-12">
                  <p className="text-gray-400">
                    No commands found matching your criteria.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tips */}
          <div className="mt-8 bg-[var(--bg-secondary)] rounded-lg p-4 border border-gray-800">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">
              Quick Tips
            </h2>
            <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
              {activeTab === 'commands' ? (
                <>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    These are common commands - responses adapt based on current data and context
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    When reporting issues, always include the bay number or location
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    The AI understands natural language - you don't need to use exact phrases
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    For urgent safety issues, contact staff directly at the front desk
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    All triggers execute immediately when clicked - use with caution
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    TrackMan resets will close and restart the software on the specified bay
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    System reboots take 2-3 minutes - notify affected customers first
                  </li>
                  <li className="flex items-start">
                    <span className="text-[#0B4E43] mr-2">•</span>
                    Contact IT support if a trigger fails or for adding new systems
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