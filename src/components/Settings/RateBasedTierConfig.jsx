import React from 'react';
import { Card, Row, Col, InputNumber, Input, Divider, Space, Typography } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

const RateBasedTierConfig = ({ config, onChange, disabled }) => {
  const tiers = ['good', 'better', 'best'];
  
  const handleLaborRateChange = (tier, category, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { laborRates: {}, materialSettings: {} };
    if (!newConfig[tier].laborRates) newConfig[tier].laborRates = {};
    newConfig[tier].laborRates[category] = value;
    onChange(newConfig);
  };

  const handleMaterialSettingChange = (tier, setting, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { laborRates: {}, materialSettings: {} };
    if (!newConfig[tier].materialSettings) newConfig[tier].materialSettings = {};
    newConfig[tier].materialSettings[setting] = value;
    onChange(newConfig);
  };

  const handleDescriptionChange = (tier, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { laborRates: {}, materialSettings: {} };
    newConfig[tier].description = value;
    onChange(newConfig);
  };

  const laborCategories = [
    { key: 'walls', label: 'Walls' },
    { key: 'ceilings', label: 'Ceilings' },
    { key: 'trim', label: 'Trim' },
    { key: 'doors', label: 'Doors' },
    { key: 'cabinets', label: 'Cabinets' }
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

            {/* Labor Rates */}
            <div>
              <Title level={5}>Labor Rates ($/sq ft)</Title>
              <Row gutter={[16, 16]}>
                {laborCategories.map(category => (
                  <Col xs={24} sm={12} md={8} key={category.key}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text>{category.label}:</Text>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        step={0.1}
                        precision={2}
                        prefix="$"
                        value={config[tier]?.laborRates?.[category.key] || 0}
                        onChange={(value) => handleLaborRateChange(tier, category.key, value)}
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

export default RateBasedTierConfig;
