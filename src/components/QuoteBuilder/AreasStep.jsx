// src/components/QuoteBuilder/AreasStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, Select, Checkbox, InputNumber, Space, Modal, Form, Switch } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Title, Text } = Typography;
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
    'Shutters',
    'Gutters & Downspouts'
  ]
};

// Surface types based on job type
const SURFACE_TYPES = {
  interior: ['Walls', 'Ceiling', 'Trim', 'Doors', 'Cabinets'],
  exterior: ['Siding', 'Trim', 'Windows', 'Doors', 'Soffit & Fascia', 'Gutters']
};

// Substrate options
const SUBSTRATES = {
  interior: {
    Walls: ['Drywall', 'Plaster', 'Wood Paneling', 'Wallpaper'],
    Ceiling: ['Drywall', 'Plaster', 'Popcorn', 'Wood'],
    Trim: ['Wood', 'MDF', 'PVC'],
    Doors: ['Wood', 'Metal', 'Fiberglass'],
    Cabinets: ['Wood', 'Laminate', 'MDF']
  },
  exterior: {
    Siding: ['Hardie Board', 'Wood', 'Vinyl', 'Stucco', 'Brick'],
    Trim: ['Wood', 'PVC', 'Aluminum'],
    Windows: ['Wood', 'Vinyl', 'Aluminum'],
    Doors: ['Wood', 'Metal', 'Fiberglass'],
    'Soffit & Fascia': ['Wood', 'Aluminum', 'Vinyl'],
    Gutters: ['Aluminum', 'Vinyl', 'Copper']
  }
};

