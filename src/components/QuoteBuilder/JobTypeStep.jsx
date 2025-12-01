// src/components/QuoteBuilder/JobTypeStep.jsx
import React, { useState } from 'react';
import { Card, Button, Alert, Row, Col, Typography } from 'antd';
import { HomeOutlined, BuildOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const JobTypeStep = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [selectedType, setSelectedType] = useState(formData.jobType || null);

  const handleJobTypeSelect = (type) => {
    setSelectedType(type);
    onUpdate({ jobType: type });
  };

  const handleNext = () => {
    if (selectedType) {
      onNext();
    }
  };

  return (
    <div className="job-type-step">
      <Alert
        message="Step 2: Job Type"
        description="Select the primary category of work. This determines which areas, materials, and processes are available."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
        What type of painting project is this?
      </Title>

      <Row gutter={24} justify="center">
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
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <HomeOutlined style={{ fontSize: 64, color: selectedType === 'interior' ? '#1890ff' : '#8c8c8c' }} />
              <Title level={2} style={{ marginTop: 16, marginBottom: 8 }}>
                Interior Painting
              </Title>
              <Text type="secondary">
                Walls, Ceilings, Trim, Doors, Cabinets
              </Text>
              
              <div style={{ marginTop: 24, textAlign: 'left' }}>
                <Text strong>Includes:</Text>
                <ul style={{ marginTop: 8 }}>
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
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <BuildOutlined style={{ fontSize: 64, color: selectedType === 'exterior' ? '#1890ff' : '#8c8c8c' }} />
              <Title level={2} style={{ marginTop: 16, marginBottom: 8 }}>
                Exterior Painting
              </Title>
              <Text type="secondary">
                Siding, Trim, Windows, Doors, Decks
              </Text>
              
              <div style={{ marginTop: 24, textAlign: 'left' }}>
                <Text strong>Includes:</Text>
                <ul style={{ marginTop: 8 }}>
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
          disabled={!selectedType}
        >
          Next: Areas & Surfaces
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
