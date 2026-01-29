import React from 'react';
import { Card, Row, Col, InputNumber, Input, Divider, Space, Typography, Tabs } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

const FlatRateTierConfig = ({ config, onChange, disabled }) => {
  const tiers = ['good', 'better', 'best'];
  
  const handleUnitPriceChange = (tier, category, item, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { unitPrices: { interior: {}, exterior: {} } };
    if (!newConfig[tier].unitPrices) newConfig[tier].unitPrices = { interior: {}, exterior: {} };
    if (!newConfig[tier].unitPrices[category]) newConfig[tier].unitPrices[category] = {};
    newConfig[tier].unitPrices[category][item] = value;
    onChange(newConfig);
  };

  const handleDescriptionChange = (tier, value) => {
    const newConfig = { ...config };
    if (!newConfig[tier]) newConfig[tier] = { unitPrices: { interior: {}, exterior: {} } };
    newConfig[tier].description = value;
    onChange(newConfig);
  };

  const interiorItems = [
    { key: 'doors', label: 'Interior Doors' },
    { key: 'smallRooms', label: 'Small Rooms' },
    { key: 'mediumRooms', label: 'Medium Rooms' },
    { key: 'largeRooms', label: 'Large Rooms' },
    { key: 'closets', label: 'Closets' },
    { key: 'accentWalls', label: 'Accent Walls' },
    { key: 'cabinetFaces', label: 'Cabinet Faces' },
    { key: 'cabinetDoors', label: 'Cabinet Doors' }
  ];

  const exteriorItems = [
    { key: 'doors', label: 'Exterior Doors' },
    { key: 'windows', label: 'Windows' },
    { key: 'garageDoors1Car', label: '1-Car Garage Doors' },
    { key: 'garageDoors2Car', label: '2-Car Garage Doors' },
    { key: 'garageDoors3Car', label: '3-Car Garage Doors' },
    { key: 'shutters', label: 'Shutters' }
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

            {/* Unit Prices */}
            <Tabs defaultActiveKey="interior">
              <TabPane tab="Interior Items" key="interior">
                <Row gutter={[16, 16]}>
                  {interiorItems.map(item => (
                    <Col xs={24} sm={12} md={8} key={item.key}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text>{item.label}:</Text>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          step={10}
                          precision={2}
                          prefix="$"
                          value={config[tier]?.unitPrices?.interior?.[item.key] || 0}
                          onChange={(value) => handleUnitPriceChange(tier, 'interior', item.key, value)}
                          disabled={disabled}
                        />
                      </Space>
                    </Col>
                  ))}
                </Row>
              </TabPane>
              <TabPane tab="Exterior Items" key="exterior">
                <Row gutter={[16, 16]}>
                  {exteriorItems.map(item => (
                    <Col xs={24} sm={12} md={8} key={item.key}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text>{item.label}:</Text>
                        <InputNumber
                          style={{ width: '100%' }}
                          min={0}
                          step={10}
                          precision={2}
                          prefix="$"
                          value={config[tier]?.unitPrices?.exterior?.[item.key] || 0}
                          onChange={(value) => handleUnitPriceChange(tier, 'exterior', item.key, value)}
                          disabled={disabled}
                        />
                      </Space>
                    </Col>
                  ))}
                </Row>
              </TabPane>
            </Tabs>
          </Space>
        </Card>
      ))}
    </div>
  );
};

export default FlatRateTierConfig;
