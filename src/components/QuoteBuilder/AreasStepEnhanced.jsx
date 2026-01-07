// src/components/QuoteBuilder/AreasStepEnhanced.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, Select, InputNumber, Space, Modal, Tag, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import DimensionCalculator from './DimensionCalculator';

const { Title, Text, Link } = Typography;
const { Option } = Select;

// Common rooms based on job type
const COMMON_ROOMS = {
  interior: [
    'Living Room',
    'Master Bedroom',
    'Bedroom 2',
    'Bedroom 3',
    'Kitchen',
    'Dining Room',
    'Bathroom',
    'Hallway',
    'Office',
    'Laundry Room'
  ],
  exterior: [
    'Exterior Siding',
    'Garage',
    'Deck',
    'Fence',
    'Shutters'
  ]
};

// Labor category mapping (from backend)
const LABOR_CATEGORIES = {
  interior: [
    { name: 'Walls', unit: 'sqft', defaultCoats: 2 },
    { name: 'Ceilings', unit: 'sqft', defaultCoats: 2 },
    { name: 'Trim', unit: 'linear_foot', defaultCoats: 2 },
    { name: 'Doors', unit: 'unit', defaultCoats: 2 },
    { name: 'Cabinets', unit: 'unit', defaultCoats: 2 },
    { name: 'Accent Walls', unit: 'sqft', defaultCoats: 2 },
    { name: 'Drywall Repair', unit: 'hour', defaultCoats: 0 }
  ],
  exterior: [
    { name: 'Exterior Walls', unit: 'sqft', defaultCoats: 2 },
    { name: 'Exterior Trim', unit: 'linear_foot', defaultCoats: 2 },
    { name: 'Exterior Doors', unit: 'unit', defaultCoats: 2 },
    { name: 'Shutters', unit: 'unit', defaultCoats: 2 },
    { name: 'Decks & Railings', unit: 'sqft', defaultCoats: 2 },
    { name: 'Soffit & Fascia', unit: 'linear_foot', defaultCoats: 2 },
    { name: 'Prep Work', unit: 'hour', defaultCoats: 0 }
  ]
};

const COVERAGE_RATE = 350; // sq ft per gallon

