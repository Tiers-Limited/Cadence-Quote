import React, { useState, useEffect } from 'react';
import { Card, InputNumber, Radio, Space, Tooltip, Spin, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import quoteApiService from '../services/quoteApiService';

export const SurfaceAreaInput = ({ surfaceType, dimensions, onDimensionsChange }) => {
  const [inputMode, setInputMode] = useState(dimensions?.directArea ? 'direct' : 'dimensions');
  const [dimensionConfig, setDimensionConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const unit = dimensions?.unit || 'sq ft';

  // Load dimension configuration from API
  useEffect(() => {
    loadDimensionConfig();
  }, [surfaceType]);

  const loadDimensionConfig = async () => {
    setLoading(true);
    try {
      const response = await quoteApiService.getSurfaceDimensions(surfaceType);
      setDimensionConfig(response.data);
    } catch (error) {
      console.error('Failed to load dimension config:', error);
      // Fallback to basic config
      setDimensionConfig({
        surfaceType,
        calculation: 'area',
        unit: 'sq ft',
        description: 'Enter dimensions',
        required: [
          { name: 'length', label: 'Length', type: 'number', unit: 'ft', min: 0, step: 0.1 },
          { name: 'width', label: 'Width', type: 'number', unit: 'ft', min: 0, step: 0.1 }
        ],
        optional: [
          { name: 'height', label: 'Height', type: 'number', unit: 'ft', min: 0, step: 0.1 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDimensionChange = (field, value) => {
    const newDimensions = { ...dimensions, [field]: value };
    onDimensionsChange(newDimensions);
  };

  const calculateArea = () => {
    if (!dimensions || !dimensionConfig) return 0;
    
    if (dimensions.directArea) return dimensions.directArea;
    
    const { length = 0, width = 0, height = 0, linearFeet = 0, count = 0 } = dimensions;
    
    // Use server-side calculation logic based on surface type
    switch (dimensionConfig.calculation) {
      case 'perimeter':
        // Walls: (L + W) * 2 * H
        if (length && width && height) {
          return (parseFloat(length) + parseFloat(width)) * 2 * parseFloat(height);
        } else if (length && height) {
          // Single wall
          return parseFloat(length) * parseFloat(height);
        }
        return 0;
        
      case 'area':
        // Ceiling/Deck: L * W
        if (length && width) {
          return parseFloat(length) * parseFloat(width);
        }
        return 0;
        
      case 'linear':
        // Trim/Fence: linear feet (or linear feet * height for fence)
        if (linearFeet) {
          if (height && surfaceType.toLowerCase().includes('fence')) {
            return parseFloat(linearFeet) * parseFloat(height);
          }
          return parseFloat(linearFeet);
        }
        // Fallback: perimeter for trim
        if (length && width) {
          return 2 * (parseFloat(length) + parseFloat(width));
        }
        return 0;
        
      case 'unit':
        // Doors/Windows/Shutters: count * area or count * standardSize
        if (count) {
          if (height && width) {
            return parseFloat(count) * parseFloat(height) * parseFloat(width);
          }
          // Return count for display (actual calculation on backend)
          return parseFloat(count);
        }
        return 0;
        
      default:
        // Default: area calculation
        if (length && width) return parseFloat(length) * parseFloat(width);
        return 0;
    }
  };

  const totalArea = calculateArea();

  return (
    <Card size="small" className="bg-gray-50">
      {loading ? (
        <div className="text-center py-4">
          <Spin size="small" />
        </div>
      ) : (
        <>
          {dimensionConfig?.description && (
            <Alert 
              message={dimensionConfig.description} 
              type="info" 
              showIcon 
              className="mb-3"
              icon={<InfoCircleOutlined />}
            />
          )}
          
          <div className="mb-3">
            <Radio.Group 
              value={inputMode} 
              onChange={(e) => {
                setInputMode(e.target.value);
                if (e.target.value === 'direct') {
                  onDimensionsChange({ ...dimensions, directArea: totalArea || 0, unit: dimensionConfig?.unit || 'sq ft' });
                } else {
                  const { directArea, ...rest } = dimensions || {};
                  onDimensionsChange({ ...rest, unit: dimensionConfig?.unit || 'sq ft' });
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
                  addonAfter={dimensionConfig?.unit || 'sq ft'}
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
              {/* Required Fields */}
              {dimensionConfig?.required && dimensionConfig.required.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {dimensionConfig.required.map((field) => (
                    <div key={field.name}>
                      <label className="text-xs text-gray-500 block mb-1">
                        {field.label} ({field.unit}) <span className="text-red-500">*</span>
                      </label>
                      <InputNumber
                        value={dimensions?.[field.name] || 0}
                        onChange={(value) => handleDimensionChange(field.name, value)}
                        min={field.min}
                        step={field.step}
                        placeholder={field.placeholder || '0'}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Optional Fields */}
              {dimensionConfig?.optional && dimensionConfig.optional.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 pt-2 border-t">
                  <div className="col-span-full">
                    <span className="text-xs text-gray-400">Optional Measurements</span>
                  </div>
                  {dimensionConfig.optional.map((field) => (
                    <div key={field.name}>
                      <label className="text-xs text-gray-500 block mb-1">
                        {field.label} ({field.unit})
                      </label>
                      <InputNumber
                        value={dimensions?.[field.name] || 0}
                        onChange={(value) => handleDimensionChange(field.name, value)}
                        min={field.min}
                        step={field.step}
                        placeholder={field.placeholder || '0'}
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Calculated Total */}
              <div className="mt-3 pt-3 border-t bg-blue-50 p-2 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Calculated {dimensionConfig?.unit || 'Area'}:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {totalArea.toFixed(2)} {dimensionConfig?.unit || 'sq ft'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
