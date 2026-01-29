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
  message,
  Modal,
  Row,
  Col,
  Tooltip,
  Badge,
  Progress,
  Collapse,
  Tabs
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  HomeOutlined,
  CheckOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

/**
 * UnitPricingProductConfig Component
 * 
 * Displays area and surface-based product selection interface for Unit Pricing (production-based) scheme.
 * Allows contractors to configure products per area and surface type with tier-based selection.
 * 
 * Features:
 * - Display areas and surfaces from quote
 * - Product assignment per surface type
 * - Tier-based selection (Good, Better, Best)
 * - Apply To All for surface types across areas
 * - Area-specific overrides
 * - Save to productSets.areas structure
 * - Progress tracking
 */
const UnitPricingProductConfig = ({
  quote,
  availableProducts = [],
  onSave,
  onCancel,
  loading = false
}) => {
  // Surface types for unit pricing
  const SURFACE_TYPES = [
    { key: 'walls', label: 'Walls', icon: '🧱' },
    { key: 'ceilings', label: 'Ceilings', icon: '⬆️' },
    { key: 'trim', label: 'Trim', icon: '📏' },
    { key: 'doors', label: 'Doors', icon: '🚪' },
    { key: 'other', label: 'Other', icon: '🎨' }
  ];

  // Product tiers
  const TIERS = ['good', 'better', 'best'];

  // Initialize state from quote's productSets
  const [productSets, setProductSets] = useState(() => {
    const initialSets = {
      areas: {}
    };

    // Load areas from quote
    const areas = quote?.areas || [];
    
    areas.forEach(area => {
      const areaId = area.id || area.areaId;
      initialSets.areas[areaId] = {
        areaName: area.name || area.areaName || `Area ${areaId}`,
        surfaces: {}
      };

      // Initialize surfaces for this area
      SURFACE_TYPES.forEach(surface => {
        initialSets.areas[areaId].surfaces[surface.key] = {
          good: {
            productId: null,
            productName: '',
            brandName: '',
            quantity: 0,
            unit: 'gallons',
            cost: 0,
            coverage: 350
          },
          better: {
            productId: null,
            productName: '',
            brandName: '',
            quantity: 0,
            unit: 'gallons',
            cost: 0,
            coverage: 350
          },
          best: {
            productId: null,
            productName: '',
            brandName: '',
            quantity: 0,
            unit: 'gallons',
            cost: 0,
            coverage: 350
          }
        };
      });
    });

    // Load existing data from quote if available
    if (quote?.productSets?.areas) {
      Object.keys(quote.productSets.areas).forEach(areaId => {
        if (initialSets.areas[areaId]) {
          const existingArea = quote.productSets.areas[areaId];
          
          // Preserve area name
          if (existingArea.areaName) {
            initialSets.areas[areaId].areaName = existingArea.areaName;
          }

          // Load surface products
          if (existingArea.surfaces) {
            Object.keys(existingArea.surfaces).forEach(surfaceKey => {
              if (initialSets.areas[areaId].surfaces[surfaceKey]) {
                TIERS.forEach(tier => {
                  if (existingArea.surfaces[surfaceKey][tier]) {
                    initialSets.areas[areaId].surfaces[surfaceKey][tier] = {
                      ...initialSets.areas[areaId].surfaces[surfaceKey][tier],
                      ...existingArea.surfaces[surfaceKey][tier]
                    };
                  }
                });
              }
            });
          }
        }
      });
    }

    return initialSets;
  });

  const [selectedSurfaceType, setSelectedSurfaceType] = useState(null);
  const [selectedTier, setSelectedTier] = useState('good');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeArea, setActiveArea] = useState(null);

  // Set initial active area
  useEffect(() => {
    const areaIds = Object.keys(productSets.areas);
    if (areaIds.length > 0 && !activeArea) {
      setActiveArea(areaIds[0]);
    }
  }, [productSets.areas, activeArea]);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [productSets]);

  /**
   * Handle product selection for a specific area, surface, and tier
   */
  const handleProductSelect = (areaId, surfaceKey, tier, productId) => {
    const product = availableProducts.find(p => p.id === productId || p.configId === productId);
    
    if (!product) {
      message.error('Product not found');
      return;
    }

    setProductSets(prev => ({
      ...prev,
      areas: {
        ...prev.areas,
        [areaId]: {
          ...prev.areas[areaId],
          surfaces: {
            ...prev.areas[areaId].surfaces,
            [surfaceKey]: {
              ...prev.areas[areaId].surfaces[surfaceKey],
              [tier]: {
                productId: product.id || product.configId,
                productName: product.productName || product.name,
                brandName: product.brandName || product.brand?.name || 'Unknown',
                quantity: prev.areas[areaId].surfaces[surfaceKey][tier].quantity || 0,
                unit: 'gallons',
                cost: product.pricePerGallon || product.sheens?.[0]?.price || 0,
                coverage: product.coverage || product.sheens?.[0]?.coverage || 350
              }
            }
          }
        }
      }
    }));

    // Clear validation error for this combination
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${areaId}_${surfaceKey}_${tier}`];
      return newErrors;
    });
  };

  /**
   * Apply selected product to all areas for a specific surface type and tier
   */
  const handleApplyToAll = () => {
    if (!selectedProduct || !selectedSurfaceType || !selectedTier) {
      message.warning('Please select a surface type, tier, and product first');
      return;
    }

    const surfaceLabel = SURFACE_TYPES.find(s => s.key === selectedSurfaceType)?.label || selectedSurfaceType;
    const tierLabel = selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1);

    Modal.confirm({
      title: `Apply Product to All Areas?`,
      content: `This will apply "${selectedProduct.productName || selectedProduct.name}" (${tierLabel} tier) to ${surfaceLabel} in all areas. Any existing selections will be overwritten.`,
      icon: <CopyOutlined />,
      okText: 'Apply to All',
      cancelText: 'Cancel',
      onOk: () => {
        const product = selectedProduct;
        const updatedAreas = { ...productSets.areas };

        Object.keys(updatedAreas).forEach(areaId => {
          if (updatedAreas[areaId].surfaces[selectedSurfaceType]) {
            updatedAreas[areaId].surfaces[selectedSurfaceType][selectedTier] = {
              productId: product.id || product.configId,
              productName: product.productName || product.name,
              brandName: product.brandName || product.brand?.name || 'Unknown',
              quantity: updatedAreas[areaId].surfaces[selectedSurfaceType][selectedTier].quantity || 0,
              unit: 'gallons',
              cost: product.pricePerGallon || product.sheens?.[0]?.price || 0,
              coverage: product.coverage || product.sheens?.[0]?.coverage || 350
            };
          }
        });

        setProductSets(prev => ({
          ...prev,
          areas: updatedAreas
        }));

        // Clear validation errors for this surface/tier combination
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          Object.keys(updatedAreas).forEach(areaId => {
            delete newErrors[`${areaId}_${selectedSurfaceType}_${selectedTier}`];
          });
          return newErrors;
        });

        message.success(`Product applied to ${surfaceLabel} (${tierLabel}) in all areas`);
      }
    });
  };

  /**
   * Calculate progress for an area
   */
  const calculateAreaProgress = (areaId) => {
    const area = productSets.areas[areaId];
    if (!area) return 0;

    let totalSlots = 0;
    let filledSlots = 0;

    SURFACE_TYPES.forEach(surface => {
      TIERS.forEach(tier => {
        totalSlots++;
        if (area.surfaces[surface.key]?.[tier]?.productId) {
          filledSlots++;
        }
      });
    });

    return totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
  };

  /**
   * Calculate overall progress
   */
  const calculateOverallProgress = () => {
    const areaIds = Object.keys(productSets.areas);
    if (areaIds.length === 0) return 0;

    const totalProgress = areaIds.reduce((sum, areaId) => {
      return sum + calculateAreaProgress(areaId);
    }, 0);

    return Math.round(totalProgress / areaIds.length);
  };

  /**
   * Validate product configuration
   */
  const validateConfiguration = () => {
    const errors = {};
    let hasErrors = false;

    // For unit pricing, at least one tier per surface per area should have a product
    Object.keys(productSets.areas).forEach(areaId => {
      const area = productSets.areas[areaId];
      
      SURFACE_TYPES.forEach(surface => {
        const surfaceConfig = area.surfaces[surface.key];
        const hasAnyProduct = TIERS.some(tier => surfaceConfig[tier]?.productId);
        
        if (!hasAnyProduct) {
          errors[`${areaId}_${surface.key}`] = `At least one tier required for ${surface.label}`;
          hasErrors = true;
        }
      });
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
      scheme: 'unit_pricing',
      areas: productSets.areas
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
   * Render tier selection for a surface
   */
  const renderTierSelection = (areaId, surfaceKey) => {
    const surfaceConfig = productSets.areas[areaId]?.surfaces[surfaceKey];
    if (!surfaceConfig) return null;

    return (
      <div style={{ marginTop: 12 }}>
        <Tabs defaultActiveKey="good" size="small">
          {TIERS.map(tier => {
            const tierConfig = surfaceConfig[tier];
            const product = tierConfig?.productId ? getProductById(tierConfig.productId) : null;
            const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
            const hasError = validationErrors[`${areaId}_${surfaceKey}_${tier}`];

            return (
              <TabPane
                tab={
                  <Space size="small">
                    <span>{tierLabel}</span>
                    {tierConfig?.productId && <CheckOutlined style={{ color: '#52c41a' }} />}
                  </Space>
                }
                key={tier}
              >
                <div style={{ padding: '12px 0' }}>
                  <Select
                    placeholder={`Select ${tierLabel} tier product`}
                    style={{ width: '100%' }}
                    showSearch
                    value={tierConfig?.productId}
                    onChange={(value) => handleProductSelect(areaId, surfaceKey, tier, value)}
                    filterOption={(input, option) => {
                      const label = option.label || '';
                      return label.toLowerCase().includes(input.toLowerCase());
                    }}
                    status={hasError ? 'error' : undefined}
                  >
                    {availableProducts.map(prod => {
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

                  {product && (
                    <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                      <Space size="small" wrap>
                        <Tag color="blue">{tierConfig.brandName}</Tag>
                        <Tag>${tierConfig.cost.toFixed(2)}/gal</Tag>
                        <Tag>{tierConfig.coverage} sq ft/gal</Tag>
                      </Space>
                    </div>
                  )}

                  {hasError && (
                    <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      {hasError}
                    </Text>
                  )}
                </div>
              </TabPane>
            );
          })}
        </Tabs>
      </div>
    );
  };

  /**
   * Render area configuration
   */
  const renderAreaConfiguration = (areaId) => {
    const area = productSets.areas[areaId];
    if (!area) return null;

    const progress = calculateAreaProgress(areaId);

    return (
      <Card
        title={
          <Space>
            <HomeOutlined />
            <span>{area.areaName}</span>
            <Badge
              count={`${progress}%`}
              style={{ backgroundColor: progress === 100 ? '#52c41a' : '#1890ff' }}
            />
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Progress percent={progress} status={progress === 100 ? 'success' : 'active'} style={{ marginBottom: 16 }} />

        <Collapse accordion>
          {SURFACE_TYPES.map(surface => {
            const surfaceConfig = area.surfaces[surface.key];
            const hasAnyProduct = TIERS.some(tier => surfaceConfig[tier]?.productId);
            const hasError = validationErrors[`${areaId}_${surface.key}`];

            return (
              <Panel
                key={surface.key}
                header={
                  <Space>
                    <span style={{ fontSize: 18 }}>{surface.icon}</span>
                    <Text strong>{surface.label}</Text>
                    {hasAnyProduct && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    {hasError && <WarningOutlined style={{ color: '#ff4d4f' }} />}
                  </Space>
                }
                style={{
                  borderColor: hasError ? '#ff4d4f' : undefined
                }}
              >
                {renderTierSelection(areaId, surface.key)}
                {hasError && (
                  <Alert
                    message={hasError}
                    type="error"
                    showIcon
                    style={{ marginTop: 12 }}
                  />
                )}
              </Panel>
            );
          })}
        </Collapse>
      </Card>
    );
  };

  const areaIds = Object.keys(productSets.areas);
  const overallProgress = calculateOverallProgress();

  return (
    <div className="unit-pricing-product-config">
      <Alert
        message="Unit Pricing - Area-Based Product Configuration"
        description="Configure products for each area and surface type. Select Good, Better, or Best tier products for each surface. Use Apply To All to quickly assign products across all areas."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Overall Progress */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Overall Progress</Text>
            <Text type="secondary">{areaIds.length} area{areaIds.length !== 1 ? 's' : ''}</Text>
          </div>
          <Progress
            percent={overallProgress}
            status={overallProgress === 100 ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </Space>
      </Card>

      {/* Apply To All Section */}
      <Card
        title="Quick Apply"
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text type="secondary">
            Select a surface type, tier, and product to apply it to all areas at once
          </Text>
          
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={8}>
              <Select
                placeholder="Select surface type"
                style={{ width: '100%' }}
                value={selectedSurfaceType}
                onChange={setSelectedSurfaceType}
              >
                {SURFACE_TYPES.map(surface => (
                  <Option key={surface.key} value={surface.key}>
                    {surface.icon} {surface.label}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col xs={24} sm={8}>
              <Select
                placeholder="Select tier"
                style={{ width: '100%' }}
                value={selectedTier}
                onChange={setSelectedTier}
              >
                {TIERS.map(tier => (
                  <Option key={tier} value={tier}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col xs={24} sm={8}>
              <Select
                placeholder="Select product"
                style={{ width: '100%' }}
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
                disabled={!selectedSurfaceType || !selectedTier}
              >
                {availableProducts.map(product => {
                  const productId = product.id || product.configId;
                  const productName = product.productName || product.name;
                  const brandName = product.brandName || product.brand?.name || 'Unknown';
                  
                  return (
                    <Option
                      key={productId}
                      value={productId}
                      label={`${brandName} - ${productName}`}
                    >
                      {brandName} - {productName}
                    </Option>
                  );
                })}
              </Select>
            </Col>
          </Row>

          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleApplyToAll}
            disabled={!selectedProduct || !selectedSurfaceType || !selectedTier}
            block
          >
            Apply to All Areas
          </Button>
        </Space>
      </Card>

      {/* Area Tabs */}
      {areaIds.length > 0 ? (
        <Tabs
          activeKey={activeArea}
          onChange={setActiveArea}
          type="card"
          style={{ marginBottom: 24 }}
        >
          {areaIds.map(areaId => {
            const area = productSets.areas[areaId];
            const progress = calculateAreaProgress(areaId);

            return (
              <TabPane
                tab={
                  <Space size="small">
                    <span>{area.areaName}</span>
                    <Badge
                      count={`${progress}%`}
                      style={{
                        backgroundColor: progress === 100 ? '#52c41a' : progress > 0 ? '#1890ff' : '#d9d9d9',
                        fontSize: 10
                      }}
                    />
                  </Space>
                }
                key={areaId}
              >
                {renderAreaConfiguration(areaId)}
              </TabPane>
            );
          })}
        </Tabs>
      ) : (
        <Alert
          message="No Areas Found"
          description="No areas have been defined for this quote. Please add areas in the quote builder before configuring products."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Validation Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          message="Validation Errors"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {Object.entries(validationErrors).map(([key, error]) => (
                <li key={key}>{error}</li>
              ))}
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

UnitPricingProductConfig.propTypes = {
  quote: PropTypes.object.isRequired,
  availableProducts: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default UnitPricingProductConfig;
