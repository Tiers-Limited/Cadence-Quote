// src/components/LoadingIndicator.jsx
/**
 * Loading Indicator Component
 * **Feature: cadence-quote-builder-update, Task 9.4**
 * **Validates: Requirements 9.5**
 */

import React, { useState, useEffect } from 'react';
import { Progress, Spin, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import loadingService from '../services/loadingService';

const { Text } = Typography;

/**
 * Global Loading Indicator Component
 * Listens to loading service events and displays appropriate indicators
 */
const LoadingIndicator = () => {
  const [activeOperations, setActiveOperations] = useState([]);

  useEffect(() => {
    // Listen to loading service events
    const handleLoadingStart = (event) => {
      const { operationId, message, showProgress } = event.detail;
      setActiveOperations(prev => [
        ...prev.filter(op => op.id !== operationId),
        {
          id: operationId,
          message,
          showProgress,
          progress: 0,
          visible: true
        }
      ]);
    };

    const handleProgressUpdate = (event) => {
      const { operationId, progress, message } = event.detail;
      setActiveOperations(prev => prev.map(op => 
        op.id === operationId 
          ? { ...op, progress, message: message || op.message }
          : op
      ));
    };

    const handleLoadingComplete = (event) => {
      const { operationId } = event.detail;
      setActiveOperations(prev => prev.filter(op => op.id !== operationId));
    };

    const handleLoadingHide = (event) => {
      const { operationId } = event.detail;
      setActiveOperations(prev => prev.filter(op => op.id !== operationId));
    };

    // Add event listeners
    window.addEventListener('loading-loading-start', handleLoadingStart);
    window.addEventListener('loading-progress-update', handleProgressUpdate);
    window.addEventListener('loading-loading-complete', handleLoadingComplete);
    window.addEventListener('loading-loading-hide', handleLoadingHide);

    // Cleanup
    return () => {
      window.removeEventListener('loading-loading-start', handleLoadingStart);
      window.removeEventListener('loading-progress-update', handleProgressUpdate);
      window.removeEventListener('loading-loading-complete', handleLoadingComplete);
      window.removeEventListener('loading-loading-hide', handleLoadingHide);
    };
  }, []);

  if (activeOperations.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      zIndex: 9999,
      background: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      minWidth: '300px',
      maxWidth: '400px'
    }}>
      {activeOperations.map(operation => (
        <div key={operation.id} style={{ marginBottom: activeOperations.length > 1 ? '12px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <Spin 
              indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} 
              style={{ marginRight: '8px' }}
            />
            <Text strong style={{ fontSize: '14px' }}>
              {operation.message}
            </Text>
          </div>
          
          {operation.showProgress && (
            <Progress 
              percent={operation.progress} 
              size="small"
              showInfo={false}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Progress Bar Component for specific operations
 */
export const ProgressIndicator = ({ 
  operationId, 
  title = 'Processing...', 
  showPercentage = true,
  style = {} 
}) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(title);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleProgressStart = (event) => {
      if (event.detail.operationId === operationId) {
        setVisible(true);
        setProgress(0);
        setMessage(event.detail.message || title);
      }
    };

    const handleProgressUpdate = (event) => {
      if (event.detail.operationId === operationId) {
        setProgress(event.detail.progress);
        if (event.detail.message) {
          setMessage(event.detail.message);
        }
      }
    };

    const handleProgressComplete = (event) => {
      if (event.detail.operationId === operationId) {
        setVisible(false);
      }
    };

    window.addEventListener('loading-progress-start', handleProgressStart);
    window.addEventListener('loading-progress-update', handleProgressUpdate);
    window.addEventListener('loading-progress-complete', handleProgressComplete);

    return () => {
      window.removeEventListener('loading-progress-start', handleProgressStart);
      window.removeEventListener('loading-progress-update', handleProgressUpdate);
      window.removeEventListener('loading-progress-complete', handleProgressComplete);
    };
  }, [operationId, title]);

  if (!visible) {
    return null;
  }

  return (
    <div style={{ padding: '16px', ...style }}>
      <Text style={{ display: 'block', marginBottom: '8px' }}>
        {message}
      </Text>
      <Progress 
        percent={progress} 
        showInfo={showPercentage}
        strokeColor={{
          '0%': '#108ee9',
          '100%': '#87d068',
        }}
      />
    </div>
  );
};

export default LoadingIndicator;