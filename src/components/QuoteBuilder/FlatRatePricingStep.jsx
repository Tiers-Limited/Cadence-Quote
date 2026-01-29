// src/components/QuoteBuilder/FlatRatePricingStep.jsx
/**
 * FlatRatePricingStep Component
 * 
 * Handles flat rate pricing for quote builder.
 * This component is specifically designed for item-based pricing with NO:
 * - Area/room selection
 * - Square footage inputs
 * - Measurement calculations
 * 
 * Features:
 * - Simple item counters for interior and exterior items
 * - Unit prices loaded from contractor settings
 * - Real-time subtotal calculation
 * - Conditional display based on job type (interior/exterior/both)
 * 
 * @param {Object} formData - Current form data including flatRateItems and jobType
 * @param {Function} onUpdate - Callback to update parent form data
 * @param {Function} onNext - Callback to proceed to next step
 * @param {Function} onPrevious - Callback to go back to previous step
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Row, Col, Typography, InputNumber, Space, Divider, Alert, message } from 'antd';
import { PlusOutlined, MinusOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * Flat rate item definitions with default prices
 * These are fallback prices if contractor settings don't provide custom prices
 */
const FLAT_RATE_ITEMS = {
  interior: {
    doors: { label: 'Doors', unit: 'each', defaultPrice: 85 },
    smallRooms: { label: 'Small Rooms', unit: 'each', defaultPrice: 350 },
    mediumRooms: { label: 'Medium Rooms', unit: 'each', defaultPrice: 450 },
    largeRooms: { label: 'Large Rooms', unit: 'each', defaultPrice: 600 },
    closets: { label: 'Closets', unit: 'each', defaultPrice: 150 },
    accentWalls: { label: 'Accent Walls', unit: 'each', defaultPrice: 200 },
    cabinetFaces: { label: 'Cabinet Faces', unit: 'each', defaultPrice: 125 },
    cabinetDoors: { label: 'Cabinet Doors', unit: 'each', defaultPrice: 25 }
  },
  exterior: {
    doors: { label: 'Exterior Doors', unit: 'each', defaultPrice: 95 },
    windows: { label: 'Windows', unit: 'each', defaultPrice: 75 },
    garageDoors1Car: { label: '1-Car Garage Doors', unit: 'each', defaultPrice: 150 },
    garageDoors2Car: { label: '2-Car Garage Doors', unit: 'each', defaultPrice: 200 },
    garageDoors3Car: { label: '3-Car Garage Doors', unit: 'each', defaultPrice: 250 },
    shutters: { label: 'Shutters', unit: 'each', defaultPrice: 50 }
  }
};