const AreasStepEnhanced = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [areas, setAreas] = useState(formData.areas || []);
  const [showCustomAreaModal, setShowCustomAreaModal] = useState(false);
  const [customAreaName, setCustomAreaName] = useState('');
  const [laborCategories, setLaborCategories] = useState([]);
  const [laborRates, setLaborRates] = useState({});
  const [dimensionCalc, setDimensionCalc] = useState({ visible: false, areaId: null, categoryName: null });

  const jobType = formData.jobType || 'interior';
  const availableRooms = COMMON_ROOMS[jobType] || [];
  const availableCategories = LABOR_CATEGORIES[jobType] || [];
  const contractorSettings = formData.contractorSettings || {};

  useEffect(() => {
    // Check if current pricing model needs labor categories/rates
    const needsLaborData = formData.pricingModelType === 'rate_based_sqft' || 
                          formData.pricingModelType === 'production_based';
    
    if (!needsLaborData) {
      // Clear labor data if not needed for flat rate pricing
      setLaborCategories([]);
      setLaborRates({});
      return;
    }
    
    // Use synced settings if available, otherwise fetch
    // Only fetch once - use formData.contractorSettings to avoid infinite loops from object reference changes
    if (formData.contractorSettings?.laborCategories && formData.contractorSettings.laborCategories.length > 0) {
      setLaborCategories(formData.contractorSettings.laborCategories);
      
      // Build rates map from synced data
      const ratesMap = {};
      if (formData.contractorSettings.laborRates && Array.isArray(formData.contractorSettings.laborRates)) {
        formData.contractorSettings.laborRates.forEach((rateRecord) => {
          ratesMap[rateRecord.laborCategoryId] = parseFloat(rateRecord.rate) || 0;
        });
      }
      setLaborRates(ratesMap);
    } else if (laborCategories.length === 0) {
      // Only fetch if we don't already have data and we need it
      fetchLaborCategories();
      fetchLaborRates();
    }
  }, [formData.contractorSettings, formData.pricingModelType]);

  useEffect(() => {
    onUpdate({ areas });
  }, [areas]);

  // Update labor rates when pricing model or contractor settings change
  useEffect(() => {
    if (areas.length > 0) {
      const updatedAreas = areas.map(area => ({
        ...area,
        laborItems: area.laborItems.map(item => ({
          ...item,
          laborRate: getLaborRate(item.categoryName)
        }))
      }));
      setAreas(updatedAreas);
    }
  }, [formData.pricingModelType, formData.contractorSettings]);

  const fetchLaborCategories = async () => {
    try {
      const response = await apiService.get('/labor-categories');
      if (response.success) {
        setLaborCategories(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching labor categories:', error);
    }
  };

  const fetchLaborRates = async () => {
    try {
      const response = await apiService.get('/labor-categories/rates');
      if (response.success && Array.isArray(response.data)) {
        // Create a map of laborCategoryId to rate for easier lookup
        const ratesMap = {};
        response.data.forEach((rateRecord) => {
          ratesMap[rateRecord.laborCategoryId] = parseFloat(rateRecord.rate) || 0;
        });
        setLaborRates(ratesMap);
      }
    } catch (error) {
      console.error('Error fetching labor rates:', error);
    }
  };

  const addArea = (areaName, isCustom = false) => {
    const newArea = {
      id: Date.now(),
      name: areaName,
      jobType,
      isCustom,
      laborItems: availableCategories.map(cat => ({
        categoryName: cat.name,
        measurementUnit: cat.unit,
        selected: false,
        quantity: null,
        numberOfCoats: cat.defaultCoats,
        dimensions: null,
        laborRate: getLaborRate(cat.name),
        gallons: null,
        allowManualGallons: false
      }))
    };
    setAreas([...areas, newArea]);
  };

  // Helper function to map category names to flat rate keys
  const mapCategoryToFlatRateKey = (categoryName) => {
    const mapping = {
      'Walls': 'walls',
      'Ceilings': 'ceilings',
      'Trim': 'trim',
      'Doors': 'door',
      'Windows': 'window',
      'Cabinets': 'cabinet',
      'Small Room': 'room_small',
      'Medium Room': 'room_medium',
      'Large Room': 'room_large'
    };
    return mapping[categoryName] || categoryName.toLowerCase();
  };

  const getLaborRate = (categoryName) => {
    // If flat rate unit pricing model is selected, use flat rate prices
    if (formData.pricingModelType === 'flat_rate_unit' && contractorSettings.flatRateUnitPrices) {
      const flatRateKey = mapCategoryToFlatRateKey(categoryName);
      const flatRate = contractorSettings.flatRateUnitPrices[flatRateKey];
      return flatRate ? parseFloat(flatRate) : 0;
    }

    // Otherwise use labor rates
    const category = laborCategories.find(c => c.categoryName === categoryName);
    if (!category) return 0;

    // laborRates is now a map, so directly access by category.id
    return laborRates[category.id] || 0;
  };

  const removeArea = (areaId) => {
    setAreas(areas.filter(a => a.id !== areaId));
  };

  const toggleLaborItem = (areaId, categoryName, checked) => {
    setAreas(areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          laborItems: area.laborItems.map(item => 
            item.categoryName === categoryName 
              ? { ...item, selected: checked }
              : item
          )
        };
      }
      return area;
    }));
  };

  const updateLaborItem = (areaId, categoryName, field, value) => {
    setAreas(areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          laborItems: area.laborItems.map(item => {
            if (item.categoryName === categoryName) {
              const updatedItem = { ...item, [field]: value };

              // Auto-calculate gallons when quantity or coats change
              if ((field === 'quantity' || field === 'numberOfCoats') && !item.allowManualGallons) {
                const qty = field === 'quantity' ? value : item.quantity;
                const coats = field === 'numberOfCoats' ? value : item.numberOfCoats;

                if (qty && coats && item.measurementUnit === 'sqft') {
                  const totalSqft = parseFloat(qty) * parseInt(coats);
                  const calculatedGallons = totalSqft / COVERAGE_RATE;
                  // Round up to nearest 0.5 gallon
                  updatedItem.gallons = Math.ceil(calculatedGallons * 2) / 2;
                }
              }

              return updatedItem;
            }
            return item;
          })
        };
      }
      return area;
    }));
  };

  const openDimensionCalculator = (areaId, categoryName) => {
    const area = areas.find(a => a.id === areaId);
    const item = area?.laborItems.find(i => i.categoryName === categoryName);
    
    setDimensionCalc({
      visible: true,
      areaId,
      categoryName,
      initialDimensions: item?.dimensions
    });
  };

  const handleDimensionCalculation = (sqft, dimensions) => {
    updateLaborItem(dimensionCalc.areaId, dimensionCalc.categoryName, 'quantity', sqft);
    updateLaborItem(dimensionCalc.areaId, dimensionCalc.categoryName, 'dimensions', dimensions);
    setDimensionCalc({ visible: false, areaId: null, categoryName: null });
  };

  const handleCustomAreaSubmit = () => {
    if (customAreaName.trim()) {
      const alreadyExists = areas.some(a => a.isCustom);
      if (alreadyExists) {
        Modal.warning({
          title: 'Custom Area Limit',
          content: 'Only one custom area can be added. Remove the existing custom area to add a different one.'
        });
        return;
      }
      addArea(customAreaName.trim(), true);
      setCustomAreaName('');
      setShowCustomAreaModal(false);
    }
  };

  const handleNext = () => {
    const hasAreas = areas.length > 0;
    const hasSelectedItems = areas.some(area => 
      area.laborItems.some(item => item.selected)
    );

    if (!hasAreas || !hasSelectedItems) {
      const modelType = formData.pricingModelType || 'rate_based_sqft';
      let message = 'Please select at least one area and labor category before continuing.';
      
      if (modelType === 'flat_rate_unit') {
        message = 'Please add areas and count the number of units (doors, windows, etc.) before continuing.';
      } else if (modelType === 'production_based') {
        message = 'Please add areas with measurements. We\'ll calculate estimated hours based on your productivity rates.';
      }
      
      Modal.warning({
        title: 'No Areas Selected',
        content: message,
      });
      return;
    }

    // Check if selected items have quantities
    const missingQuantities = areas.some(area =>
      area.laborItems.some(item => item.selected && (!item.quantity || item.quantity <= 0))
    );

    if (missingQuantities) {
      const modelType = formData.pricingModelType || 'rate_based_sqft';
      let message = 'Please enter measurements for all selected surfaces.';
      
      if (modelType === 'flat_rate_unit') {
        message = 'Please enter quantities for all selected items.';
      }
      
      Modal.warning({
        title: 'Missing Measurements',
        content: message,
      });
      return;
    }

    onNext();
  };

  const getUnitLabel = (unit) => {
    const labels = {
      sqft: 'sq ft',
      linear_foot: 'LF',
      unit: 'units',
      hour: 'hrs'
    };
    return labels[unit] || unit;
  };

  // Check if using unit counts (Flat Rate model)
  const isUnitCountMode = () => {
    return formData.pricingModelType === 'flat_rate_unit';
  };

  // Check if using detailed measurements (Rate-Based/Production)
  const isDetailedMeasurement = () => {
    return formData.pricingModelType === 'rate_based_sqft' || 
           formData.pricingModelType === 'production_based';
  };

  // Get placeholder text based on pricing model
  const getQuantityPlaceholder = (unit) => {
    if (isUnitCountMode()) {
      return unit === 'unit' ? 'Count' : 'Qty';
    }
    return unit === 'sqft' ? 'Sq Ft' : unit === 'linear_foot' ? 'Linear Ft' : 'Qty';
  };

  // Get input label based on pricing model
  const getQuantityLabel = (unit) => {
    if (isUnitCountMode()) {
      return 'Quantity';
    }
    return unit === 'sqft' ? 'Square Feet' : unit === 'linear_foot' ? 'Linear Feet' : unit === 'unit' ? 'Count' : 'Quantity';
  };

  // Get production rate for a category (for time estimates)
  const getProductionRate = (categoryName) => {
    const prodRates = contractorSettings.productionRates || {};
    const keyMap = {
      'Walls': 'interiorWalls',
      'Ceilings': 'interiorCeilings',
      'Trim': 'interiorTrim',
      'Exterior Walls': 'exteriorWalls',
      'Exterior Trim': 'exteriorTrim',
      'Soffit & Fascia': 'soffitFascia',
      'Doors': 'doors',
      'Exterior Doors': 'doors',
      'Cabinets': 'cabinets'
    };
    const key = keyMap[categoryName] || 'interiorWalls';
    return prodRates[key] || formData.productivityRate || 300;
  };

  // Calculate estimated hours for production-based model
  const calculateEstimatedHours = (quantity, categoryName) => {
    if (!quantity || quantity <= 0) return 0;
    const productionRate = getProductionRate(categoryName);
    const crewSize = formData.crewSize || contractorSettings.other?.crewSize || 2;
    return (quantity / productionRate) / crewSize;
  };

  // Determine pricing model type for conditional rendering
  const modelType = formData.pricingModelType || 'rate_based_sqft';
  const isFlatRate = modelType === 'flat_rate_unit';
  const isProduction = modelType === 'production_based';
  const isDetailed = modelType === 'rate_based_sqft' || modelType === 'sqft_labor_paint';

  return (
    <div className="areas-step-enhanced" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Alert
        message={`Step 3: Areas & Labor – ${
          isFlatRate ? 'Flat Rate Unit Mode' : 
          isProduction ? 'Production (Time) Mode' : 
          'Detailed SqFt Mode'
        }`}
        description={
          isFlatRate 
            ? "📦 Just count items - no measurements needed! Fixed price per item (door, window, cabinet, etc.). Example: 5 doors, 8 windows, 12 cabinet doors." 
            : isProduction 
            ? "Enter measurements → we'll estimate hours based on your productivity rates." 
            : "Select rooms, specify labor categories, and enter measurements. Gallons calculate automatically."
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Pricing Model Guidance Banner */}
      {formData.pricingSchemeId && (
        <Card 
          size="small" 
          style={{ marginBottom: 16, backgroundColor: '#f0f5ff', borderColor: '#1890ff' }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
              <Text strong style={{ color: '#1890ff' }}>
                {formData.pricingModelFriendlyName || 'Rate-Based Pricing'}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {formData.pricingModelDescription || 'Enter detailed measurements for each surface to calculate labor and materials.'}
            </Text>
            {formData.pricingModelType === 'flat_rate_unit' && (
              <Alert
                message="📦 Unit Pricing: Just count items - no measurements needed!"
                description="Example: 5 doors, 8 windows, 12 cabinet doors. Price is fixed per unit."
                type="info"
                showIcon
                banner
                closable
                style={{ marginTop: 8 }}
              />
            )}
            {formData.pricingModelType === 'production_based' && (
              <Alert
                message={`⏱️ Time-Based: Estimated hours = (Total Sq Ft ÷ ${formData.productivityRate || 300} productivity) ÷ ${formData.crewSize || 2} crew`}
                description="Labor calculated automatically based on your productivity rates and crew size settings."
                type="info"
                showIcon
                banner
                closable
                style={{ marginTop: 8 }}
              />
            )}
            {formData.pricingModelType === 'rate_based_sqft' && (
              <Alert
                message="📏 Rate-Based: Enter precise measurements for accurate pricing"
                description="Use the calculator button next to inputs to convert room dimensions to square footage."
                type="info"
                showIcon
                banner
                closable
                style={{ marginTop: 8 }}
              />
            )}
          </Space>
        </Card>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Text strong>Select Areas:</Text>
        <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
          {availableRooms.map(room => {
            const allowMultiple = room === 'Kitchen' || room === 'Bathroom' || room.toLowerCase().includes('bedroom');
            const isSelected = areas.some(a => a.name === room);
            const handleClick = () => {
              if (allowMultiple) {
                const sameCount = areas.filter(a => a.name.startsWith(room)).length;
                const displayName = sameCount > 0 ? `${room} ${sameCount + 1}` : room;
                addArea(displayName);
              } else {
                return isSelected ? removeArea(areas.find(a => a.name === room)?.id) : addArea(room);
              }
            };
            return (
              <Col key={room} xs={12} sm={8} md={6} lg={4}>
                <Button
                  size="small"
                  type={isSelected && !allowMultiple ? 'primary' : 'default'}
                  block
                  onClick={handleClick}
                >
                  {room}
                </Button>
              </Col>
            );
          })}
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              size="small"
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => setShowCustomAreaModal(true)}
            >
              Custom
            </Button>
          </Col>
        </Row>
      </Card>

      {areas.length > 0 && (
        <div>
          {areas.map(area => (
            <Card 
              key={area.id}
              size="small"
              title={
                <Space>
                  <strong>{area.name}</strong>
                  <Button 
                    type="text" 
                    danger 
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeArea(area.id)}
                  />
                </Space>
              }
              style={{ marginBottom: 12 }}
            >
              {area?.laborItems?.map(item => (
                <div key={item.categoryName} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4, border: '1px solid #e8e8e8' }}>
                  <Row gutter={8} align="middle">
                    {/* Category Name */}
                    <Col xs={24} sm={5}>
                      <Space size="small">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => toggleLaborItem(area.id, item.categoryName, e.target.checked)}
                        />
                        <Text strong>{item.categoryName}</Text>
                        <Tag color="blue" style={{ margin: 0 }}>{getUnitLabel(item.measurementUnit)}</Tag>
                      </Space>
                    </Col>

                    {item.selected && (
                      <>
                        {/* Quantity/Measurement - Dynamic based on pricing model */}
                        <Col xs={12} sm={4}>
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              size="small"
                              style={{ width: '100%' }}
                              min={0}
                              step={isUnitCountMode() ? 1 : (item.measurementUnit === 'sqft' ? 10 : 1)}
                              value={item.quantity}
                              onChange={(value) => updateLaborItem(area.id, item.categoryName, 'quantity', value)}
                              placeholder={getQuantityPlaceholder(item.measurementUnit)}
                            />
                            {/* Show calculator only for detailed measurements (not unit counts) */}
                            {!isUnitCountMode() && isDetailedMeasurement() && (item.measurementUnit === 'sqft' || item.measurementUnit === 'linear_foot') && (
                              <Button
                                size="small"
                                icon={<CalculatorOutlined />}
                                onClick={() => openDimensionCalculator(area.id, item.categoryName)}
                                title="Use dimensions calculator"
                              />
                            )}
                          </Space.Compact>
                          {item.dimensions && (
                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                              {item.categoryName.includes('Wall') ? (
                                <>2×({item.dimensions.length}+{item.dimensions.width})×{item.dimensions.height}</>
                              ) : item.categoryName.includes('Ceiling') ? (
                                <>{item.dimensions.length}×{item.dimensions.width}</>
                              ) : item.categoryName.includes('Trim') ? (
                                <>2×({item.dimensions.length}+{item.dimensions.width})</>
                              ) : (
                                <>{item.dimensions.length}×{item.dimensions.width}</>
                              )}
                            </Text>
                          )}
                          {/* Helpful hint for unit count mode */}
                          {isUnitCountMode() && item.quantity > 0 && (
                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2, color: '#52c41a' }}>
                              ✓ {item.quantity} {item.measurementUnit === 'unit' ? 'items' : getUnitLabel(item.measurementUnit)}
                            </Text>
                          )}
                          {/* Show estimated hours for production-based model */}
                          {formData.pricingModelType === 'production_based' && item.quantity > 0 && (
                            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2, color: '#1890ff' }}>
                              ⏱ Est. {calculateEstimatedHours(item.quantity, item.categoryName).toFixed(1)} hours
                            </Text>
                          )}
                        </Col>

                        {/* Number of Coats (only in detailed modes - not needed for flat-rate) */}
                        {!isFlatRate && item.measurementUnit === 'sqft' && item.categoryName !== 'Drywall Repair' && item.categoryName !== 'Prep Work' && (
                          <Col xs={12} sm={3}>
                            <Select
                              size="small"
                              style={{ width: '100%' }}
                              value={item.numberOfCoats}
                              onChange={(value) => updateLaborItem(area.id, item.categoryName, 'numberOfCoats', value)}
                            >
                              <Option value={1}>1 Coat</Option>
                              <Option value={2}>2 Coats</Option>
                              <Option value={3}>3 Coats</Option>
                            </Select>
                          </Col>
                        )}

                        {/* Auto-calculated Gallons (only in detailed modes - not needed for flat-rate) */}
                        {!isFlatRate && item.measurementUnit === 'sqft' && item.categoryName !== 'Drywall Repair' && item.categoryName !== 'Prep Work' && (
                          <Col xs={12} sm={4}>
                            <Space.Compact style={{ width: '100%' }}>
                              <InputNumber
                                size="small"
                                style={{ width: '100%' }}
                                min={0}
                                step={0.5}
                                value={item.gallons}
                                onChange={(value) => updateLaborItem(area.id, item.categoryName, 'gallons', value)}
                                placeholder="Gallons"
                                disabled={!item.allowManualGallons}
                                addonAfter="gal"
                              />
                            </Space.Compact>
                            {item.quantity && item.numberOfCoats && (
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                                {item.quantity} × {item.numberOfCoats} ÷ {COVERAGE_RATE} = {item.gallons} gal
                              </Text>
                            )}
                          </Col>
                        )}

                        {/* Labor Rate Display */}
                        <Col xs={12} sm={3}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            ${getLaborRate(item.categoryName)}/{getUnitLabel(item.measurementUnit)}
                          </Text>
                        </Col>

                        {/* Allow Manual Override Toggle (only in detailed modes) */}
                        {!isFlatRate && item.measurementUnit === 'sqft' && item.categoryName !== 'Drywall Repair' && item.categoryName !== 'Prep Work' && (
                          <Col xs={12} sm={4}>
                            <label style={{ fontSize: 11, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={item.allowManualGallons}
                                onChange={(e) => updateLaborItem(area.id, item.categoryName, 'allowManualGallons', e.target.checked)}
                                style={{ marginRight: 4 }}
                                aria-label="Enable manual gallons override"
                              />
                              Manual Gallons
                            </label>
                          </Col>
                        )}
                      </>
                    )}
                  </Row>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}

      {areas.length === 0 && (
        <Alert
          message="No Areas Selected"
          description="Please select at least one area to continue."
          type="warning"
          showIcon
        />
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onPrevious}>
          Previous
        </Button>
        <Button 
          type="primary" 
          onClick={handleNext}
        >
          Next: Products
        </Button>
      </div>

      {/* Custom Area Modal */}
      <Modal
        title="Add Custom Area"
        open={showCustomAreaModal}
        onOk={handleCustomAreaSubmit}
        onCancel={() => {
          setShowCustomAreaModal(false);
          setCustomAreaName('');
        }}
        okText="Add Area"
      >
        <Input
          placeholder="Enter area name (e.g., Bonus Room, Guest Suite)"
          value={customAreaName}
          onChange={(e) => setCustomAreaName(e.target.value)}
          onPressEnter={handleCustomAreaSubmit}
          autoFocus
        />
      </Modal>

      {/* Dimension Calculator Modal */}
      <DimensionCalculator
        surfaceType={dimensionCalc.categoryName}
        visible={dimensionCalc.visible}
        onCalculate={handleDimensionCalculation}
        onCancel={() => setDimensionCalc({ visible: false, areaId: null, categoryName: null })}
        initialDimensions={
          dimensionCalc.areaId && dimensionCalc.categoryName
            ? areas.find(a => a.id === dimensionCalc.areaId)?.laborItems.find(i => i.categoryName === dimensionCalc.categoryName)?.dimensions
            : null
        }
      />
    </div>
  );
};

export default AreasStepEnhanced;
