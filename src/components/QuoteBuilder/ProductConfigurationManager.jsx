import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Spin,
  Alert,
  message,
  Modal,
  Space,
  Typography,
  Button,
  Input
} from 'antd';
import {
  SaveOutlined,
  CloseOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import { apiService } from '../../services/apiService';
import TurnkeyProductConfig from './TurnkeyProductConfig';
import FlatRateUnitProductConfig from './FlatRateUnitProductConfig';
import UnitPricingProductConfig from './UnitPricingProductConfig';
import HourlyPricingProductConfig from './HourlyPricingProductConfig';

const { Title, Text } = Typography;
const { Search } = Input;

/**
 * ProductConfigurationManager Component
 * 
 * Wrapper component that dynamically renders scheme-specific product configuration components.
 * Handles common functionality like save/cancel, auto-save, conflict resolution, loading states,
 * validation errors, and product search.
 * 
 * Features:
 * - Dynamic component rendering based on pricing scheme
 * - Auto-save with configurable interval
 * - Conflict resolution for concurrent edits
 * - Loading states and error handling
 * - Product search functionality
 * - Validation error display
 * - Unsaved changes warning
 * 
 * Pricing Scheme Mapping:
 * - turnkey, sqft_turnkey → TurnkeyProductConfig
 * - flat_rate_unit, room_flat_rate → FlatRateUnitProductConfig
 * - unit_pricing, production_based, rate_based_sqft → UnitPricingProductConfig
 * - hourly_time_materials → HourlyPricingProductConfig
 */
const ProductConfigurationManager = ({
  quote,
  onSave,
  onCancel,
  autoSaveInterval = 30000, // 30 seconds default
  enableAutoSave = true
}) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  
  // Refs for auto-save
  const autoSaveTimerRef = useRef(null);
  const pendingChangesRef = useRef(null);

  /**
   * Determine which component to render based on pricing scheme
   */
  const getSchemeComponent = () => {
    if (!quote?.pricingScheme) {
      return null;
    }

    const schemeType = quote.pricingScheme.type?.toLowerCase();

    // Turnkey pricing schemes
    if (schemeType === 'turnkey' || schemeType === 'sqft_turnkey') {
      return TurnkeyProductConfig;
    }

    // Flat Rate Unit pricing schemes
    if (schemeType === 'flat_rate_unit' || schemeType === 'room_flat_rate') {
      return FlatRateUnitProductConfig;
    }

    // Unit Pricing schemes (production-based)
    if (schemeType === 'unit_pricing' || 
        schemeType === 'production_based' || 
        schemeType === 'rate_based_sqft') {
      return UnitPricingProductConfig;
    }

    // Hourly pricing schemes
    if (schemeType === 'hourly_time_materials') {
      return HourlyPricingProductConfig;
    }

    return null;
  };

  /**
   * Load product configuration data
   */
  const loadProductConfiguration = useCallback(async () => {
    if (!quote?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const response = await apiService.get(
        `/quote-builder/${quote.id}/product-configuration`
      );

      if (response.success) {
        setAvailableProducts(response.data.availableProducts || []);
        setFilteredProducts(response.data.availableProducts || []);
        setValidationErrors([]);
      } else {
        message.error('Failed to load product configuration');
      }
    } catch (error) {
      console.error('Error loading product configuration:', error);
      message.error('Failed to load product configuration: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [quote?.id]);

  /**
   * Load data on mount
   */
  useEffect(() => {
    loadProductConfiguration();
  }, [loadProductConfiguration]);

  /**
   * Filter products based on search text
   */
  useEffect(() => {
    if (!searchText) {
      setFilteredProducts(availableProducts);
      return;
    }

    const searchLower = searchText.toLowerCase();
    const filtered = availableProducts.filter(product => {
      const productName = (product.productName || product.name || '').toLowerCase();
      const brandName = (product.brandName || product.brand?.name || '').toLowerCase();
      const category = (product.category || '').toLowerCase();
      
      return productName.includes(searchLower) || 
             brandName.includes(searchLower) || 
             category.includes(searchLower);
    });

    setFilteredProducts(filtered);
  }, [searchText, availableProducts]);

  /**
   * Handle product search
   */
  const handleSearch = (value) => {
    setSearchText(value);
  };

  /**
   * Save product configuration
   */
  const saveProductConfiguration = async (productSets, options = {}) => {
    const { showSuccessMessage = true, isAutoSave = false } = options;

    try {
      setSaving(true);

      const response = await apiService.put(
        `/quote-builder/${quote.id}/product-configuration`,
        {
          productSets,
          autoSaveVersion: quote.version || 0
        }
      );

      if (response.success) {
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date());
        setValidationErrors([]);
        
        if (showSuccessMessage) {
          message.success(isAutoSave ? 'Auto-saved successfully' : 'Configuration saved successfully');
        }

        // Call parent onSave callback
        if (onSave) {
          await onSave(response.data);
        }

        return { success: true, data: response.data };
      } else if (response.conflict) {
        // Handle conflict
        setConflictData(response.conflictData);
        setShowConflictModal(true);
        return { success: false, conflict: true };
      } else {
        throw new Error(response.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving product configuration:', error);
      
      // Check if it's a validation error
      if (error.response?.data?.errors) {
        setValidationErrors(error.response.data.errors);
        message.error('Please fix validation errors before saving');
      } else if (error.response?.status === 409) {
        // Conflict detected
        setConflictData(error.response.data);
        setShowConflictModal(true);
      } else {
        message.error('Failed to save configuration: ' + error.message);
      }
      
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle save from child component
   */
  const handleSave = async (productSets) => {
    const result = await saveProductConfiguration(productSets, {
      showSuccessMessage: true,
      isAutoSave: false
    });

    return result;
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: 'Unsaved Changes',
        content: 'You have unsaved changes. Are you sure you want to cancel?',
        icon: <WarningOutlined />,
        okText: 'Yes, Cancel',
        cancelText: 'No, Stay',
        okButtonProps: { danger: true },
        onOk: () => {
          // Clear auto-save timer
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          
          if (onCancel) {
            onCancel();
          }
        }
      });
    } else {
      if (onCancel) {
        onCancel();
      }
    }
  };

  /**
   * Auto-save functionality
   */
  useEffect(() => {
    if (!enableAutoSave || !hasUnsavedChanges || !pendingChangesRef.current) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(async () => {
      if (pendingChangesRef.current) {
        await saveProductConfiguration(pendingChangesRef.current, {
          showSuccessMessage: false,
          isAutoSave: true
        });
      }
    }, autoSaveInterval);

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, enableAutoSave, autoSaveInterval]);

  /**
   * Track changes for auto-save
   */
  const handleProductSetsChange = (productSets) => {
    pendingChangesRef.current = productSets;
    setHasUnsavedChanges(true);
  };

  /**
   * Handle conflict resolution
   */
  const handleConflictResolution = async (resolution) => {
    try {
      const response = await apiService.post(
        `/quote-builder/${quote.id}/resolve-conflict`,
        {
          resolution, // 'server' or 'client'
          data: resolution === 'client' ? pendingChangesRef.current : null
        }
      );

      if (response.success) {
        setShowConflictModal(false);
        setConflictData(null);
        message.success('Conflict resolved successfully');
        
        // Reload configuration
        await loadProductConfiguration();
      } else {
        message.error('Failed to resolve conflict');
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      message.error('Failed to resolve conflict: ' + error.message);
    }
  };

  /**
   * Validate product configuration
   */
  const validateConfiguration = async (productSets) => {
    try {
      const response = await apiService.post(
        `/quote-builder/${quote.id}/product-configuration/validate`,
        {
          productSets,
          scheme: quote.pricingScheme?.type
        }
      );

      if (response.success) {
        if (response.data.valid) {
          setValidationErrors([]);
          return { valid: true };
        } else {
          setValidationErrors(response.data.errors || []);
          return { valid: false, errors: response.data.errors };
        }
      }
    } catch (error) {
      console.error('Error validating configuration:', error);
      return { valid: false, error };
    }
  };

  // Get the appropriate component
  const SchemeComponent = getSchemeComponent();

  // Render loading state
  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading product configuration...</Text>
          </div>
        </div>
      </Card>
    );
  }

  // Render error state if no component found
  if (!SchemeComponent) {
    return (
      <Card>
        <Alert
          message="Unsupported Pricing Scheme"
          description={`Product configuration is not yet available for the "${quote?.pricingScheme?.name}" pricing scheme. Please select a different pricing scheme or contact support.`}
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
          action={
            <Space>
              <Button size="small" onClick={handleCancel}>
                Go Back
              </Button>
            </Space>
          }
        />
      </Card>
    );
  }

  return (
    <div className="product-configuration-manager">
      {/* Header with search and status */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Product Configuration
              </Title>
              <Text type="secondary">
                {quote?.pricingScheme?.name || 'Unknown Scheme'}
              </Text>
            </div>
            
            <Space>
              {hasUnsavedChanges && (
                <Text type="warning">
                  <WarningOutlined /> Unsaved changes
                </Text>
              )}
              {lastSavedAt && !hasUnsavedChanges && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Last saved: {lastSavedAt.toLocaleTimeString()}
                </Text>
              )}
              {enableAutoSave && hasUnsavedChanges && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Auto-saving...
                </Text>
              )}
            </Space>
          </div>

          {/* Product Search */}
          <Search
            placeholder="Search products by name, brand, or category..."
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            value={searchText}
            style={{ maxWidth: 600 }}
          />
        </Space>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert
          message="Validation Errors"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>
                  <strong>{error.category || 'General'}:</strong> {error.message}
                </li>
              ))}
            </ul>
          }
          type="error"
          showIcon
          closable
          onClose={() => setValidationErrors([])}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Scheme-specific component */}
      <SchemeComponent
        quote={quote}
        availableProducts={filteredProducts}
        onSave={handleSave}
        onCancel={handleCancel}
        loading={saving}
        onChange={handleProductSetsChange}
      />

      {/* Conflict Resolution Modal */}
      <Modal
        title="Concurrent Edit Detected"
        open={showConflictModal}
        onCancel={() => setShowConflictModal(false)}
        footer={[
          <Button
            key="server"
            onClick={() => handleConflictResolution('server')}
          >
            Use Server Version
          </Button>,
          <Button
            key="client"
            type="primary"
            onClick={() => handleConflictResolution('client')}
          >
            Use My Changes
          </Button>
        ]}
      >
        <Alert
          message="Conflict Detected"
          description="This quote has been modified by another user or in another session. Please choose which version to keep."
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
        />
        
        {conflictData && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Server Version:</Text>
              <div style={{ padding: 8, background: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                <Text type="secondary">
                  Last modified: {new Date(conflictData.serverVersion?.updatedAt).toLocaleString()}
                </Text>
              </div>
            </div>
            
            <div>
              <Text strong>Your Version:</Text>
              <div style={{ padding: 8, background: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                <Text type="secondary">
                  Your changes from this session
                </Text>
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

ProductConfigurationManager.propTypes = {
  quote: PropTypes.object.isRequired,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
  autoSaveInterval: PropTypes.number,
  enableAutoSave: PropTypes.bool
};

export default ProductConfigurationManager;
