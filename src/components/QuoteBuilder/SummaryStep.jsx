// src/components/QuoteBuilder/SummaryStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Descriptions, Divider, Input, Modal, Table, Tag, Space, Statistic } from 'antd';
import { EditOutlined, SendOutlined, SaveOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { quoteBuilderApi } from '../../services/quoteBuilderApi';
import { apiService } from '../../services/apiService';
import ProposalPreviewModal from './ProposalPreviewModal';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SummaryStep = ({ formData, onUpdate, onPrevious, onEdit, pricingSchemes }) => {
  const [notes, setNotes] = useState(formData.notes || '');
  const [calculatedQuote, setCalculatedQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showProposalPreview, setShowProposalPreview] = useState(false);
  const [productsMap, setProductsMap] = useState({});

  useEffect(() => {
    calculateQuote();
    fetchProducts();
  }, []);

  useEffect(() => {
    onUpdate({ notes });
  }, [notes]);

  const fetchProducts = async () => {
    try {
      const response = await apiService.get('/contractor/product-configs');
      if (response.success) {
        const productMap = {};
        (response.data || []).forEach(config => {
          productMap[config.id] = {
            brandName: config.globalProduct?.brand?.name || 'Unknown',
            productName: config.globalProduct?.name || 'Unknown',
            pricePerGallon: config.sheens?.[0]?.price || 0
          };
        });
        setProductsMap(productMap);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const calculateQuote = async () => {
    try {
      setLoading(true);
      const response = await quoteBuilderApi.calculateQuote(
        formData.areas,
        formData.productSets,
        formData.pricingSchemeId,
        formData.jobType,
        { distance: 0 } // TODO: Calculate from customer address
      );
      if (response.success) {
        setCalculatedQuote(response.calculation);
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

  // Prepare area details for display - supports both laborItems and surfaces
  const getAreaDetails = () => {
    return (formData.areas || []).map(area => {
      let items = [];
      let totalSqft = 0;
      let totalGallons = 0;

      // New structure: laborItems
      if (area.laborItems) {
        const selectedItems = area.laborItems.filter(i => i.selected);
        items = selectedItems.map(item => ({
          type: item.categoryName,
          quantity: item.quantity,
          unit: item.measurementUnit,
          coats: item.numberOfCoats,
          gallons: item.gallons,
          laborRate: item.laborRate,
          dimensions: item.dimensions ? `${item.dimensions.length}' x ${item.dimensions.width}'${item.dimensions.height ? ` x ${item.dimensions.height}'` : ''}` : null
        }));
        totalSqft = selectedItems
          .filter(i => i.measurementUnit === 'sqft')
          .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
        totalGallons = selectedItems.reduce((sum, i) => sum + (parseFloat(i.gallons) || 0), 0);
      }
      // Old structure: surfaces
      else if (area.surfaces) {
        const selectedSurfaces = area.surfaces.filter(s => s.selected);
        items = selectedSurfaces.map(s => ({
          type: s.type,
          substrate: s.substrate,
          quantity: s.sqft,
          unit: 'sqft',
          dimensions: s.dimensions
        }));
        totalSqft = selectedSurfaces.reduce((sum, s) => sum + (parseFloat(s.sqft) || 0), 0);
      }

      return {
        areaName: area.name,
        items,
        totalSqft,
        totalGallons
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
          {formData.pricingSchemeId && (
            <Descriptions.Item label="Pricing Scheme" span={2}>
              <Tag color="blue">
                {(() => {
                  const scheme = pricingSchemes?.find(s => s.id === formData.pricingSchemeId);
                  return scheme ? scheme.name : `Scheme ID: ${formData.pricingSchemeId}`;
                })()}
                {(() => {
                  const scheme = pricingSchemes?.find(s => s.id === formData.pricingSchemeId);
                  return scheme?.isDefault ? ' (Default)' : '';
                })()}
              </Tag>
            </Descriptions.Item>
          )}
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
              dataSource={area.items}
              rowKey={(record, index) => index}
              columns={[
                { title: 'Category', dataIndex: 'type', key: 'type' },
                { 
                  title: 'Quantity', 
                  key: 'quantity', 
                  render: (_, record) => record.quantity ? `${record.quantity} ${record.unit === 'sqft' ? 'sq ft' : record.unit === 'linear_foot' ? 'LF' : record.unit === 'unit' ? 'units' : 'hrs'}` : 'N/A'
                },
                { 
                  title: 'Coats', 
                  dataIndex: 'coats', 
                  key: 'coats',
                  render: (val) => val > 0 ? `${val} coat${val > 1 ? 's' : ''}` : '-'
                },
                { 
                  title: 'Gallons', 
                  dataIndex: 'gallons', 
                  key: 'gallons',
                  render: (val) => val ? `${val} gal` : '-'
                },
                { 
                  title: 'Labor Rate', 
                  dataIndex: 'laborRate', 
                  key: 'laborRate',
                  render: (val, record) => val ? `$${val}/${record.unit === 'sqft' ? 'sqft' : record.unit === 'linear_foot' ? 'LF' : record.unit === 'unit' ? 'unit' : 'hr'}` : '-'
                },
                { title: 'Dimensions', dataIndex: 'dimensions', key: 'dimensions', render: (val) => val || '-' },
              ]}
            />
            <Space style={{ marginTop: 8 }}>
              {area.totalSqft > 0 && <Text type="secondary">Total Area: {area.totalSqft.toFixed(0)} sq ft</Text>}
              {area.totalGallons > 0 && <Text type="secondary">• Total Gallons: {area.totalGallons} gal</Text>}
            </Space>
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
            <Space direction="vertical" style={{ width: '100%' }}>
              {detail.products.map((product, idx) => {
                const productInfo = productsMap[product.productId];
                return (
                  <div key={idx} style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <Space>
                      <Tag color={
                        product.tier === 'Good' ? 'blue' :
                        product.tier === 'Better' ? 'cyan' :
                        product.tier === 'Best' ? 'green' : 'default'
                      }>
                        {product.tier}
                      </Tag>
                      {productInfo ? (
                        <Text strong>{productInfo.brandName} - {productInfo.productName}</Text>
                      ) : (
                        <Text type="secondary">Product ID: {product.productId}</Text>
                      )}
                      {productInfo && <Text type="secondary">(${productInfo.pricePerGallon}/gal)</Text>}
                    </Space>
                  </div>
                );
              })}
            </Space>
            {detail.gallons > 0 && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Estimated: {detail.gallons.toFixed(2)} gallons
              </Text>
            )}
            {detail.materialCost && (
              <Text strong style={{ display: 'block', marginTop: 4, color: '#1890ff' }}>
                Material Cost: ${detail.materialCost}
              </Text>
            )}
          </div>
        ))}
      </Card>

      {/* Cost Breakdown */}
      {calculatedQuote && (
        <Card title="Cost Breakdown" loading={loading} style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Statistic 
                title="Labor Total" 
                value={calculatedQuote.laborTotal || 0} 
                prefix="$"
                precision={2}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic 
                title="Materials Total" 
                value={calculatedQuote.materialTotal || 0} 
                prefix="$"
                precision={2}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Statistic 
                title="Final Total" 
                value={calculatedQuote.total || 0} 
                prefix="$"
                precision={2}
                valueStyle={{ color: '#3f8600', fontWeight: 'bold', fontSize: '28px' }}
              />
            </Col>
          </Row>

          <Divider orientation="left">Detailed Breakdown</Divider>
          
          {/* Pricing Settings Info */}
          {calculatedQuote.markupPercent !== undefined && calculatedQuote.taxRate !== undefined && (
            <Alert
              message="Pricing Settings Applied"
              description={
                <Space direction="vertical" size={0}>
                  <Text>Markup: {calculatedQuote.markupPercent}% (from contractor settings)</Text>
                  <Text>Tax Rate: {calculatedQuote.taxRate}% (from contractor settings)</Text>
                </Space>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Labor Cost">
              ${calculatedQuote.laborTotal?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label="Material Cost">
              ${calculatedQuote.materialTotal?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label="Prep Work">
              ${calculatedQuote.prepTotal?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label="Add-Ons">
              ${calculatedQuote.addOnsTotal?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label="Overhead" span={2}>
              ${calculatedQuote.overhead?.toFixed(2) || '0.00'}
              {calculatedQuote.travelCost > 0 && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  (Travel: ${calculatedQuote.travelCost?.toFixed(2)}, Cleanup: ${calculatedQuote.cleanupCost?.toFixed(2)})
                </Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Subtotal Before Markup">
              ${calculatedQuote.subtotalBeforeMarkup?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label={`Markup (${calculatedQuote.markupPercent || 0}%)`}>
              ${calculatedQuote.markupAmount?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label="Subtotal">
              ${calculatedQuote.subtotal?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label={`Tax (${calculatedQuote.taxRate || 0}%)`}>
              ${calculatedQuote.taxAmount?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            <Descriptions.Item label={<strong>Grand Total</strong>} span={2}>
              <div style={{ textAlign: 'right', width: '100%' }}>
                <strong style={{ fontSize: '18px', color: '#3f8600' }}>
                  ${calculatedQuote.total?.toFixed(2) || '0.00'}
                </strong>
              </div>
            </Descriptions.Item>
          </Descriptions>

          {calculatedQuote.breakdown && calculatedQuote.breakdown.length > 0 && (
            <>
              <Divider orientation="left">Area-by-Area Breakdown</Divider>
              {calculatedQuote.breakdown.map((area, index) => (
                <Card 
                  key={index} 
                  size="small" 
                  title={area.areaName} 
                  style={{ marginBottom: 12 }}
                  type="inner"
                >
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={area.items || []}
                    columns={[
                      { 
                        title: 'Surface/Category', 
                        key: 'type',
                        render: (_, record) => record.categoryName || record.type || '-'
                      },
                      { 
                        title: 'Quantity', 
                        key: 'quantity',
                        render: (_, record) => {
                          const qty = record.quantity || record.sqft || 0;
                          const unit = record.measurementUnit || 'sqft';
                          const unitLabel = unit === 'sqft' ? 'sq ft' : 
                                          unit === 'linear_foot' ? 'LF' : 
                                          unit === 'unit' ? 'units' : 
                                          unit === 'hour' ? 'hrs' : unit;
                          return `${qty?.toFixed(0)} ${unitLabel}`;
                        }
                      },
                      { 
                        title: 'Coats', 
                        dataIndex: 'numberOfCoats', 
                        key: 'coats',
                        render: (val) => val > 0 ? `${val}` : '-'
                      },
                      { 
                        title: 'Gallons', 
                        dataIndex: 'gallons', 
                        key: 'gallons',
                        render: (val) => val ? val?.toFixed(2) : '-'
                      },
                      { 
                        title: 'Labor Cost', 
                        dataIndex: 'laborCost', 
                        key: 'laborCost',
                        render: (val) => `$${val?.toFixed(2) || '0.00'}`
                      },
                      { 
                        title: 'Material Cost', 
                        dataIndex: 'materialCost', 
                        key: 'materialCost',
                        render: (val) => `$${val?.toFixed(2) || '0.00'}`
                      },
                      { 
                        title: 'Prep', 
                        dataIndex: 'prepCost', 
                        key: 'prepCost',
                        render: (val) => val > 0 ? `$${val?.toFixed(2)}` : '-'
                      },
                      { 
                        title: 'Add-Ons', 
                        dataIndex: 'addOnCost', 
                        key: 'addOnCost',
                        render: (val) => val > 0 ? `$${val?.toFixed(2)}` : '-'
                      }
                    ]}
                  />
                  <div style={{ marginTop: 8, textAlign: 'right' }}>
                    <Text strong>
                      Area Total: ${(area.items || []).reduce((sum, item) => 
                        sum + (item.laborCost || 0) + (item.materialCost || 0) + (item.prepCost || 0) + (item.addOnCost || 0), 0
                      ).toFixed(2)}
                    </Text>
                  </div>
                </Card>
              ))}
            </>
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
            icon={<EyeOutlined />}
            onClick={() => setShowProposalPreview(true)}
          >
            Preview Proposal
          </Button>
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

      {/* Proposal Preview Modal */}
      <ProposalPreviewModal
        visible={showProposalPreview}
        onClose={() => setShowProposalPreview(false)}
        quoteData={formData}
        calculatedQuote={calculatedQuote}
      />
    </div>
  );
};

export default SummaryStep;
