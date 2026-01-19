// src/components/QuoteBuilder/ProposalPreviewModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Spin, Typography, Divider, Row, Col, Card, Button, Space, Tag, Alert, Collapse } from 'antd';
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

  const getPricingSchemeType = () => {
    const scheme = pricingSchemes?.find(s => s.id === quoteData.pricingSchemeId);
    return scheme?.type || 'standard';
  };

  const isTurnkey = () => {
    const schemeType = getPricingSchemeType();
    return schemeType === 'turnkey' || schemeType === 'sqft_turnkey';
  };

  const isAreaWise = () => {
    const schemeType = getPricingSchemeType();
    return schemeType === 'flat_rate_unit' || schemeType === 'production_based' || schemeType === 'rate_based';
  };

  /**
   * Calculate gallons needed for a surface type based on areas
   */
  const calculateGallonsForSurface = (surfaceType) => {
    let totalSqft = 0;
    
    (quoteData.areas || []).forEach(area => {
      if (area.laborItems) {
        area.laborItems.forEach(item => {
          if (item.selected && item.categoryName === surfaceType && item.quantity) {
            totalSqft += Number(item.quantity) || 0;
          }
        });
      }
    });
    
    if (totalSqft === 0) return 0;
    
    const coverage = quoteData.coverage || 350;
    const coats = quoteData.coats || 2;
    const gallons = (totalSqft / coverage) * coats;
    
    return Math.max(gallons, 0);
  };

  /**
   * Build product tiers properly from surface-type-based productSets
   * Used for Turnkey pricing (global product selection)
   */
  const getProductTiersFromSurfaces = () => {
    const rows = [];
    const productMap = {};
    
    (quoteData.productSets || []).forEach(set => {
      if (!set.surfaceType) return;
      
      const gallons = calculateGallonsForSurface(set.surfaceType);
      if (gallons === 0) return; // Skip surfaces with no areas
      
      const rowEntry = {
        label: set.surfaceType,
        good: null,
        better: null,
        best: null,
        gallons
      };
      
      // Extract product names for each tier
      if (quoteData.productStrategy === 'GBB' && set.products) {
        ['good', 'better', 'best'].forEach(tier => {
          const productId = set.products[tier];
          if (productId) {
            const productInfo = products[productId];
            rowEntry[tier] = productInfo?.productName || productInfo?.brandName || `Product ${productId}`;
          }
        });
      } else if (set.products?.single) {
        const productInfo = products[set.products.single];
        rowEntry.good = productInfo?.productName || productInfo?.brandName || `Product ${set.products.single}`;
      }
      
      rows.push(rowEntry);
      
      // Aggregate product usage
      if (quoteData.productStrategy === 'GBB' && set.products) {
        ['good', 'better', 'best'].forEach(tier => {
          const productId = set.products[tier];
          if (productId) {
            if (!productMap[productId]) {
              productMap[productId] = { gallons: 0, surfaces: new Set() };
            }
            productMap[productId].gallons += gallons;
            productMap[productId].surfaces.add(set.surfaceType);
          }
        });
      }
    });
    
    return { rows, productMap };
  };

  /**
   * Get products organized by area and surface for area-wise pricing schemes
   * Used for Flat Rate, Production Based, and Rate Based pricing
   */
  const getAreaWiseProducts = () => {
    const areaProducts = [];
    
    (quoteData.areas || []).forEach(area => {
      const areaItem = {
        areaName: area.name,
        areaId: area.id,
        surfaces: []
      };
      
      // Get selected surfaces/labor items for this area
      if (area.laborItems) {
        const selectedItems = area.laborItems.filter(item => item.selected);
        
        selectedItems.forEach(item => {
          const surfaceType = item.categoryName;
          
          // Look for product selection for this area+surface combination
          const productSet = quoteData.productSets?.find(ps => 
            ps.areaId === area.id && ps.surfaceType === surfaceType
          );
          
          // If not found with area, try global fallback
          const globalProductSet = !productSet && quoteData.productSets?.find(ps => 
            !ps.areaId && ps.surfaceType === surfaceType
          );
          
          const selectedSet = productSet || globalProductSet;
          
          const surfaceItem = {
            type: surfaceType,
            quantity: item.quantity,
            unit: item.measurementUnit,
            tiers: {},
            isOverridden: productSet ? true : false
          };
          
          if (selectedSet) {
            if (quoteData.productStrategy === 'GBB' && selectedSet.products) {
              // Show all three tiers
              ['good', 'better', 'best'].forEach(tier => {
                const productId = selectedSet.products[tier];
                if (productId) {
                  const productInfo = products[productId];
                  surfaceItem.tiers[tier] = {
                    name: productInfo?.productName || productInfo?.brandName || `Product ${productId}`,
                    price: productInfo?.pricePerGallon || 0
                  };
                }
              });
            } else if (selectedSet.products?.single) {
              // Show single product
              const productId = selectedSet.products.single;
              const productInfo = products[productId];
              const productName = productInfo?.productName || productInfo?.brandName || `Product ${productId}`;
              surfaceItem.tiers['single'] = {
                name: productName,
                price: productInfo?.pricePerGallon || 0
              };
            }
          }
          
          areaItem.surfaces.push(surfaceItem);
        });
      }
      
      if (areaItem.surfaces.length > 0) {
        areaProducts.push(areaItem);
      }
    });
    
    
    return areaProducts;
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
  
  // Build product summary from area-wise data
  const productTiers = {};
  const uniqueProducts = {};
  
  if (isAreaWise()) {
    const areaWiseProducts = getAreaWiseProducts();
    areaWiseProducts.forEach(area => {
      area.surfaces.forEach(surface => {
        Object.entries(surface.tiers || {}).forEach(([tierKey, tierInfo]) => {
          if (tierInfo && tierInfo.name && tierInfo.name !== 'Not specified') {
            // Group by tier
            if (!productTiers[tierKey]) {
              productTiers[tierKey] = [];
            }
            
            // Find the product ID to get full details
            const productSet = quoteData.productSets?.find(ps => 
              ps.areaId === area.areaId && ps.surfaceType === surface.type
            );
            
            if (productSet && productSet.products && productSet.products[tierKey]) {
              const productId = productSet.products[tierKey];
              const productInfo = products[productId];
              
              if (productInfo && !uniqueProducts[productId]) {
                uniqueProducts[productId] = true;
                productTiers[tierKey].push({
                  brandName: productInfo.brandName || '',
                  productName: productInfo.productName || tierInfo.name,
                  sheen: productInfo.sheen || 'Not specified'
                });
              }
            }
          }
        });
      });
    });
  } else {
    // Turnkey pricing - use original logic
    const { rows } = getProductTiersFromSurfaces();
    rows.forEach(row => {
      ['good', 'better', 'best'].forEach(tier => {
        if (row[tier]) {
          if (!productTiers[tier]) productTiers[tier] = [];
          productTiers[tier].push({ 
            brandName: '',
            productName: row[tier],
            sheen: 'Not specified'
          });
        }
      });
    });
  }
  
  const areaProducts = [];

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
        <div style={{ padding: '30px 40px', fontFamily: 'Arial, sans-serif' }}>
          
          {/* Header Section */}
          <Row gutter={[40, 0]} style={{ marginBottom: 50, paddingBottom: 30, borderBottom: '3px solid #1890ff' }}>
            <Col span={12}>
              <div style={{ 
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                padding: '30px',
                borderRadius: '8px',
              }}>
                <div style={{ 
                  width: '70px', 
                  height: '70px', 
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  margin: '0 auto 15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  overflow: 'hidden'
                }}>
                  {settings?.tenant?.logoUrl ? (
                    <img src={settings.tenant.logoUrl} alt="Company Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    '🎨'
                  )}
                </div>
                <Title level={2} style={{ color: '#fff', margin: '10px 0', fontSize: '24px' }}>
                  {settings?.tenant?.companyName || 'Professional Painting Co.'}
                </Title>
                <Text style={{ color: '#e6f7ff', fontSize: '13px' }}>
                  Professional Painting Services
                </Text>
                <div style={{ marginTop: 15, color: '#fff', fontSize: '12px', lineHeight: 2 }}>
                  <div>📱 {settings?.tenant?.phoneNumber || '(555) 123-4567'}</div>
                  <div>📧 {settings?.tenant?.email || 'contact@company.com'}</div>
                  <div>✓ Licensed & Insured</div>
                </div>
              </div>
            </Col>

            <Col span={12}>
              <div style={{ paddingTop: 5 }}>
                <Title level={3} style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Project Proposal</Title>
                
                <Row gutter={[16, 12]}>
                  <Col span={12}>
                    <Text strong style={{ fontSize: '12px', color: '#666' }}>QUOTE NUMBER</Text>
                    <Title level={4} style={{ margin: '5px 0' }}>{quoteData.quoteNumber || 'Q-2026-001'}</Title>
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ fontSize: '12px', color: '#666' }}>DATE</Text>
                    <Title level={4} style={{ margin: '5px 0' }}>{today}</Title>
                  </Col>
                </Row>

                <Row gutter={[16, 12]} style={{ marginTop: 15 }}>
                  <Col span={12}>
                    <Text strong style={{ fontSize: '12px', color: '#666' }}>CUSTOMER</Text>
                    <Title level={4} style={{ margin: '5px 0' }}>{quoteData.customerName}</Title>
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ fontSize: '12px', color: '#666' }}>PRICE TIER</Text>
                    <Title level={4} style={{ margin: '5px 0', textTransform: 'capitalize' }}>
                      {quoteData.productStrategy || 'GBB'}
                    </Title>
                  </Col>
                </Row>

                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #d9d9d9' }}>
                  <Text strong style={{ fontSize: '12px', color: '#666' }}>PROJECT LOCATION</Text>
                  <Paragraph style={{ margin: '5px 0', fontSize: '14px' }}>
                    {quoteData.street}
                    <br />
                    {quoteData.city}, {quoteData.state} {quoteData.zipCode}
                  </Paragraph>
                </div>
              </div>
            </Col>
          </Row>

          {/* Opening Message */}
          <Paragraph style={{ fontSize: '15px', lineHeight: 1.8, marginBottom: 30 }}>
            <Text strong>Dear {quoteData.customerName},</Text>
            <br /><br />
            Thank you for the opportunity to provide this proposal. We've tailored a professional painting solution designed to meet your specific needs. We don't just paint walls — we deliver quality craftsmanship that protects your investment and enhances your property.
          </Paragraph>

          {/* PRODUCT SELECTION - CONDITIONAL BASED ON PRICING SCHEME */}
          
          {/* TURNKEY PRICING: Global Product Selection */}
          {isTurnkey() && (
            <Card style={{ marginBottom: 40, backgroundColor: '#f0f9ff', borderColor: '#1890ff' }}>
              <Title level={3} style={{ fontSize: '18px', color: '#1890ff', marginBottom: 20 }}>
                Product Selection for Entire Home
              </Title>
              {quoteData.productStrategy === 'GBB' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e6f7ff', borderBottom: '2px solid #1890ff' }}>
                        <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', borderRight: '1px solid #d9d9d9' }}>Surface Type</th>
                        <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #d9d9d9' }}>Good</th>
                        <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #d9d9d9' }}>Better</th>
                        <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', borderRight: '1px solid #d9d9d9' }}>Best</th>
                        <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600' }}>Gallons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const { rows } = getProductTiersFromSurfaces();
                        return rows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #d9d9d9', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding: '10px', borderRight: '1px solid #d9d9d9', fontWeight: '500' }}>
                              {row.label}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #d9d9d9' }}>
                              {row.good ? (
                                <span style={{ fontSize: '12px' }}>{row.good}</span>
                              ) : (
                                <span style={{ color: '#999' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #d9d9d9' }}>
                              {row.better ? (
                                <span style={{ fontSize: '12px' }}>{row.better}</span>
                              ) : (
                                <span style={{ color: '#999' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', borderRight: '1px solid #d9d9d9' }}>
                              {row.best ? (
                                <span style={{ fontSize: '12px' }}>{row.best}</span>
                              ) : (
                                <span style={{ color: '#999' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#1890ff' }}>
                              {Math.ceil(row.gallons)} gal
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <Title level={4} style={{ fontSize: '14px', marginTop: 10 }}>Selected Products for Entire Home</Title>
                  {(() => {
                    const { rows } = getProductTiersFromSurfaces();
                    return (
                      <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                        {rows.map((row, idx) => (
                          <li key={idx}>
                            <strong>{row.label}:</strong> {row.good || 'To be determined'}
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              )}
              
              {/* Product Summary for Turnkey */}
              {(() => {
                const { productMap } = getProductTiersFromSurfaces();
                if (Object.keys(productMap).length === 0) return null;
                
                return (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #d9d9d9' }}>
                    <Text strong style={{ fontSize: '12px', color: '#666' }}>SELECTED PRODUCTS SUMMARY</Text>
                    <div style={{ marginTop: 10 }}>
                      {Object.entries(productMap).map(([productId, info]) => {
                        const productInfo = products[productId] || {};
                        return (
                          <div key={productId} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <div>
                                <Text strong style={{ fontSize: '13px' }}>
                                  {productInfo.productName || productInfo.brandName || `Product ${productId}`}
                                </Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  {Array.from(info.surfaces).join(', ')}
                                </Text>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <Text strong style={{ fontSize: '14px', color: '#1890ff' }}>
                                  {Math.ceil(info.gallons)} gal
                                </Text>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}

          {/* AREA-WISE PRICING: Products by Area (Flat Rate, Production Based, Rate Based) */}
          {isAreaWise() && (
            <Card style={{ marginBottom: 40, backgroundColor: '#f5f5f5', borderColor: '#d9d9d9' }}>
              <Title level={3} style={{ fontSize: '18px', color: '#1890ff', marginBottom: 20 }}>
                Product Selections by Area
              </Title>
              {(() => {
                const areaWiseProducts = getAreaWiseProducts();
                
                if (areaWiseProducts.length === 0) {
                  return (
                    <Alert
                      message="Product selections not configured"
                      description="Products will be selected during the quote process."
                      type="info"
                      showIcon
                    />
                  );
                }
                
                // Calculate product totals across all areas and surfaces
                const productTotals = {};
                areaWiseProducts.forEach(area => {
                  area.surfaces.forEach(surface => {
                    Object.entries(surface.tiers || {}).forEach(([tier, tierInfo]) => {
                      // Extract product ID from the tier data
                      // Since we're displaying product names, we need to track by name
                      const productKey = tierInfo.name;
                      if (productKey && productKey !== 'Not specified') {
                        if (!productTotals[productKey]) {
                          productTotals[productKey] = {
                            productName: tierInfo.name,
                            pricePerGallon: tierInfo.price || 0,
                            usedIn: []
                          };
                        }
                        productTotals[productKey].usedIn.push(`${area.areaName} - ${surface.type}`);
                      }
                    });
                  });
                });
                
                // Create nested collapse items for areas -> surfaces
                const collapseItems = areaWiseProducts.map(area => {
                  const surfaceCount = area.surfaces.length;
                  
                  // Create nested collapse items for surfaces
                  const surfaceCollapseItems = area.surfaces.map((surface, surfaceIdx) => ({
                    key: `${area.areaId}-${surfaceIdx}`,
                    label: (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 16 }}>
                        <Space>
                          <Text strong>{surface.type}</Text>
                          <Tag color="geekblue" style={{ fontSize: 11 }}>
                            {surface.quantity} {surface.unit === 'sqft' ? 'sq ft' : surface.unit === 'linear_foot' ? 'LF' : surface.unit === 'unit' ? 'units' : surface.unit}
                          </Tag>
                          {surface.isOverridden && (
                            <Tag color="orange" style={{ fontSize: 11 }}>Custom</Tag>
                          )}
                        </Space>
                      </div>
                    ),
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {Object.keys(surface.tiers).length === 0 ? (
                          <Text type="secondary">No product selected</Text>
                        ) : (
                          Object.entries(surface.tiers).map(([tierKey, tierInfo]) => (
                            <div key={tierKey} style={{ padding: '10px 12px', background: '#fafafa', borderRadius: '4px', border: '1px solid #e8e8e8' }}>
                              <Row gutter={[8, 8]} align="middle">
                                <Col flex="auto">
                                  <Space direction="vertical" size={0}>
                                    <Space>
                                      <Tag color={
                                        tierKey === 'good' ? 'blue' :
                                        tierKey === 'better' ? 'cyan' :
                                        tierKey === 'best' ? 'green' : 'default'
                                      } style={{ fontSize: 11 }}>
                                        {tierKey.charAt(0).toUpperCase() + tierKey.slice(1)}
                                      </Tag>
                                      <Text strong style={{ fontSize: 13 }}>{tierInfo.name || 'Unknown'}</Text>
                                    </Space>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      ${tierInfo.price || 0}/gallon
                                    </Text>
                                  </Space>
                                </Col>
                              </Row>
                            </div>
                          ))
                        )}
                      </Space>
                    )
                  }));
                  
                  return {
                    key: area.areaId,
                    label: (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 16 }}>
                        <Space>
                          <Text strong style={{ fontSize: 15 }}>{area.areaName}</Text>
                          <Tag color="blue">{surfaceCount} surface{surfaceCount !== 1 ? 's' : ''}</Tag>
                        </Space>
                      </div>
                    ),
                    children: (
                      <Collapse 
                        items={surfaceCollapseItems}
                        ghost
                        size="small"
                      />
                    )
                  };
                });
                
                return (
                  <>
                    <Collapse 
                      items={collapseItems}
                      defaultActiveKey={areaWiseProducts.length === 1 ? [areaWiseProducts[0].areaId] : []}
                      style={{ backgroundColor: '#fafafa', marginBottom: 16 }}
                    />
                    
                    {/* Product Summary */}
                    {Object.keys(productTotals).length > 0 && (
                      <Card 
                        title="Product Summary" 
                        size="small"
                        style={{ marginTop: 16, backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                          {Object.entries(productTotals).map(([productKey, totals]) => (
                            <div key={productKey} style={{ padding: '12px', background: '#fff', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
                              <Row gutter={16} align="middle">
                                <Col flex="auto">
                                  <Space direction="vertical" size={2}>
                                    <Text strong style={{ fontSize: 14 }}>{totals.productName}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      ${totals.pricePerGallon}/gallon • Used in {totals.usedIn.length} location{totals.usedIn.length !== 1 ? 's' : ''}
                                    </Text>
                                  </Space>
                                </Col>
                              </Row>
                            </div>
                          ))}
                        </Space>
                      </Card>
                    )}
                  </>
                );
              })()}
            </Card>
          )}

          {/* Two Column Layout */}
          <Row gutter={[40, 0]} style={{ marginBottom: 30 }}>
            
            {/* LEFT COLUMN */}
            <Col span={12}>
              
              {/* Scope of Work */}
              <div style={{ marginBottom: 40 }}>
                <Title level={3} style={{ fontSize: '18px', color: '#1890ff', marginBottom: 20, borderBottom: '2px solid #1890ff', paddingBottom: 10 }}>
                  Scope of Work
                </Title>
                {quoteData.areas?.map((area, index) => (
                  <div key={index} style={{ marginBottom: 25 }}>
                    <Title level={4} style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '600' }}>
                      {area.name}
                    </Title>
                    <ul style={{ marginLeft: 20, lineHeight: 1.9, fontSize: '13px' }}>
                      <li><strong>Prep:</strong> Protect flooring, patch holes, sand, spot-prime</li>
                      <li><strong>Application:</strong> Apply 2 coats with sanding between</li>
                      <li><strong>Cleanup:</strong> Daily tidy-up + final walkthrough</li>
                    </ul>
                    {area.laborItems && area.laborItems.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '12px', fontWeight: '600' }}>Surfaces: </Text>
                        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {area.laborItems.filter(item => item.selected).map((item, idx) => (
                            <Tag key={idx} style={{ fontSize: '11px' }}>
                              {item.categoryName} ({item.quantity || 0} {item.measurementUnit || 'units'})
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Products & Materials */}
              <div style={{ marginBottom: 40 }}>
                <Title level={3} style={{ fontSize: '18px', color: '#1890ff', marginBottom: 20, borderBottom: '2px solid #1890ff', paddingBottom: 10 }}>
                  Products & Materials
                </Title>
                
                <div style={{ marginBottom: 18 }}>
                  <Title level={4} style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>Paint Systems</Title>
                  {Object.keys(productTiers).length > 0 ? (
                    <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                      {Object.entries(productTiers).map(([tier, prods]) => (
                        <li key={tier}>
                          <strong style={{ textTransform: 'capitalize' }}>{tier}:</strong>{' '}
                          {prods.map((p, idx) => (
                            <span key={idx}>
                              {idx > 0 && ', '}
                              {p.brandName && `${p.brandName} - `}{p.productName}
                              {p.sheen && p.sheen !== 'Not specified' && ` (${p.sheen})`}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  ) : areaProducts.length > 0 ? (
                    <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                      {areaProducts.map((p, idx) => (
                        <li key={idx}>
                          <strong>{p.areaName}:</strong> {p.brandName} {p.productName} ({p.sheen})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Text type="secondary" style={{ fontSize: '13px' }}>Product selections to be determined</Text>
                  )}
                </div>

                <div style={{ marginBottom: 15 }}>
                  <Title level={4} style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>Primers</Title>
                  <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                    <li>Multi-purpose primer for bare surfaces</li>
                    <li>Stain-blocking primer on repairs</li>
                  </ul>
                </div>

                <div style={{ marginBottom: 15 }}>
                  <Title level={4} style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>Caulking & Fillers</Title>
                  <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                    <li>Acrylic latex caulk</li>
                    <li>Wood filler for trim</li>
                  </ul>
                </div>

                <div>
                  <Title level={4} style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>Tools & Supplies</Title>
                  <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                    <li>Dustless sanding system</li>
                    <li>Drop cloths, tape, protective sheeting</li>
                  </ul>
                </div>
              </div>

            </Col>

            {/* RIGHT COLUMN */}
            <Col span={12}>
              
              {/* Investment Summary */}
              {calculatedQuote && (
                <div style={{ marginBottom: 40 }}>
                  <Title level={3} style={{ fontSize: '18px', color: '#1890ff', marginBottom: 20, borderBottom: '2px solid #1890ff', paddingBottom: 10 }}>
                    Investment Breakdown
                  </Title>

                  <div style={{ backgroundColor: '#f5f5f5', padding: 16, borderRadius: 6, marginBottom: 20 }}>
                    <Row gutter={[0, 10]}>
                      <Col span={16}>
                        <Text style={{ fontSize: '13px' }}>Labor</Text>
                      </Col>
                      <Col span={8} style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: '13px', fontWeight: '600' }}>${calculatedQuote.laborTotal?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                      </Col>

                      {calculatedQuote.materialMarkupPercent !== undefined && calculatedQuote.materialMarkupPercent > 0 && (
                        <>
                          <Col span={16}>
                            <Text type='secondary' style={{ fontSize: '12px' }}>Materials (Raw Cost)</Text>
                          </Col>
                          <Col span={8} style={{ textAlign: 'right' }}>
                            <Text type='secondary' style={{ fontSize: '12px' }}>${(calculatedQuote.materialCost || calculatedQuote.materialTotal)?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                          </Col>
                          
                          <Col span={16}>
                            <Text type='secondary' style={{ fontSize: '12px' }}>Material Markup ({calculatedQuote.materialMarkupPercent}%)</Text>
                          </Col>
                          <Col span={8} style={{ textAlign: 'right' }}>
                            <Text type='secondary' style={{ fontSize: '12px' }}>+${calculatedQuote.materialMarkupAmount?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                          </Col>
                        </>
                      )}
                      
                      <Col span={16}>
                        <Text style={{ fontSize: '13px', fontWeight: '600' }}>Materials Total</Text>
                      </Col>
                      <Col span={8} style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: '13px', fontWeight: '600' }}>${calculatedQuote.materialTotal?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                      </Col>

                      {calculatedQuote.overhead !== undefined && calculatedQuote.overhead > 0 && (
                        <>
                          <Col span={16}>
                            <Text style={{ fontSize: '13px' }}>Overhead ({calculatedQuote.overheadPercent}%)</Text>
                            <br />
                            <Text type='secondary' style={{ fontSize: '11px' }}>Transportation, equipment, insurance</Text>
                          </Col>
                          <Col span={8} style={{ textAlign: 'right' }}>
                            <Text style={{ fontSize: '13px', fontWeight: '600' }}>${calculatedQuote.overhead?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                          </Col>
                        </>
                      )}

                      <Col span={24} style={{ margin: '8px 0' }}>
                        <Divider style={{ margin: '0' }} />
                      </Col>

                      {calculatedQuote.profitAmount !== undefined && calculatedQuote.profitAmount > 0 && (
                        <>
                          <Col span={16}>
                            <Text style={{ fontSize: '13px', fontWeight: '600' }}>Profit Margin ({calculatedQuote.profitMarginPercent}%)</Text>
                          </Col>
                          <Col span={8} style={{ textAlign: 'right' }}>
                            <Text style={{ fontSize: '13px', fontWeight: '600' }}>${calculatedQuote.profitAmount?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                          </Col>
                        </>
                      )}

                      <Col span={24} style={{ margin: '8px 0' }}>
                        <Divider style={{ margin: '0', borderColor: '#1890ff', borderWidth: 2 }} />
                      </Col>

                      <Col span={16}>
                        <Text strong style={{ fontSize: '14px' }}>Subtotal</Text>
                      </Col>
                      <Col span={8} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: '14px' }}>${calculatedQuote.subtotal?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                      </Col>

                      <Col span={16}>
                        <Text style={{ fontSize: '13px' }}>Sales Tax ({calculatedQuote.taxPercent}%)</Text>
                      </Col>
                      <Col span={8} style={{ textAlign: 'right' }}>
                        <Text style={{ fontSize: '13px' }}>${calculatedQuote.tax?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                      </Col>

                      <Col span={24} style={{ margin: '10px 0' }}>
                        <Divider style={{ margin: '0', borderColor: '#52c41a', borderWidth: 2 }} />
                      </Col>

                      <Col span={16}>
                        <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>TOTAL INVESTMENT</Text>
                      </Col>
                      <Col span={8} style={{ textAlign: 'right' }}>
                        <Text strong style={{ fontSize: '20px', color: '#52c41a' }}>
                          ${calculatedQuote.total?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </Text>
                      </Col>
                    </Row>
                  </div>

                  {/* Payment Schedule */}
                  <div style={{ backgroundColor: '#f6ffed', border: '2px solid #52c41a', borderRadius: 6, padding: 16 }}>
                    <Title level={4} style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#52c41a' }}>PAYMENT SCHEDULE</Title>
                    <Row gutter={[16, 12]}>
                      <Col span={12}>
                        <div style={{ paddingBottom: 12 }}>
                          <Text type='secondary' style={{ fontSize: '11px' }}>DEPOSIT DUE AT SIGNING</Text>
                          <br />
                          <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                            ${calculatedQuote.deposit?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </Text>
                          <br />
                          <Text type='secondary' style={{ fontSize: '11px' }}>({calculatedQuote.depositPercent}% of total)</Text>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ paddingBottom: 12 }}>
                          <Text type='secondary' style={{ fontSize: '11px' }}>BALANCE DUE AT COMPLETION</Text>
                          <br />
                          <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                            ${calculatedQuote.balance?.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </Text>
                          <br />
                          <Text type='secondary' style={{ fontSize: '11px' }}>({100 - calculatedQuote.depositPercent}% of total)</Text>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </div>
              )}

              {/* Timeline & Terms */}
              <div style={{ marginBottom: 40 }}>
                <Title level={4} style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Timeline</Title>
                <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px', marginBottom: 20 }}>
                  <li>Estimated Start: To be scheduled upon acceptance</li>
                  <li>Estimated Completion: Based on project scope</li>
                  <li>Subject to weather and site conditions</li>
                </ul>

                <Title level={4} style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Payment Methods</Title>
                <Text style={{ fontSize: '13px' }}>Cash • Check • Credit Card • CashApp • Venmo • Zelle</Text>
              </div>

              {/* Warranty */}
              <div>
                <Title level={4} style={{ fontSize: '14px', fontWeight: '600', marginBottom: 12 }}>Warranty</Title>
                <ul style={{ marginLeft: 20, lineHeight: 1.8, fontSize: '13px' }}>
                  <li><strong>Workmanship:</strong> {settings?.warrantyTerms || '2-year warranty on all interior work'}</li>
                  <li><strong>Manufacturer:</strong> Coverage per product specifications</li>
                </ul>
              </div>

            </Col>
          </Row>

          {/* Acceptance Section */}
          <Card 
            style={{ 
              marginBottom: 30, 
              backgroundColor: '#fffbe6', 
              borderColor: '#faad14',
              borderWidth: 2
            }}
          >
            <Title level={3} style={{ fontSize: '16px', marginBottom: 15 }}>Acceptance of Proposal</Title>
            <Paragraph style={{ fontSize: '14px', lineHeight: 1.8, marginBottom: 25 }}>
              By signing below, you acknowledge that you have read and agree to the scope of work, 
              products, investment amount, timeline, payment terms, and warranty as described in this proposal.
            </Paragraph>
            <Row gutter={30} style={{ marginTop: 30 }}>
              <Col span={12}>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 5, minHeight: '40px' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>Customer Signature</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>Date: _____________</Text>
              </Col>
              <Col span={12}>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 5, minHeight: '40px' }} />
                <Text type="secondary" style={{ fontSize: '12px' }}>Contractor Signature</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>Date: _____________</Text>
              </Col>
            </Row>
          </Card>

          {/* Footer */}
          <div style={{ 
            textAlign: 'center', 
            paddingTop: 20, 
            borderTop: '2px solid #d9d9d9',
            color: '#999',
            fontSize: '11px'
          }}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              {settings?.tenant?.companyName || 'Professional Painting Co.'}
            </Text>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
              {settings?.tenant?.email || 'contact@company.com'} | {settings?.tenant?.phoneNumber || '(555) 123-4567'}
            </Text>
            <Text type="secondary" style={{ fontSize: '10px', display: 'block', color: '#bbb' }}>
              Powered by Cadence Quote • www.cadencequote.com
            </Text>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ProposalPreviewModal;
