import React from 'react';
import { Card, Row, Col, Badge, Button, Statistic, Divider } from 'antd';
import { CheckCircleOutlined, StarOutlined, TrophyOutlined } from '@ant-design/icons';

/**
 * Tier Selection Step Component
 * 
 * Displays Good-Better-Best pricing tiers and allows selection.
 */
const TierSelectionStep = ({ tierPricing, selectedTier, onSelectTier, pricingScheme }) => {
  if (!tierPricing || !tierPricing.gbbEnabled) {
    return null; // Don't show if GBB is not enabled
  }

  const tiers = [
    {
      key: 'good',
      label: 'Good',
      icon: <CheckCircleOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff',
      borderColor: '#91d5ff',
      description: tierPricing.good?.tierDescription || 'Quality work at competitive prices'
    },
    {
      key: 'better',
      label: 'Better',
      icon: <StarOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      borderColor: '#b7eb8f',
      recommended: true,
      description: tierPricing.better?.tierDescription || 'Enhanced quality and attention to detail'
    },
    {
      key: 'best',
      label: 'Best',
      icon: <TrophyOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      borderColor: '#d3adf7',
      description: tierPricing.best?.tierDescription || 'Premium service with finest materials'
    }
  ];

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const getTierPricing = (tier) => {
    return tierPricing[tier] || {};
  };

  return (
    <div className="tier-selection-step">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Select Your Pricing Tier</h2>
        <p className="text-gray-600">
          Choose the quality level that best fits your needs and budget
        </p>
      </div>

      <Row gutter={[16, 16]}>
        {tiers.map((tier) => {
          const pricing = getTierPricing(tier.key);
          const isSelected = selectedTier === tier.key;

          return (
            <Col xs={24} md={8} key={tier.key}>
              <Card
                hoverable
                className={`tier-card ${isSelected ? 'selected' : ''}`}
                style={{
                  borderColor: isSelected ? tier.color : tier.borderColor,
                  borderWidth: isSelected ? 3 : 1,
                  backgroundColor: isSelected ? tier.bgColor : 'white',
                  height: '100%'
                }}
                onClick={() => onSelectTier(tier.key)}
              >
                <div className="text-center mb-4">
                  {tier.recommended && (
                    <Badge.Ribbon text="Recommended" color="green">
                      <div style={{ height: 20 }} />
                    </Badge.Ribbon>
                  )}
                  <div style={{ fontSize: 48, color: tier.color, marginBottom: 8 }}>
                    {tier.icon}
                  </div>
                  <h3 className="text-xl font-bold" style={{ color: tier.color }}>
                    {tier.label} Tier
                  </h3>
                </div>

                <Divider />

                <div className="text-center mb-4">
                  <Statistic
                    title="Total Price"
                    value={pricing.total || 0}
                    precision={2}
                    prefix="$"
                    valueStyle={{ 
                      color: tier.color, 
                      fontSize: 32,
                      fontWeight: 'bold'
                    }}
                  />
                </div>

                <div className="mb-4">
                  <p className="text-gray-600 text-sm text-center">
                    {tier.description}
                  </p>
                </div>

                <Divider />

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Labor Cost:</span>
                    <span className="font-semibold">{formatCurrency(pricing.laborCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Material Cost:</span>
                    <span className="font-semibold">{formatCurrency(pricing.materialCost)}</span>
                  </div>
                  {pricing.productCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Product Cost:</span>
                      <span className="font-semibold">{formatCurrency(pricing.productCost)}</span>
                    </div>
                  )}
                </div>

                <Button
                  type={isSelected ? 'primary' : 'default'}
                  size="large"
                  block
                  icon={isSelected ? <CheckCircleOutlined /> : null}
                  style={{
                    backgroundColor: isSelected ? tier.color : undefined,
                    borderColor: tier.color
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTier(tier.key);
                  }}
                >
                  {isSelected ? 'Selected' : 'Select This Tier'}
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      {selectedTier && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-gray-700">
            <strong>Selected:</strong> {tiers.find(t => t.key === selectedTier)?.label} Tier - {formatCurrency(getTierPricing(selectedTier).total)}
          </p>
        </div>
      )}

      <style jsx>{`
        .tier-card {
          transition: all 0.3s ease;
        }
        .tier-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .tier-card.selected {
          transform: translateY(-4px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default TierSelectionStep;