const AreasStep = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [areas, setAreas] = useState(formData.areas || []);
  const [showCustomAreaModal, setShowCustomAreaModal] = useState(false);
  const [customAreaName, setCustomAreaName] = useState('');
  const [editingArea, setEditingArea] = useState(null);
  const [serviceTypes, setServiceTypes] = useState([]);

  const jobType = formData.jobType || 'interior';
  const availableRooms = COMMON_ROOMS[jobType] || [];
  const availableSurfaces = SURFACE_TYPES[jobType] || [];

  // Determine pricing model type for conditional rendering
  const modelType = formData.pricingModelType || 'rate_based_sqft';
  const isFlatRate = modelType === 'flat_rate_unit';
  const isProduction = modelType === 'production_based';
  const isDetailed = modelType === 'rate_based_sqft' || modelType === 'sqft_labor_paint';

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  useEffect(() => {
    onUpdate({ areas });
  }, [areas]);

  const fetchServiceTypes = async () => {
    try {
      const response = await apiService.get('/service-types');
      if (response.success) {
        setServiceTypes(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching service types:', error);
    }
  };
  const addArea = (areaName) => {
    const newArea = {
      id: Date.now(),
      name: areaName,
      jobType,
      serviceTypeId: null,
      surfaces: availableSurfaces.map(surfaceType => ({
        type: surfaceType,
        selected: false,
        substrate: null,
        sqft: null,
        dimensions: null,
        condition: 'smooth',
        textured: false,
        highCeiling: false,
        vaulted: false,
        needsPrep: false
      }))
    };
    setAreas([...areas, newArea]);
  };

  const removeArea = (areaId) => {
    setAreas(areas.filter(a => a.id !== areaId));
  };

  const toggleSurface = (areaId, surfaceType, checked) => {
    setAreas(areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: area.surfaces.map(surface => 
            surface.type === surfaceType 
              ? { ...surface, selected: checked }
              : surface
          )
        };
      }
      return area;
    }));
  };

  const updateSurface = (areaId, surfaceType, field, value) => {
    setAreas(areas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          surfaces: area.surfaces.map(surface => 
            surface.type === surfaceType 
              ? { ...surface, [field]: value }
              : surface
          )
        };
      }
      return area;
    }));
  };

  const handleCustomAreaSubmit = () => {
    if (customAreaName.trim()) {
      addArea(customAreaName.trim());
      setCustomAreaName('');
      setShowCustomAreaModal(false);
    }
  };

  const handleNext = () => {
    const hasAreas = areas.length > 0;
    const hasSelectedSurfaces = areas.some(area => 
      area.surfaces.some(surface => surface.selected)
    );

    if (!hasAreas || !hasSelectedSurfaces) {
      Modal.warning({
        title: 'No Areas Selected',
        content: 'Please select at least one area and surface before continuing.',
      });
      return;
    }

    onNext();
  };

  return (
    <div className="areas-step">
      <Alert
        message={`Step 3: Areas & Surfaces – ${
          isFlatRate ? 'Flat Rate Unit Mode' : 
          isProduction ? 'Production (Time) Mode' : 
          'Detailed SqFt Mode'
        }`}
        description={
          isFlatRate 
            ? "📦 Just count items - no measurements needed! Fixed price per item (door, window, cabinet, etc.). Example: 5 doors, 8 windows, 12 cabinet doors." 
            : isProduction 
            ? "Enter measurements → we'll estimate hours based on your productivity rates." 
            : "Choose the rooms or areas to be painted, then select surfaces and specify square footage for each."
        }
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="Select Areas" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {availableRooms.map(room => {
            const isSelected = areas.some(a => a.name === room);
            return (
              <Col key={room} xs={12} sm={8} md={6} lg={4}>
                <Button
                  type={isSelected ? 'primary' : 'default'}
                  block
                  onClick={() => isSelected ? removeArea(areas.find(a => a.name === room)?.id) : addArea(room)}
                >
                  {room}
                </Button>
              </Col>
            );
          })}
          <Col xs={12} sm={8} md={6} lg={4}>
            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => setShowCustomAreaModal(true)}
            >
              Custom Area
            </Button>
          </Col>
        </Row>
      </Card>

      {areas.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Title level={4}>Configure Selected Areas</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {isFlatRate 
              ? 'For each area, select items and enter quantity (count).'
              : 'For each area, select surfaces, choose substrate type, and enter square footage.'}
          </Text>

          {areas.map(area => (
            <Card 
              key={area.id}
              title={
                <Space>
                  {area.name}
                  <Button 
                    type="text" 
                    danger 
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeArea(area.id)}
                  >
                    Remove
                  </Button>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              {/* Service Type Selection for Area */}
              <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', borderRadius: 4 }}>
                <Row gutter={16} align="middle">
                  <Col xs={24} sm={12}>
                    <Text strong>Service Type: </Text>
                    <Select
                      placeholder="Select Service Type (Optional)"
                      style={{ width: '100%', marginTop: 8 }}
                      value={area.serviceTypeId}
                      onChange={(value) => {
                        setAreas(areas.map(a => 
                          a.id === area.id ? { ...a, serviceTypeId: value } : a
                        ));
                      }}
                      allowClear
                    >
                      {serviceTypes
                        .filter(st => st.serviceType === `${jobType}_painting`)
                        .map(st => (
                          <Option key={st.id} value={st.id}>
                            {st.displayName} - ${st.laborRate}/{st.laborRateType.replace('per_', '')}
                          </Option>
                        ))}
                    </Select>
                  </Col>
                </Row>
              </div>

              {area.surfaces.map(surface => (
                <div key={surface.type} style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                  <Row gutter={16} align="middle">
                    <Col xs={24} sm={6}>
                      <Checkbox
                        checked={surface.selected}
                        onChange={(e) => toggleSurface(area.id, surface.type, e.target.checked)}
                      >
                        <strong>{surface.type}</strong>
                      </Checkbox>
                    </Col>

                    {surface.selected && (
                      <>
                        <Col xs={24} sm={8}>
                          <Select
                            placeholder="Select Substrate"
                            style={{ width: '100%' }}
                            value={surface.substrate}
                            onChange={(value) => updateSurface(area.id, surface.type, 'substrate', value)}
                          >
                            {SUBSTRATES[jobType][surface.type]?.map(substrate => (
                              <Option key={substrate} value={substrate}>{substrate}</Option>
                            ))}
                          </Select>
                        </Col>

                        <Col xs={24} sm={6}>
                          <InputNumber
                            placeholder={isFlatRate ? 'Count' : 'Sq Ft'}
                            style={{ width: '100%' }}
                            min={0}
                            step={isFlatRate ? 1 : 10}
                            value={surface.sqft}
                            onChange={(value) => updateSurface(area.id, surface.type, 'sqft', value)}
                            addonAfter={isFlatRate ? 'items' : 'sq ft'}
                          />
                        </Col>

                        <Col xs={24} sm={4}>
                          <Input
                            placeholder="Dimensions (optional)"
                            value={surface.dimensions}
                            onChange={(e) => updateSurface(area.id, surface.type, 'dimensions', e.target.value)}
                          />
                        </Col>
                      </>
                    )}
                  </Row>
                  
                  {/* Surface Condition and Add-ons */}
                  {surface.selected && (
                    <Row gutter={16} style={{ marginTop: 12 }}>
                      <Col xs={12} sm={6}>
                        <Select
                          placeholder="Condition"
                          size="small"
                          style={{ width: '100%' }}
                          value={surface.condition || 'smooth'}
                          onChange={(value) => updateSurface(area.id, surface.type, 'condition', value)}
                        >
                          <Option value="smooth">Smooth</Option>
                          <Option value="textured">Textured</Option>
                          <Option value="patched">Patched</Option>
                          <Option value="damaged">Damaged</Option>
                        </Select>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Checkbox
                          checked={surface.textured}
                          onChange={(e) => updateSurface(area.id, surface.type, 'textured', e.target.checked)}
                        >
                          Textured (+$0.10/sqft)
                        </Checkbox>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Checkbox
                          checked={surface.highCeiling}
                          onChange={(e) => updateSurface(area.id, surface.type, 'highCeiling', e.target.checked)}
                        >
                          High Ceiling (+$0.20/sqft)
                        </Checkbox>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Checkbox
                          checked={surface.needsPrep}
                          onChange={(e) => updateSurface(area.id, surface.type, 'needsPrep', e.target.checked)}
                        >
                          Needs Prep
                        </Checkbox>
                      </Col>
                    </Row>
                  )}
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
          style={{ marginTop: 24 }}
        />
      )}

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
        <Button size="large" onClick={onPrevious}>
          Previous
        </Button>
        <Button 
          type="primary" 
          size="large" 
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
    </div>
  );
};

export default AreasStep;
