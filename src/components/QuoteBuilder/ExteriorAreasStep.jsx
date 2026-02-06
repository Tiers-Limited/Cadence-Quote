// src/components/QuoteBuilder/ExteriorAreasStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, InputNumber, Space, Modal, Select, Tag, Grid } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';
import DimensionCalculator from './DimensionCalculator';
import * as pricingUtils from '../../utils/pricingUtils';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { useBreakpoint } = Grid;

// Common exterior areas - Simplified for better UX
// Contractors think in work scopes (Siding, Trim, Deck), not directional elevations
const COMMON_EXTERIOR_AREAS = [
  'Exterior Siding',
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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  const [areas, setAreas] = useState(formData.areas || []);
  const [showCustomAreaModal, setShowCustomAreaModal] = useState(false);
  const [customAreaName, setCustomAreaName] = useState('');
  const [laborCategories, setLaborCategories] = useState([]);
  const [laborRates, setLaborRates] = useState([]);
  const [dimensionCalc, setDimensionCalc] = useState({ visible: false, areaId: null, categoryName: null });

  // Determine pricing model mode using centralized util
  const mode = pricingUtils.getPricingMode(formData.pricingModelType);
  const jobType = 'exterior';

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
    
    // Use synced settings from parent (QuoteBuilderPage)
    if (formData.contractorSettings?.laborCategories && formData.contractorSettings.laborCategories.length > 0) {
      console.log('[ExteriorAreasStep] Using labor data from contractorSettings:', {
        categories: formData.contractorSettings.laborCategories.length,
        rates: Object.keys(formData.contractorSettings.laborRates || {}).length
      });
      
      setLaborCategories(formData.contractorSettings.laborCategories);
      
      // laborRates in contractorSettings is already a map object {categoryId: rate}
      if (formData.contractorSettings.laborRates && typeof formData.contractorSettings.laborRates === 'object') {
        setLaborRates(formData.contractorSettings.laborRates);
      }
    } else if (laborCategories.length === 0) {
      // Fallback: Only fetch if we don't already have data and parent hasn't provided it
      console.log('[ExteriorAreasStep] No labor data from parent, fetching with jobType:', jobType);
      fetchLaborCategories();
      fetchLaborRates();
    }
  }, [formData.contractorSettings, formData.pricingModelType, formData._laborDataUpdated]);

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
      const response = await apiService.get(`/labor-categories?jobType=${jobType}`);
      if (response.success) {
        setLaborCategories(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching labor categories:', error);
    }
  };

  const fetchLaborRates = async () => {
    try {
      const response = await apiService.get(`/labor-categories/rates?jobType=${jobType}`);
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

  // Map area types to their relevant labor categories
  const getRelevantLaborCategories = (areaName) => {
    // Define which labor categories are relevant for each area type
    const areaToLabor = {
      'Exterior Siding': ['Exterior Walls', 'Exterior Trim', 'Prep Work'],
      'Garage': ['Exterior Walls', 'Exterior Trim', 'Exterior Doors', 'Prep Work'],
      'Deck': ['Decks & Railings', 'Prep Work'],
      'Fence': ['Exterior Walls', 'Prep Work'],
      'Shutters': ['Shutters']
    };

    // For custom areas, provide all options
    const relevantCategories = areaToLabor[areaName] || EXTERIOR_LABOR_CATEGORIES.map(cat => cat.name);
    
    // Filter EXTERIOR_LABOR_CATEGORIES to only include relevant ones
    return EXTERIOR_LABOR_CATEGORIES.filter(cat => relevantCategories.includes(cat.name));
  };

  const addArea = (areaName, isCustom = false) => {
    const relevantCategories = getRelevantLaborCategories(areaName);
    
    // For flat rate unit pricing, filter out categories that use linear_foot or hour
    // since those don't make sense in a per-unit pricing model
    const isFlatRateUnit = formData.pricingModelType === 'flat_rate_unit';
    const categoriesForArea = isFlatRateUnit 
      ? relevantCategories.filter(cat => cat.unit !== 'linear_foot' && cat.unit !== 'hour')
      : relevantCategories;
    
    const newArea = {
      id: Date.now(),
      name: areaName,
      jobType: 'exterior',
      isCustom,
      laborItems: categoriesForArea.map(cat => {
        const rate = getLaborRate(cat.name);
        return {
          categoryName: cat.name,
          // Override measurement unit to 'unit' for flat rate pricing
          measurementUnit: isFlatRateUnit ? 'unit' : cat.unit,
          selected: false,
          quantity: null,
          numberOfCoats: cat.defaultCoats,
          dimensions: null,
          laborRate: rate,
          gallons: null,
          allowManualGallons: false
        };
      })
    };
    setAreas([...areas, newArea]);
  };

  // Helper function to map category names to flat rate keys
  const mapCategoryToFlatRateKey = (categoryName) => {
    const mapping = {
      // Exterior surfaces
      'Exterior Walls': 'siding',
      'Siding': 'siding',
      'Exterior Siding': 'siding',
      'Exterior Trim': 'exterior_trim',
      'Trim': 'exterior_trim',
      'Exterior Doors': 'door',
      'Doors': 'door',
      'Shutters': 'door',
      'Decks & Railings': 'deck',
      'Soffit & Fascia': 'soffit_fascia',
      'Gutters': 'gutters',
      'Prep Work': 'hour'
    };
    return mapping[categoryName] || categoryName.toLowerCase().replace(/\s+/g, '_');
  };

  const getLaborRate = (categoryName) => {
    return pricingUtils.getLaborRate(categoryName, jobType, formData);
  };

  // Format labor rate display based on pricing model
  const formatLaborRateDisplay = (categoryName, measurementUnit) => {
    const rate = getLaborRate(categoryName);
    const isFlatRateUnit = formData.pricingModelType === 'flat_rate_unit';
    
    if (isFlatRateUnit) {
      // For flat rate, always show as "$X/unit" regardless of original measurement
      return `$${rate}/unit`;
    }
    
    // For other models, show with appropriate unit label
    return `$${rate}/${getUnitLabel(measurementUnit)}`;
  };

  // Get production rate for a category (for time estimates)
  const getProductionRate = (categoryName) => {
    const settings = formData.contractorSettings || {};
    const key = pricingUtils.mapCategoryToKey(categoryName, jobType, false, true);
    return settings.productionRates?.[key] || 50;
  };

  // Calculate estimated hours for production-based model
  const calculateEstimatedHours = (quantity, categoryName) => {
    return pricingUtils.calculateEstimatedHours(quantity, categoryName, jobType, formData);
  };

  // Check if using unit counts (Flat Rate model)
  const isUnitCountMode = () => {
    return mode === 'flat_unit';
  };

  // Check if using detailed measurements (Rate-Based/Production)
  const isDetailedMeasurement = () => {
    return ['rate_sqft', 'production'].includes(mode);
  };

  // Get placeholder text based on pricing model
  const getQuantityPlaceholder = (unit) => {
    return pricingUtils.getQuantityPlaceholder(mode, unit);
  };

  // Get input label based on pricing model
  const getQuantityLabel = (unit) => {
    if (isUnitCountMode()) {
      return 'Quantity';
    }
    return unit === 'sqft' ? 'Square Feet' : unit === 'linear_foot' ? 'Linear Feet' : unit === 'unit' ? 'Count' : 'Quantity';
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
                const qty = parseFloat(field === 'quantity' ? value : item.quantity) || 0;
                const coats = parseInt(field === 'numberOfCoats' ? value : item.numberOfCoats) || 2;
                const coverage = 350; // Standard coverage rate

                if (qty > 0 && coats > 0) {
                  let calculatedGallons = 0;
                  
                  if (item.measurementUnit === 'sqft') {
                    // For square footage items
                    const totalSqft = qty * coats;
                    calculatedGallons = totalSqft / coverage;
                  } else if (item.measurementUnit === 'linear_foot') {
                    // For linear footage (trim, etc.) - assume 6" width
                    const sqft = qty * 0.5; // 6 inches = 0.5 feet width
                    calculatedGallons = (sqft * coats) / coverage;
                  } else if (item.measurementUnit === 'unit') {
                    // For units (doors, cabinets) - estimate surface area
                    let estimatedSqft = 0;
                    const category = item.categoryName.toLowerCase();
                    if (category.includes('door')) {
                      estimatedSqft = qty * 21; // Standard door ~21 sq ft per side
                    } else if (category.includes('cabinet')) {
                      estimatedSqft = qty * 30; // Cabinet ~30 sq ft per unit
                    } else if (category.includes('window')) {
                      estimatedSqft = qty * 15; // Window ~15 sq ft
                    } else if (category.includes('shutter')) {
                      estimatedSqft = qty * 10; // Shutter ~10 sq ft per pair
                    } else {
                      estimatedSqft = qty * 20; // Generic estimate
                    }
                    calculatedGallons = (estimatedSqft * coats) / coverage;
                  }
                  
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
    // Update both quantity and dimensions in a single state update to avoid race conditions
    setAreas(areas.map(area => {
      if (area.id === dimensionCalc.areaId) {
        return {
          ...area,
          laborItems: area.laborItems.map(item => {
            if (item.categoryName === dimensionCalc.categoryName) {
              const updatedItem = { 
                ...item, 
                quantity: sqft,
                dimensions: dimensions
              };

              // Auto-calculate gallons when quantity changes
              if (!item.allowManualGallons) {
                const qty = parseFloat(sqft) || 0;
                const coats = parseInt(item.numberOfCoats) || 2;
                const coverage = 350; // Standard coverage rate

                if (qty > 0 && coats > 0) {
                  let calculatedGallons = 0;
                  
                  if (item.measurementUnit === 'sqft') {
                    // For square footage items
                    const totalSqft = qty * coats;
                    calculatedGallons = totalSqft / coverage;
                  } else if (item.measurementUnit === 'linear_foot') {
                    // For linear footage (trim, etc.) - assume 6" width
                    const sqftCalc = qty * 0.5; // 6 inches = 0.5 feet width
                    calculatedGallons = (sqftCalc * coats) / coverage;
                  } else if (item.measurementUnit === 'unit') {
                    // For units (doors, cabinets) - estimate surface area
                    let estimatedSqft = 0;
                    const category = item.categoryName.toLowerCase();
                    if (category.includes('door')) {
                      estimatedSqft = qty * 21; // Standard door ~21 sq ft per side
                    } else if (category.includes('cabinet')) {
                      estimatedSqft = qty * 30; // Cabinet ~30 sq ft per unit
                    } else if (category.includes('window')) {
                      estimatedSqft = qty * 15; // Window ~15 sq ft
                    } else if (category.includes('shutter')) {
                      estimatedSqft = qty * 10; // Shutter ~10 sq ft per pair
                    } else {
                      estimatedSqft = qty * 20; // Generic estimate
                    }
                    calculatedGallons = (estimatedSqft * coats) / coverage;
                  }
                  
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
      const modelType = formData.pricingModelType || 'rate_based_sqft';
      let message = 'Please select at least one area and labor category before continuing.';
      
      if (modelType === 'flat_rate_unit') {
        message = 'Please add areas and count the number of units (doors, shutters, etc.) before continuing.';
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

  return (
    <div className="exterior-areas-step" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Model-specific guidance */}
      <Alert
        message={`Step 3: Exterior Areas & Labor – ${
          mode === 'flat_unit' ? 'Flat Rate Unit Mode' : 
          mode === 'production' ? 'Production (Time) Mode' : 
          'Detailed SqFt Mode'
        }`}
        description={pricingUtils.getModelGuidanceMessage(mode)}
        type="info"
        showIcon
        style={{ marginBottom: isMobile ? 12 : 16 }}
      />

      {/* Pricing Model Guidance Banner */}
      {formData.pricingSchemeId && (
        <Card 
          size="small" 
          style={{ marginBottom: isMobile ? 12 : 16, backgroundColor: '#f0f5ff', borderColor: '#1890ff' }}
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: isMobile ? 16 : 18 }} />
              <Text strong style={{ color: '#1890ff', fontSize: isMobile ? 13 : 14 }}>
                {formData.pricingModelFriendlyName || 'Rate-Based Pricing'}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
              {formData.pricingModelDescription || 'Enter detailed measurements for each surface to calculate labor and materials.'}
            </Text>
            <Alert
              message={pricingUtils.getModelGuidanceMessage(mode)}
              type="info"
              showIcon
              banner
              closable
              style={{ marginTop: 8 }}
            />
          </Space>
        </Card>
      )}

      {/* Painters on Site and Labor Only Controls */}
      <Card size="small" style={{ marginBottom: isMobile ? 12 : 16 }}>
        <Row gutter={isMobile ? 8 : 16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4, fontSize: isMobile ? 12 : 14 }}>Painters on Site:</Text>
              <Select
                size="small"
                style={{ width: '100%' }}
                value={formData.paintersOnSite || 1}
                onChange={(value) => onUpdate({ paintersOnSite: value })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <Option key={num} value={num}>
                    {num} Painter{num > 1 ? 's' : ''}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          
          {/* Labor Only toggle - show for Time and Materials schemes (rate-based and production-based) */}
          {(formData.pricingModelType === 'production_based' || formData.pricingModelType === 'rate_based_sqft') && (
            <Col xs={24} sm={12} md={8}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 4, fontSize: isMobile ? 12 : 14 }}>Labor Only:</Text>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={formData.laborOnly || false}
                    onChange={(e) => onUpdate({ laborOnly: e.target.checked })}
                  />
                  <Text style={{ fontSize: isMobile ? 12 : 14 }}>Customer supplies paint</Text>
                </label>
              </div>
            </Col>
          )}
        </Row>
      </Card>

      <Card size="small" style={{ marginBottom: isMobile ? 12 : 16 }}>
        <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Select Exterior Areas:</Text>
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
                  style={{ fontSize: isMobile ? 11 : 13 }}
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
              style={{ fontSize: isMobile ? 11 : 13 }}
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
                              style={{ 
                                width: '100%',
                                ...(item.dimensions ? { borderColor: '#52c41a', backgroundColor: '#f6ffed' } : {})
                              }}
                              min={0}
                              step={mode === 'flat_unit' ? 1 : (item.measurementUnit === 'sqft' ? 10 : 1)}
                              value={item.quantity}
                              onChange={(value) => updateLaborItem(area.id, item.categoryName, 'quantity', value)}
                              placeholder={pricingUtils.getQuantityPlaceholder(mode, item.measurementUnit)}
                              prefix={item.dimensions ? '📐' : null}
                            />
                            {/* Show calculator for detailed measurement modes only */}
                            {pricingUtils.shouldShowDimensionsCalculator(mode, item.measurementUnit) && (
                              <Button
                                size="small"
                                icon={<CalculatorOutlined />}
                                onClick={() => openDimensionCalculator(area.id, item.categoryName)}
                                title="Use dimensions calculator"
                                type={item.dimensions ? 'primary' : 'default'}
                              />
                            )}
                          </Space.Compact>
                          {item.dimensions && (
                            <Text type="success" style={{ fontSize: 10, display: 'block', marginTop: 2, color: '#52c41a', fontWeight: 500 }}>
                              ✓ Calculated: {item.categoryName.includes('Wall') ? (
                                <>2×({item.dimensions.length}+{item.dimensions.width})×{item.dimensions.height} = {item.quantity || 0} sqft</>
                              ) : item.categoryName.includes('Deck') ? (
                                <>{item.dimensions.length}×{item.dimensions.width} = {item.quantity || 0} sqft</>
                              ) : item.categoryName.includes('Trim') || item.categoryName.includes('Fascia') ? (
                                <>2×({item.dimensions.length}+{item.dimensions.width}) = {item.quantity || 0} LF</>
                              ) : (
                                <>{item.dimensions.length}×{item.dimensions.width} = {item.quantity || 0} sqft</>
                              )}
                            </Text>
                          )}
                        </Col>

                        {/* Number of Coats (only in detailed modes - not needed for flat-rate) */}
                        {pricingUtils.shouldShowCoats(mode) && item.measurementUnit === 'sqft' && item.categoryName !== 'Prep Work' && (
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
                        {pricingUtils.shouldShowGallons(mode) && item.measurementUnit === 'sqft' && item.categoryName !== 'Prep Work' && (
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
                              />
                            </Space.Compact>
                          </Col>
                        )}

                        {/* Time Preview (for production-based model) */}
                        {pricingUtils.shouldShowEstimatedHours(mode) && item.quantity > 0 && (
                          <Col xs={12} sm={4}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Est. {calculateEstimatedHours(item.quantity, item.categoryName).toFixed(1)} hrs
                            </Text>
                          </Col>
                        )}

                        {/* Labor Rate Display */}
                        <Col xs={12} sm={3}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatLaborRateDisplay(item.categoryName, item.measurementUnit)}
                          </Text>
                        </Col>

                        {/* Allow Manual Override Toggle (only in detailed modes) */}
                        {pricingUtils.shouldShowGallons(mode) && item.measurementUnit === 'sqft' && item.categoryName !== 'Prep Work' && (
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
          description="Please select at least one exterior area to continue."
          type="warning"
          showIcon
        />
      )}

      <div style={{ marginTop: isMobile ? 12 : 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? 8 : 0 }}>
        <Button 
          onClick={onPrevious}
          size={isMobile ? 'middle' : 'large'}
          block={isMobile}
        >
          Previous
        </Button>
        <Button 
          type="primary" 
          onClick={handleNext}
          size={isMobile ? 'middle' : 'large'}
          block={isMobile}
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
