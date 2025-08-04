import Head from 'next/head';
import TicketCenterOptimized from '@/components/TicketCenterOptimized';

export default function TicketCenter() {
  return (
    <>
      <Head>
        <title>ClubOS - Ticket Center</title>
        <meta name="description" content="Manage facilities and technical support tickets" />
      </Head>
      
      <div className="min-h-screen bg-[var(--bg-primary)] pb-12">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Header Section */}
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              Ticket Center
            </h1>
            <p className="text-[var(--text-secondary)] text-sm font-light max-w-3xl">
              View and manage all facilities and technical support tickets
            </p>
          </div>

          {/* Main Content */}
          <TicketCenterOptimized />
        </div>
      </div>
    </>
  );
}
