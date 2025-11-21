import React, { useState } from 'react';
import { Card, InputNumber, Radio, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

export const SurfaceAreaInput = ({ surfaceType, dimensions, onDimensionsChange }) => {
  const [inputMode, setInputMode] = useState(dimensions?.directArea ? 'direct' : 'dimensions');
  const unit = dimensions?.unit || 'sq ft';
  const isTrim = unit === 'linear ft';

  const handleDimensionChange = (field, value) => {
    const newDimensions = { ...dimensions, [field]: value };
    onDimensionsChange(newDimensions);
  };

  const calculateArea = () => {
    if (!dimensions) return 0;
    
    if (dimensions.directArea) return dimensions.directArea;
    
    const { length = 0, width = 0, height = 0 } = dimensions;
    
    if (isTrim) {
      // For trim: perimeter calculation
      if (length && width) return 2 * (length + width);
      return 0;
    }
    
    // For walls: perimeter × height
    if (surfaceType.toLowerCase().includes('wall') && length && width && height) {
      return 2 * (length + width) * height;
    }
    
    // For ceiling/floor: length × width
    if (length && width) return length * width;
    
    return 0;
  };

  const totalArea = calculateArea();

  return (
    <Card size="small" className="bg-gray-50">
      <div className="mb-3">
        <Radio.Group 
          value={inputMode} 
          onChange={(e) => {
            setInputMode(e.target.value);
            if (e.target.value === 'direct') {
              onDimensionsChange({ ...dimensions, directArea: totalArea || 0 });
            } else {
              const { directArea, ...rest } = dimensions || {};
              onDimensionsChange(rest);
            }
          }}
          size="small"
        >
          <Radio value="dimensions">Enter Dimensions</Radio>
          <Radio value="direct">Direct Area</Radio>
        </Radio.Group>
      </div>

      {inputMode === 'direct' ? (
        <div>
          <Space>
            <InputNumber
              value={dimensions?.directArea || 0}
              onChange={(value) => handleDimensionChange('directArea', value)}
              min={0}
              step={0.1}
              addonAfter={unit}
              placeholder="Total area"
              style={{ width: 150 }}
            />
            <Tooltip title="Enter the total area directly">
              <InfoCircleOutlined className="text-gray-400" />
            </Tooltip>
          </Space>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Length (ft)</label>
              <InputNumber
                value={dimensions?.length || 0}
                onChange={(value) => handleDimensionChange('length', value)}
                min={0}
                step={0.5}
                placeholder="0"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Width (ft)</label>
              <InputNumber
                value={dimensions?.width || 0}
                onChange={(value) => handleDimensionChange('width', value)}
                min={0}
                step={0.5}
                placeholder="0"
                style={{ width: '100%' }}
              />
            </div>
            {!isTrim && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Height (ft)</label>
                <InputNumber
                  value={dimensions?.height || 0}
                  onChange={(value) => handleDimensionChange('height', value)}
                  min={0}
                  step={0.5}
                  placeholder="0"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
          {totalArea > 0 && (
            <div className="text-sm font-medium text-blue-600 mt-2">
              Calculated: {totalArea.toFixed(1)} {unit}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
