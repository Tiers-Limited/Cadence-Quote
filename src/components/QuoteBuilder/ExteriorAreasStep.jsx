// src/components/QuoteBuilder/ExteriorAreasStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, InputNumber, Space, Modal, Select, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import DimensionCalculator from './DimensionCalculator';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Common exterior areas
const COMMON_EXTERIOR_AREAS = [
  'Front Exterior',
  'Back Exterior',
  'Side Exterior (Left)',
  'Side Exterior (Right)',
  'Garage',
  'Deck',
  'Fence',
  'Shutters'
];

// Exterior labor categories
const EXTERIOR_LABOR_CATEGORIES = [
  { name: 'Exterior Walls', unit: 'sqft', defaultCoats: 2 },
  { name: 'Exterior Trim', unit: 'linear_foot', defaultCoats: 2 },
  { name: 'Exterior Doors', unit: 'unit', defaultCoats: 2 },
  { name: 'Shutters', unit: 'unit', defaultCoats: 2 },
  { name: 'Decks & Railings', unit: 'sqft', defaultCoats: 2 },
  { name: 'Soffit & Fascia', unit: 'linear_foot', defaultCoats: 2 },
  { name: 'Prep Work', unit: 'hour', defaultCoats: 0 }
];

const COVERAGE_RATE = 350; // sq ft per gallon

const ExteriorAreasStep = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [areas, setAreas] = useState(formData.areas || []);
  const [showCustomAreaModal, setShowCustomAreaModal] = useState(false);
  const [customAreaName, setCustomAreaName] = useState('');
  const [laborCategories, setLaborCategories] = useState([]);
  const [laborRates, setLaborRates] = useState([]);
  const [dimensionCalc, setDimensionCalc] = useState({ visible: false, areaId: null, categoryName: null });

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
      jobType: 'exterior',
      isCustom,
      laborItems: EXTERIOR_LABOR_CATEGORIES.map(cat => ({
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
    <div className="exterior-areas-step" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Alert
        message="Step 3: Exterior Areas & Labor"
        description="Select exterior areas, specify labor categories, and enter measurements. Gallons calculate automatically."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Text strong>Select Exterior Areas:</Text>
        <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
          {COMMON_EXTERIOR_AREAS.map(areaName => {
            const isSelected = areas.some(a => a.name === areaName);
            const allowMultiple = areaName.includes('Side');
            
            const handleClick = () => {
              if (allowMultiple) {
                const sameCount = areas.filter(a => a.name.startsWith(areaName.split('(')[0].trim())).length;
                const displayName = sameCount > 0 ? `${areaName} ${sameCount + 1}` : areaName;
                addArea(displayName);
              } else {
                if (isSelected) {
                  const area = areas.find(a => a.name === areaName);
                  if (area) removeArea(area.id);
                } else {
                  addArea(areaName);
                }
              }
            };

            return (
              <Col key={areaName} xs={12} sm={8} md={6} lg={4}>
                <Button
                  size="small"
                  type={isSelected && !allowMultiple ? 'primary' : 'default'}
                  block
                  onClick={handleClick}
                >
                  {areaName}
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
                              ) : item.categoryName.includes('Deck') ? (
                                <>{item.dimensions.length}×{item.dimensions.width}</>
                              ) : item.categoryName.includes('Trim') || item.categoryName.includes('Fascia') ? (
                                <>2×({item.dimensions.length}+{item.dimensions.width})</>
                              ) : (
                                <>{item.dimensions.length}×{item.dimensions.width}</>
                              )}
                            </Text>
                          )}
                        </Col>

                        {/* Number of Coats (for paint surfaces only) */}
                        {item.measurementUnit === 'sqft' && item.categoryName !== 'Prep Work' && (
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
                        {item.measurementUnit === 'sqft' && item.categoryName !== 'Prep Work' && (
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
                        {item.measurementUnit === 'sqft' && item.categoryName !== 'Prep Work' && (
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
          description="Please select at least one exterior area to continue."
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
          Next: Products & Pricing
        </Button>
      </div>

      {/* Custom Area Modal */}
      <Modal
        title="Add Custom Exterior Area"
        open={showCustomAreaModal}
        onOk={handleCustomAreaSubmit}
        onCancel={() => {
          setShowCustomAreaModal(false);
          setCustomAreaName('');
        }}
        okText="Add Area"
      >
        <Input
          placeholder="Enter custom area name (e.g., Pergola, Pool House, Garden Shed)"
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

export default ExteriorAreasStep;
