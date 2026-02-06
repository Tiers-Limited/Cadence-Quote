// src/components/QuoteBuilder/JobTypeStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Select, Form, Grid } from 'antd';
import { HomeOutlined, BuildOutlined, DollarOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const JobTypeStep = ({ formData, onUpdate, onNext, onPrevious, pricingSchemes = [] }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  
  const [selectedType, setSelectedType] = useState(formData.jobType || null);
  const [selectedScheme, setSelectedScheme] = useState(null);

  // Find the currently selected pricing scheme
  useEffect(() => {
    if (formData.pricingSchemeId && pricingSchemes.length > 0) {
      const scheme = pricingSchemes.find(s => s.id === formData.pricingSchemeId);
      setSelectedScheme(scheme || null);
    } else if (pricingSchemes.length > 0 && !formData.pricingSchemeId) {
      // Auto-select default or first scheme
      const defaultScheme = pricingSchemes.find(s => s.isDefault) || pricingSchemes[0];
      if (defaultScheme) {
        setSelectedScheme(defaultScheme);
        onUpdate({ pricingSchemeId: defaultScheme.id });
      }
    }
  }, [formData.pricingSchemeId, pricingSchemes]);

  const handleJobTypeSelect = (type) => {
    setSelectedType(type);
    onUpdate({ jobType: type });
  };

  const handlePricingSchemeChange = (schemeId) => {
    const scheme = pricingSchemes.find(s => s.id === schemeId);
    setSelectedScheme(scheme);
    onUpdate({ pricingSchemeId: schemeId });
  };

  const handleDynamicFieldChange = (updates) => {
    onUpdate(updates);
  };

  const handleNext = () => {
    if (selectedType && formData.pricingSchemeId) {
      onNext();
    }
  };

  return (
    <div className="job-type-step">
      <Alert
        message="Step 2: Job Type & Pricing Model"
        description="Select the job type and pricing model for this quote. The pricing model determines how labor and materials are calculated."
        type="info"
        showIcon
        style={{ marginBottom: isMobile ? 16 : 24 }}
      />

      <Title level={isMobile ? 4 : 3} style={{ textAlign: 'center', marginBottom: isMobile ? 16 : 32 }}>
        What type of painting project is this?
      </Title>

      <Row gutter={isMobile ? 12 : 24} justify="center">
        <Col xs={24} md={10}>
          <Card
            hoverable
            className={selectedType === 'interior' ? 'job-type-card selected' : 'job-type-card'}
            onClick={() => handleJobTypeSelect('interior')}
            style={{
              height: '100%',
              border: selectedType === 'interior' ? '3px solid #1890ff' : '1px solid #d9d9d9',
              cursor: 'pointer',
            }}
          >
            <div style={{ textAlign: 'center', padding: isMobile ? '16px 0' : '24px 0' }}>
              <HomeOutlined style={{ fontSize: isMobile ? 48 : 64, color: selectedType === 'interior' ? '#1890ff' : '#8c8c8c' }} />
              <Title level={isMobile ? 3 : 2} style={{ marginTop: isMobile ? 12 : 16, marginBottom: 8 }}>
                Interior Painting
              </Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                Walls, Ceilings, Trim, Doors, Cabinets
              </Text>
              
              <div style={{ marginTop: isMobile ? 16 : 24, textAlign: 'left' }}>
                <Text strong>Includes:</Text>
                <ul style={{ marginTop: 8, fontSize: isMobile ? 12 : 14 }}>
                  <li>Wall preparation & painting</li>
                  <li>Ceiling work</li>
                  <li>Trim & door painting</li>
                  <li>Cabinet refinishing</li>
                  <li>Drywall repairs</li>
                </ul>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card
            hoverable
            className={selectedType === 'exterior' ? 'job-type-card selected' : 'job-type-card'}
            onClick={() => handleJobTypeSelect('exterior')}
            style={{
              height: '100%',
              border: selectedType === 'exterior' ? '3px solid #1890ff' : '1px solid #d9d9d9',
              cursor: 'pointer',
            }}
          >
            <div style={{ textAlign: 'center', padding: isMobile ? '16px 0' : '24px 0' }}>
              <BuildOutlined style={{ fontSize: isMobile ? 48 : 64, color: selectedType === 'exterior' ? '#1890ff' : '#8c8c8c' }} />
              <Title level={isMobile ? 3 : 2} style={{ marginTop: isMobile ? 12 : 16, marginBottom: 8 }}>
                Exterior Painting
              </Title>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                Siding, Trim, Windows, Doors, Decks
              </Text>
              
              <div style={{ marginTop: isMobile ? 16 : 24, textAlign: 'left' }}>
                <Text strong>Includes:</Text>
                <ul style={{ marginTop: 8, fontSize: isMobile ? 12 : 14 }}>
                  <li>Siding preparation & coating</li>
                  <li>Pressure washing / softwash</li>
                  <li>Exterior trim system</li>
                  <li>Window & door painting</li>
                  <li>Deck & fence staining</li>
                </ul>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {!selectedType && (
        <Alert
          message="Please select a job type to continue"
          type="warning"
          showIcon
          style={{ marginTop: isMobile ? 16 : 24 }}
        />
      )}

      <div style={{ marginTop: isMobile ? 16 : 32, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: isMobile ? 8 : 0 }}>
        <Button 
          size={isMobile ? 'middle' : 'large'} 
          onClick={onPrevious}
          block={isMobile}
        >
          Previous
        </Button>
        <Button 
          type="primary" 
          size={isMobile ? 'middle' : 'large'} 
          onClick={handleNext}
          disabled={!selectedType || !formData.pricingSchemeId}
          block={isMobile}
        >
          Next
        </Button>
      </div>

      <style jsx>{`
        .job-type-card {
          transition: all 0.3s ease;
        }
        
        .job-type-card.selected {
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
        }
        
        .job-type-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
        }
      `}</style>
    </div>
  );
};

export default JobTypeStep;
