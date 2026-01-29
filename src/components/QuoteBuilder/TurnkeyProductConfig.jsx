import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Alert,
  Space,
  Typography,
  Tag,
  Divider,
  Spin,
  message,
  Modal,
  InputNumber,
  Row,
  Col,
  Tooltip
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * TurnkeyProductConfig Component
 * 
 * Displays global surface type selection interface for Turnkey pricing scheme.
 * Allows contractors to configure products for walls, ceilings, trim, doors, and other surfaces
 * for the entire house (not per area).
 * 
 * Features:
 * - Global surface type product selection
 * - Product search and selection
 * - Product details display (name, brand, type, cost)
 * - Apply To All functionality
 * - Override with visual indicators
 * - Save to productSets.global structure
 * - Real-time validation feedback
 */
const TurnkeyProductConfig = ({
  quote,
  availableProducts = [],
  onSave,
  onCancel,
  loading = false
}) => {
  // Surface types for turnkey pricing
  const SURFACE_TYPES = [
    { key: 'walls', label: 'Walls', icon: '🧱' },
    { key: 'ceilings', label: 'Ceilings', icon: '⬆️' },
    { key: 'trim', label: 'Trim', icon: '📏' },
    { key: 'doors', label: 'Doors', icon: '🚪' },
    { key: 'other', label: 'Other Surfaces', icon: '🎨' }
  ];

  // Initialize state from quote's productSets
  const [productSets, setProductSets] = useState(() => {
    const initialSets = {};
    SURFACE_TYPES.forEach(surface => {
      initialSets[surface.key] = {
        productId: null,
        productName: '',
        brandName: '',
        quantity: 0,
        unit: 'gallons',
        cost: 0,
        coverage: 350,
        overridden: false
      };
    });

    // Load existing data from quote if available
    if (quote?.productSets?.global) {
      Object.keys(quote.productSets.global).forEach(surfaceKey => {
        if (initialSets[surfaceKey]) {
          initialSets[surfaceKey] = {
            ...initialSets[surfaceKey],
            ...quote.productSets.global[surfaceKey]
          };
        }
      });
    }

    return initialSets;
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [productSets]);

  /**
   * Handle product selection for a specific surface type
   */
  const handleProductSelect = (surfaceKey, productId) => {
    const product = availableProducts.find(p => p.id === productId || p.configId === productId);
    
    if (!product) {
      message.error('Product not found');
      return;
    }

    setProductSets(prev => ({
      ...prev,
      [surfaceKey]: {
        productId: product.id || product.configId,
        productName: product.productName || product.name,
        brandName: product.brandName || product.brand?.name || 'Unknown',
        quantity: prev[surfaceKey].quantity || 0,
        unit: 'gallons',
        cost: product.pricePerGallon || product.sheens?.[0]?.price || 0,
        coverage: product.coverage || product.sheens?.[0]?.coverage || 350,
        overridden: true
      }
    }));

    // Clear validation error for this surface
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[surfaceKey];
      return newErrors;
    });
  };

  /**
   * Handle quantity change for a surface type
   */
  const handleQuantityChange = (surfaceKey, quantity) => {
    setProductSets(prev => ({
      ...prev,
      [surfaceKey]: {
        ...prev[surfaceKey],
        quantity: quantity || 0
      }
    }));
  };

  /**
   * Apply selected product to all surface types
   */
  const handleApplyToAll = () => {
    if (!selectedProduct) {
      message.warning('Please select a product first');
      return;
    }

    Modal.confirm({
      title: 'Apply Product to All Surfaces?',
      content: `This will apply "${selectedProduct.productName || selectedProduct.name}" to all surface types. Any existing selections will be overwritten.`,
      icon: <CopyOutlined />,
      okText: 'Apply to All',
      cancelText: 'Cancel',
      onOk: () => {
        const product = selectedProduct;
        const updatedSets = {};

        SURFACE_TYPES.forEach(surface => {
          updatedSets[surface.key] = {
            productId: product.id || product.configId,
            productName: product.productName || product.name,
            brandName: product.brandName || product.brand?.name || 'Unknown',
            quantity: productSets[surface.key].quantity || 0,
            unit: 'gallons',
            cost: product.pricePerGallon || product.sheens?.[0]?.price || 0,
            coverage: product.coverage || product.sheens?.[0]?.coverage || 350,
            overridden: false // Not overridden since applied to all
          };
        });

        setProductSets(updatedSets);
        setValidationErrors({});
        message.success('Product applied to all surface types');
      }
    });
  };

  /**
   * Validate product configuration
   */
  const validateConfiguration = () => {
    const errors = {};
    let hasErrors = false;

    SURFACE_TYPES.forEach(surface => {
      const config = productSets[surface.key];
      
      // Check if product is selected
      if (!config.productId) {
        errors[surface.key] = 'Product required';
        hasErrors = true;
      }
      
      // Check if quantity is valid (optional but should be >= 0 if set)
      if (config.quantity < 0) {
        errors[surface.key] = 'Quantity must be 0 or greater';
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  /**
   * Handle save action
   */
  const handleSave = async () => {
    if (!validateConfiguration()) {
      message.error('Please fix validation errors before saving');
      return;
    }

    const productSetsData = {
      scheme: 'turnkey',
      global: productSets
    };

    try {
      await onSave(productSetsData);
      setHasChanges(false);
      message.success('Product configuration saved successfully');
    } catch (error) {
      message.error('Failed to save product configuration: ' + error.message);
    }
  };

  /**
   * Handle cancel action
   */
  const handleCancel = () => {
    if (hasChanges) {
      Modal.confirm({
        title: 'Unsaved Changes',
        content: 'You have unsaved changes. Are you sure you want to cancel?',
        icon: <WarningOutlined />,
        okText: 'Yes, Cancel',
        cancelText: 'No, Stay',
        okButtonProps: { danger: true },
        onOk: () => {
          onCancel();
        }
      });
    } else {
      onCancel();
    }
  };

  /**
   * Get product by ID
   */
  const getProductById = (productId) => {
    return availableProducts.find(p => p.id === productId || p.configId === productId);
  };

  /**
   * Filter products based on search text
   */
  const filteredProducts = availableProducts.filter(product => {
    if (!searchText) return true;
    
    const searchLower = searchText.toLowerCase();
    const productName = (product.productName || product.name || '').toLowerCase();
    const brandName = (product.brandName || product.brand?.name || '').toLowerCase();
    
    return productName.includes(searchLower) || brandName.includes(searchLower);
  });

  return (
    <div className="turnkey-product-config">
      <Alert
        message="Turnkey Pricing - Global Product Configuration"
        description="Configure products for each surface type. These products will be applied to the entire house based on total square footage."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Apply To All Section */}
      <Card
        title="Quick Apply"
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            Select a product and apply it to all surface types at once
          </Text>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              placeholder="Select a product to apply to all surfaces"
              style={{ flex: 1 }}
              showSearch
              value={selectedProduct?.id || selectedProduct?.configId}
              onChange={(value) => {
                const product = availableProducts.find(p => p.id === value || p.configId === value);
                setSelectedProduct(product);
              }}
              filterOption={(input, option) => {
                const label = option.label || '';
                return label.toLowerCase().includes(input.toLowerCase());
              }}
              loading={loading}
            >
              {filteredProducts.map(product => {
                const productId = product.id || product.configId;
                const productName = product.productName || product.name;
                const brandName = product.brandName || product.brand?.name || 'Unknown';
                const price = product.pricePerGallon || product.sheens?.[0]?.price || 0;
                
                return (
                  <Option
                    key={productId}
                    value={productId}
                    label={`${brandName} - ${productName}`}
                  >
                    <div>
                      <Text strong>{brandName}</Text> - {productName}
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ${price.toFixed(2)}/gal
                      </Text>
                    </div>
                  </Option>
                );
              })}
            </Select>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleApplyToAll}
              disabled={!selectedProduct}
            >
              Apply to All
            </Button>
          </Space.Compact>
        </Space>
      </Card>

      {/* Surface Type Configuration */}
      <Card title="Surface Type Products" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {SURFACE_TYPES.map(surface => {
            const config = productSets[surface.key];
            const hasError = validationErrors[surface.key];
            const product = config.productId ? getProductById(config.productId) : null;

            return (
              <Card
                key={surface.key}
                size="small"
                type={config.overridden ? 'inner' : undefined}
                style={{
                  borderColor: hasError ? '#ff4d4f' : config.overridden ? '#1890ff' : undefined,
                  borderWidth: config.overridden ? 2 : 1
                }}
              >
                <Row gutter={[16, 16]} align="middle">
                  {/* Surface Type Label */}
                  <Col xs={24} sm={6}>
                    <Space>
                      <span style={{ fontSize: 24 }}>{surface.icon}</span>
                      <div>
                        <Text strong>{surface.label}</Text>
                        {config.overridden && (
                          <div>
                            <Tag color="blue" style={{ fontSize: 10 }}>
                              OVERRIDDEN
                            </Tag>
                          </div>
                        )}
                      </div>
                    </Space>
                  </Col>

                  {/* Product Selection */}
                  <Col xs={24} sm={10}>
                    <Select
                      placeholder={`Select product for ${surface.label.toLowerCase()}`}
                      style={{ width: '100%' }}
                      showSearch
                      value={config.productId}
                      onChange={(value) => handleProductSelect(surface.key, value)}
                      filterOption={(input, option) => {
                        const label = option.label || '';
                        return label.toLowerCase().includes(input.toLowerCase());
                      }}
                      status={hasError ? 'error' : undefined}
                      loading={loading}
                    >
                      {filteredProducts.map(prod => {
                        const prodId = prod.id || prod.configId;
                        const prodName = prod.productName || prod.name;
                        const brandName = prod.brandName || prod.brand?.name || 'Unknown';
                        const price = prod.pricePerGallon || prod.sheens?.[0]?.price || 0;
                        
                        return (
                          <Option
                            key={prodId}
                            value={prodId}
                            label={`${brandName} - ${prodName}`}
                          >
                            <div>
                              <Text strong>{brandName}</Text> - {prodName}
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                ${price.toFixed(2)}/gal
                              </Text>
                            </div>
                          </Option>
                        );
                      })}
                    </Select>
                    {hasError && (
                      <Text type="danger" style={{ fontSize: 12 }}>
                        {hasError}
                      </Text>
                    )}
                  </Col>

                  {/* Quantity Input */}
                  <Col xs={12} sm={4}>
                    <Tooltip title="Estimated quantity needed (optional)">
                      <InputNumber
                        placeholder="Qty"
                        min={0}
                        precision={1}
                        value={config.quantity}
                        onChange={(value) => handleQuantityChange(surface.key, value)}
                        addonAfter="gal"
                        style={{ width: '100%' }}
                      />
                    </Tooltip>
                  </Col>

                  {/* Product Details */}
                  <Col xs={12} sm={4}>
                    {product && (
                      <Space direction="vertical" size={0}>
                        <Text strong style={{ fontSize: 12 }}>
                          ${config.cost.toFixed(2)}/gal
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {config.coverage} sq ft/gal
                        </Text>
                      </Space>
                    )}
                  </Col>
                </Row>

                {/* Product Details Expanded */}
                {product && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <Space size="small" wrap>
                      <Tag color="blue">{config.brandName}</Tag>
                      <Tag>{product.category || 'Paint'}</Tag>
                      {product.sheens && product.sheens.length > 0 && (
                        <Tooltip title="Available sheens">
                          <Tag icon={<InfoCircleOutlined />}>
                            {product.sheens.length} sheen{product.sheens.length > 1 ? 's' : ''}
                          </Tag>
                        </Tooltip>
                      )}
                    </Space>
                  </div>
                )}
              </Card>
            );
          })}
        </Space>
      </Card>

      {/* Validation Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          message="Validation Errors"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {Object.entries(validationErrors).map(([key, error]) => {
                const surface = SURFACE_TYPES.find(s => s.key === key);
                return (
                  <li key={key}>
                    <strong>{surface?.label}:</strong> {error}
                  </li>
                );
              })}
            </ul>
          }
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Action Buttons */}
      <Card>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleSave}
            loading={loading}
            disabled={Object.keys(validationErrors).length > 0}
          >
            Save Configuration
          </Button>
        </Space>
        {hasChanges && (
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Text type="warning" style={{ fontSize: 12 }}>
              <WarningOutlined /> Unsaved changes
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

TurnkeyProductConfig.propTypes = {
  quote: PropTypes.object.isRequired,
  availableProducts: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default TurnkeyProductConfig;
