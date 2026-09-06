import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RegistrarDashboard from './pages/RegistrarDashboard.jsx'; // Import your layout
import AdminDashboard from './pages/AdminDashboard.jsx';
import JudgeDashboard from './pages/JudgeDashboard.jsx';
import CompleteProfile from './pages/CompleteProfile.jsx';
import CaseHistory from './pages/CaseHistory.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import JudgeProfile from './pages/JudgeProfile.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import VerifyOTP from './pages/VerifyOTP.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
    
        <Route path="/CompleteProfile" element={<CompleteProfile />} />
        
        {/* Dashboard and Profile routes with layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="Lawyer">
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRole="Lawyer">
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/RegistrarDashboard" element={<ProtectedRoute allowedRole="CourtRegistrar"><RegistrarDashboard /></ProtectedRoute>} />
        <Route path="/AdminDashboard" element={<ProtectedRoute allowedRole="Admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/JudgeDashboard" element={<ProtectedRoute allowedRole="Judge"><JudgeDashboard /></ProtectedRoute>} />
        <Route path="/case-history/:caseId" element={<DashboardLayout><CaseHistory /></DashboardLayout>} />
        <Route path="/ClientDashboard" element={<ProtectedRoute allowedRole="Client"><ClientDashboard /></ProtectedRoute>} />
        <Route
          path="/judge-profile"
          element={
            <ProtectedRoute allowedRole="Judge">
              <DashboardLayout>
                <JudgeProfile />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Optional: 404 fallback */}
        {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
