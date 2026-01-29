// services/dataRecoveryService.js
/**
 * Data Recovery Service for Quote Builder
 * **Feature: cadence-quote-builder-update, Task 7.4**
 * **Validates: Requirements 6.5**
 */

const { Quote } = require('../models');
const { Op } = require('sequelize');

/**
 * Data Recovery Service
 * Handles session recovery, data backup, and conflict resolution
 */
class DataRecoveryService {
  constructor() {
    this.recoveryTimeout = 30 * 60 * 1000; // 30 minutes
    this.maxBackupAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Create a recovery checkpoint for a quote
   * @param {object} quoteData - Quote data to backup
   * @param {string} sessionId - User session ID
   * @param {number} userId - User ID
   * @returns {object} - Recovery checkpoint info
   */
  async createRecoveryCheckpoint(quoteData, sessionId, userId) {
    try {
      const checkpoint = {
        sessionId,
        userId,
        quoteId: quoteData.id,
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(quoteData)), // Deep copy
        version: quoteData.autoSaveVersion || 1,
        checkpointType: 'auto_save'
      };

      // Store in memory cache or Redis if available
      const checkpointKey = `recovery:${sessionId}:${quoteData.id}`;
      
      // For now, we'll use a simple in-memory storage
      // In production, this should use Redis or similar persistent storage
      if (!global.recoveryCheckpoints) {
        global.recoveryCheckpoints = new Map();
      }
      
      global.recoveryCheckpoints.set(checkpointKey, checkpoint);
      
      // Clean up old checkpoints
      this.cleanupOldCheckpoints();
      
      return {
        success: true,
        checkpointId: checkpointKey,
        timestamp: checkpoint.timestamp,
        version: checkpoint.version
      };
    } catch (error) {
      console.error('Error creating recovery checkpoint:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve recovery data for a session
   * @param {string} sessionId - User session ID
   * @param {number} quoteId - Quote ID (optional)
   * @returns {array} - Available recovery checkpoints
   */
  async getRecoveryData(sessionId, quoteId = null) {
    try {
      if (!global.recoveryCheckpoints) {
        return [];
      }

      const recoveryData = [];
      const searchPattern = quoteId ? `recovery:${sessionId}:${quoteId}` : `recovery:${sessionId}:`;
      
      for (const [key, checkpoint] of global.recoveryCheckpoints.entries()) {
        if (key.startsWith(searchPattern)) {
          // Check if checkpoint is still valid (not too old)
          const checkpointAge = Date.now() - new Date(checkpoint.timestamp).getTime();
          if (checkpointAge <= this.maxBackupAge) {
            recoveryData.push({
              checkpointId: key,
              quoteId: checkpoint.quoteId,
              timestamp: checkpoint.timestamp,
              version: checkpoint.version,
              checkpointType: checkpoint.checkpointType,
              age: checkpointAge
            });
          }
        }
      }

      // Sort by timestamp (newest first)
      recoveryData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return recoveryData;
    } catch (error) {
      console.error('Error retrieving recovery data:', error);
      return [];
    }
  }

  /**
   * Restore quote data from a recovery checkpoint
   * @param {string} checkpointId - Checkpoint ID
   * @param {number} userId - User ID for security check
   * @returns {object} - Restored quote data
   */
  async restoreFromCheckpoint(checkpointId, userId) {
    try {
      if (!global.recoveryCheckpoints || !global.recoveryCheckpoints.has(checkpointId)) {
        throw new Error('Recovery checkpoint not found');
      }

      const checkpoint = global.recoveryCheckpoints.get(checkpointId);
      
      // Security check - ensure user owns this checkpoint
      if (checkpoint.userId !== userId) {
        throw new Error('Unauthorized access to recovery checkpoint');
      }

      // Check if checkpoint is still valid
      const checkpointAge = Date.now() - new Date(checkpoint.timestamp).getTime();
      if (checkpointAge > this.maxBackupAge) {
        throw new Error('Recovery checkpoint has expired');
      }

      return {
        success: true,
        data: checkpoint.data,
        timestamp: checkpoint.timestamp,
        version: checkpoint.version,
        restoredAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error restoring from checkpoint:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect and resolve conflicts between local and server data
   * @param {object} localData - Local quote data
   * @param {object} serverData - Server quote data
   * @returns {object} - Conflict resolution result
   */
  async detectAndResolveConflicts(localData, serverData) {
    try {
      const conflicts = [];
      const resolution = {
        hasConflicts: false,
        conflicts: [],
        suggestedResolution: 'no_conflict',
        mergedData: null
      };

      // Check version conflicts
      if (localData.autoSaveVersion !== serverData.autoSaveVersion) {
        conflicts.push({
          field: 'version',
          type: 'version_mismatch',
          localValue: localData.autoSaveVersion,
          serverValue: serverData.autoSaveVersion,
          description: 'Quote has been modified by another user'
        });
      }

      // Check timestamp conflicts
      const localModified = new Date(localData.lastModified || localData.updatedAt);
      const serverModified = new Date(serverData.lastModified || serverData.updatedAt);
      
      if (Math.abs(localModified.getTime() - serverModified.getTime()) > 60000) { // 1 minute threshold
        conflicts.push({
          field: 'lastModified',
          type: 'timestamp_mismatch',
          localValue: localModified.toISOString(),
          serverValue: serverModified.toISOString(),
          description: 'Quote modification times differ significantly'
        });
      }

      // Check critical field conflicts
      const criticalFields = ['customerName', 'customerEmail', 'homeSqft', 'pricingSchemeId'];
      for (const field of criticalFields) {
        if (localData[field] !== serverData[field]) {
          conflicts.push({
            field,
            type: 'data_mismatch',
            localValue: localData[field],
            serverValue: serverData[field],
            description: `${field} values differ between local and server`
          });
        }
      }

      // Check complex object conflicts (areas, flatRateItems, productSets)
      const complexFields = ['areas', 'flatRateItems', 'productSets'];
      for (const field of complexFields) {
        const localJson = JSON.stringify(localData[field] || {});
        const serverJson = JSON.stringify(serverData[field] || {});
        
        if (localJson !== serverJson) {
          conflicts.push({
            field,
            type: 'complex_data_mismatch',
            localValue: localData[field],
            serverValue: serverData[field],
            description: `${field} structure differs between local and server`
          });
        }
      }

      if (conflicts.length > 0) {
        resolution.hasConflicts = true;
        resolution.conflicts = conflicts;
        
        // Determine suggested resolution strategy
        if (conflicts.some(c => c.type === 'version_mismatch')) {
          resolution.suggestedResolution = 'manual_review';
        } else if (localModified > serverModified) {
          resolution.suggestedResolution = 'use_local';
        } else {
          resolution.suggestedResolution = 'use_server';
        }

        // Create merged data based on resolution strategy
        resolution.mergedData = this.createMergedData(localData, serverData, resolution.suggestedResolution);
      } else {
        resolution.mergedData = serverData; // No conflicts, use server data
      }

      return resolution;
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return {
        hasConflicts: true,
        conflicts: [{
          field: 'system',
          type: 'error',
          description: `Conflict detection failed: ${error.message}`
        }],
        suggestedResolution: 'manual_review',
        mergedData: null
      };
    }
  }

  /**
   * Create merged data based on resolution strategy
   * @param {object} localData - Local quote data
   * @param {object} serverData - Server quote data
   * @param {string} strategy - Resolution strategy
   * @returns {object} - Merged quote data
   */
  createMergedData(localData, serverData, strategy) {
    switch (strategy) {
      case 'use_local':
        return {
          ...localData,
          autoSaveVersion: Math.max(localData.autoSaveVersion || 1, serverData.autoSaveVersion || 1) + 1,
          lastModified: new Date().toISOString()
        };
        
      case 'use_server':
        return serverData;
        
      case 'manual_review':
      default:
        // Create a base merge with server data and local timestamps
        return {
          ...serverData,
          _conflictData: {
            local: localData,
            server: serverData,
            requiresManualReview: true,
            mergedAt: new Date().toISOString()
          }
        };
    }
  }

  /**
   * Clean up old recovery checkpoints
   */
  cleanupOldCheckpoints() {
    if (!global.recoveryCheckpoints) return;

    const now = Date.now();
    const keysToDelete = [];

    for (const [key, checkpoint] of global.recoveryCheckpoints.entries()) {
      const checkpointAge = now - new Date(checkpoint.timestamp).getTime();
      if (checkpointAge > this.maxBackupAge) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => global.recoveryCheckpoints.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired recovery checkpoints`);
    }
  }

  /**
   * Get recovery statistics
   * @param {number} userId - User ID
   * @returns {object} - Recovery statistics
   */
  async getRecoveryStats(userId) {
    try {
      if (!global.recoveryCheckpoints) {
        return {
          totalCheckpoints: 0,
          userCheckpoints: 0,
          oldestCheckpoint: null,
          newestCheckpoint: null
        };
      }

      let totalCheckpoints = 0;
      let userCheckpoints = 0;
      let oldestTimestamp = null;
      let newestTimestamp = null;

      for (const [key, checkpoint] of global.recoveryCheckpoints.entries()) {
        totalCheckpoints++;
        
        if (checkpoint.userId === userId) {
          userCheckpoints++;
        }

        const timestamp = new Date(checkpoint.timestamp);
        if (!oldestTimestamp || timestamp < oldestTimestamp) {
          oldestTimestamp = timestamp;
        }
        if (!newestTimestamp || timestamp > newestTimestamp) {
          newestTimestamp = timestamp;
        }
      }

      return {
        totalCheckpoints,
        userCheckpoints,
        oldestCheckpoint: oldestTimestamp ? oldestTimestamp.toISOString() : null,
        newestCheckpoint: newestTimestamp ? newestTimestamp.toISOString() : null
      };
    } catch (error) {
      console.error('Error getting recovery stats:', error);
      return {
        totalCheckpoints: 0,
        userCheckpoints: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const dataRecoveryService = new DataRecoveryService();

module.exports = dataRecoveryService;