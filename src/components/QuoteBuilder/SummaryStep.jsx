// src/components/QuoteBuilder/SummaryStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Descriptions, Divider, Input, Modal, Table, Tag, Space, Statistic } from 'antd';
import { EditOutlined, SendOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { quoteBuilderApi } from '../../services/quoteBuilderApi';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SummaryStep = ({ formData, onUpdate, onPrevious, onEdit }) => {
  const [notes, setNotes] = useState(formData.notes || '');
  const [calculatedQuote, setCalculatedQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    calculateQuote();
  }, []);

  useEffect(() => {
    onUpdate({ notes });
  }, [notes]);

  const calculateQuote = async () => {
    try {
      setLoading(true);
      const response = await quoteBuilderApi.calculateQuote(
        formData.areas,
        formData.productSets,
        formData.pricingSchemeId
      );
      if (response.success) {
        setCalculatedQuote(response.data);
      }
    } catch (error) {
      console.error('Error calculating quote:', error);
      Modal.error({
        title: 'Calculation Error',
        content: 'Failed to calculate quote totals. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuote = async () => {
    try {
      setSending(true);
      
      // First save the draft with all data
      const quoteData = {
        ...formData,
        notes,
        status: 'sent'
      };

      const saveResponse = await quoteBuilderApi.saveDraft(quoteData);
      const quoteId = formData.quoteId || saveResponse.data?.id;
      
      if (!quoteId) {
        throw new Error('Failed to save quote');
      }

      // Then send it
      const response = await quoteBuilderApi.sendQuote(quoteId);
      
      Modal.success({
        title: 'Quote Sent Successfully!',
        content: (
          <div>
            <p>Quote #{quoteId} has been sent to {formData.customerEmail}</p>
            <p>The customer can view and accept the quote in their portal.</p>
          </div>
        ),
        onOk: () => {
          // Navigate back to quotes list or dashboard
          window.location.href = '/quotes';
        }
      });
    } catch (error) {
      console.error('Error sending quote:', error);
      Modal.error({
        title: 'Send Failed',
        content: error.message || 'Failed to send quote. Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const quoteData = {
        ...formData,
        notes,
        status: 'draft'
      };

      await quoteBuilderApi.saveDraft(quoteData);
      
      Modal.success({
        title: 'Draft Saved',
        content: 'Quote has been saved as draft. You can continue editing later.',
        onOk: () => {
          window.location.href = '/quotes';
        }
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      Modal.error({
        title: 'Save Failed',
        content: 'Failed to save draft. Please try again.',
      });
    }
  };

  // Prepare area details for display
  const getAreaDetails = () => {
    return (formData.areas || []).map(area => {
      const selectedSurfaces = area.surfaces.filter(s => s.selected);
      return {
        areaName: area.name,
        surfaces: selectedSurfaces,
        totalSqft: selectedSurfaces.reduce((sum, s) => sum + (parseFloat(s.sqft) || 0), 0)
      };
    });
  };

  // Prepare product details for display
  const getProductDetails = () => {
    return (formData.productSets || []).map(set => {
      const products = [];
      
      if (formData.productStrategy === 'gbb') {
        if (set.products.good) products.push({ tier: 'Good', productId: set.products.good });
        if (set.products.better) products.push({ tier: 'Better', productId: set.products.better });
        if (set.products.best) products.push({ tier: 'Best', productId: set.products.best });
      } else {
        if (set.products.single) products.push({ tier: 'Selected', productId: set.products.single });
      }

      return {
        surfaceType: set.surfaceType,
        products,
        gallons: set.gallons
      };
    });
  };

  const areaDetails = getAreaDetails();
  const productDetails = getProductDetails();

  return (
    <div className="summary-step">
      <Alert
        message="Step 5: Review & Send Quote"
        description="Review all details and send the quote to your customer. They'll receive an email with a link to view and accept the quote."
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        style={{ marginBottom: 24 }}
      />

      {/* Customer Information */}
      <Card 
        title={
          <Space>
            <span>Customer Information</span>
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => onEdit(0)}
            >
              Edit
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Descriptions column={2}>
          <Descriptions.Item label="Name">{formData.customerName}</Descriptions.Item>
          <Descriptions.Item label="Email">{formData.customerEmail}</Descriptions.Item>
          <Descriptions.Item label="Phone">{formData.customerPhone}</Descriptions.Item>
          <Descriptions.Item label="Address">
            {formData.street}, {formData.city}, {formData.state} {formData.zipCode}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Job Type */}
      <Card 
        title={
          <Space>
            <span>Job Type</span>
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => onEdit(1)}
            >
              Edit
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Tag color={formData.jobType === 'interior' ? 'blue' : 'green'} style={{ fontSize: 16, padding: '4px 12px' }}>
          {formData.jobType === 'interior' ? 'Interior' : 'Exterior'} Paint Job
        </Tag>
      </Card>

      {/* Areas & Surfaces */}
      <Card 
        title={
          <Space>
            <span>Areas & Surfaces</span>
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => onEdit(2)}
            >
              Edit
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {areaDetails.map(area => (
          <div key={area.areaName} style={{ marginBottom: 16 }}>
            <Title level={5}>{area.areaName}</Title>
            <Table
              size="small"
              pagination={false}
              dataSource={area.surfaces}
              columns={[
                { title: 'Surface', dataIndex: 'type', key: 'type' },
                { title: 'Substrate', dataIndex: 'substrate', key: 'substrate' },
                { title: 'Sq Ft', dataIndex: 'sqft', key: 'sqft', render: (val) => val ? `${val} sq ft` : 'N/A' },
                { title: 'Dimensions', dataIndex: 'dimensions', key: 'dimensions', render: (val) => val || 'N/A' },
              ]}
            />
            <Text type="secondary">Total: {area.totalSqft} sq ft</Text>
          </div>
        ))}
      </Card>

      {/* Products */}
      <Card 
        title={
          <Space>
            <span>Product Selections</span>
            <Button 
              type="link" 
              icon={<EditOutlined />}
              onClick={() => onEdit(3)}
            >
              Edit
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph>
          <strong>Strategy:</strong> {formData.productStrategy === 'gbb' ? 'Good-Better-Best' : 'Single Product'}
        </Paragraph>
        
        {productDetails.map(detail => (
          <div key={detail.surfaceType} style={{ marginBottom: 16 }}>
            <Title level={5}>{detail.surfaceType}</Title>
            <ul>
              {detail.products.map((product, idx) => (
                <li key={idx}>
                  <Tag color={
                    product.tier === 'Good' ? 'blue' :
                    product.tier === 'Better' ? 'cyan' :
                    product.tier === 'Best' ? 'green' : 'default'
                  }>
                    {product.tier}
                  </Tag>
                  Product ID: {product.productId}
                </li>
              ))}
            </ul>
            {detail.gallons && <Text type="secondary">Estimated: {detail.gallons} gallons</Text>}
          </div>
        ))}
      </Card>

      {/* Cost Breakdown */}
      {calculatedQuote && (
        <Card title="Cost Breakdown" loading={loading} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic 
                title="Materials Cost" 
                value={calculatedQuote.materialsCost || 0} 
                prefix="$"
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="Labor Cost" 
                value={calculatedQuote.laborCost || 0} 
                prefix="$"
                precision={2}
              />
            </Col>
            <Col span={8}>
              <Statistic 
                title="Total Quote" 
                value={calculatedQuote.totalCost || 0} 
                prefix="$"
                precision={2}
                valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
              />
            </Col>
          </Row>
          {calculatedQuote.breakdown && (
            <Divider />
          )}
          {calculatedQuote.breakdown && (
            <Descriptions column={1} size="small">
              {Object.entries(calculatedQuote.breakdown).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  ${value.toFixed(2)}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}
        </Card>
      )}

      {/* Notes */}
      <Card title="Additional Notes (Optional)" style={{ marginBottom: 16 }}>
        <TextArea
          rows={4}
          placeholder="Add any special instructions, prep work needed, timeline considerations, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          showCount
        />
      </Card>

      {/* Actions */}
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
        <Button size="large" onClick={onPrevious}>
          Previous
        </Button>
        <Space>
          <Button 
            size="large" 
            icon={<SaveOutlined />}
            onClick={handleSaveDraft}
          >
            Save as Draft
          </Button>
          <Button 
            type="primary" 
            size="large" 
            icon={<SendOutlined />}
            onClick={handleSendQuote}
            loading={sending}
          >
            Send Quote to Customer
          </Button>
        </Space>
      </div>

      <Divider />

      <Alert
        message="What Happens Next?"
        description={
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Customer receives email with quote link</li>
            <li>They can view all options in the Customer Portal</li>
            <li>They select colors and sheens for each area</li>
            <li>They can accept, request changes, or decline</li>
            <li>You'll be notified of their response</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </div>
  );
};

export default SummaryStep;
