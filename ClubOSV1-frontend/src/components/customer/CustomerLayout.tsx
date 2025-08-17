import React from 'react';
import CustomerNavigation from './CustomerNavigation';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 customer-app">
      <CustomerNavigation />
      {/* Main Content - Add padding to account for fixed header and bottom nav */}
      <main className="pt-12 pb-20 lg:pb-0 lg:pt-14">
        {children}
      </main>
    </div>
  );
};

export default CustomerLayout;