// src/components/QuoteBuilder/DimensionCalculator.jsx
import React, { useState, useEffect } from 'react';
import { Modal, InputNumber, Row, Col, Typography, Button, Space, Alert } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';

const { Text } = Typography;

const DimensionCalculator = ({ surfaceType, visible, onCalculate, onCancel, initialDimensions }) => {
  const [length, setLength] = useState(initialDimensions?.length || null);
  const [width, setWidth] = useState(initialDimensions?.width || null);
  const [height, setHeight] = useState(initialDimensions?.height || null);
  const [calculatedSqft, setCalculatedSqft] = useState(null);

  useEffect(() => {
    if (length && width) {
      let sqft = 0;

      if (surfaceType === 'Walls' || surfaceType === 'Siding' || surfaceType === 'Exterior Walls') {
        // Walls: 2 × (length + width) × height
        if (height) {
          sqft = 2 * (parseFloat(length) + parseFloat(width)) * parseFloat(height);
        }
      } else if (surfaceType === 'Ceiling' || surfaceType === 'Ceilings') {
        // Ceiling: length × width
        sqft = parseFloat(length) * parseFloat(width);
      } else if (surfaceType === 'Trim' || surfaceType === 'Exterior Trim') {
        // Trim (optional): 2 × (length + width)
        sqft = 2 * (parseFloat(length) + parseFloat(width));
      } else {
        // Default: length × width
        sqft = parseFloat(length) * parseFloat(width);
      }

      setCalculatedSqft(Math.ceil(sqft)); // Round up
    } else {
      setCalculatedSqft(null);
    }
  }, [length, width, height, surfaceType]);

  const handleOk = () => {
    if (calculatedSqft) {
      onCalculate(calculatedSqft, { length, width, height });
    }
  };

  const getFormulaText = () => {
    if (surfaceType === 'Walls' || surfaceType === 'Siding' || surfaceType === 'Exterior Walls') {
      return 'Formula: 2 × (L + W) × H';
    } else if (surfaceType === 'Ceiling' || surfaceType === 'Ceilings') {
      return 'Formula: L × W';
    } else if (surfaceType === 'Trim' || surfaceType === 'Exterior Trim') {
      return 'Formula: 2 × (L + W)';
    }
    return 'Formula: L × W';
  };

  return (
    <Modal
      title={
        <Space>
          <CalculatorOutlined />
          <span>Calculate Square Footage - {surfaceType}</span>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Use This Calculation"
      okButtonProps={{ disabled: !calculatedSqft }}
      width={450}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">{getFormulaText()}</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Text strong>Length (ft)</Text>
          <InputNumber
            style={{ width: '100%', marginTop: 4 }}
            min={0}
            step={0.5}
            value={length}
            onChange={setLength}
            placeholder="Length"
          />
        </Col>
        <Col span={12}>
          <Text strong>Width (ft)</Text>
          <InputNumber
            style={{ width: '100%', marginTop: 4 }}
            min={0}
            step={0.5}
            value={width}
            onChange={setWidth}
            placeholder="Width"
          />
        </Col>

        {(surfaceType === 'Walls' || surfaceType === 'Siding' || surfaceType === 'Exterior Walls') && (
          <Col span={12}>
            <Text strong>Height (ft)</Text>
            <InputNumber
              style={{ width: '100%', marginTop: 4 }}
              min={0}
              step={0.5}
              value={height}
              onChange={setHeight}
              placeholder="Height"
            />
          </Col>
        )}
      </Row>

      {calculatedSqft && (
        <Alert
          message="Calculated Square Footage"
          description={
            <div>
              <Text strong style={{ fontSize: 18, display: 'block', marginBottom: 8 }}>
                {calculatedSqft.toLocaleString()} sq ft
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {surfaceType === 'Walls' || surfaceType === 'Siding' || surfaceType === 'Exterior Walls' ? (
                  <span>2 × ({length} + {width}) × {height} = {calculatedSqft} sq ft</span>
                ) : surfaceType === 'Ceiling' || surfaceType === 'Ceilings' ? (
                  <span>{length} × {width} = {calculatedSqft} sq ft</span>
                ) : surfaceType === 'Trim' || surfaceType === 'Exterior Trim' ? (
                  <span>2 × ({length} + {width}) = {calculatedSqft} LF</span>
                ) : (
                  <span>{length} × {width} = {calculatedSqft} sq ft</span>
                )}
              </Text>
            </div>
          }
          type="success"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
};

export default DimensionCalculator;
