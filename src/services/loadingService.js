// services/loadingService.js
/**
 * Loading Service for UI Feedback
 * **Feature: cadence-quote-builder-update, Task 9.4**
 * **Validates: Requirements 9.5**
 */

import { message } from 'antd';

/**
 * Loading Service
 * Provides loading indicators and UI feedback for operations > 1 second
 */
class LoadingService {
  constructor() {
    this.activeOperations = new Map();
    this.loadingThreshold = 1000; // 1 second threshold
    this.progressCallbacks = new Map();
  }

  /**
   * Start a loading operation with automatic UI feedback
   * @param {string} operationId - Unique operation identifier
   * @param {string} message - Loading message to display
   * @param {object} options - Loading options
   * @returns {object} - Operation control object
   */
  startOperation(operationId, loadingMessage = 'Loading...', options = {}) {
    const {
      showProgress = false,
      estimatedDuration = null,
      showAfterDelay = true,
      delayMs = this.loadingThreshold
    } = options;

    // Clear any existing operation with the same ID
    this.stopOperation(operationId);

    const operation = {
      id: operationId,
      message: loadingMessage,
      startTime: Date.now(),
      showProgress,
      estimatedDuration,
      isVisible: false,
      timeoutId: null,
      progressValue: 0,
      status: 'starting'
    };

    this.activeOperations.set(operationId, operation);

    // Show loading indicator after delay (for operations > 1 second)
    if (showAfterDelay) {
      operation.timeoutId = setTimeout(() => {
        this.showLoadingIndicator(operation);
      }, delayMs);
    } else {
      this.showLoadingIndicator(operation);
    }

    // Return control object
    return {
      updateProgress: (progress, statusMessage) => this.updateProgress(operationId, progress, statusMessage),
      updateMessage: (newMessage) => this.updateMessage(operationId, newMessage),
      complete: (successMessage) => this.completeOperation(operationId, successMessage),
      error: (errorMessage) => this.errorOperation(operationId, errorMessage),
      cancel: () => this.cancelOperation(operationId)
    };
  }

  /**
   * Show loading indicator for operation
   * @param {object} operation - Operation object
   */
  showLoadingIndicator(operation) {
    if (!operation.isVisible) {
      operation.isVisible = true;
      operation.status = 'loading';

      // Show appropriate loading UI based on operation type
      if (operation.showProgress) {
        this.showProgressIndicator(operation);
      } else {
        this.showSpinnerIndicator(operation);
      }

      // Dispatch custom event for components to listen to
      this.dispatchLoadingEvent('loading-start', {
        operationId: operation.id,
        message: operation.message,
        showProgress: operation.showProgress
      });
    }
  }

  /**
   * Show spinner loading indicator
   * @param {object} operation - Operation object
   */
  showSpinnerIndicator(operation) {
    // Use Ant Design's message loading
    const hide = message.loading(operation.message, 0); // 0 = don't auto-hide
    operation.hideSpinner = hide;
  }

  /**
   * Show progress indicator
   * @param {object} operation - Operation object
   */
  showProgressIndicator(operation) {
    // Dispatch event for progress bar components
    this.dispatchLoadingEvent('progress-start', {
      operationId: operation.id,
      message: operation.message,
      progress: 0,
      estimatedDuration: operation.estimatedDuration
    });
  }

  /**
   * Update operation progress
   * @param {string} operationId - Operation ID
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} statusMessage - Optional status message
   */
  updateProgress(operationId, progress, statusMessage = null) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    operation.progressValue = Math.max(0, Math.min(100, progress));
    
    if (statusMessage) {
      operation.message = statusMessage;
    }