const FlatRatePricingStep = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [itemCounts, setItemCounts] = useState(formData.flatRateItems || {
    interior: {},
    exterior: {}
  });
  const [loading, setLoading] = useState(false);
  const [unitPrices, setUnitPrices] = useState({});

  const jobType = formData.jobType || 'interior';
  const contractorSettings = formData.contractorSettings || {};

  // Initialize unit prices from contractor settings
  useEffect(() => {
    const settingsPrices = contractorSettings.flatRateUnitPrices || {};
    const defaultPrices = {};
    
    // Map contractor settings to component keys
    const priceMapping = {
      'interior_doors': settingsPrices.door || 85,
      'interior_smallRooms': settingsPrices.room_small || 350,
      'interior_mediumRooms': settingsPrices.room_medium || 450,
      'interior_largeRooms': settingsPrices.room_large || 600,
      'interior_closets': settingsPrices.closet || 150,
      'interior_accentWalls': settingsPrices.accent_wall || 200,
      'interior_cabinetFaces': settingsPrices.cabinet_face || 125,
      'interior_cabinetDoors': settingsPrices.cabinet_door || 25,
      'exterior_doors': settingsPrices.exterior_door || 95,
      'exterior_windows': settingsPrices.window || 75,
      'exterior_garageDoors1Car': settingsPrices.garage_door_1car || 150,
      'exterior_garageDoors2Car': settingsPrices.garage_door_2car || 200,
      'exterior_garageDoors3Car': settingsPrices.garage_door_3car || 250,
      'exterior_shutters': settingsPrices.shutters || 50,
    };
    
    setUnitPrices(priceMapping);
  }, [contractorSettings]);

  // Initialize item counts from form data
  useEffect(() => {
    if (formData.flatRateItems) {
      setItemCounts(formData.flatRateItems);
    }
  }, [formData.flatRateItems]);

  // Debounced update to parent component
  const debouncedUpdate = useCallback(
    debounce((updatedCounts) => {
      onUpdate({
        flatRateItems: updatedCounts,
        // Clear areas since flat rate doesn't use them
        areas: []
      });
    }, 300),
    [onUpdate]
  );

  /**
   * Handle item count change
   * Updates the count for a specific item and triggers parent update
   * 
   * @param {string} category - 'interior' or 'exterior'
   * @param {string} item - Item key (e.g., 'doors', 'smallRooms')
   * @param {number} count - New count value
   */
  const handleItemCountChange = (category, item, count) => {
    const newCount = Math.max(0, count || 0);
    
    const updated = {
      ...itemCounts,
      [category]: {
        ...itemCounts[category],
        [item]: newCount
      }
    };
    
    setItemCounts(updated);
    debouncedUpdate(updated);
  };

  const handleIncrement = (category, item) => {
    const currentCount = itemCounts[category]?.[item] || 0;
    handleItemCountChange(category, item, currentCount + 1);
  };

  const handleDecrement = (category, item) => {
    const currentCount = itemCounts[category]?.[item] || 0;
    if (currentCount > 0) {
      handleItemCountChange(category, item, currentCount - 1);
    }
  };

  /**
   * Calculate total price across all items
   * Multiplies each item count by its unit price
   * 
   * @returns {number} Total price for all selected items
   */
  const calculateTotal = () => {
    let total = 0;
    
    Object.entries(FLAT_RATE_ITEMS).forEach(([category, items]) => {
      Object.entries(items).forEach(([key, item]) => {
        const count = itemCounts[category]?.[key] || 0;
        const price = unitPrices[`${category}_${key}`] || item.defaultPrice;
        total += count * price;
      });
    });
    
    return total;
  };

  const getTotalItems = () => {
    let total = 0;
    Object.values(itemCounts).forEach(category => {
      Object.values(category).forEach(count => {
        total += count || 0;
      });
    });
    return total;
  };

  const validateStep = () => {
    const totalItems = getTotalItems();
    if (totalItems === 0) {
      message.warning('Please select at least one item to continue');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      onNext();
    }
  };

  const renderItemCounter = (category, itemKey, itemData) => {
    const count = itemCounts[category]?.[itemKey] || 0;
    const price = unitPrices[`${category}_${itemKey}`] || itemData.defaultPrice;
    const subtotal = count * price;

    return (
      <Card 
        key={`${category}_${itemKey}`}
        size="small" 
        className="mb-3"
        style={{ backgroundColor: count > 0 ? '#f6ffed' : '#fafafa' }}
      >
        <Row align="middle" justify="space-between">
          <Col span={8}>
            <div>
              <Text strong>{itemData.label}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ${price.toFixed(2)} {itemData.unit}
              </Text>
            </div>
          </Col>
          
          <Col span={8}>
            <Space>
              <Button
                type="text"
                icon={<MinusOutlined />}
                onClick={() => handleDecrement(category, itemKey)}
                disabled={count === 0}
                size="small"
              />
              
              <InputNumber
                value={count}
                onChange={(value) => handleItemCountChange(category, itemKey, value)}
                min={0}
                max={999}
                size="small"
                style={{ width: '60px', textAlign: 'center' }}
                controls={false}
              />
              
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => handleIncrement(category, itemKey)}
                size="small"
              />
            </Space>
          </Col>
          
          <Col span={8} style={{ textAlign: 'right' }}>
            <Text strong style={{ color: count > 0 ? '#52c41a' : '#8c8c8c' }}>
              ${subtotal.toFixed(2)}
            </Text>
          </Col>
        </Row>
      </Card>
    );
  };

  const renderCategory = (category, title) => {
    const items = FLAT_RATE_ITEMS[category];
    const categoryTotal = Object.entries(items).reduce((sum, [key, item]) => {
      const count = itemCounts[category]?.[key] || 0;
      const price = unitPrices[`${category}_${key}`] || item.defaultPrice;
      return sum + (count * price);
    }, 0);

    const categoryItemCount = Object.values(itemCounts[category] || {}).reduce((sum, count) => sum + (count || 0), 0);

    return (
      <Card 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{title}</span>
            <div>
              <Text type="secondary" style={{ marginRight: '16px' }}>
                {categoryItemCount} items
              </Text>
              <Text strong style={{ color: '#1890ff' }}>
                ${categoryTotal.toFixed(2)}
              </Text>
            </div>
          </div>
        }
        className="mb-4"
      >
        {Object.entries(items).map(([key, item]) => 
          renderItemCounter(category, key, item)
        )}
      </Card>
    );
  };

  const subtotal = calculateTotal();
  const totalItems = getTotalItems();

  return (
    <div>
      <Alert
        message="Flat Rate Pricing - Item-Based Only"
        description={`Count the number of items for each category. No room/area selection, no measurements needed! 
          Materials are included in the unit prices. Perfect for standardized pricing.`}
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        className="mb-4"
      />

      <Row gutter={[24, 24]}>
        {/* Show interior items for interior jobs or both */}
        {(jobType === 'interior' || jobType === 'both') && (
          <Col xs={24} lg={12}>
            {renderCategory('interior', 'Interior Items')}
          </Col>
        )}

        {/* Show exterior items for exterior jobs or both */}
        {(jobType === 'exterior' || jobType === 'both') && (
          <Col xs={24} lg={12}>
            {renderCategory('exterior', 'Exterior Items')}
          </Col>
        )}
      </Row>

      {/* Summary Card */}
      <Card 
        title="Quote Summary" 
        className="mt-4"
        style={{ backgroundColor: '#f0f9ff' }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space direction="vertical" size="small">
              <Text>Total Items: <Text strong>{totalItems}</Text></Text>
              <Text>Pricing Model: <Text strong>Flat Rate Unit Pricing</Text></Text>
            </Space>
          </Col>
          <Col>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary">Subtotal</Text>
              <br />
              <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                ${subtotal.toFixed(2)}
              </Title>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button onClick={onPrevious} size="large">
          Previous
        </Button>
        
        <Button 
          type="primary" 
          onClick={handleNext} 
          size="large"
          disabled={totalItems === 0}
        >
          Next: Products
        </Button>
      </div>
    </div>
  );
};

/**
 * Simple debounce utility
 * Delays function execution until after wait milliseconds have elapsed
 * since the last time it was invoked
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default FlatRatePricingStep;