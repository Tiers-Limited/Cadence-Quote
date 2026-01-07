import React from 'react';
import { Form, InputNumber, Select, Switch, Tooltip, Typography, Space, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

/**
 * Dynamic Pricing Fields Component
 * Renders form fields based on the selected pricing scheme type
 * Hides/shows fields relevant to each pricing model
 */
const DynamicPricingFields = ({ 
  pricingScheme, 
  formData, 
  onChange, 
  showMaterialControls = false,
  disabled = false 
}) => {
  if (!pricingScheme) {
    return (
      <Alert
        message="No Pricing Scheme Selected"
        description="Please select a pricing scheme to continue."
        type="warning"
        showIcon
      />
    );
  }

  const schemeType = pricingScheme.type;
  const isTurnkey = schemeType === 'turnkey' || schemeType === 'sqft_turnkey';
  const isRateBased = schemeType === 'rate_based_sqft' || schemeType === 'sqft_labor_paint';
  const isProductionBased = schemeType === 'production_based' || schemeType === 'hourly_time_materials';
  const isFlatRate = schemeType === 'flat_rate_unit' || schemeType === 'unit_pricing' || schemeType === 'room_flat_rate';

  const handleFieldChange = (field, value) => {
    if (onChange) {
      onChange({ [field]: value });
    }
  };

  const renderTurnkeyFields = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        message="Turnkey Pricing Model"
        description="This model uses total home square footage. Individual room measurements and product selections are not needed."
        type="info"
        showIcon
        closable
      />

      <Form.Item
        label={
          <span>
            Total Home Size (sq ft)
            <Tooltip title="Enter the total square footage of the home for turnkey pricing">
              <InfoCircleOutlined style={{ marginLeft: 8 }} />
            </Tooltip>
          </span>
        }
        required
      >
        <InputNumber
          style={{ width: '100%' }}
          value={formData.homeSqft}
          onChange={(value) => handleFieldChange('homeSqft', value)}
          min={100}
          max={50000}
          step={100}
          disabled={disabled}
          placeholder="e.g., 2500"
          addonAfter="sq ft"
        />
      </Form.Item>

      <Form.Item
        label={
          <span>
            Job Scope
            <Tooltip title="Select whether this is interior only, exterior only, or both">
              <InfoCircleOutlined style={{ marginLeft: 8 }} />
            </Tooltip>
          </span>
        }
      >
        <Select
          value={formData.jobScope || 'both'}
          onChange={(value) => handleFieldChange('jobScope', value)}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          <Option value="interior">Interior Only</Option>
          <Option value="exterior">Exterior Only</Option>
          <Option value="both">Both Interior & Exterior</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={
          <span>
            Number of Stories
            <Tooltip title="More stories may affect pricing complexity">
              <InfoCircleOutlined style={{ marginLeft: 8 }} />
            </Tooltip>
          </span>
        }
      >
        <InputNumber
          style={{ width: '100%' }}
          value={formData.numberOfStories || 1}
          onChange={(value) => handleFieldChange('numberOfStories', value)}
          min={1}
          max={4}
          disabled={disabled}
        />
      </Form.Item>

      <Form.Item
        label={
          <span>
            Property Condition
            <Tooltip title="Property condition affects pricing: Poor (+25%), Fair (+10%), Average (±0%), Good (-5%), Excellent (-10%)">
              <InfoCircleOutlined style={{ marginLeft: 8 }} />
            </Tooltip>
          </span>
        }
      >
        <Select
          value={formData.conditionModifier || 'average'}
          onChange={(value) => handleFieldChange('conditionModifier', value)}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          <Option value="excellent">Excellent (−10%)</Option>
          <Option value="good">Good (−5%)</Option>
          <Option value="average">Average (±0%)</Option>
          <Option value="fair">Fair (+10%)</Option>
          <Option value="poor">Poor (+25%)</Option>
        </Select>
      </Form.Item>
    </Space>
  );

  const renderRateBasedFields = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        message="Rate-Based Square Foot Pricing"
        description="Labor is calculated per square foot. You'll add rooms and measure each surface area in the next step."
        type="info"
        showIcon
      />
    </Space>
  );

  const renderProductionBasedFields = () => {
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          message="Production-Based Pricing (Time & Materials)"
          description="Labor is calculated based on estimated hours using your production rates. You'll see time estimates as you add measurements in the next step."
          type="info"
          showIcon
        />
      </Space>
    );
  };

  const renderFlatRateFields = () => (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        message="Flat Rate Unit Pricing"
        description="This model uses fixed prices per unit (door, window, room, etc.). Materials are included in the unit price. You'll enter counts in the next step."
        type="info"
        showIcon
      />
    </Space>
  );

  const renderMaterialControls = () => {
    // Don't show material controls for flat rate (materials always included) or turnkey
    if (!showMaterialControls || isFlatRate || isTurnkey) return null;

    const rules = pricingScheme.pricingRules || {};
    const includeMaterials = formData.includeMaterials ?? rules.includeMaterials ?? true;

    return (
      <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 24 }}>
        <Text strong>Material Settings</Text>
        
        <Form.Item
          label="Include Materials"
          tooltip="Toggle OFF only if customer supplies their own paint"
        >
          <Switch
            checked={includeMaterials}
            onChange={(checked) => handleFieldChange('includeMaterials', checked)}
            disabled={disabled}
            checkedChildren="Included"
            unCheckedChildren="Excluded"
          />
          {!includeMaterials && (
            <Text type="warning" style={{ display: 'block', marginTop: 8 }}>
              Materials excluded - Labor-only pricing
            </Text>
          )}
        </Form.Item>
      </Space>
    );
  };

  return (
    <div>
      {/* Model-specific fields */}
      {isTurnkey && renderTurnkeyFields()}
      {isRateBased && renderRateBasedFields()}
      {isProductionBased && renderProductionBasedFields()}
      {isFlatRate && renderFlatRateFields()}
      
      {/* Material controls (shown if requested) */}
      {renderMaterialControls()}
    </div>
  );
};

export default DynamicPricingFields;
