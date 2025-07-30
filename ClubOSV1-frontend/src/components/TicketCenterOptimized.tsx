import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Check, Clock, AlertCircle, MessageSquare, Trash2, X, ChevronRight, Filter } from 'lucide-react';
import { useRouter } from 'next/router';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory = 'facilities' | 'tech';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  location?: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: Comment[];
}

interface Comment {
  id: string;
  text: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

const TicketCenterOptimized = () => {
  const router = useRouter();
  const { notify } = useNotifications();
  const { user } = useAuthState();
  
  const [activeTab, setActiveTab] = useState<'all' | 'facilities' | 'tech'>('all');
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showTicketDetail, setShowTicketDetail] = useState(false);

  // Load tickets on mount and when tab changes
  useEffect(() => {
    loadTickets();
  }, [activeTab]);

  // Check URL params on mount
  useEffect(() => {
    const { category, status } = router.query;
    if (category === 'tech' || category === 'facilities') {
      setActiveTab(category);
    }
    if (status && ['open', 'in-progress', 'resolved', 'closed'].includes(status as string)) {
      setFilter(status as TicketStatus);
    }
  }, [router.query]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const params = new URLSearchParams();
      
      if (activeTab !== 'all') {
        params.append('category', activeTab);
      }
      
      const response = await axios.get(`${API_URL}/tickets?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setTickets(response.data.data);
      }
    } catch (error) {
      notify('error', 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  // Calculate ticket counts
  const ticketCounts = useMemo(() => {
    const counts = {
      all: tickets.length,
      open: 0,
      'in-progress': 0,
      resolved: 0,
      closed: 0
    };
    
    tickets.forEach(ticket => {
      counts[ticket.status]++;
    });
    
    return counts;
  }, [tickets]);

  // Filter tickets based on status and search
  const filteredTickets = useMemo(() => {
    let filtered = tickets;
    
    if (filter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === filter);
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.title.toLowerCase().includes(search) ||
        ticket.description.toLowerCase().includes(search) ||
        ticket.location?.toLowerCase().includes(search) ||
        ticket.id.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [tickets, filter, searchTerm]);

  const filters = [
    { value: 'all', label: 'All', count: ticketCounts.all },
    { value: 'open', label: 'Open', count: ticketCounts.open },
    { value: 'in-progress', label: 'In Progress', count: ticketCounts['in-progress'] },
    { value: 'resolved', label: 'Resolved', count: ticketCounts.resolved },
    { value: 'closed', label: 'Closed', count: ticketCounts.closed }
  ];

  const priorityColors = {
    urgent: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500'
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-500/20 text-yellow-600';
      case 'in-progress':
        return 'bg-blue-500/20 text-blue-600';
      case 'resolved':
        return 'bg-green-500/20 text-green-600';
      case 'closed':
        return 'bg-gray-500/20 text-gray-600';
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
  };

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.patch(
        `${API_URL}/tickets/${ticketId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        notify('success', 'Ticket status updated');
        loadTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status: newStatus });
        }
      }
    } catch (error) {
      notify('error', 'Failed to update ticket status');
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.delete(
        `${API_URL}/tickets/${ticketId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        notify('success', 'Ticket deleted');
        loadTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
          setShowTicketDetail(false);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        notify('error', 'You do not have permission to delete tickets');
      } else {
        notify('error', 'Failed to delete ticket');
      }
    }
  };

  const handleQuickResolve = (ticketId: string) => {
    updateTicketStatus(ticketId, 'resolved');
  };

  const addComment = async (ticketId: string) => {
    if (!newComment.trim()) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/tickets/${ticketId}/comments`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        notify('success', 'Comment added');
        setNewComment('');
        // Reload tickets to get updated comments
        loadTickets();
        // Update selected ticket if it's the same one
        if (selectedTicket?.id === ticketId) {
          const updatedTicket = tickets.find(t => t.id === ticketId);
          if (updatedTicket) {
            setSelectedTicket({
              ...updatedTicket,
              comments: [...(updatedTicket.comments || []), response.data.data]
            });
          }
        }
      }
    } catch (error) {
      notify('error', 'Failed to add comment');
    }
  };

  const clearAllTickets = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const params = new URLSearchParams();
      
      if (activeTab !== 'all') {
        params.append('category', activeTab);
      }
      
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      const response = await axios.delete(
        `${API_URL}/tickets/clear-all?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        notify('success', response.data.message);
        loadTickets();
        setSelectedTicket(null);
        setShowTicketDetail(false);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        notify('error', 'Only administrators can clear tickets');
      } else {
        notify('error', 'Failed to clear tickets');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header - Sticky on mobile */}
      <div className="sticky top-0 z-10 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Ticket Center</h1>
              <p className="text-sm text-[var(--text-secondary)] hidden md:block">
                View and manage all facilities and technical support tickets
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && filteredTickets.length > 0 && (
                <button
                  onClick={() => {
                    const categoryText = activeTab === 'all' ? '' : ` ${activeTab}`;
                    const statusText = filter === 'all' ? '' : ` ${filter}`;
                    if (confirm(`Clear all${statusText}${categoryText} tickets?`)) {
                      clearAllTickets();
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Clear all tickets"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Ticket</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              All Tickets
            </button>
            <button
              onClick={() => setActiveTab('facilities')}
              className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'facilities'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Facilities
            </button>
            <button
              onClick={() => setActiveTab('tech')}
              className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tech'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              Tech Support
            </button>
          </div>

          {/* Search Bar - Mobile optimized */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm"
            />
          </div>

          {/* Filter Pills - Horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value as TicketStatus | 'all')}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  filter === f.value
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`text-xs ${
                    filter === f.value ? 'bg-white/20' : 'bg-[var(--bg-tertiary)]'
                  } px-1.5 py-0.5 rounded-full`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket List - Optimized for mobile */}
      <div className="container mx-auto px-3 sm:px-4 py-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent)]"></div>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Loading tickets...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-3 hover:border-[var(--accent)] transition-colors"
            >
              {/* Mobile-optimized layout */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Ticket header with ID and priority */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">#{ticket.id.slice(0, 6)}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[ticket.priority]}`} />
                    <span className={`px-1.5 py-0.5 text-[10px] rounded ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('-', ' ')}
                    </span>
                  </div>
                  
                  {/* Title - Clickable */}
                  <h3 
                    className="font-medium text-xs mb-1.5 line-clamp-2 cursor-pointer hover:text-[var(--accent)]"
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setShowTicketDetail(true);
                    }}
                  >
                    {ticket.title}
                  </h3>
                  
                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-0.5">
                      <span className="font-medium capitalize">{ticket.category}</span>
                    </span>
                    {ticket.location && <span>{ticket.location}</span>}
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimeAgo(ticket.createdAt)}
                    </span>
                    {ticket.comments.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {ticket.comments.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-0.5">
                  <button
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setShowTicketDetail(true);
                    }}
                    className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                    title="View details"
                  >
                    <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />
                  </button>
                  {ticket.status === 'open' && (
                    <button
                      onClick={() => handleQuickResolve(ticket.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Quick resolve"
                    >
                      <Check className="w-3 h-3 text-green-500" />
                    </button>
                  )}
                  {(user?.role === 'admin' || user?.role === 'operator') && (
                    <button
                      onClick={() => deleteTicket(ticket.id)}
                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Delete ticket"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredTickets.length === 0 && (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-secondary)]">
              {searchTerm ? 'No tickets match your search' : 'No tickets found'}
            </p>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="mt-2 text-xs text-[var(--accent)] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {showTicketDetail && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-[var(--bg-primary)] w-full sm:max-w-2xl max-h-[90vh] rounded-t-lg sm:rounded-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-3 border-b border-[var(--border-primary)] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Ticket Details</h2>
                <p className="text-xs text-[var(--text-muted)]">#{selectedTicket.id.slice(0, 6)}</p>
              </div>
              <button
                onClick={() => {
                  setShowTicketDetail(false);
                  setSelectedTicket(null);
                  setNewComment('');
                }}
                className="p-1.5 hover:bg-[var(--bg-secondary)] rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Ticket Info */}
              <div>
                <h3 className="font-medium text-sm mb-1.5">{selectedTicket.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[var(--text-muted)]">Category:</span>
                  <span className="ml-1 capitalize">{selectedTicket.category}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Priority:</span>
                  <span className={`ml-1 capitalize ${priorityColors[selectedTicket.priority].replace('bg-', 'text-')}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Status:</span>
                  <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded ${getStatusColor(selectedTicket.status)}`}>
                    {selectedTicket.status.replace('-', ' ')}
                  </span>
                </div>
                {selectedTicket.location && (
                  <div>
                    <span className="text-[var(--text-muted)]">Location:</span>
                    <span className="ml-1">{selectedTicket.location}</span>
                  </div>
                )}
                <div>
                  <span className="text-[var(--text-muted)]">Created:</span>
                  <span className="ml-1">{formatTimeAgo(selectedTicket.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">By:</span>
                  <span className="ml-1">{selectedTicket.createdBy.name}</span>
                </div>
              </div>

              {/* Status Update */}
              <div>
                <label className="text-xs text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">Update Status:</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(['open', 'in-progress', 'resolved', 'closed'] as TicketStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => updateTicketStatus(selectedTicket.id, status)}
                      disabled={selectedTicket.status === status}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        selectedTicket.status === status
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-primary)] border border-[var(--border-secondary)]'
                      }`}
                    >
                      {status.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider mb-1.5">Comments ({selectedTicket.comments.length})</h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {selectedTicket.comments.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No comments yet</p>
                  ) : (
                    selectedTicket.comments.map(comment => (
                      <div key={comment.id} className="bg-[var(--bg-tertiary)] rounded p-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium">{comment.createdBy.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {formatTimeAgo(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Comment */}
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full p-2 bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded text-xs resize-none"
                  rows={2}
                />
                <button
                  onClick={() => addComment(selectedTicket.id)}
                  disabled={!newComment.trim()}
                  className="mt-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded text-xs disabled:opacity-50"
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketCenterOptimized;
