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
  InputNumber,
  Row,
  Col,
  Tooltip,
  Badge,
  Input
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  HomeOutlined,
  BankOutlined,
  SearchOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * FlatRateUnitProductConfig Component
 * 
 * Displays category-based product selection interface for Flat Rate Unit pricing scheme.
 * Allows contractors to configure products for interior and exterior categories.
 * 
 * Features:
 * - Interior categories: Door, Small Room, Medium Room, Large Room, Closet, Accent Wall, Cabinets (Face and Doors)
 * - Exterior categories: Doors, Windows, Garage Doors (1-car, 2-car, 3-car), Shutters
 * - Separate "Apply to All Interior" and "Apply to All Exterior" functionality
 * - Individual category product override
 * - Quantity display for each category
 * - Garage door multiplier visual indicators
 * - Cabinet subcategories (Face and Doors) handled separately
 * - Save to productSets.interior and productSets.exterior structure
 * - Validation for required categories
 */
const FlatRateUnitProductConfig = ({
  quote,
  availableProducts = [],
  onSave,
  onCancel,
  loading = false
}) => {
  // Interior categories for flat rate unit pricing
  const INTERIOR_CATEGORIES = [
    { key: 'door', label: 'Door', icon: '🚪', description: 'Interior doors' },
    { key: 'smallRoom', label: 'Small Room', icon: '🏠', description: 'Small rooms' },
    { key: 'mediumRoom', label: 'Medium Room', icon: '🏡', description: 'Medium rooms' },
    { key: 'largeRoom', label: 'Large Room', icon: '🏘️', description: 'Large rooms' },
    { key: 'closet', label: 'Closet', icon: '🚪', description: 'Closets' },
    { key: 'accentWall', label: 'Accent Wall', icon: '🎨', description: 'Accent walls' },
    { key: 'cabinetsFace', label: 'Cabinets (Face)', icon: '🗄️', description: 'Cabinet faces' },
    { key: 'cabinetsDoors', label: 'Cabinets (Doors)', icon: '🚪', description: 'Cabinet doors' }
  ];

  // Exterior categories for flat rate unit pricing
  const EXTERIOR_CATEGORIES = [
    { key: 'doors', label: 'Doors', icon: '🚪', description: 'Exterior doors' },
    { key: 'windows', label: 'Windows', icon: '🪟', description: 'Windows' },
    { 
      key: 'garageDoor1Car', 
      label: '1-Car Garage Door', 
      icon: '🚗', 
      description: '1-car garage doors',
      multiplier: 0.5 
    },
    { 
      key: 'garageDoor2Car', 
      label: '2-Car Garage Door', 
      icon: '🚗🚗', 
      description: '2-car garage doors',
      multiplier: 1.0 
    },
    { 
      key: 'garageDoor3Car', 
      label: '3-Car Garage Door', 
      icon: '🚗🚗🚗', 
      description: '3-car garage doors',
      multiplier: 1.5 
    },
    { key: 'shutters', label: 'Shutters', icon: '🪟', description: 'Shutters' }
  ];

  // Initialize state from quote's productSets
  const [productSets, setProductSets] = useState(() => {
    const initialSets = {
      interior: {},
      exterior: {}
    };

    // Initialize interior categories
    INTERIOR_CATEGORIES.forEach(category => {
      initialSets.interior[category.key] = {
        products: [],
        unitCount: 0,
        totalCost: 0,
        overridden: false
      };
    });

    // Initialize exterior categories
    EXTERIOR_CATEGORIES.forEach(category => {
      initialSets.exterior[category.key] = {
        products: [],
        unitCount: 0,
        totalCost: 0,
        overridden: false,
        multiplier: category.multiplier || 1.0
      };
    });

    // Load existing data from quote if available
    if (quote?.productSets?.interior) {
      Object.keys(quote.productSets.interior).forEach(categoryKey => {
        if (initialSets.interior[categoryKey]) {
          initialSets.interior[categoryKey] = {
            ...initialSets.interior[categoryKey],
            ...quote.productSets.interior[categoryKey]
          };
        }
      });
    }

    if (quote?.productSets?.exterior) {
      Object.keys(quote.productSets.exterior).forEach(categoryKey => {
        if (initialSets.exterior[categoryKey]) {
          initialSets.exterior[categoryKey] = {
            ...initialSets.exterior[categoryKey],
            ...quote.productSets.exterior[categoryKey]
          };
        }
      });
    }

    // Load quantities from flatRateItems if available
    if (quote?.flatRateItems) {
      // Map flatRateItems keys to productSets keys
      const itemMapping = {
        interior: {
          doors: 'door',
          smallRooms: 'smallRoom',
          mediumRooms: 'mediumRoom',
          largeRooms: 'largeRoom',
          closets: 'closet',
          accentWalls: 'accentWall',
          cabinetFaces: 'cabinetsFace',
          cabinetDoors: 'cabinetsDoors'
        },
        exterior: {
          doors: 'doors',
          windows: 'windows',
          garageDoors1Car: 'garageDoor1Car',
          garageDoors2Car: 'garageDoor2Car',
          garageDoors3Car: 'garageDoor3Car',
          shutters: 'shutters'
        }
      };

      // Load interior quantities
      if (quote.flatRateItems.interior) {
        Object.entries(quote.flatRateItems.interior).forEach(([itemKey, count]) => {
          const categoryKey = itemMapping.interior[itemKey];
          if (categoryKey && initialSets.interior[categoryKey]) {
            initialSets.interior[categoryKey].unitCount = count || 0;
          }
        });
      }

      // Load exterior quantities
      if (quote.flatRateItems.exterior) {
        Object.entries(quote.flatRateItems.exterior).forEach(([itemKey, count]) => {
          const categoryKey = itemMapping.exterior[itemKey];
          if (categoryKey && initialSets.exterior[categoryKey]) {
            initialSets.exterior[categoryKey].unitCount = count || 0;
          }
        });
      }
    }

    return initialSets;
  });

  const [selectedInteriorProduct, setSelectedInteriorProduct] = useState(null);
  const [selectedExteriorProduct, setSelectedExteriorProduct] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [productSets]);

  /**
   * Handle product selection for a specific category
   */
  const handleProductSelect = (categoryType, categoryKey, productId) => {
    const product = availableProducts.find(p => p.id === productId || p.configId === productId);
    
    if (!product) {
      message.error('Product not found');
      return;
    }

    setProductSets(prev => ({
      ...prev,
      [categoryType]: {
        ...prev[categoryType],
        [categoryKey]: {
          ...prev[categoryType][categoryKey],
          products: [{
            productId: product.id || product.configId,
            productName: product.productName || product.name,
            brandName: product.brandName || product.brand?.name || 'Unknown',
            pricePerUnit: prev[categoryType][categoryKey].pricePerUnit || 0,
            includedInUnitPrice: true
          }],
          overridden: true
        }
      }
    }));

    // Clear validation error for this category
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${categoryType}_${categoryKey}`];
      return newErrors;
    });
  };

  /**
   * Apply selected product to all interior categories
   */
  const handleApplyToAllInterior = () => {
    if (!selectedInteriorProduct) {
      message.warning('Please select a product first');
      return;
    }

    Modal.confirm({
      title: 'Apply Product to All Interior Categories?',
      content: `This will apply "${selectedInteriorProduct.productName || selectedInteriorProduct.name}" to all interior categories. Any existing selections will be overwritten.`,
      icon: <CopyOutlined />,
      okText: 'Apply to All Interior',
      cancelText: 'Cancel',
      onOk: () => {
        const product = selectedInteriorProduct;
        const updatedInterior = {};

        INTERIOR_CATEGORIES.forEach(category => {
          updatedInterior[category.key] = {
            ...productSets.interior[category.key],
            products: [{
              productId: product.id || product.configId,
              productName: product.productName || product.name,
              brandName: product.brandName || product.brand?.name || 'Unknown',
              pricePerUnit: productSets.interior[category.key].pricePerUnit || 0,
              includedInUnitPrice: true
            }],
            overridden: false // Not overridden since applied to all
          };
        });

        setProductSets(prev => ({
          ...prev,
          interior: updatedInterior
        }));

        // Clear interior validation errors
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          INTERIOR_CATEGORIES.forEach(cat => {
            delete newErrors[`interior_${cat.key}`];
          });
          return newErrors;
        });

        message.success('Product applied to all interior categories');
      }
    });
  };

  /**
   * Apply selected product to all exterior categories
   */
  const handleApplyToAllExterior = () => {
    if (!selectedExteriorProduct) {
      message.warning('Please select a product first');
      return;
    }

    Modal.confirm({
      title: 'Apply Product to All Exterior Categories?',
      content: `This will apply "${selectedExteriorProduct.productName || selectedExteriorProduct.name}" to all exterior categories. Any existing selections will be overwritten.`,
      icon: <CopyOutlined />,
      okText: 'Apply to All Exterior',
      cancelText: 'Cancel',
      onOk: () => {
        const product = selectedExteriorProduct;
        const updatedExterior = {};

        EXTERIOR_CATEGORIES.forEach(category => {
          updatedExterior[category.key] = {
            ...productSets.exterior[category.key],
            products: [{
              productId: product.id || product.configId,
              productName: product.productName || product.name,
              brandName: product.brandName || product.brand?.name || 'Unknown',
              pricePerUnit: productSets.exterior[category.key].pricePerUnit || 0,
              includedInUnitPrice: true
            }],
            overridden: false // Not overridden since applied to all
          };
        });

        setProductSets(prev => ({
          ...prev,
          exterior: updatedExterior
        }));

        // Clear exterior validation errors
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          EXTERIOR_CATEGORIES.forEach(cat => {
            delete newErrors[`exterior_${cat.key}`];
          });
          return newErrors;
        });

        message.success('Product applied to all exterior categories');
      }
    });
  };

  /**
   * Validate product configuration
   */
  const validateConfiguration = () => {
    const errors = {};
    let hasErrors = false;

    // Validate interior categories (only if they have quantities)
    INTERIOR_CATEGORIES.forEach(category => {
      const config = productSets.interior[category.key];
      
      if (config.unitCount > 0 && (!config.products || config.products.length === 0)) {
        errors[`interior_${category.key}`] = 'Product required for this category';
        hasErrors = true;
      }
    });

    // Validate exterior categories (only if they have quantities)
    EXTERIOR_CATEGORIES.forEach(category => {
      const config = productSets.exterior[category.key];
      
      if (config.unitCount > 0 && (!config.products || config.products.length === 0)) {
        errors[`exterior_${category.key}`] = 'Product required for this category';
        hasErrors = true;
      }
    });

    // Validate cabinet subcategories - if one has products, both should
    const cabinetFace = productSets.interior.cabinetsFace;
    const cabinetDoors = productSets.interior.cabinetsDoors;
    
    if ((cabinetFace.products?.length > 0 || cabinetFace.unitCount > 0) && 
        (!cabinetDoors.products || cabinetDoors.products.length === 0)) {
      errors['interior_cabinetsDoors'] = 'Cabinet doors product required when cabinet faces are configured';
      hasErrors = true;
    }
    
    if ((cabinetDoors.products?.length > 0 || cabinetDoors.unitCount > 0) && 
        (!cabinetFace.products || cabinetFace.products.length === 0)) {
      errors['interior_cabinetsFace'] = 'Cabinet face product required when cabinet doors are configured';
      hasErrors = true;
    }

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
      scheme: 'flat_rate_unit',
      interior: productSets.interior,
      exterior: productSets.exterior
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

  /**
   * Render category configuration card
   */
  const renderCategoryCard = (categoryType, category) => {
    const config = productSets[categoryType][category.key];
    const hasError = validationErrors[`${categoryType}_${category.key}`];
    const product = config.products?.[0]?.productId ? getProductById(config.products[0].productId) : null;
    const hasQuantity = config.unitCount > 0;

    return (
      <Card
        key={`${categoryType}_${category.key}`}
        size="small"
        type={config.overridden ? 'inner' : undefined}
        style={{
          borderColor: hasError ? '#ff4d4f' : config.overridden ? '#1890ff' : undefined,
          borderWidth: config.overridden ? 2 : 1,
          marginBottom: 12
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          {/* Category Label */}
          <Col xs={24} sm={8}>
            <Space>
              <span style={{ fontSize: 20 }}>{category.icon}</span>
              <div>
                <div>
                  <Text strong>{category.label}</Text>
                  {config.overridden && (
                    <Tag color="blue" style={{ fontSize: 10, marginLeft: 8 }}>
                      OVERRIDDEN
                    </Tag>
                  )}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {category.description}
                  </Text>
                </div>
                {category.multiplier && (
                  <div>
                    <Tag color="orange" style={{ fontSize: 10, marginTop: 4 }}>
                      {category.multiplier}x multiplier
                    </Tag>
                  </div>
                )}
              </div>
            </Space>
          </Col>

          {/* Product Selection */}
          <Col xs={24} sm={10}>
            <Select
              placeholder={`Select product for ${category.label.toLowerCase()}`}
              style={{ width: '100%' }}
              showSearch
              value={config.products?.[0]?.productId}
              onChange={(value) => handleProductSelect(categoryType, category.key, value)}
              filterOption={(input, option) => {
                const product = availableProducts.find(p => 
                  (p.id === option.value || p.configId === option.value)
                );
                if (!product) return false;
                
                const searchText = input.toLowerCase();
                const productName = (product.productName || product.name || '').toLowerCase();
                const brandName = (product.brandName || product.brand?.name || '').toLowerCase();
                
                return productName.includes(searchText) || brandName.includes(searchText);
              }}
              status={hasError ? 'error' : undefined}
            >
              {filteredProducts.map(product => (
                <Option 
                  key={product.id || product.configId} 
                  value={product.id || product.configId}
                >
                  <div>
                    <Text strong>{product.productName || product.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {product.brandName || product.brand?.name || 'Unknown Brand'}
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
            {hasError && (
              <Text type="danger" style={{ fontSize: 11 }}>
                {hasError}
              </Text>
            )}
          </Col>

          {/* Quantity Display */}
          <Col xs={24} sm={6}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Quantity:</Text>
                <br />
                <Badge 
                  count={config.unitCount} 
                  showZero 
                  style={{ backgroundColor: hasQuantity ? '#52c41a' : '#d9d9d9' }}
                />
                <Text style={{ marginLeft: 8, fontSize: 12 }}>
                  {config.unitCount === 1 ? 'unit' : 'units'}
                </Text>
              </div>
              {product && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {product.productName || product.name}
                  </Text>
                </div>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  /**
   * Count configured categories
   */
  const getConfiguredCount = (categoryType) => {
    const categories = categoryType === 'interior' ? INTERIOR_CATEGORIES : EXTERIOR_CATEGORIES;
    return categories.filter(cat => {
      const config = productSets[categoryType][cat.key];
      return config.products && config.products.length > 0;
    }).length;
  };

  const interiorConfigured = getConfiguredCount('interior');
  const exteriorConfigured = getConfiguredCount('exterior');

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3}>
          <HomeOutlined /> Flat Rate Unit Product Configuration
        </Title>
        <Text type="secondary">
          Configure products for each interior and exterior category. Use "Apply to All" to quickly assign 
          the same product to multiple categories, then override individual categories as needed.
        </Text>
      </div>

      {/* Validation Errors Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          message="Validation Errors"
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
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

      {/* Product Search */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Input
          placeholder="Search products by name or brand..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </Card>

      {/* Interior Categories Section */}
      <Card 
        title={
          <Space>
            <HomeOutlined />
            <span>Interior Categories</span>
            <Badge 
              count={`${interiorConfigured}/${INTERIOR_CATEGORIES.length}`} 
              style={{ backgroundColor: interiorConfigured === INTERIOR_CATEGORIES.length ? '#52c41a' : '#1890ff' }}
            />
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="Select product to apply to all interior"
              style={{ width: 300 }}
              showSearch
              value={selectedInteriorProduct?.id || selectedInteriorProduct?.configId}
              onChange={(value) => {
                const product = availableProducts.find(p => p.id === value || p.configId === value);
                setSelectedInteriorProduct(product);
              }}
              filterOption={(input, option) => {
                const product = availableProducts.find(p => 
                  (p.id === option.value || p.configId === option.value)
                );
                if (!product) return false;
                
                const searchText = input.toLowerCase();
                const productName = (product.productName || product.name || '').toLowerCase();
                const brandName = (product.brandName || product.brand?.name || '').toLowerCase();
                
                return productName.includes(searchText) || brandName.includes(searchText);
              }}
            >
              {filteredProducts.map(product => (
                <Option 
                  key={product.id || product.configId} 
                  value={product.id || product.configId}
                >
                  {product.productName || product.name} - {product.brandName || product.brand?.name || 'Unknown'}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleApplyToAllInterior}
              disabled={!selectedInteriorProduct}
            >
              Apply to All Interior
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {INTERIOR_CATEGORIES.map(category => renderCategoryCard('interior', category))}
      </Card>

      {/* Exterior Categories Section */}
      <Card 
        title={
          <Space>
            <BankOutlined />
            <span>Exterior Categories</span>
            <Badge 
              count={`${exteriorConfigured}/${EXTERIOR_CATEGORIES.length}`} 
              style={{ backgroundColor: exteriorConfigured === EXTERIOR_CATEGORIES.length ? '#52c41a' : '#1890ff' }}
            />
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="Select product to apply to all exterior"
              style={{ width: 300 }}
              showSearch
              value={selectedExteriorProduct?.id || selectedExteriorProduct?.configId}
              onChange={(value) => {
                const product = availableProducts.find(p => p.id === value || p.configId === value);
                setSelectedExteriorProduct(product);
              }}
              filterOption={(input, option) => {
                const product = availableProducts.find(p => 
                  (p.id === option.value || p.configId === option.value)
                );
                if (!product) return false;
                
                const searchText = input.toLowerCase();
                const productName = (product.productName || product.name || '').toLowerCase();
                const brandName = (product.brandName || product.brand?.name || '').toLowerCase();
                
                return productName.includes(searchText) || brandName.includes(searchText);
              }}
            >
              {filteredProducts.map(product => (
                <Option 
                  key={product.id || product.configId} 
                  value={product.id || product.configId}
                >
                  {product.productName || product.name} - {product.brandName || product.brand?.name || 'Unknown'}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleApplyToAllExterior}
              disabled={!selectedExteriorProduct}
            >
              Apply to All Exterior
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {EXTERIOR_CATEGORIES.map(category => renderCategoryCard('exterior', category))}
      </Card>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          type="primary" 
          onClick={handleSave}
          loading={loading}
          icon={<CheckCircleOutlined />}
        >
          Save Configuration
        </Button>
      </div>

      {/* Info Alert */}
      <Alert
        message="Product Configuration Tips"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Use "Apply to All Interior" or "Apply to All Exterior" to quickly assign products to all categories</li>
            <li>Override individual categories by selecting a different product directly</li>
            <li>Overridden categories are highlighted with a blue border and "OVERRIDDEN" tag</li>
            <li>Garage door multipliers (0.5x, 1.0x, 1.5x) are automatically applied based on size</li>
            <li>Cabinet Face and Cabinet Doors must both be configured if either is selected</li>
            <li>Only categories with quantities greater than 0 require product assignments</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  );
};

FlatRateUnitProductConfig.propTypes = {
  quote: PropTypes.object.isRequired,
  availableProducts: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default FlatRateUnitProductConfig;
