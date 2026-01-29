// hooks/useDataRecovery.js
/**
 * Data Recovery Hook for Quote Builder
 * **Feature: cadence-quote-builder-update, Task 7.4**
 * **Validates: Requirements 6.5**
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useDataRecovery = (quoteId, sessionId) => {
  const [recoveryData, setRecoveryData] = useState([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  
  const backupIntervalRef = useRef(null);
  const lastDataRef = useRef(null);

  // Configuration
  const BACKUP_INTERVAL = 30000; // 30 seconds
  const MAX_BACKUPS = 10;
  const BACKUP_KEY_PREFIX = 'quote_backup_';
  const SESSION_KEY_PREFIX = 'session_recovery_';

  /**
   * Generate storage keys
   */
  const getBackupKey = useCallback((timestamp) => {
    return `${BACKUP_KEY_PREFIX}${quoteId}_${timestamp}`;
  }, [quoteId]);

  const getSessionKey = useCallback(() => {
    return `${SESSION_KEY_PREFIX}${sessionId}`;
  }, [sessionId]);

  /**
   * Save data to local storage
   */
  const saveToLocalStorage = useCallback((data, isAutoSave = false) => {
    try {
      const timestamp = Date.now();
      const backupData = {
        quoteId,
        sessionId,
        timestamp,
        data: JSON.parse(JSON.stringify(data)), // Deep copy
        version: data.autoSaveVersion || 1,
        isAutoSave,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Save current backup
      const backupKey = getBackupKey(timestamp);
      localStorage.setItem(backupKey, JSON.stringify(backupData));

      // Update session recovery data
      const sessionKey = getSessionKey();
      localStorage.setItem(sessionKey, JSON.stringify({
        latestBackup: backupKey,
        timestamp,
        quoteId,
        sessionId
      }));

      // Clean up old backups
      cleanupOldBackups();

      setLastBackup({
        timestamp,
        isAutoSave,
        key: backupKey
      });

      console.log(`Data backup saved: ${backupKey}`);
      return true;
    } catch (error) {
      console.error('Failed to save backup to local storage:', error);
      return false;
    }
  }, [quoteId, sessionId, getBackupKey, getSessionKey]);

  /**
   * Load data from local storage
   */
  const loadFromLocalStorage = useCallback((backupKey) => {
    try {
      const backupData = localStorage.getItem(backupKey);
      if (!backupData) {
        throw new Error('Backup not found');
      }

      const parsed = JSON.parse(backupData);
      return {
        success: true,
        data: parsed.data,
        timestamp: parsed.timestamp,
        version: parsed.version,
        isAutoSave: parsed.isAutoSave
      };
    } catch (error) {
      console.error('Failed to load backup from local storage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  /**
   * Get all available backups for current quote
   */
  const getAvailableBackups = useCallback(() => {
    try {
      const backups = [];
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith(`${BACKUP_KEY_PREFIX}${quoteId}_`)) {
          try {
            const backupData = JSON.parse(localStorage.getItem(key));
            backups.push({
              key,
              timestamp: backupData.timestamp,
              version: backupData.version,
              isAutoSave: backupData.isAutoSave,
              age: Date.now() - backupData.timestamp,
              size: JSON.stringify(backupData.data).length
            });
          } catch (error) {
            console.warn(`Invalid backup data for key: ${key}`);
          }
        }
      });

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp - a.timestamp);
      
      return backups;
    } catch (error) {
      console.error('Failed to get available backups:', error);
      return [];
    }
  }, [quoteId]);

  /**
   * Clean up old backups
   */
  const cleanupOldBackups = useCallback(() => {
    try {
      const backups = getAvailableBackups();
      
      // Remove backups beyond the limit
      if (backups.length > MAX_BACKUPS) {
        const toRemove = backups.slice(MAX_BACKUPS);
        toRemove.forEach(backup => {
          localStorage.removeItem(backup.key);
        });
        console.log(`Cleaned up ${toRemove.length} old backups`);
      }

      // Remove backups older than 24 hours
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const expiredBackups = backups.filter(backup => backup.timestamp < oneDayAgo);
      expiredBackups.forEach(backup => {
        localStorage.removeItem(backup.key);
      });
      
      if (expiredBackups.length > 0) {
        console.log(`Cleaned up ${expiredBackups.length} expired backups`);
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }, [getAvailableBackups]);

  /**
   * Check for session recovery data
   */
  const checkForSessionRecovery = useCallback(async () => {
    try {
      const sessionKey = getSessionKey();
      const sessionData = localStorage.getItem(sessionKey);
      
      if (!sessionData) {
        return null;
      }

      const parsed = JSON.parse(sessionData);
      const backupResult = loadFromLocalStorage(parsed.latestBackup);
      
      if (backupResult.success) {
        return {
          hasRecoveryData: true,
          timestamp: backupResult.timestamp,
          version: backupResult.version,
          data: backupResult.data,
          age: Date.now() - backupResult.timestamp,
          backupKey: parsed.latestBackup
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to check for session recovery:', error);
      return null;
    }
  }, [getSessionKey, loadFromLocalStorage]);

  /**
   * Start automatic backup
   */
  const startAutoBackup = useCallback((getData) => {
    if (backupIntervalRef.current) {
      clearInterval(backupIntervalRef.current);
    }

    backupIntervalRef.current = setInterval(() => {
      const currentData = getData();
      
      // Only backup if data has changed
      if (currentData && JSON.stringify(currentData) !== JSON.stringify(lastDataRef.current)) {
        saveToLocalStorage(currentData, true);
        lastDataRef.current = currentData;
        setHasUnsavedChanges(true);
      }
    }, BACKUP_INTERVAL);

    console.log('Auto backup started');
  }, [saveToLocalStorage]);

  /**
   * Stop automatic backup
   */
  const stopAutoBackup = useCallback(() => {
    if (backupIntervalRef.current) {
      clearInterval(backupIntervalRef.current);
      backupIntervalRef.current = null;
      console.log('Auto backup stopped');
    }
  }, []);

  /**
   * Manual backup
   */
  const createManualBackup = useCallback((data) => {
    const success = saveToLocalStorage(data, false);
    if (success) {
      setHasUnsavedChanges(false);
    }
    return success;
  }, [saveToLocalStorage]);

  /**
   * Restore from backup
   */
  const restoreFromBackup = useCallback(async (backupKey) => {
    setIsRecovering(true);
    
    try {
      const result = loadFromLocalStorage(backupKey);
      
      if (result.success) {
        setHasUnsavedChanges(false);
        return {
          success: true,
          data: result.data,
          timestamp: result.timestamp,
          version: result.version
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsRecovering(false);
    }
  }, [loadFromLocalStorage]);

  /**
   * Clear all recovery data
   */
  const clearRecoveryData = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      let cleared = 0;
      
      keys.forEach(key => {
        if (key.startsWith(`${BACKUP_KEY_PREFIX}${quoteId}_`) || 
            key === getSessionKey()) {
          localStorage.removeItem(key);
          cleared++;
        }
      });
      
      setRecoveryData([]);
      setLastBackup(null);
      setHasUnsavedChanges(false);
      
      console.log(`Cleared ${cleared} recovery items`);
      return true;
    } catch (error) {
      console.error('Failed to clear recovery data:', error);
      return false;
    }
  }, [quoteId, getSessionKey]);

  /**
   * Get recovery statistics
   */
  const getRecoveryStats = useCallback(() => {
    const backups = getAvailableBackups();
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    
    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      autoBackups: backups.filter(b => b.isAutoSave).length,
      manualBackups: backups.filter(b => !b.isAutoSave).length
    };
  }, [getAvailableBackups]);

  // Load available recovery data on mount
  useEffect(() => {
    const backups = getAvailableBackups();
    setRecoveryData(backups);
  }, [getAvailableBackups]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoBackup();
    };
  }, [stopAutoBackup]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return {
    // State
    recoveryData,
    isRecovering,
    hasUnsavedChanges,
    lastBackup,
    
    // Methods
    startAutoBackup,
    stopAutoBackup,
    createManualBackup,
    restoreFromBackup,
    checkForSessionRecovery,
    clearRecoveryData,
    getRecoveryStats,
    getAvailableBackups,
    
    // Utilities
    setHasUnsavedChanges
  };
};

export default useDataRecovery;