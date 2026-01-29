import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Alert,
  Space,
  Typography,
  Tag,
  message,
  Modal,
  Input,
  InputNumber,
  Row,
  Col,
  Tooltip,
  List,
  Divider
} from 'antd';
import {
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  EditOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

/**
 * HourlyPricingProductConfig Component
 * 
 * Displays hourly items interface for Hourly (time-and-materials) pricing scheme.
 * Allows contractors to configure products for time-and-materials work.
 * 
 * Features:
 * - Display hourly items interface
 * - Product assignment per item
 * - Quantity and description fields
 * - Save to productSets.items structure
 * - Validation feedback
 */
const HourlyPricingProductConfig = ({
  quote,
  availableProducts = [],
  onSave,
  onCancel,
  loading = false
}) => {
  // Initialize state from quote's productSets
  const [items, setItems] = useState(() => {
    const initialItems = [];

    // Load existing data from quote if available
    if (quote?.productSets?.items && Array.isArray(quote.productSets.items)) {
      return quote.productSets.items.map((item, index) => ({
        ...item,
        id: item.id || `item-${index + 1}`
      }));
    }

    // Start with one empty item
    return [{
      id: 'item-1',
      description: '',
      products: [],
      estimatedHours: 0,
      laborRate: 50.00,
      laborCost: 0,
      materialCost: 0,
      totalCost: 0
    }];
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Track changes
  useEffect(() => {
    setHasChanges(true);
  }, [items]);

  /**
   * Add a new item
   */
  const handleAddItem = () => {
    const newItem = {
      id: `item-${Date.now()}`,
      description: '',
      products: [],
      estimatedHours: 0,
      laborRate: 50.00,
      laborCost: 0,
      materialCost: 0,
      totalCost: 0
    };

    setItems(prev => [...prev, newItem]);
    setEditingItem(newItem.id);
  };

  /**
   * Remove an item
   */
  const handleRemoveItem = (itemId) => {
    Modal.confirm({
      title: 'Remove Item?',
      content: 'Are you sure you want to remove this item?',
      icon: <DeleteOutlined />,
      okText: 'Remove',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: () => {
        setItems(prev => prev.filter(item => item.id !== itemId));
        
        // Clear validation errors for this item
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[itemId];
          return newErrors;
        });

        message.success('Item removed');
      }
    });
  };

  /**
   * Update item field
   */
  const handleUpdateItem = (itemId, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;

      const updatedItem = {
        ...item,
        [field]: value
      };

      // Recalculate costs
      if (field === 'estimatedHours' || field === 'laborRate') {
        updatedItem.laborCost = (updatedItem.estimatedHours || 0) * (updatedItem.laborRate || 0);
      }

      // Calculate material cost from products
      if (field === 'products') {
        updatedItem.materialCost = value.reduce((sum, product) => {
          return sum + ((product.quantity || 0) * (product.cost || 0));
        }, 0);
      }

      // Calculate total cost
      updatedItem.totalCost = (updatedItem.laborCost || 0) + (updatedItem.materialCost || 0);

      return updatedItem;
    }));

    // Clear validation error for this item
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[itemId];
      return newErrors;
    });
  };

  /**
   * Add product to an item
   */
  const handleAddProductToItem = (itemId, productId) => {
    const product = availableProducts.find(p => p.id === productId || p.configId === productId);
    
    if (!product) {
      message.error('Product not found');
      return;
    }

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const newProduct = {
      productId: product.id || product.configId,
      productName: product.productName || product.name,
      brandName: product.brandName || product.brand?.name || 'Unknown',
      quantity: 1,
      unit: 'gallons',
      cost: product.pricePerGallon || product.sheens?.[0]?.price || 0
    };

    const updatedProducts = [...(item.products || []), newProduct];
    handleUpdateItem(itemId, 'products', updatedProducts);
  };

  /**
   * Update product quantity in an item
   */
  const handleUpdateProductQuantity = (itemId, productIndex, quantity) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updatedProducts = [...item.products];
    updatedProducts[productIndex] = {
      ...updatedProducts[productIndex],
      quantity: quantity || 0
    };

    handleUpdateItem(itemId, 'products', updatedProducts);
  };

  /**
   * Remove product from an item
   */
  const handleRemoveProductFromItem = (itemId, productIndex) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updatedProducts = item.products.filter((_, index) => index !== productIndex);
    handleUpdateItem(itemId, 'products', updatedProducts);
  };

  /**
   * Validate product configuration
   */
  const validateConfiguration = () => {
    const errors = {};
    let hasErrors = false;

    items.forEach(item => {
      // Check if description is provided
      if (!item.description || item.description.trim() === '') {
        errors[item.id] = 'Description is required';
        hasErrors = true;
      }

      // Check if at least one product is assigned or hours are estimated
      if ((!item.products || item.products.length === 0) && (!item.estimatedHours || item.estimatedHours <= 0)) {
        errors[item.id] = 'Either products or estimated hours must be specified';
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
      scheme: 'hourly',
      items: items
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
   * Calculate total costs
   */
  const calculateTotals = () => {
    return items.reduce((totals, item) => {
      return {
        laborCost: totals.laborCost + (item.laborCost || 0),
        materialCost: totals.materialCost + (item.materialCost || 0),
        totalCost: totals.totalCost + (item.totalCost || 0)
      };
    }, { laborCost: 0, materialCost: 0, totalCost: 0 });
  };

  const totals = calculateTotals();

  /**
   * Render item card
   */
  const renderItemCard = (item, index) => {
    const hasError = validationErrors[item.id];
    const isEditing = editingItem === item.id;

    return (
      <Card
        key={item.id}
        size="small"
        style={{
          marginBottom: 16,
          borderColor: hasError ? '#ff4d4f' : undefined
        }}
        title={
          <Space>
            <ClockCircleOutlined />
            <Text strong>Item {index + 1}</Text>
            {item.description && <Text type="secondary">- {item.description.substring(0, 30)}{item.description.length > 30 ? '...' : ''}</Text>}
          </Space>
        }
        extra={
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setEditingItem(isEditing ? null : item.id)}
              size="small"
            >
              {isEditing ? 'Collapse' : 'Edit'}
            </Button>
            {items.length > 1 && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveItem(item.id)}
                size="small"
              >
                Remove
              </Button>
            )}
          </Space>
        }
      >
        {hasError && (
          <Alert
            message={hasError}
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <Text strong>Description:</Text>
          <TextArea
            placeholder="Describe the work to be done (e.g., 'Interior walls - prep and paint')"
            value={item.description}
            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
            rows={2}
            style={{ marginTop: 4 }}
            status={hasError && !item.description ? 'error' : undefined}
          />
        </div>

        {isEditing && (
          <>
            {/* Labor Information */}
            <Divider orientation="left" plain>Labor</Divider>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">Estimated Hours:</Text>
                  <InputNumber
                    placeholder="Hours"
                    min={0}
                    precision={1}
                    value={item.estimatedHours}
                    onChange={(value) => handleUpdateItem(item.id, 'estimatedHours', value)}
                    addonAfter="hrs"
                    style={{ width: '100%' }}
                  />
                </Space>
              </Col>
              <Col xs={24} sm={12}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text type="secondary">Labor Rate:</Text>
                  <InputNumber
                    placeholder="Rate"
                    min={0}
                    precision={2}
                    value={item.laborRate}
                    onChange={(value) => handleUpdateItem(item.id, 'laborRate', value)}
                    addonBefore="$"
                    addonAfter="/hr"
                    style={{ width: '100%' }}
                  />
                </Space>
              </Col>
            </Row>

            {/* Products */}
            <Divider orientation="left" plain>Materials</Divider>
            
            {/* Add Product */}
            <div style={{ marginBottom: 12 }}>
              <Select
                placeholder="Add a product to this item"
                style={{ width: '100%' }}
                showSearch
                value={null}
                onChange={(value) => handleAddProductToItem(item.id, value)}
                filterOption={(input, option) => {
                  const label = option.label || '';
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
              >
                {availableProducts.map(product => {
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
            </div>

            {/* Product List */}
            {item.products && item.products.length > 0 && (
              <List
                size="small"
                bordered
                dataSource={item.products}
                renderItem={(product, productIndex) => (
                  <List.Item
                    actions={[
                      <Button
                        key="remove"
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveProductFromItem(item.id, productIndex)}
                      >
                        Remove
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{product.brandName}</Text>
                          <Text>-</Text>
                          <Text>{product.productName}</Text>
                        </Space>
                      }
                      description={
                        <Space>
                          <InputNumber
                            size="small"
                            min={0}
                            precision={1}
                            value={product.quantity}
                            onChange={(value) => handleUpdateProductQuantity(item.id, productIndex, value)}
                            addonAfter="gal"
                            style={{ width: 120 }}
                          />
                          <Text type="secondary">
                            @ ${product.cost.toFixed(2)}/gal = ${((product.quantity || 0) * product.cost).toFixed(2)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </>
        )}

        {/* Cost Summary */}
        <Divider />
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>Labor Cost:</Text>
              <Text strong>${item.laborCost.toFixed(2)}</Text>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>Material Cost:</Text>
              <Text strong>${item.materialCost.toFixed(2)}</Text>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 12 }}>Total Cost:</Text>
              <Text strong style={{ color: '#1890ff' }}>${item.totalCost.toFixed(2)}</Text>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div className="hourly-pricing-product-config">
      <Alert
        message="Hourly Pricing - Time and Materials Configuration"
        description="Configure products and labor for time-and-materials work. Add items with descriptions, estimated hours, and materials needed."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Items List */}
      <div style={{ marginBottom: 24 }}>
        {items.map((item, index) => renderItemCard(item, index))}
      </div>

      {/* Add Item Button */}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddItem}
        block
        style={{ marginBottom: 24 }}
      >
        Add Item
      </Button>

      {/* Totals Summary */}
      <Card
        title="Total Estimate"
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text type="secondary">Total Labor:</Text>
              <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                ${totals.laborCost.toFixed(2)}
              </Title>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text type="secondary">Total Materials:</Text>
              <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                ${totals.materialCost.toFixed(2)}
              </Title>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Text type="secondary">Grand Total:</Text>
              <Title level={4} style={{ margin: 0, color: '#fa8c16' }}>
                ${totals.totalCost.toFixed(2)}
              </Title>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Validation Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          message="Validation Errors"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {Object.entries(validationErrors).map(([itemId, error]) => {
                const itemIndex = items.findIndex(i => i.id === itemId);
                return (
                  <li key={itemId}>
                    <strong>Item {itemIndex + 1}:</strong> {error}
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

HourlyPricingProductConfig.propTypes = {
  quote: PropTypes.object.isRequired,
  availableProducts: PropTypes.array,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default HourlyPricingProductConfig;
