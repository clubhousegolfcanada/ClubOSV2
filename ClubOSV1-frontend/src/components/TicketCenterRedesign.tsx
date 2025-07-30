import React, { useState } from 'react';
import { Plus, Filter, Download, RefreshCw, Search, ChevronDown, AlertCircle, Clock, CheckCircle, Settings, Building, Wrench, BookOpen, Users, BarChart3, Calendar, Tool, FileText, HelpCircle } from 'lucide-react';

// This is a MOCKUP component showing the new Ticket Center design
// Demonstrates the tab structure and mobile-friendly layout

const TicketCenterRedesign = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'facilities' | 'tech'>('all');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  
  // Sample data for demonstration
  const stats = {
    active: 12,
    pending: 8,
    resolvedToday: 15,
    slaPerformance: 94
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header - Mobile Optimized */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Ticket Center</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Manage facilities and technical support efficiently
              </p>
            </div>
            <button className="md:hidden p-2 rounded-lg bg-[var(--bg-secondary)]">
              <Filter className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tab Navigation - Scrollable on mobile */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'all' 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              All Tickets
            </button>
            <button
              onClick={() => setActiveTab('facilities')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'facilities' 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              Facilities
            </button>
            <button
              onClick={() => setActiveTab('tech')}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'tech' 
                  ? 'bg-[var(--accent)] text-white' 
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              }`}
            >
              Tech Support
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'all' && (
          <div className="space-y-6">
            {/* Quick Stats - Responsive Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-2xl font-bold">{stats.active}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">Active</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="text-2xl font-bold">{stats.pending}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">Pending</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-2xl font-bold">{stats.resolvedToday}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">Resolved Today</p>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  <span className="text-2xl font-bold">{stats.slaPerformance}%</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">SLA Performance</p>
              </div>
            </div>

            {/* Action Bar - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <button className="flex-1 sm:flex-none px-4 py-2 bg-[var(--accent)] text-white rounded-lg flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Ticket
                </button>
                <button className="p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 sm:w-64 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search tickets..."
                    className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] rounded-lg"
                  />
                </div>
                <button className="p-2 bg-[var(--bg-secondary)] rounded-lg">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Ticket List - Compact Mobile Design */}
            <div className="space-y-3">
              {/* Sample Ticket Card */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-primary)]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[var(--text-muted)]">#TK-1234</span>
                      <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">High</span>
                      <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">Open</span>
                    </div>
                    <h3 className="font-medium text-sm mb-1">Simulator 3 projection issue</h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      The projection on simulator 3 is showing distorted images. Needs immediate attention.
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 ml-2" />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Bedford • Tech Support</span>
                  <span>2 hours ago</span>
                </div>
              </div>
              
              {/* More ticket cards would go here */}
            </div>
          </div>
        )}

        {activeTab === 'facilities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 hover:shadow-lg transition-shadow">
              <Building className="w-8 h-8 text-[var(--accent)] mb-3" />
              <h3 className="font-semibold mb-2">Location Management</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Track issues by location and manage facility-specific needs
              </p>
              <button className="text-sm text-[var(--accent)] hover:underline">
                Manage Locations →
              </button>
            </div>
            
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 hover:shadow-lg transition-shadow">
              <Tool className="w-8 h-8 text-[var(--accent)] mb-3" />
              <h3 className="font-semibold mb-2">Equipment Registry</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Complete inventory of all facility equipment and status
              </p>
              <button className="text-sm text-[var(--accent)] hover:underline">
                View Equipment →
              </button>
            </div>
            
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 hover:shadow-lg transition-shadow">
              <Calendar className="w-8 h-8 text-[var(--accent)] mb-3" />
              <h3 className="font-semibold mb-2">Maintenance Schedule</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Preventive maintenance calendar and compliance tracking
              </p>
              <button className="text-sm text-[var(--accent)] hover:underline">
                View Schedule →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 hover:shadow-lg transition-shadow">
              <BookOpen className="w-8 h-8 text-[var(--accent)] mb-3" />
              <h3 className="font-semibold mb-2">Knowledge Base</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Common issues, solutions, and troubleshooting guides
              </p>
              <button className="text-sm text-[var(--accent)] hover:underline">
                Browse Articles →
              </button>
            </div>
            
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 hover:shadow-lg transition-shadow">
              <FileText className="w-8 h-8 text-[var(--accent)] mb-3" />
              <h3 className="font-semibold mb-2">SOP Management</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Standard operating procedures and escalation protocols
              </p>
              <button className="text-sm text-[var(--accent)] hover:underline">
                View SOPs →
              </button>
            </div>
            
            <div className="bg-[var(--bg-secondary)] rounded-lg p-6 hover:shadow-lg transition-shadow">
              <HelpCircle className="w-8 h-8 text-[var(--accent)] mb-3" />
              <h3 className="font-semibold mb-2">Remote Support</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Quick diagnostics and remote assistance tools
              </p>
              <button className="text-sm text-[var(--accent)] hover:underline">
                Launch Tools →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Floating Action Button */}
      <button className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-[var(--accent)] text-white rounded-full shadow-lg flex items-center justify-center">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default TicketCenterRedesign;
