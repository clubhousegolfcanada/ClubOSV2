import Head from 'next/head';
import Link from 'next/link';
import { useAuthState } from '@/state/useStore';

export default function Dashboard() {
  const { user } = useAuthState();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Head>
        <title>ClubOS - Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-[var(--text-secondary)]">
            AI-powered assistant for facility management
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link href="/commands" className="card hover:border-[var(--accent)] transition-all cursor-pointer">
            <h3 className="text-lg font-semibold mb-2">AI Command Center</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              Process requests with AI-powered routing and responses
            </p>
          </Link>

          <Link href="/tickets" className="card hover:border-[var(--accent)] transition-all cursor-pointer">
            <h3 className="text-lg font-semibold mb-2">Ticket Center</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              Manage facilities and technical support tickets
            </p>
          </Link>

          <Link href="/operations" className="card hover:border-[var(--accent)] transition-all cursor-pointer">
            <h3 className="text-lg font-semibold mb-2">Operations</h3>
            <p className="text-[var(--text-secondary)] text-sm">
              User management and system administration
            </p>
          </Link>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">External Tools</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            
              href="https://app.skedda.com/register?i=277234"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center group">

              <div className="text-2xl mb-2 font-bold">CAL</div>
              <div className="text-sm font-medium">Skedda</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Booking System</div>
            </a>
            
              href="https://my.splashtop.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center group"
            >
              <div className="text-2xl mb-2 font-bold">RDP</div>
              <div className="text-sm font-medium">Splashtop</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Remote Access</div>
            </a>
            
              href="https://app.hubspot.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center group"
            >
              <div className="text-2xl mb-2 font-bold">CRM</div>
              <div className="text-sm font-medium">HubSpot</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">CRM System</div>
            </a>
            
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-center group"
            >
              <div className="text-2xl mb-2 font-bold">PAY</div>
              <div className="text-sm font-medium">Stripe</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Payments</div>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">AI Service</span>
                <span className="text-green-500">Operational</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Database</span>
                <span className="text-green-500">Connected</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">API</span>
                <span className="text-green-500">Online</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Quick Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Your Role</span>
                <span className="text-[var(--text-primary)] capitalize">{user?.role || 'User'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Environment</span>
                <span className="text-[var(--text-primary)]">Production</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Version</span>
                <span className="text-[var(--text-primary)]">1.0.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// Force deployment 1753407431
