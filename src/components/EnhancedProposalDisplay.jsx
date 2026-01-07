import React from 'react';
import { Card, Typography, Divider, Space, Row, Col, Tag, Alert } from 'antd';
import { 
  DollarOutlined, 
  HomeOutlined, 
  CheckCircleOutlined,
  ToolOutlined 
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * Enhanced Proposal Display Component
 * Adapts display based on pricing model type
 */
const EnhancedProposalDisplay = ({ 
  proposal, 
  calculation, 
  pricingScheme,
  showBreakdown = true 
}) => {
  if (!proposal || !calculation) {
    return <Alert message="Proposal data not available" type="warning" />;
  }

  const isTurnkey = pricingScheme?.type === 'turnkey' || pricingScheme?.type === 'sqft_turnkey';
  const isRateBased = pricingScheme?.type === 'rate_based_sqft' || pricingScheme?.type === 'sqft_labor_paint';
  const isProductionBased = pricingScheme?.type === 'production_based' || pricingScheme?.type === 'hourly_time_materials';
  const isFlatRate = pricingScheme?.type === 'flat_rate_unit' || pricingScheme?.type === 'unit_pricing';

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const renderTurnkeyBreakdown = () => (
    <Card style={{ marginTop: 16 }} bordered={false}>
      <Title level={4}>
        <HomeOutlined style={{ marginRight: 8 }} />
        Turnkey Pricing Details
      </Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={12}>
          <Text type="secondary">Home Size</Text>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {calculation.homeSqft?.toLocaleString()} sq ft
          </div>
        </Col>
        <Col xs={12}>
          <Text type="secondary">Rate per Sq Ft</Text>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {formatCurrency(calculation.turnkeyRate)}
          </div>
        </Col>
        <Col xs={12}>
          <Text type="secondary">Job Scope</Text>
          <div style={{ fontSize: 16 }}>
            <Tag color="blue">
              {calculation.jobScope === 'interior' ? 'Interior' : 
               calculation.jobScope === 'exterior' ? 'Exterior' : 'Full Home'}
            </Tag>
          </div>
        </Col>
        <Col xs={12}>
          <Text type="secondary">Property Condition</Text>
          <div style={{ fontSize: 16 }}>
            {calculation.conditionModifier?.charAt(0).toUpperCase() + 
             calculation.conditionModifier?.slice(1)}
          </div>
        </Col>
      </Row>

      <Divider />

      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>Base Labor Cost</Text>
          <Text strong>{formatCurrency(calculation.laborTotal)}</Text>
        </div>
        
        {calculation.includeMaterials && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Materials Included</Text>
            <Text strong>{formatCurrency(calculation.materialTotal)}</Text>
          </div>
        )}
      </Space>
    </Card>
  );

  const renderDetailedBreakdown = () => (
    <Card style={{ marginTop: 16 }} bordered={false}>
      <Title level={4}>
        <ToolOutlined style={{ marginRight: 8 }} />
        Project Breakdown
      </Title>
      
      {calculation.breakdown?.map((area, idx) => (
        <div key={idx} style={{ marginBottom: 24 }}>
          <Title level={5} style={{ color: '#1890ff' }}>
            {area.areaName}
          </Title>
          
          {area.items?.map((item, itemIdx) => (
            <Row key={itemIdx} gutter={[16, 8]} style={{ marginBottom: 8 }}>
              <Col xs={12}>
                <Text>{item.categoryName || item.type}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.quantity} {item.measurementUnit || 'sq ft'}
                    {item.hours && ` (${item.hours} hrs)`}
                  </Text>
                </div>
              </Col>
              <Col xs={12} style={{ textAlign: 'right' }}>
                <div>
                  <Text strong>{formatCurrency(item.laborCost)}</Text>
                </div>
                {calculation.includeMaterials && item.materialCost > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      + {formatCurrency(item.materialCost)} materials
                    </Text>
                  </div>
                )}
              </Col>
            </Row>
          ))}
        </div>
      ))}
    </Card>
  );

  const renderPricingSummary = () => (
    <Card style={{ marginTop: 16, backgroundColor: '#fafafa' }}>
      <Title level={4}>Investment Summary</Title>
      
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* Base Costs */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>Labor Subtotal</Text>
          <Text>{formatCurrency(calculation.laborCostWithMarkup)}</Text>
        </div>
        
        {calculation.includeMaterials && calculation.materialCostWithMarkup > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Materials Subtotal</Text>
            <Text>{formatCurrency(calculation.materialCostWithMarkup)}</Text>
          </div>
        )}

        {calculation.prepTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Preparation Work</Text>
            <Text>{formatCurrency(calculation.prepTotal)}</Text>
          </div>
        )}

        {calculation.addOnsTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Additional Services</Text>
            <Text>{formatCurrency(calculation.addOnsTotal)}</Text>
          </div>
        )}

        {calculation.overhead > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Overhead ({calculation.overheadPercent}%)</Text>
            <Text type="secondary">{formatCurrency(calculation.overhead)}</Text>
          </div>
        )}

        {calculation.profitAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Project Management ({calculation.profitMarginPercent}%)</Text>
            <Text type="secondary">{formatCurrency(calculation.profitAmount)}</Text>
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text strong>Subtotal</Text>
          <Text strong>{formatCurrency(calculation.subtotal)}</Text>
        </div>

        {calculation.tax > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text>Tax ({calculation.taxPercent}%)</Text>
            <Text>{formatCurrency(calculation.tax)}</Text>
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
          <Text strong style={{ fontSize: 18 }}>Total Investment</Text>
          <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
            {formatCurrency(calculation.total)}
          </Text>
        </div>

        {calculation.deposit > 0 && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Deposit Required ({calculation.depositPercent}%)</Text>
              <Text strong style={{ color: '#52c41a' }}>
                {formatCurrency(calculation.deposit)}
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Balance Due at Completion</Text>
              <Text>{formatCurrency(calculation.balance)}</Text>
            </div>
          </>
        )}
      </Space>
    </Card>
  );

  const renderPricingModelInfo = () => (
    <Alert
      message={
        <Space>
          <CheckCircleOutlined />
          <span>
            Pricing Model: <strong>{pricingScheme?.name || 'Standard Pricing'}</strong>
          </span>
        </Space>
      }
      description={
        <div>
          <Text type="secondary">
            {isTurnkey && 'All-inclusive turnkey pricing based on total home square footage'}
            {isRateBased && 'Labor calculated per square foot, materials priced separately'}
            {isProductionBased && 'Time & materials based on hourly rates and production efficiency'}
            {isFlatRate && 'Fixed price per unit (doors, windows, rooms, etc.)'}
          </Text>
          {calculation.includeMaterials ? (
            <div style={{ marginTop: 8 }}>
              <Tag color="success">Materials Included</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {calculation.coats} coat(s) • {calculation.coverage} sq ft/gal coverage
              </Text>
            </div>
          ) : (
            <Tag color="orange">Labor Only - Customer Supplies Materials</Tag>
          )}
        </div>
      }
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );

  return (
    <div>
      {/* Pricing Model Information */}
      {pricingScheme && renderPricingModelInfo()}

      {/* Model-specific breakdown */}
      {showBreakdown && (
        <>
          {isTurnkey && renderTurnkeyBreakdown()}
          {!isTurnkey && renderDetailedBreakdown()}
        </>
      )}

      {/* Pricing Summary (all models) */}
      {renderPricingSummary()}

      {/* Additional Info */}
      {calculation.quoteValidityDays && (
        <Alert
          message={`This quote is valid for ${calculation.quoteValidityDays} days from the date issued.`}
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default EnhancedProposalDisplay;
