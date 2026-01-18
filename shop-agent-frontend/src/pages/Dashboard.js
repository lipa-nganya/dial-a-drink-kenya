import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('shopAgentUser');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing user:', e);
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('shopAgentToken');
    localStorage.removeItem('shopAgentUser');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Shop Agent Dashboard</h1>
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="welcome-card">
          <h2>Welcome, {user?.name || 'Shop Agent'}!</h2>
          <p>Mobile: {user?.mobileNumber || 'N/A'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          {/* Inventory Check Card */}
          <div className="info-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory-check')}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 16V8C21 7.45 20.55 7 20 7H19L12 2L5 7H4C3.45 7 3 7.45 3 8V16C3 16.55 3.45 17 4 17H5V20C5 20.55 5.45 21 6 21H8C8.55 21 9 20.55 9 20V17H15V20C15 20.55 15.45 21 16 21H18C18.55 21 19 20.55 19 20V17H20C20.55 17 21 16.55 21 16ZM12 4.5L17.5 8H6.5L12 4.5ZM5 15V9H19V15H5Z" fill="#00E0B8"/>
                </svg>
              </div>
              <h3 style={{ color: '#00E0B8', marginBottom: '10px' }}>Inventory Check</h3>
              <p style={{ color: '#B0B0B0', fontSize: '14px' }}>Submit new inventory counts</p>
            </div>
          </div>

          {/* Inventory Check History Card */}
          <div className="info-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory-check-history')}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="#00E0B8"/>
                  <path d="M7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H14V17H7V15Z" fill="#00E0B8"/>
                </svg>
              </div>
              <h3 style={{ color: '#00E0B8', marginBottom: '10px' }}>Inventory Check History</h3>
              <p style={{ color: '#B0B0B0', fontSize: '14px' }}>View approved and rejected checks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


