import React from 'react';
import CourtRegistrationForm from '../components/CourtRegistrationForm';
import { useNavigate } from 'react-router-dom';

const CourtRegistrationPage = () => {
  const navigate = useNavigate();

  const handleCourtRegistration = async (data) => {
    try {
      const response = await fetch('/api/court', {
        method: 'POST',
        headers: {
          
          'Content-Type': 'application/json',
        },
        
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to register court');
      }

      localStorage.setItem('courtRegistered', 'true');
      navigate('/RegistrarDashboard');
    } catch (error) {
      console.error('Court registration failed:', error);
      alert('Registration failed. Please try again.');
    }
  };

  return (
    <div
      className="signup-bg"
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <CourtRegistrationForm onSubmit={handleCourtRegistration} />
    </div>
  );
};

export default CourtRegistrationPage;
