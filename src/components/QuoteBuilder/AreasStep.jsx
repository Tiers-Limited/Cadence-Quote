// src/components/QuoteBuilder/AreasStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, Select, Checkbox, InputNumber, Space, Modal, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

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
    'Front Exterior',
    'Back Exterior',
    'Side Exterior (Left)',
    'Side Exterior (Right)',
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

  const jobType = formData.jobType || 'interior';
  const availableRooms = COMMON_ROOMS[jobType] || [];
  const availableSurfaces = SURFACE_TYPES[jobType] || [];

  useEffect(() => {
    onUpdate({ areas });
  }, [areas]);

  const addArea = (areaName) => {
    const newArea = {
      id: Date.now(),
      name: areaName,
      jobType,
      surfaces: availableSurfaces.map(surfaceType => ({
        type: surfaceType,
        selected: false,
        substrate: null,
        sqft: null,
        dimensions: null
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
        message="Step 3: Areas & Surfaces"
        description="Select the rooms/areas to be painted and specify surfaces for each. Color and sheen selection will happen later in the Customer Portal."
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
            For each area, select surfaces, choose substrate type, and enter square footage.
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
                            placeholder="Sq Ft"
                            style={{ width: '100%' }}
                            min={0}
                            value={surface.sqft}
                            onChange={(value) => updateSurface(area.id, surface.type, 'sqft', value)}
                            addonAfter="sq ft"
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
