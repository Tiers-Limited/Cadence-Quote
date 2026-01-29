import React from 'react';
import { Card, Row, Col, InputNumber, Input, Divider, Space, Typography } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ProductionBasedTierConfig = ({ config, onChange, disabled }) => {
  const tiers = ['good', 'better', 'best'];
  
  const handleHourlyRateChange = (tier, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { hourlyRate: 0, productionRates: {}, materialSettings: {} };
    newConfig[tier].hourlyRate = value;
    onChange(newConfig);
  };

  const handleProductionRateChange = (tier, category, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { hourlyRate: 0, productionRates: {}, materialSettings: {} };
    if (!newConfig[tier].productionRates) newConfig[tier].productionRates = {};
    newConfig[tier].productionRates[category] = value;
    onChange(newConfig);
  };

  const handleMaterialSettingChange = (tier, setting, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { hourlyRate: 0, productionRates: {}, materialSettings: {} };
    if (!newConfig[tier].materialSettings) newConfig[tier].materialSettings = {};
    newConfig[tier].materialSettings[setting] = value;
    onChange(newConfig);
  };

  const handleDescriptionChange = (tier, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { hourlyRate: 0, productionRates: {}, materialSettings: {} };
    newConfig[tier].description = value;
    onChange(newConfig);
  };

  const productionCategories = [
    { key: 'walls', label: 'Walls (sq ft/hr)' },
    { key: 'ceilings', label: 'Ceilings (sq ft/hr)' },
    { key: 'trim', label: 'Trim (sq ft/hr)' },
    { key: 'doors', label: 'Doors (units/hr)' },
    { key: 'cabinets', label: 'Cabinets (units/hr)' }
  ];

  const getTierColor = (tier) => {
    return tier === 'good' ? '#1890ff' : tier === 'better' ? '#52c41a' : '#722ed1';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {tiers.map(tier => (
        <Card
          key={tier}
          style={{
            borderColor: getTierColor(tier),
            borderWidth: 2
          }}
          title={
            <span style={{ color: getTierColor(tier), fontSize: 18, fontWeight: 'bold' }}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
            </span>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Description */}
            <div>
              <Text strong>Tier Description:</Text>
              <TextArea
                rows={2}
                placeholder="Enter description for this tier"
                value={config[tier]?.description || ''}
                onChange={(e) => handleDescriptionChange(tier, e.target.value)}
                disabled={disabled}
                style={{ marginTop: 8 }}
              />
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* Hourly Rate */}
            <div>
              <Title level={5}>Hourly Labor Rate</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>Billable Rate ($/hr):</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={5}
                      precision={2}
                      prefix="$"
                      value={config[tier]?.hourlyRate || 0}
                      onChange={(value) => handleHourlyRateChange(tier, value)}
                      disabled={disabled}
                    />
                  </Space>
                </Col>
              </Row>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* Production Rates */}
            <div>
              <Title level={5}>Production Rates</Title>
              <Row gutter={[16, 16]}>
                {productionCategories.map(category => (
                  <Col xs={24} sm={12} md={8} key={category.key}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text>{category.label}:</Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        step={10}
                        precision={0}
                        value={config[tier]?.productionRates?.[category.key] || 0}
                        onChange={(value) => handleProductionRateChange(tier, category.key, value)}
                        disabled={disabled}
                      />
                    </Space>
                  </Col>
                ))}
              </Row>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* Material Settings */}
            <div>
              <Title level={5}>Material Settings</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>Cost Per Gallon:</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={1}
                      precision={2}
                      prefix="$"
                      value={config[tier]?.materialSettings?.costPerGallon || 0}
                      onChange={(value) => handleMaterialSettingChange(tier, 'costPerGallon', value)}
                      disabled={disabled}
                    />
                  </Space>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>Coverage (sq ft/gal):</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={100}
                      max={500}
                      step={10}
                      value={config[tier]?.materialSettings?.coverage || 350}
                      onChange={(value) => handleMaterialSettingChange(tier, 'coverage', value)}
                      disabled={disabled}
                    />
                  </Space>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>Coats:</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      max={5}
                      step={1}
                      value={config[tier]?.materialSettings?.coats || 2}
                      onChange={(value) => handleMaterialSettingChange(tier, 'coats', value)}
                      disabled={disabled}
                    />
                  </Space>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>Waste Factor:</Text>
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      max={2}
                      step={0.05}
                      precision={2}
                      value={config[tier]?.materialSettings?.wasteFactor || 1.1}
                      onChange={(value) => handleMaterialSettingChange(tier, 'wasteFactor', value)}
                      disabled={disabled}
                    />
                  </Space>
                </Col>
              </Row>
            </div>
          </Space>
        </Card>
      ))}
    </div>
  );
};

export default ProductionBasedTierConfig;
