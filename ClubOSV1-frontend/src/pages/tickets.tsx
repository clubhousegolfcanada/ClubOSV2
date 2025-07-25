import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';
import { Trash2, AlertTriangle } from 'lucide-react';

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

export default function TicketCenter() {
  const [activeTab, setActiveTab] = useState<'all' | 'facilities' | 'tech'>('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | 'all'>('open');
  const [newComment, setNewComment] = useState('');
  const { notify } = useNotifications();
  const { user } = useAuthState();

  useEffect(() => {
    loadTickets();
  }, [activeTab, filterStatus]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const params = new URLSearchParams();
      
      // Only add category filter if not 'all'
      if (activeTab !== 'all') {
        params.append('category', activeTab);
      }
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
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
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.delete(
        `${API_URL}/tickets/${ticketId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        notify('success', 'Ticket deleted successfully');
        loadTickets();
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
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
        loadTickets();
        // Refresh selected ticket
        if (selectedTicket?.id === ticketId) {
          const updatedTicket = tickets.find(t => t.id === ticketId);
          if (updatedTicket) {
            setSelectedTicket({
              ...updatedTicket,
              comments: [...updatedTicket.comments, response.data.data]
            });
          }
        }
      }
    } catch (error) {
      notify('error', 'Failed to add comment');
    }
  };

  const clearAllTickets = async () => {
    const categoryText = activeTab === 'all' ? '' : ` ${activeTab}`;
    const message = filterStatus === 'all' 
      ? `Are you sure you want to clear ALL${categoryText} tickets? This action cannot be undone.`
      : `Are you sure you want to clear all ${filterStatus}${categoryText} tickets? This action cannot be undone.`;
      
    if (!confirm(message)) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      const params = new URLSearchParams();
      
      if (activeTab !== 'all') {
        params.append('category', activeTab);
      }
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      
      const response = await axios.delete(
        `${API_URL}/tickets/clear-all?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        notify('success', response.data.message);
        loadTickets();
        setSelectedTicket(null);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        notify('error', 'Only administrators can clear tickets');
      } else {
        notify('error', 'Failed to clear tickets');
      }
    }
  };

  const getStatusColor = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'in-progress':
        return 'text-blue-500 bg-blue-500/10';
      case 'resolved':
        return 'text-green-500 bg-green-500/10';
      case 'closed':
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getPriorityColor = (priority: TicketPriority) => {
    switch (priority) {
      case 'low':
        return 'text-gray-400';
      case 'medium':
        return 'text-yellow-500';
      case 'high':
        return 'text-orange-500';
      case 'urgent':
        return 'text-red-500';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Head>
        <title>ClubOSV1 - Ticket Center</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Ticket Center
          </h1>
          <p className="text-[var(--text-secondary)]">
            View and manage all facilities and technical support tickets
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="card mb-6">
          <div className="border-b border-[var(--border-secondary)] -mx-8 -mt-8 px-8">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('all')}
                className={`
                  py-4 px-6 font-medium text-sm transition-all duration-200 flex items-center gap-2
                  ${activeTab === 'all'
                    ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                📊 All Tickets
              </button>
              <button
                onClick={() => setActiveTab('facilities')}
                className={`
                  py-4 px-6 font-medium text-sm transition-all duration-200 flex items-center gap-2
                  ${activeTab === 'facilities'
                    ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                🏢 Facilities
              </button>
              <button
                onClick={() => setActiveTab('tech')}
                className={`
                  py-4 px-6 font-medium text-sm transition-all duration-200 flex items-center gap-2
                  ${activeTab === 'tech'
                    ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                🔧 Tech Support
              </button>
            </nav>
          </div>

          {/* Filter Bar */}
          <div className="mt-6 mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'open', 'in-progress', 'resolved', 'closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${filterStatus === status
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-[var(--text-secondary)]">
                {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
              </div>
              {user?.role === 'admin' && tickets.length > 0 && (
                <button
                  onClick={clearAllTickets}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-all"
                  title="Clear tickets"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Clear {filterStatus !== 'all' ? filterStatus : 'All'}
                </button>
              )}
            </div>
          </div>

          {/* Tickets Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tickets List */}
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-[var(--text-secondary)]">Loading tickets...</p>
                </div>
              ) : tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`
                      bg-[var(--bg-tertiary)] rounded-lg p-4 cursor-pointer transition-all
                      ${selectedTicket?.id === ticket.id ? 'ring-2 ring-[var(--accent)]' : ''}
                      hover:bg-[var(--bg-secondary)]
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-[var(--text-primary)] pr-2">
                          {ticket.title}
                        </h3>
                        {activeTab === 'all' && (
                          <span className="text-xs text-[var(--text-muted)] uppercase">
                            {ticket.category === 'facilities' ? '🏢 Facilities' : '🔧 Tech'}
                          </span>
                        )}
                      </div>
                      <span className={`text-sm ${getPriorityColor(ticket.priority)} font-medium`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-[var(--text-secondary)] mb-3 overflow-hidden" style={{ maxHeight: '3rem' }}>
                      {ticket.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('-', ' ')}
                        </span>
                        {ticket.location && (
                          <span className="text-xs text-[var(--text-muted)]">
                            {ticket.location}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-[var(--text-secondary)]">No tickets found</p>
                </div>
              )}
            </div>

            {/* Ticket Details */}
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-6">
              {selectedTicket ? (
                <div>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                      {selectedTicket.title}
                    </h2>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                        {selectedTicket.status.replace('-', ' ')}
                      </span>
                      <span className={`text-sm ${getPriorityColor(selectedTicket.priority)} font-medium`}>
                        {selectedTicket.priority.toUpperCase()}
                      </span>
                      {selectedTicket.location && (
                        <span className="text-sm text-[var(--text-muted)]">
                          📍 {selectedTicket.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-medium text-sm text-[var(--text-secondary)] mb-2">Description</h3>
                    <p className="text-[var(--text-primary)]">{selectedTicket.description}</p>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-medium text-sm text-[var(--text-secondary)] mb-2">Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)]">Created by:</span>{' '}
                        <span className="text-[var(--text-primary)]">{selectedTicket.createdBy.name}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Created:</span>{' '}
                        <span className="text-[var(--text-primary)]">
                          {new Date(selectedTicket.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {selectedTicket.assignedTo && (
                        <div>
                          <span className="text-[var(--text-muted)]">Assigned to:</span>{' '}
                          <span className="text-[var(--text-primary)]">{selectedTicket.assignedTo.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mb-6">
                    <h3 className="font-medium text-sm text-[var(--text-secondary)] mb-2">Actions</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        {(['open', 'in-progress', 'resolved', 'closed'] as TicketStatus[]).map((status) => (
                          <button
                            key={status}
                            onClick={() => updateTicketStatus(selectedTicket.id, status)}
                            disabled={selectedTicket.status === status}
                            className={`
                              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                              ${selectedTicket.status === status
                                ? 'bg-[var(--accent)] text-white cursor-not-allowed'
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }
                            `}
                          >
                            {status.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                      {(user?.role === 'admin' || user?.role === 'operator') && (
                        <button
                          onClick={() => deleteTicket(selectedTicket.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-all self-start"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comments */}
                  <div>
                    <h3 className="font-medium text-sm text-[var(--text-secondary)] mb-3">
                      Comments ({selectedTicket.comments.length})
                    </h3>
                    <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                      {selectedTicket.comments.map((comment) => (
                        <div key={comment.id} className="bg-[var(--bg-secondary)] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {comment.createdBy.name}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)]">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addComment(selectedTicket.id)}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm"
                      />
                      <button
                        onClick={() => addComment(selectedTicket.id)}
                        className="px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent)]/90 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[var(--text-secondary)]">Select a ticket to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// Force redeploy Thu 24 Jul 2025 22:01:56 ADT
