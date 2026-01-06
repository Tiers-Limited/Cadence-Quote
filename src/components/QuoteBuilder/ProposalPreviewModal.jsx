// src/components/QuoteBuilder/ProposalPreviewModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Spin, Typography, Divider, Row, Col, Card, Button, Space, Tag, Alert } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Title, Paragraph, Text } = Typography;

const ProposalPreviewModal = ({ visible, onClose, quoteData, calculatedQuote, pricingSchemes }) => {
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const proposalRef = useRef(null);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch contractor settings
      const settingsRes = await apiService.get('/settings');
      if (settingsRes.success) {
        setSettings(settingsRes.data);
      }

      // Fetch products for product names
      const productsRes = await apiService.get('/contractor/product-configs');
      if (productsRes.success) {
        const productMap = {};
        (productsRes.data || []).forEach(config => {
          productMap[config.id] = {
            brandName: config.globalProduct?.brand?.name || 'Unknown',
            productName: config.globalProduct?.name || 'Unknown',
            pricePerGallon: config.sheens?.[0]?.price || 0
          };
        });
        setProducts(productMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPricingSchemeName = () => {
    const scheme = pricingSchemes?.find(s => s.id === quoteData.pricingSchemeId);
    return scheme ? scheme.name : 'Standard Pricing';
  };

  const getProductTiers = () => {
    const tiers = {};
    quoteData.productSets?.forEach(set => {
      // Handle both array and object formats for products
      const productsList = Array.isArray(set.products) ? set.products : [];
      productsList.forEach(product => {
        const productInfo = products[product.productId];
        if (productInfo && product.tier) {
          if (!tiers[product.tier]) {
            tiers[product.tier] = [];
          }
          tiers[product.tier].push({
            surfaceType: set.surfaceType,
            ...productInfo,
            tier: product.tier
          });
        }
      });
    });
    return tiers;
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      
      // Simple print-based PDF generation
      const printWindow = window.open('', '', 'height=800,width=1000');
      const content = proposalRef.current.innerHTML;
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Proposal - ${quoteData.customerName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${content}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Modal
        title="Proposal Preview"
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Loading proposal..." />
        </div>
      </Modal>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const productTiers = getProductTiers();

  return (
    <Modal
      title="Professional Proposal Preview"
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}
            loading={downloading}
          >
            Download PDF
          </Button>
        </Space>
      }
      bodyStyle={{ maxHeight: '80vh', overflowY: 'auto', padding: 0 }}
    >
      <div ref={proposalRef} style={{ backgroundColor: '#fff' }}>
        {/* Proposal Content */}
        <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
          
          {/* Header Section */}
          <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid #1890ff', paddingBottom: 20 }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                backgroundColor: '#fff',
                borderRadius: '50%',
                margin: '0 auto 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px'
              }}>
                📋
              </div>
              <Title level={1} style={{ color: '#fff', margin: 0, fontSize: '32px' }}>
                {settings?.tenant?.companyName || 'Professional Painting Co.'}
              </Title>
              <Text style={{ color: '#e6f7ff', fontSize: '16px' }}>
                The rhythm behind every great quote
              </Text>
            </div>
          </div>

          {/* Customer Info Header */}
          <Card style={{ marginBottom: 30, backgroundColor: '#f0f5ff' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong style={{ fontSize: '14px' }}>Prepared for:</Text>
                <Title level={4} style={{ margin: '5px 0' }}>{quoteData.customerName}</Title>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text strong style={{ fontSize: '14px' }}>Date:</Text>
                <Title level={4} style={{ margin: '5px 0' }}>{today}</Title>
              </Col>
              <Col span={24} style={{ marginTop: 10 }}>
                <Text strong>Property:</Text>{' '}
                <Text>{quoteData.street}, {quoteData.city}, {quoteData.state} {quoteData.zipCode}</Text>
              </Col>
            </Row>
          </Card>

          {/* Opening Message */}
          <Card style={{ marginBottom: 30 }}>
            <Paragraph style={{ fontSize: '15px', lineHeight: 1.8 }}>
              Dear {quoteData.customerName},
            </Paragraph>
            <Paragraph style={{ fontSize: '15px', lineHeight: 1.8 }}>
              Thank you for the opportunity to provide this proposal. Using Cadence Quote, we've tailored a 
              professional painting solution designed to meet your specific needs.
            </Paragraph>
            <Paragraph style={{ fontSize: '15px', lineHeight: 1.8, marginBottom: 0 }}>
              <strong>We don't just paint walls — we deliver a professional experience that protects your 
              investment and enhances your home.</strong>
            </Paragraph>
          </Card>

          {/* Scope of Work */}
          <Card title={<Title level={3}>Scope of Work</Title>} style={{ marginBottom: 30 }}>
            {quoteData.areas?.map((area, index) => (
              <div key={index} style={{ marginBottom: 20 }}>
                <Title level={4} style={{ color: '#1890ff', marginBottom: 10 }}>
                  {area.name}
                </Title>
                <ul style={{ marginLeft: 20, lineHeight: 1.8 }}>
                  <li>
                    <strong>Prep:</strong> Protect flooring, patch holes, sand, spot-prime.
                  </li>
                  <li>
                    <strong>Application:</strong> Apply 2 coats with dustless sanding between.
                  </li>
                  <li>
                    <strong>Cleanup:</strong> Daily tidy-up + final walkthrough.
                  </li>
                </ul>
                {area.laborItems && area.laborItems.length > 0 && (
                  <div style={{ marginTop: 10, paddingLeft: 20 }}>
                    <Text type="secondary">Surfaces: </Text>
                    {area.laborItems.map((item, idx) => (
                      <Tag key={idx} style={{ margin: '2px' }}>
                        {item.categoryName} ({item.quantity} {item.measurementUnit})
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Card>

          {/* Products & Materials */}
          <Card title={<Title level={3}>Products & Materials</Title>} style={{ marginBottom: 30 }}>
            <div style={{ marginBottom: 20 }}>
              <Title level={4}>Paint Systems</Title>
              {Object.keys(productTiers).length > 0 ? (
                <ul style={{ marginLeft: 20, lineHeight: 2 }}>
                  {Object.entries(productTiers).map(([tier, prods]) => (
                    <li key={tier}>
                      <strong>{tier}:</strong>{' '}
                      {prods.map(p => `${p.brandName} ${p.productName}`).join(', ')}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary">Product selections to be determined</Text>
              )}
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <Title level={4}>Primers</Title>
              <ul style={{ marginLeft: 20, lineHeight: 2 }}>
                <li>Multi-purpose primer for bare surfaces</li>
                <li>Stain-blocking primer on repairs</li>
              </ul>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Title level={4}>Caulking & Fillers</Title>
              <ul style={{ marginLeft: 20, lineHeight: 2 }}>
                <li>Acrylic latex caulk</li>
                <li>Wood filler for trim</li>
              </ul>
            </div>

            <div>
              <Title level={4}>Tools & Supplies</Title>
              <ul style={{ marginLeft: 20, lineHeight: 2 }}>
                <li>Dustless sanding system</li>
                <li>Drop cloths, tape, sheeting</li>
              </ul>
            </div>
          </Card>

        {/* Investment Summary */}
        {calculatedQuote && (
          <Card title={<Title level={3}>Investment Breakdown</Title>} style={{ marginBottom: 30 }}>
            <Alert
              message='US Industry Standard Formula'
              description='(Materials + Labor + Overhead) × (1 + Profit Margin) + Tax'
              type='info'
              showIcon
              style={{ marginBottom: 20 }}
            />
            
            <div style={{ backgroundColor: '#f0f5ff', padding: 20, borderRadius: 8, marginBottom: 20 }}>
              <Row gutter={[16, 12]}>
                <Col span={16}>
                  <Text strong style={{ fontSize: '16px' }}>Labor</Text>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: '16px' }}>${calculatedQuote.laborTotal?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                </Col>

                {calculatedQuote.materialMarkupPercent !== undefined && calculatedQuote.materialMarkupPercent > 0 && (
                  <>
                    <Col span={16} style={{ paddingLeft: 20 }}>
                      <Text type='secondary'>Materials (Raw Cost)</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Text type='secondary'>${(calculatedQuote.materialCost || calculatedQuote.materialTotal)?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </Col>
                    
                    <Col span={16} style={{ paddingLeft: 20 }}>
                      <Text type='secondary'>Material Markup ({calculatedQuote.materialMarkupPercent}%)</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Text type='secondary'>+${calculatedQuote.materialMarkupAmount?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </Col>
                  </>
                )}
                
                <Col span={16}>
                  <Text strong style={{ fontSize: '16px' }}>Materials Total</Text>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: '16px' }}>${calculatedQuote.materialTotal?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                </Col>

                {calculatedQuote.overhead !== undefined && (
                  <>
                    <Col span={16}>
                      <Text strong style={{ fontSize: '16px' }}>Overhead ({calculatedQuote.overheadPercent}%)</Text>
                      <br />
                      <Text type='secondary' style={{ fontSize: '12px' }}>Transportation, equipment, insurance</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Text style={{ fontSize: '16px' }}>${calculatedQuote.overhead?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </Col>
                  </>
                )}

                <Col span={24}>
                  <Divider style={{ margin: '10px 0', borderColor: '#d9d9d9' }} />
                </Col>

                {calculatedQuote.subtotalBeforeProfit && (
                  <>
                    <Col span={16}>
                      <Text type='secondary' style={{ fontStyle: 'italic' }}>Subtotal before profit</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Text type='secondary' style={{ fontStyle: 'italic' }}>${calculatedQuote.subtotalBeforeProfit?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </Col>
                  </>
                )}

                {calculatedQuote.profitAmount !== undefined && (
                  <>
                    <Col span={16}>
                      <Text strong style={{ fontSize: '16px' }}>Profit Margin ({calculatedQuote.profitMarginPercent}%)</Text>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Text style={{ fontSize: '16px' }}>${calculatedQuote.profitAmount?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </Col>
                  </>
                )}

                <Col span={24}>
                  <Divider style={{ margin: '10px 0', borderColor: '#1890ff' }} />
                </Col>

                <Col span={16}>
                  <Text strong style={{ fontSize: '18px' }}>Subtotal</Text>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: '18px' }}>${calculatedQuote.subtotal?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                </Col>

                <Col span={16}>
                  <Text style={{ fontSize: '16px' }}>Sales Tax ({calculatedQuote.taxPercent}%)</Text>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Text style={{ fontSize: '16px' }}>${calculatedQuote.tax?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                </Col>

                <Col span={24}>
                  <Divider style={{ margin: '10px 0', borderColor: '#52c41a', borderWidth: 2 }} />
                </Col>

                <Col span={16}>
                  <Title level={3} style={{ margin: 0, color: '#1890ff' }}>Total Investment</Title>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                  <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                    ${calculatedQuote.total?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </Title>
                </Col>
              </Row>
            </div>

            <div style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Deposit ({calculatedQuote.depositPercent}%):</Text>
                  <br />
                  <Text style={{ fontSize: '18px', color: '#52c41a' }}>${calculatedQuote.deposit?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  <br />
                  <Text type='secondary' style={{ fontSize: '12px' }}>Due at signing</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Balance:</Text>
                  <br />
                  <Text style={{ fontSize: '18px', color: '#52c41a' }}>${calculatedQuote.balance?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                  <br />
                  <Text type='secondary' style={{ fontSize: '12px' }}>Due at completion</Text>
                </Col>
              </Row>
            </div>
          </Card>
        )}

        {/* Warranty */}
          <Card title={<Title level={3}>Warranty</Title>} style={{ marginBottom: 30 }}>
            <ul style={{ marginLeft: 20, lineHeight: 2 }}>
              <li><strong>Workmanship Warranty:</strong> {settings?.warrantyTerms || '2 years standard'}</li>
              <li>Manufacturer warranties apply</li>
            </ul>
          </Card>

          {/* Timeline */}
          <Card title={<Title level={3}>Timeline</Title>} style={{ marginBottom: 30 }}>
            <ul style={{ marginLeft: 20, lineHeight: 2 }}>
              <li>Estimated Start: To be scheduled upon acceptance</li>
              <li>Estimated Completion: Based on project scope</li>
              <li>Subject to weather/site conditions</li>
            </ul>
          </Card>

          {/* Payment Terms */}
          <Card title={<Title level={3}>Payment Terms</Title>} style={{ marginBottom: 30 }}>
            <ul style={{ marginLeft: 20, lineHeight: 2 }}>
              <li>Deposit: {settings?.depositPercentage || 30}% at signing</li>
              <li>Balance: Due at completion</li>
              <li>Accepted: Cash, Check, Card, CashApp, Venmo, Zelle</li>
            </ul>
          </Card>

          {/* Acceptance */}
          <Card 
            style={{ 
              marginBottom: 30, 
              backgroundColor: '#fffbe6', 
              borderColor: '#faad14' 
            }}
          >
            <Title level={3}>Acceptance</Title>
            <Paragraph style={{ fontSize: '15px', lineHeight: 1.8 }}>
              By signing below, you agree to the scope, products, colors, investment, terms, and warranty 
              described in this proposal.
            </Paragraph>
            <Row gutter={16} style={{ marginTop: 30 }}>
              <Col span={12}>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 5, marginBottom: 5 }}>
                  <Text type="secondary">Customer Signature & Date</Text>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 5, marginBottom: 5 }}>
                  <Text type="secondary">Contractor Signature & Date</Text>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Footer */}
          <div style={{ 
            textAlign: 'center', 
            paddingTop: 20, 
            borderTop: '2px solid #d9d9d9',
            color: '#8c8c8c',
            fontSize: '12px'
          }}>
            <Text type="secondary">
              {settings?.tenant?.email || 'contact@company.com'} | 
              {settings?.tenant?.phoneNumber ? ` ${settings.tenant.phoneNumber} | ` : ' '}
              Licensed & Insured
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Powered by Cadence Quote \u2022 www.cadencequote.com
            </Text>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ProposalPreviewModal;
