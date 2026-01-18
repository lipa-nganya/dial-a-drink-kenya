import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Dashboard.css';

const InventoryCheck = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [countedItems, setCountedItems] = useState([]); // Array of { item, count }
  const [selectedItem, setSelectedItem] = useState(null);
  const [tempCount, setTempCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setSearchResults(filtered.slice(0, 10)); // Limit to 10 results
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, items]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shop-agents/inventory-items');
      if (response.data.success) {
        setItems(response.data.items);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err.response?.data?.error || 'Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setTempCount(0);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleAddToCounted = () => {
    if (!selectedItem || tempCount < 0) return;

    // Check if item already exists in counted items
    const existingIndex = countedItems.findIndex(ci => ci.item.id === selectedItem.id);
    
    if (existingIndex >= 0) {
      // Update existing item count
      const updated = [...countedItems];
      updated[existingIndex] = { ...updated[existingIndex], count: tempCount };
      setCountedItems(updated);
    } else {
      // Add new item
      setCountedItems([...countedItems, { item: selectedItem, count: tempCount }]);
    }

    setSelectedItem(null);
    setTempCount(0);
  };

  const handleRemoveFromCounted = (itemId) => {
    setCountedItems(countedItems.filter(ci => ci.item.id !== itemId));
  };

  const handleCountChange = (itemId, value) => {
    const numValue = parseInt(value) || 0;
    if (numValue < 0) return;
    
    const updated = countedItems.map(ci => 
      ci.item.id === itemId ? { ...ci, count: numValue } : ci
    );
    setCountedItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (countedItems.length === 0) {
      setError('Please add at least one item with a count');
      return;
    }

    // Prepare items array
    const itemsToSubmit = countedItems.map(ci => ({
      drinkId: ci.item.id,
      count: parseInt(ci.count) || 0
    }));

    try {
      setSubmitting(true);
      const response = await api.post('/shop-agents/inventory-check', {
        items: itemsToSubmit
      });

      if (response.data.success) {
        setSuccess(`Inventory check submitted successfully for ${response.data.results.length} item(s)`);
        // Clear counted items after successful submission
        setTimeout(() => {
          setCountedItems([]);
          setSuccess('');
        }, 3000);
      } else {
        setError(response.data.error || 'Failed to submit inventory check');
      }
    } catch (err) {
      console.error('Error submitting inventory check:', err);
      setError(err.response?.data?.error || 'Failed to submit inventory check');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading inventory items...</div>
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
          <h1>Inventory Check</h1>
        </div>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '20px', padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" style={{ margin: '20px', padding: '15px', background: '#efe', border: '1px solid #cfc', borderRadius: '4px', color: '#060' }}>
          {success}
        </div>
      )}

      <div className="dashboard-content">
        <div className="info-card" style={{ marginBottom: '20px' }}>
          <h3>Instructions</h3>
          <p>Search for items, enter the count, and add them to your list. Submit when done.</p>
        </div>

        {/* Search Section */}
        <div style={{ marginBottom: '30px' }}>
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #333',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a',
              color: '#F5F5F5'
            }}
          />
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div style={{
              marginTop: '8px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '4px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {searchResults.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleItemSelect(item)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #333',
                    cursor: 'pointer',
                    color: '#F5F5F5',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#2a2a2a'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontSize: '14px', color: '#B0B0B0' }}>
                    {item.category?.name || 'No category'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Item Count Input */}
        {selectedItem && (
          <div className="info-card" style={{ marginBottom: '20px', backgroundColor: '#1a1a1a' }}>
            <h3 style={{ color: '#00E0B8', marginBottom: '15px' }}>Enter Count for: {selectedItem.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
              <button
                type="button"
                onClick={() => setTempCount(Math.max(0, tempCount - 1))}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  backgroundColor: '#121212',
                  color: '#F5F5F5',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                −
              </button>
              <input
                type="number"
                min="0"
                value={tempCount}
                onChange={(e) => setTempCount(Math.max(0, parseInt(e.target.value) || 0))}
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
                onClick={() => setTempCount(tempCount + 1)}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  backgroundColor: '#121212',
                  color: '#F5F5F5',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                +
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleAddToCounted}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Add to List
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedItem(null);
                  setTempCount(0);
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
        )}

        {/* Counted Items List */}
        {countedItems.length > 0 && (
          <form onSubmit={handleSubmit}>
            <div className="info-card" style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#00E0B8', marginBottom: '15px' }}>
                Counted Items ({countedItems.length})
              </h3>
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#121212', color: '#F5F5F5' }}>
                  <thead>
                    <tr style={{ background: '#1a1a1a', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold', width: '25%' }}>Item Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Category</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold' }}>Count</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #333', color: '#00E0B8', fontWeight: 'bold', width: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countedItems.map(ci => (
                      <tr key={ci.item.id} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '12px', color: '#F5F5F5', width: '25%', wordWrap: 'break-word', overflowWrap: 'break-word', maxWidth: '200px' }}>
                          {ci.item.name}
                        </td>
                        <td style={{ padding: '12px', color: '#B0B0B0' }}>
                          {ci.item.category?.name || 'N/A'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleCountChange(ci.item.id, Math.max(0, ci.count - 1))}
                              style={{
                                width: '32px',
                                height: '32px',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                backgroundColor: '#1a1a1a',
                                color: '#F5F5F5',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={ci.count}
                              onChange={(e) => handleCountChange(ci.item.id, e.target.value)}
                              style={{
                                width: '70px',
                                padding: '6px',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                textAlign: 'center',
                                backgroundColor: '#1a1a1a',
                                color: '#F5F5F5',
                                fontSize: '16px'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCountChange(ci.item.id, ci.count + 1)}
                              style={{
                                width: '32px',
                                height: '32px',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                backgroundColor: '#1a1a1a',
                                color: '#F5F5F5',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCounted(ci.item.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#FF3366',
                              color: '#FFF',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              {submitting ? 'Submitting...' : `Submit Inventory Check (${countedItems.length} items)`}
            </button>
          </form>
        )}

        {countedItems.length === 0 && !selectedItem && (
          <div className="info-card" style={{ textAlign: 'center', padding: '40px', color: '#B0B0B0' }}>
            <p>No items added yet. Search for items above to start counting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryCheck;
