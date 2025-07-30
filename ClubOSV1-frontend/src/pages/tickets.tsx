import Head from 'next/head';
import TicketCenterOptimized from '@/components/TicketCenterOptimized';

export default function TicketCenter() {
  return (
    <>
      <Head>
        <title>ClubOS - Ticket Center</title>
        <meta name="description" content="Manage facilities and technical support tickets" />
      </Head>
      
      <TicketCenterOptimized />
    </>
  );
}
