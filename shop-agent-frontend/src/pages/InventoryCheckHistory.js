import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Dashboard.css';

const InventoryCheckHistory = () => {
  const navigate = useNavigate();
  const [checks, setChecks] = useState([]);
  const [approvedChecks, setApprovedChecks] = useState([]);
  const [rejectedChecks, setRejectedChecks] = useState([]);
  const [activeTab, setActiveTab] = useState('approved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recountingItem, setRecountingItem] = useState(null);
  const [recountCount, setRecountCount] = useState(0);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const approved = checks.filter(c => c.status === 'approved');
    const rejected = checks.filter(c => c.status === 'recount_requested');
    setApprovedChecks(approved);
    setRejectedChecks(rejected);
  }, [checks]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shop-agents/inventory-check-history');
      if (response.data.success) {
        setChecks(response.data.checks);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.response?.data?.error || 'Failed to load inventory check history');
    } finally {
      setLoading(false);
    }
  };

  const handleRecount = (check) => {
    setRecountingItem(check);
    setRecountCount(check.agentCount);
  };

  const handleSubmitRecount = async () => {
    if (!recountingItem || recountCount < 0) return;

    try {
      setError('');
      const response = await api.post('/shop-agents/inventory-check', {
        items: [{
          drinkId: recountingItem.drink.id,
          count: recountCount
        }]
      });

      if (response.data.success) {
        setRecountingItem(null);
        setRecountCount(0);
        fetchHistory(); // Refresh the list
      } else {
        setError(response.data.error || 'Failed to submit recount');
      }
    } catch (err) {
      console.error('Error submitting recount:', err);
      setError(err.response?.data?.error || 'Failed to submit recount');
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00E0B8'
            }}
            title="Back to Dashboard"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="currentColor"/>
            </svg>
          </button>
          <h1>Inventory Check History</h1>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '20px', padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      <div className="dashboard-content">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #333' }}>
          <button
            onClick={() => setActiveTab('approved')}
            style={{
              padding: '12px 24px',
              backgroundColor: activeTab === 'approved' ? '#00E0B8' : 'transparent',
              color: activeTab === 'approved' ? '#0D0D0D' : '#F5F5F5',
              border: 'none',
              borderBottom: activeTab === 'approved' ? '2px solid #00E0B8' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === 'approved' ? 'bold' : 'normal'
            }}
          >
            Approved ({approvedChecks.length})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            style={{
              padding: '12px 24px',
              backgroundColor: activeTab === 'rejected' ? '#FF3366' : 'transparent',
              color: activeTab === 'rejected' ? '#FFF' : '#F5F5F5',
              border: 'none',
              borderBottom: activeTab === 'rejected' ? '2px solid #FF3366' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: activeTab === 'rejected' ? 'bold' : 'normal'
            }}
          >
            Rejected ({rejectedChecks.length})
          </button>
        </div>

        {/* Approved Tab */}
        {activeTab === 'approved' && (
          <div className="info-card">
            {approvedChecks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#B0B0B0' }}>
                <p>No approved inventory checks yet.</p>
              </div>
            ) : (
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#121212', color: '#F5F5F5' }}>
                  <thead>
                    <tr style={{ background: '#1a1a1a', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Item Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Category</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Your Count</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Database Count</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedChecks.map(check => (
                      <tr key={check.id} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '12px', color: '#F5F5F5' }}>{check.drink?.name || 'Unknown'}</td>
                        <td style={{ padding: '12px', color: '#B0B0B0' }}>{check.drink?.category?.name || 'N/A'}</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#F5F5F5', fontWeight: 'bold' }}>{check.agentCount}</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#B0B0B0' }}>{check.databaseCount}</td>
                        <td style={{ padding: '12px', color: '#B0B0B0' }}>
                          {new Date(check.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rejected Tab */}
        {activeTab === 'rejected' && (
          <div className="info-card">
            {rejectedChecks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#B0B0B0' }}>
                <p>No rejected inventory checks. All your counts have been approved!</p>
              </div>
            ) : (
              <>
                {recountingItem ? (
                  <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px' }}>
                    <h3 style={{ color: '#00E0B8', marginBottom: '15px' }}>
                      Recount: {recountingItem.drink?.name}
                    </h3>
                    <p style={{ color: '#B0B0B0', marginBottom: '15px' }}>
                      Previous count: {recountingItem.agentCount} | Database count: {recountingItem.databaseCount}
                    </p>
                    {recountingItem.notes && (
                      <p style={{ color: '#FF3366', marginBottom: '15px', fontStyle: 'italic' }}>
                        Admin notes: {recountingItem.notes}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                      <button
                        type="button"
                        onClick={() => setRecountCount(Math.max(0, recountCount - 1))}
                        style={{
                          width: '40px',
                          height: '40px',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          backgroundColor: '#121212',
                          color: '#F5F5F5',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={recountCount}
                        onChange={(e) => setRecountCount(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{
                          width: '100px',
                          padding: '10px',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          textAlign: 'center',
                          backgroundColor: '#121212',
                          color: '#F5F5F5',
                          fontSize: '18px'
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setRecountCount(recountCount + 1)}
                        style={{
                          width: '40px',
                          height: '40px',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          backgroundColor: '#121212',
                          color: '#F5F5F5',
                          fontSize: '24px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={handleSubmitRecount}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          padding: '12px',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
                      >
                        Submit Recount
                      </button>
                      <button
                        onClick={() => {
                          setRecountingItem(null);
                          setRecountCount(0);
                        }}
                        style={{
                          flex: 1,
                          padding: '12px',
                          fontSize: '16px',
                          backgroundColor: '#333',
                          color: '#F5F5F5',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
                <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#121212', color: '#F5F5F5' }}>
                    <thead>
                      <tr style={{ background: '#1a1a1a', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#FF3366', fontWeight: 'bold' }}>Item Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#FF3366', fontWeight: 'bold' }}>Category</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #333', color: '#FF3366', fontWeight: 'bold' }}>Your Count</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #333', color: '#FF3366', fontWeight: 'bold' }}>Database Count</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#FF3366', fontWeight: 'bold' }}>Date</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #333', color: '#FF3366', fontWeight: 'bold' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rejectedChecks.map(check => (
                        <tr key={check.id} style={{ borderBottom: '1px solid #333' }}>
                          <td style={{ padding: '12px', color: '#F5F5F5' }}>{check.drink?.name || 'Unknown'}</td>
                          <td style={{ padding: '12px', color: '#B0B0B0' }}>{check.drink?.category?.name || 'N/A'}</td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#F5F5F5', fontWeight: 'bold' }}>{check.agentCount}</td>
                          <td style={{ padding: '12px', textAlign: 'center', color: '#B0B0B0' }}>{check.databaseCount}</td>
                          <td style={{ padding: '12px', color: '#B0B0B0' }}>
                            {new Date(check.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleRecount(check)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#00E0B8',
                                color: '#0D0D0D',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold'
                              }}
                            >
                              Recount
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryCheckHistory;
