// Custom hook for handling abortable API calls in useEffect
// This prevents memory leaks and unnecessary API calls when users navigate away

import { useEffect, useRef } from 'react';

/**
 * Custom hook that creates an AbortController and provides cleanup
 * @param {Function} effect - The effect function to run (receives abortController.signal)
 * @param {Array} deps - Dependency array for the effect
 * @returns {Object} - Returns the abort controller for manual abort if needed
 */
export const useAbortableEffect = (effect, deps = []) => {
  const abortControllerRef = useRef(null);

  useEffect(() => {
    // Create a new AbortController for this effect
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Run the effect with the signal
    effect(signal);

    // Cleanup: abort any pending requests when deps change or component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, deps);

  return abortControllerRef.current;
};

/**
 * Utility function to check if an error is an abort error
 * @param {Error} error - The error to check
 * @returns {boolean} - True if error is from an aborted request
 */
export const isAbortError = (error) => {
  return error.name === 'AbortError' || 
         error.message?.includes('aborted') || 
         error.message?.includes('abort');
};

/**
 * Wrapper for API calls that handles abort errors gracefully
 * @param {Function} apiCall - Async function that makes the API call
 * @param {AbortSignal} signal - The abort signal from AbortController
 * @param {Function} onSuccess - Callback for successful response
 * @param {Function} onError - Callback for errors (excluding abort errors)
 */
export const handleAbortableRequest = async (apiCall, signal, onSuccess, onError) => {
  try {
    const response = await apiCall(signal);
    
    // Check if request was aborted before processing response
    if (signal && signal.aborted) {
      console.log('Request aborted - user navigated away');
      return;
    }
    
    if (onSuccess) {
      onSuccess(response);
    }
    
    return response;
  } catch (error) {
    // Ignore abort errors - these are expected when users navigate
    if (isAbortError(error)) {
      console.log('Request cancelled:', error.message);
      return;
    }
    
    // Handle real errors
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
  }
};

export default useAbortableEffect;