    if (operation.isVisible && operation.showProgress) {
      this.dispatchLoadingEvent('progress-update', {
        operationId,
        progress: operation.progressValue,
        message: operation.message
      });
    }
  }

  /**
   * Update operation message
   * @param {string} operationId - Operation ID
   * @param {string} newMessage - New message
   */
  updateMessage(operationId, newMessage) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    operation.message = newMessage;

    if (operation.isVisible) {
      this.dispatchLoadingEvent('message-update', {
        operationId,
        message: newMessage
      });
    }
  }

  /**
   * Complete operation successfully
   * @param {string} operationId - Operation ID
   * @param {string} successMessage - Success message
   */
  completeOperation(operationId, successMessage = null) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const duration = Date.now() - operation.startTime;
    operation.status = 'completed';

    // Clear timeout if operation completed before threshold
    if (operation.timeoutId) {
      clearTimeout(operation.timeoutId);
    }

    // Hide loading indicators
    this.hideLoadingIndicators(operation);

    // Show success message if provided and operation was visible
    if (successMessage && (operation.isVisible || duration >= this.loadingThreshold)) {
      message.success(successMessage);
    }

    // Dispatch completion event
    this.dispatchLoadingEvent('loading-complete', {
      operationId,
      duration,
      success: true,
      message: successMessage
    });

    // Clean up
    this.activeOperations.delete(operationId);
  }

  /**
   * Handle operation error
   * @param {string} operationId - Operation ID
   * @param {string} errorMessage - Error message
   */
  errorOperation(operationId, errorMessage = 'Operation failed') {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const duration = Date.now() - operation.startTime;
    operation.status = 'error';

    // Clear timeout
    if (operation.timeoutId) {
      clearTimeout(operation.timeoutId);
    }

    // Hide loading indicators
    this.hideLoadingIndicators(operation);

    // Show error message
    message.error(errorMessage);

    // Dispatch error event
    this.dispatchLoadingEvent('loading-error', {
      operationId,
      duration,
      success: false,
      error: errorMessage
    });

    // Clean up
    this.activeOperations.delete(operationId);
  }

  /**
   * Cancel operation
   * @param {string} operationId - Operation ID
   */
  cancelOperation(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    operation.status = 'cancelled';

    // Clear timeout
    if (operation.timeoutId) {
      clearTimeout(operation.timeoutId);
    }

    // Hide loading indicators
    this.hideLoadingIndicators(operation);

    // Dispatch cancellation event
    this.dispatchLoadingEvent('loading-cancelled', {
      operationId,
      duration: Date.now() - operation.startTime
    });

    // Clean up
    this.activeOperations.delete(operationId);
  }

  /**
   * Stop operation (alias for cancel)
   * @param {string} operationId - Operation ID
   */
  stopOperation(operationId) {
    this.cancelOperation(operationId);
  }

  /**
   * Hide loading indicators for operation
   * @param {object} operation - Operation object
   */
  hideLoadingIndicators(operation) {
    if (operation.hideSpinner) {
      operation.hideSpinner();
    }

    if (operation.showProgress) {
      this.dispatchLoadingEvent('progress-complete', {
        operationId: operation.id
      });
    }

    this.dispatchLoadingEvent('loading-hide', {
      operationId: operation.id
    });
  }

  /**
   * Dispatch loading event for components to listen to
   * @param {string} eventType - Event type
   * @param {object} detail - Event detail
   */
  dispatchLoadingEvent(eventType, detail) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`loading-${eventType}`, { detail }));
    }
  }

  /**
   * Get active operations
   * @returns {array} - Array of active operations
   */
  getActiveOperations() {
    return Array.from(this.activeOperations.values()).map(op => ({
      id: op.id,
      message: op.message,
      status: op.status,
      progress: op.progressValue,
      duration: Date.now() - op.startTime,
      isVisible: op.isVisible
    }));
  }

  /**
   * Check if operation is active
   * @param {string} operationId - Operation ID
   * @returns {boolean} - Whether operation is active
   */
  isOperationActive(operationId) {
    return this.activeOperations.has(operationId);
  }

  /**
   * Create loading wrapper for async functions
   * @param {string} operationId - Operation ID
   * @param {string} message - Loading message
   * @param {function} asyncFunction - Async function to wrap
   * @param {object} options - Loading options
   * @returns {function} - Wrapped function
   */
  wrapAsync(operationId, message, asyncFunction, options = {}) {
    return async (...args) => {
      const operation = this.startOperation(operationId, message, options);
      
      try {
        const result = await asyncFunction(...args);
        operation.complete(options.successMessage);
        return result;
      } catch (error) {
        operation.error(options.errorMessage || error.message);
        throw error;
      }
    };
  }

  /**
   * Create loading wrapper for quote calculations
   * @param {function} calculationFunction - Calculation function
   * @returns {function} - Wrapped function
   */
  wrapQuoteCalculation(calculationFunction) {
    return this.wrapAsync(
      'quote-calculation',
      'Calculating quote...',
      calculationFunction,
      {
        showProgress: true,
        estimatedDuration: 3000,
        successMessage: 'Quote calculated successfully'
      }
    );
  }

  /**
   * Create loading wrapper for auto-save operations
   * @param {function} saveFunction - Save function
   * @returns {function} - Wrapped function
   */
  wrapAutoSave(saveFunction) {
    return this.wrapAsync(
      'auto-save',
      'Saving changes...',
      saveFunction,
      {
        showAfterDelay: false, // Show immediately for auto-save
        delayMs: 0,
        successMessage: null // Don't show success message for auto-save
      }
    );
  }

  /**
   * Create loading wrapper for template rendering
   * @param {function} renderFunction - Render function
   * @returns {function} - Wrapped function
   */
  wrapTemplateRender(renderFunction) {
    return this.wrapAsync(
      'template-render',
      'Generating proposal...',
      renderFunction,
      {
        showProgress: true,
        estimatedDuration: 2000,
        successMessage: 'Proposal generated successfully'
      }
    );
  }

  /**
   * Show feedback for quick operations (< 1 second)
   * @param {string} message - Feedback message
   * @param {string} type - Message type ('success', 'info', 'warning', 'error')
   */
  showQuickFeedback(message, type = 'success') {
    switch (type) {
      case 'success':
        message.success(message);
        break;
      case 'info':
        message.info(message);
        break;
      case 'warning':
        message.warning(message);
        break;
      case 'error':
        message.error(message);
        break;
      default:
        message.info(message);
    }
  }

  /**
   * Clean up expired operations
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [operationId, operation] of this.activeOperations.entries()) {
      if (now - operation.startTime > maxAge) {
        this.cancelOperation(operationId);
      }
    }
  }
}

// Create singleton instance
const loadingService = new LoadingService();

// Auto-cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    loadingService.cleanup();
  }, 5 * 60 * 1000);
}

export default loadingService;