import React, { useState } from 'react';
import { AlertTriangle, ClipboardList, Upload } from 'lucide-react';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';


interface Command {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  requiresConfirm?: boolean;
  confirmMessage?: string;
}

export const CommandShortcutBar: React.FC = () => {
  const router = useRouter();
  const { notify } = useNotifications();
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleAlertStaff = async () => {
    setIsProcessing('alert-staff');
    try {
      const token = localStorage.getItem('clubos_token');
      
      // Create high priority ticket
      await http.post(`tickets`, {
        title: 'URGENT: Door Access Issue',
        description: 'Staff alerted about door access issue. Immediate attention required.',
        category: 'facilities',
        priority: 'urgent'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // In real implementation, would also trigger Slack alert
      notify('success', 'Staff has been alerted about the door issue');
      setShowConfirm(null);
    } catch (error) {
      notify('error', 'Failed to alert staff. Please try again.');
    } finally {
      setIsProcessing(null);
    }
  };

  const commands: Command[] = [
    {
      id: 'alert-staff',
      label: 'Alert Staff – Door Issue',
      icon: AlertTriangle,
      action: handleAlertStaff,
      requiresConfirm: true,
      confirmMessage: 'Alert all staff about a door access issue?'
    },
    {
      id: 'new-checklist',
      label: 'Create New Checklist',
      icon: ClipboardList,
      action: () => router.push('/checklists?create=true')
    },
    {
      id: 'upload-knowledge',
      label: 'Upload New Knowledge',
      icon: Upload,
      action: () => router.push('/knowledge?upload=true')
    }
  ];

  const handleCommandClick = (command: Command) => {
    if (command.requiresConfirm) {
      setShowConfirm(command.id);
    } else {
      command.action();
    }
  };

  return (
    <>
      <div className="hidden lg:block fixed right-6 top-20 z-40">
        <div className="flex flex-col space-y-2">
          {commands.map(command => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                onClick={() => handleCommandClick(command)}
                disabled={isProcessing === command.id}
                className="group relative flex items-center justify-center w-12 h-12 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-secondary)] transition-all hover:shadow-md disabled:opacity-50"
                title={command.label}
              >
                <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                
                {/* Tooltip */}
                <div className="absolute right-full mr-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {command.label}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-gray-900" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-2">Confirm Action</h3>
            <p className="text-[var(--text-muted)] mb-4">
              {commands.find(c => c.id === showConfirm)?.confirmMessage}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const command = commands.find(c => c.id === showConfirm);
                  if (command) {
                    command.action();
                  }
                }}
                disabled={isProcessing === showConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isProcessing === showConfirm ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};