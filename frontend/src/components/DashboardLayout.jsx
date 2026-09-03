import React from 'react';

const DashboardLayout = ({ children }) => (
  <div className="d-flex flex-column min-vh-100 bg-light">
    <main className="flex-grow-1">
      {children}
    </main>
  </div>
);

export default DashboardLayout;
