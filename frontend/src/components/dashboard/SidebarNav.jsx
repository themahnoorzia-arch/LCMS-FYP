import React from 'react';
import { ListGroup } from 'react-bootstrap';
import { Briefcase, Calendar3, CreditCard2Front, Hammer } from 'react-bootstrap-icons';

const navItems = [
  { view: 'cases', label: 'My Cases', icon: <Briefcase className="me-2" /> },
  { view: 'calendar', label: 'Calendar', icon: <Calendar3 className="me-2" /> },
  { view: 'billing', label: 'Billing', icon: <CreditCard2Front className="me-2" /> },
  { view: 'appeals', label: 'Appeals', icon: <Hammer className="me-2" /> },
  // { view: 'profile', label: 'Profile', icon: <Person className="me-2" /> }, // Optional
];

const SidebarNav = ({ activeView, onViewChange, className = '' }) => {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1ec6b6 0%, #22304a 100%)',
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        boxShadow: '2px 0 16px 0 rgba(34,48,74,0.08)',
        padding: '18px 0 18px 0',
        minHeight: '100vh',
        color: '#fff',
        width: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 20, padding: '0 24px 18px 24px', letterSpacing: 1 }}>
        <i className="bi bi-briefcase" style={{ fontSize: 22, color: '#fff', marginRight: 8 }}></i>
        Lawyer Portal
      </div>
      <ListGroup variant="flush" className={`d-flex flex-column gap-1 ${className}`} style={{ background: 'transparent' }}>
        {navItems.map((item) => (
          <ListGroup.Item
            key={item.view}
            action
            onClick={() => onViewChange(item.view)}
            active={activeView === item.view}
            className={`d-flex align-items-center sidebar-link px-3 py-2 border-0 rounded-2 ${
              activeView === item.view
                ? 'bg-white text-primary fw-bold shadow-sm'
                : 'text-white'
            }`}
            style={{
              background: activeView === item.view ? '#fff' : 'transparent',
              color: activeView === item.view ? '#1ec6b6' : '#fff',
              fontWeight: activeView === item.view ? 700 : 500,
              fontSize: 15,
              borderLeft: activeView === item.view ? '4px solid #1ec6b6' : '4px solid transparent',
              marginBottom: 2,
              transition: 'all 0.18s',
              boxShadow: activeView === item.view ? '0 2px 8px rgba(30,198,182,0.08)' : 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              if (!activeView || activeView !== item.view) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.color = '#1ec6b6';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,198,182,0.12)';
              }
            }}
            onMouseLeave={e => {
              if (!activeView || activeView !== item.view) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {item.icon}
            <span style={{ fontSize: 14 }}>{item.label}</span>
          </ListGroup.Item>
        ))}
        <ListGroup.Item
          action
          onClick={() => onViewChange('evidence')}
          active={activeView === 'evidence'}
          className={`d-flex align-items-center sidebar-link px-3 py-2 border-0 rounded-2 ${
            activeView === 'evidence'
              ? 'bg-white text-primary fw-bold shadow-sm'
              : 'text-white'
          }`}
          style={{
            background: activeView === 'evidence' ? '#fff' : 'transparent',
            color: activeView === 'evidence' ? '#1ec6b6' : '#fff',
            fontWeight: activeView === 'evidence' ? 700 : 500,
            fontSize: 15,
            borderLeft: activeView === 'evidence' ? '4px solid #1ec6b6' : '4px solid transparent',
            marginBottom: 2,
            transition: 'all 0.18s',
            boxShadow: activeView === 'evidence' ? '0 2px 8px rgba(30,198,182,0.08)' : 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            if (!activeView || activeView !== 'evidence') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
              e.currentTarget.style.color = '#1ec6b6';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,198,182,0.12)';
            }
          }}
          onMouseLeave={e => {
            if (!activeView || activeView !== 'evidence') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          Evidence
        </ListGroup.Item>
        <ListGroup.Item
          action
          onClick={() => onViewChange('witnesses')}
          active={activeView === 'witnesses'}
          className={`d-flex align-items-center sidebar-link px-3 py-2 border-0 rounded-2 ${
            activeView === 'witnesses'
              ? 'bg-white text-primary fw-bold shadow-sm'
              : 'text-white'
          }`}
          style={{
            background: activeView === 'witnesses' ? '#fff' : 'transparent',
            color: activeView === 'witnesses' ? '#1ec6b6' : '#fff',
            fontWeight: activeView === 'witnesses' ? 700 : 500,
            fontSize: 15,
            borderLeft: activeView === 'witnesses' ? '4px solid #1ec6b6' : '4px solid transparent',
            marginBottom: 2,
            transition: 'all 0.18s',
            boxShadow: activeView === 'witnesses' ? '0 2px 8px rgba(30,198,182,0.08)' : 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            if (!activeView || activeView !== 'witnesses') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
              e.currentTarget.style.color = '#1ec6b6';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,198,182,0.12)';
            }
          }}
          onMouseLeave={e => {
            if (!activeView || activeView !== 'witnesses') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          Witnesses
        </ListGroup.Item>
      </ListGroup>
    </div>
  );
};

export default SidebarNav;
