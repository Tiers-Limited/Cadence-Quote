// src/components/QuoteBuilder/AreasStepEnhanced.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, Select, InputNumber, Space, Modal, Tag, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined } from '@ant-design/icons';
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
    'Front Exterior',
    'Back Exterior',
    'Side Exterior (Left)',
    'Side Exterior (Right)',
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
  const [laborRates, setLaborRates] = useState([]);
  const [dimensionCalc, setDimensionCalc] = useState({ visible: false, areaId: null, categoryName: null });

  const jobType = formData.jobType || 'interior';
  const availableRooms = COMMON_ROOMS[jobType] || [];
  const availableCategories = LABOR_CATEGORIES[jobType] || [];

  useEffect(() => {
    fetchLaborCategories();
    fetchLaborRates();
  }, []);

  useEffect(() => {
    onUpdate({ areas });
  }, [areas]);

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
      if (response.success) {
        setLaborRates(response.data || []);
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

  const getLaborRate = (categoryName) => {
    const category = laborCategories.find(c => c.categoryName === categoryName);
    if (!category) return 0;

    const rate = laborRates.find(r => r.laborCategoryId === category.id);
    return rate ? parseFloat(rate.rate) : 0;
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
      Modal.warning({
        title: 'No Areas Selected',
        content: 'Please select at least one area and labor category before continuing.',
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

  return (
    <div className="areas-step-enhanced" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Alert
        message="Step 3: Areas & Labor"
        description="Select rooms, specify labor categories, and enter measurements. Gallons calculate automatically."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

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
                        {/* Quantity/Measurement */}
                        <Col xs={12} sm={4}>
                          <Space.Compact style={{ width: '100%' }}>
                            <InputNumber
                              size="small"
                              style={{ width: '100%' }}
                              min={0}
                              step={item.measurementUnit === 'sqft' ? 10 : 1}
                              value={item.quantity}
                              onChange={(value) => updateLaborItem(area.id, item.categoryName, 'quantity', value)}
                              placeholder={getUnitLabel(item.measurementUnit)}
                            />
                            {(item.measurementUnit === 'sqft' || item.measurementUnit === 'linear_foot') && (
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
                        </Col>

                        {/* Number of Coats (for paint surfaces only) */}
                        {item.measurementUnit === 'sqft' && item.categoryName !== 'Drywall Repair' && item.categoryName !== 'Prep Work' && (
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

                        {/* Auto-calculated Gallons */}
                        {item.measurementUnit === 'sqft' && item.categoryName !== 'Drywall Repair' && item.categoryName !== 'Prep Work' && (
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
                            ${item.laborRate}/{getUnitLabel(item.measurementUnit)}
                          </Text>
                        </Col>

                        {/* Allow Manual Override Toggle */}
                        {item.measurementUnit === 'sqft' && item.categoryName !== 'Drywall Repair' && item.categoryName !== 'Prep Work' && (
                          <Col xs={12} sm={4}>
                            <label style={{ fontSize: 11 }}>
                              <input
                                type="checkbox"
                                checked={item.allowManualGallons}
                                onChange={(e) => updateLaborItem(area.id, item.categoryName, 'allowManualGallons', e.target.checked)}
                                style={{ marginRight: 4 }}
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
