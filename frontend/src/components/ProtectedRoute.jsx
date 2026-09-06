import React from 'react';
import { Navigate } from 'react-router-dom';

// Where each role's own dashboard lives — used to redirect someone away
// from a dashboard that isn't theirs, instead of letting the page render
// with the wrong shape of data (the backend answers every API call
// according to the real session role, not whichever page asked).
const ROLE_DASHBOARD = {
  Lawyer: '/dashboard',
  CourtRegistrar: '/RegistrarDashboard',
  Admin: '/AdminDashboard',
  Judge: '/JudgeDashboard',
  // The backend maps the CaseParticipant role to "Client" specifically in
  // the login/signup responses (see auth/routes.py's mapped_role) — that's
  // the value actually stored in localStorage, not the raw DB role name.
  Client: '/ClientDashboard',
};

function ProtectedRoute({ allowedRole, children }) {
  const role = localStorage.getItem('userRole');

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (role !== allowedRole) {
    return <Navigate to={ROLE_DASHBOARD[role] || '/login'} replace />;
  }

  return children;
}

export default ProtectedRoute;
