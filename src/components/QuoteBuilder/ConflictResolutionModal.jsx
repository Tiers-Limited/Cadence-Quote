// components/QuoteBuilder/ConflictResolutionModal.jsx
/**
 * Conflict Resolution Modal for Quote Builder
 * **Feature: cadence-quote-builder-update, Task 7.4**
 * **Validates: Requirements 6.5**
 */

import React, { useState, useEffect } from 'react';
import './ConflictResolutionModal.css';

const ConflictResolutionModal = ({ 
  isOpen, 
  onClose, 
  conflicts, 
  localData, 
  serverData, 
  suggestedResolution,
  onResolve 
}) => {
  const [selectedResolution, setSelectedResolution] = useState(suggestedResolution || 'manual_review');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedConflicts, setSelectedConflicts] = useState(new Set());

  useEffect(() => {
    if (suggestedResolution) {
      setSelectedResolution(suggestedResolution);
    }
  }, [suggestedResolution]);

  if (!isOpen) return null;

  const handleResolve = () => {
    onResolve(selectedResolution, Array.from(selectedConflicts));
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getConflictSeverity = (conflict) => {
    if (conflict.type === 'version_mismatch') return 'high';
    if (conflict.type === 'data_mismatch' && ['customerName', 'customerEmail'].includes(conflict.field)) return 'high';
    if (conflict.type === 'complex_data_mismatch') return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#dc3545';
      case 'medium': return '#fd7e14';
      case 'low': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const resolutionOptions = [
    {
      value: 'use_local',
      label: 'Use My Changes',
      description: 'Keep your local changes and overwrite server data',
      icon: '💻'
    },
    {
      value: 'use_server',
      label: 'Use Server Version',
      description: 'Discard your changes and use the server version',
      icon: '☁️'
    },
    {
      value: 'manual_review',
      label: 'Manual Review',
      description: 'Review each conflict individually and choose',
      icon: '👁️'
    }
  ];

  return (
    <div className="conflict-resolution-overlay">
      <div className="conflict-resolution-modal">
        <div className="modal-header">
          <h2>🔄 Resolve Data Conflicts</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="conflict-summary">
            <div className="alert alert-warning">
              <strong>⚠️ Conflicts Detected</strong>
              <p>
                Your quote has been modified by another user or session. 
                We found {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} that need resolution.
              </p>
            </div>
          </div>

          <div className="resolution-options">
            <h3>Choose Resolution Strategy</h3>
            <div className="resolution-grid">
              {resolutionOptions.map(option => (
                <div 
                  key={option.value}
                  className={`resolution-option ${selectedResolution === option.value ? 'selected' : ''}`}
                  onClick={() => setSelectedResolution(option.value)}
                >
                  <div className="option-icon">{option.icon}</div>
                  <div className="option-content">
                    <h4>{option.label}</h4>
                    <p>{option.description}</p>
                  </div>
                  <input 
                    type="radio" 
                    name="resolution" 
                    value={option.value}
                    checked={selectedResolution === option.value}
                    onChange={() => setSelectedResolution(option.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="conflicts-list">
            <div className="conflicts-header">
              <h3>Conflicts ({conflicts.length})</h3>
              <button 
                className="toggle-details"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            <div className="conflicts-container">
              {conflicts.map((conflict, index) => {
                const severity = getConflictSeverity(conflict);
                const severityColor = getSeverityColor(severity);
                
                return (
                  <div key={index} className="conflict-item">
                    <div className="conflict-header">
                      <div className="conflict-info">
                        <span 
                          className="severity-badge"
                          style={{ backgroundColor: severityColor }}
                        >
                          {severity.toUpperCase()}
                        </span>
                        <strong>{conflict.field}</strong>
                        <span className="conflict-type">({conflict.type.replace('_', ' ')})</span>
                      </div>
                      {selectedResolution === 'manual_review' && (
                        <input
                          type="checkbox"
                          checked={selectedConflicts.has(index)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedConflicts);
                            if (e.target.checked) {
                              newSelected.add(index);
                            } else {
                              newSelected.delete(index);
                            }
                            setSelectedConflicts(newSelected);
                          }}
                        />
                      )}
                    </div>
                    
                    <p className="conflict-description">{conflict.description}</p>
                    
                    {showDetails && (
                      <div className="conflict-details">
                        <div className="value-comparison">
                          <div className="value-section">
                            <h5>Your Version (Local)</h5>
                            <pre className="value-display local">
                              {formatValue(conflict.localValue)}
                            </pre>
                          </div>
                          <div className="value-section">
                            <h5>Server Version</h5>
                            <pre className="value-display server">
                              {formatValue(conflict.serverValue)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedResolution === 'manual_review' && (
            <div className="manual-review-info">
              <div className="alert alert-info">
                <strong>ℹ️ Manual Review Mode</strong>
                <p>
                  Select the conflicts you want to resolve with your local changes. 
                  Unselected conflicts will use the server version.
                </p>
                <p>
                  <strong>Selected:</strong> {selectedConflicts.size} of {conflicts.length} conflicts
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleResolve}
            disabled={selectedResolution === 'manual_review' && selectedConflicts.size === 0}
          >
            Resolve Conflicts
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolutionModal;