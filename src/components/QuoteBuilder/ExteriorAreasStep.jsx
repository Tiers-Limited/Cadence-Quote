// src/components/QuoteBuilder/ExteriorAreasStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Input, InputNumber, Space, Modal, Collapse, Divider } from 'antd';
import { CaretRightOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Static list of exterior areas - NO auto-selection, NO nested lists
const EXTERIOR_AREAS = [
  'Exterior Walls',
  'Trim',
  'Soffits & Fascia',
  'Gutters',
  'Shutters',
  'Doors',
  'Rails',
  'Accents',
  'Deck Floor',
  'Fence',
  'Custom'
];

const ExteriorAreasStep = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [selectedAreas, setSelectedAreas] = useState(formData.exteriorAreas || []);
  const [notes, setNotes] = useState(formData.exteriorNotes || '');
  const [customAreaName, setCustomAreaName] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  useEffect(() => {
    onUpdate({ 
      exteriorAreas: selectedAreas,
      exteriorNotes: notes
    });
  }, [selectedAreas, notes]);

  const toggleArea = (areaName) => {
    const isSelected = selectedAreas.some(a => a.name === areaName);
    
    if (isSelected) {
      // Remove the area
      setSelectedAreas(selectedAreas.filter(a => a.name !== areaName));
    } else {
      // Add new area with measurement fields
      const newArea = {
        id: Date.now(),
        name: areaName,
        measurements: {
          length: null,
          width: null,
          height: null,
          quantity: null,
          linearFeet: null,
          squareFeet: null
        }
      };
      setSelectedAreas([...selectedAreas, newArea]);
    }
  };

  const updateMeasurement = (areaId, field, value) => {
    setSelectedAreas(selectedAreas.map(area => {
      if (area.id === areaId) {
        return {
          ...area,
          measurements: {
            ...area.measurements,
            [field]: value
          }
        };
      }
      return area;
    }));
  };

  const handleCustomAreaSubmit = () => {
    if (customAreaName.trim()) {
      toggleArea(customAreaName.trim());
      setCustomAreaName('');
      setShowCustomModal(false);
    }
  };

  const handleNext = () => {
    if (selectedAreas.length === 0) {
      Modal.warning({
        title: 'No Areas Selected',
        content: 'Please select at least one exterior area before continuing.',
      });
      return;
    }

    // Validate that selected areas have at least one measurement
    const areasWithoutMeasurements = selectedAreas.filter(area => {
      const m = area.measurements;
      return !m.length && !m.width && !m.height && !m.quantity && !m.linearFeet && !m.squareFeet;
    });

    if (areasWithoutMeasurements.length > 0) {
      Modal.warning({
        title: 'Missing Measurements',
        content: `Please enter measurements for: ${areasWithoutMeasurements.map(a => a.name).join(', ')}`,
      });
      return;
    }

    onNext();
  };

  const isAreaSelected = (areaName) => {
    return selectedAreas.some(a => a.name === areaName);
  };

  const getAreaData = (areaName) => {
    return selectedAreas.find(a => a.name === areaName);
  };

  const renderMeasurementInputs = (area) => {
    const m = area.measurements;
    
    return (
      <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '4px', marginTop: '8px' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: '12px', fontSize: '13px' }}>
          Enter measurements for {area.name}:
        </Text>
        
        <Row gutter={[12, 12]}>
          {/* Length, Width, Height - for walls, deck floor */}
          {['Exterior Walls', 'Deck Floor', 'Fence'].includes(area.name) && (
            <>
              <Col xs={12} sm={8}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Text style={{ fontSize: '12px' }}>Length (ft)</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={1}
                    value={m.length}
                    onChange={(value) => updateMeasurement(area.id, 'length', value)}
                    placeholder="0"
                  />
                </Space>
              </Col>
              <Col xs={12} sm={8}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Text style={{ fontSize: '12px' }}>Width (ft)</Text>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    step={1}
                    value={m.width}
                    onChange={(value) => updateMeasurement(area.id, 'width', value)}
                    placeholder="0"
                  />
                </Space>
              </Col>
              {area.name === 'Exterior Walls' && (
                <Col xs={12} sm={8}>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Text style={{ fontSize: '12px' }}>Height (ft)</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={1}
                      value={m.height}
                      onChange={(value) => updateMeasurement(area.id, 'height', value)}
                      placeholder="0"
                    />
                  </Space>
                </Col>
              )}
            </>
          )}

          {/* Linear Feet - for trim, soffits, gutters, rails */}
          {['Trim', 'Soffits & Fascia', 'Gutters', 'Rails', 'Accents'].includes(area.name) && (
            <Col xs={12} sm={8}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Text style={{ fontSize: '12px' }}>Linear Feet</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1}
                  value={m.linearFeet}
                  onChange={(value) => updateMeasurement(area.id, 'linearFeet', value)}
                  placeholder="0"
                />
              </Space>
            </Col>
          )}

          {/* Quantity - for shutters, doors */}
          {['Shutters', 'Doors'].includes(area.name) && (
            <Col xs={12} sm={8}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Text style={{ fontSize: '12px' }}>Quantity</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1}
                  value={m.quantity}
                  onChange={(value) => updateMeasurement(area.id, 'quantity', value)}
                  placeholder="0"
                />
              </Space>
            </Col>
          )}

          {/* Square Feet - custom areas */}
          {area.name === 'Custom' && (
            <Col xs={12} sm={8}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Text style={{ fontSize: '12px' }}>Square Feet</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={10}
                  value={m.squareFeet}
                  onChange={(value) => updateMeasurement(area.id, 'squareFeet', value)}
                  placeholder="0"
                />
              </Space>
            </Col>
          )}
        </Row>

        {/* Calculated area display */}
        {area.name === 'Exterior Walls' && m.length && m.width && m.height && (
          <Alert
            type="info"
            message={`Calculated Area: ${(2 * (parseFloat(m.length) + parseFloat(m.width)) * parseFloat(m.height)).toFixed(2)} sq ft`}
            style={{ marginTop: '12px' }}
          />
        )}

        {area.name === 'Deck Floor' && m.length && m.width && (
          <Alert
            type="info"
            message={`Calculated Area: ${(parseFloat(m.length) * parseFloat(m.width)).toFixed(2)} sq ft`}
            style={{ marginTop: '12px' }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="exterior-areas-step" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Alert
        message="Step 3: Exterior Areas"
        description="Select individual exterior areas to paint. Enter measurements for each selected area. Use the Notes section below to specify substrate materials and other details."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* Static Area Selection - Individual Checkboxes */}
      <Card title="Select Exterior Areas" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {EXTERIOR_AREAS.map(areaName => {
            const isSelected = isAreaSelected(areaName);
            const isCustom = areaName === 'Custom';

            return (
              <Col key={areaName} xs={24} sm={12} md={8} lg={6}>
                <Card
                  size="small"
                  hoverable
                  style={{
                    borderColor: isSelected ? '#1890ff' : '#d9d9d9',
                    background: isSelected ? '#e6f7ff' : '#fff',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (isCustom) {
                      setShowCustomModal(true);
                    } else {
                      toggleArea(areaName);
                    }
                  }}
                >
                  <Space>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ cursor: 'pointer' }}
                    />
                    <Text strong>{areaName}</Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Expanded Measurement Sections for Selected Areas */}
      {selectedAreas.length > 0 && (
        <Card title="Area Measurements" size="small" style={{ marginBottom: 16 }}>
          <Collapse
            bordered={false}
            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
            style={{ background: '#fff' }}
            items={selectedAreas.map(area => ({
              key: area.id,
              label: (
                <Space>
                  <Text strong>{area.name}</Text>
                  {area.measurements.length || area.measurements.linearFeet || area.measurements.quantity || area.measurements.squareFeet ? (
                    <Text type="success" style={{ fontSize: '12px' }}>✓ Measured</Text>
                  ) : (
                    <Text type="danger" style={{ fontSize: '12px' }}>⚠ Needs measurements</Text>
                  )}
                </Space>
              ),
              children: renderMeasurementInputs(area)
            }))}
          />
        </Card>
      )}

      {/* Universal Notes Section - for substrate and other details */}
      <Card title="Notes (Substrate, Materials, Special Instructions)" size="small" style={{ marginBottom: 16 }}>
        <TextArea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Example:\n\nSubstrate:\n- Exterior Walls: Wood siding, good condition\n- Trim: Aluminum, some oxidation\n- Deck Floor: Pressure-treated wood, weathered\n\nSpecial Instructions:\n- Power wash all surfaces before painting\n- Replace rotted trim boards on north side\n- Two coats on all surfaces`}
          style={{ fontFamily: 'monospace', fontSize: '13px' }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: '8px', fontSize: '12px' }}>
          Use this section to document substrate materials, surface conditions, prep work requirements, 
          number of coats, and any other important details for the exterior project.
        </Text>
      </Card>

      {selectedAreas.length === 0 && (
        <Alert
          message="No Areas Selected"
          description="Please select at least one exterior area to continue."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
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
        open={showCustomModal}
        onOk={handleCustomAreaSubmit}
        onCancel={() => {
          setShowCustomModal(false);
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
    </div>
  );
};

export default ExteriorAreasStep;
