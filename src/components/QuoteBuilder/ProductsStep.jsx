// src/components/QuoteBuilder/ProductsStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Select, Radio, Checkbox, InputNumber, Space, Modal, Divider, Tag } from 'antd';
import { ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';
import { apiService } from '../../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;

const ProductsStep = ({ formData, onUpdate, onNext, onPrevious }) => {
  const [productStrategy, setProductStrategy] = useState(formData.productStrategy || 'GBB');
  const [allowCustomerChoice, setAllowCustomerChoice] = useState(formData.allowCustomerProductChoice || false);
  const [productSets, setProductSets] = useState(formData.productSets || []);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const pricingSchemeId = formData.pricingSchemeId;

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    onUpdate({ 
      productStrategy, 
      allowCustomerProductChoice: allowCustomerChoice,
      productSets 
    });
  }, [productStrategy, allowCustomerChoice, productSets]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/contractor/product-configs', {
        params: { pricingSchemeId }
      });
      if (response.success) {
        // Transform the response data to a flatter structure for easier use
        const transformedProducts = (response.data || []).map(config => ({
          id: config.id,
          configId: config.id,
          globalProductId: config.globalProductId,
          brandName: config.globalProduct?.brand?.name || 'Unknown Brand',
          productName: config.globalProduct?.name || 'Unknown Product',
          category: config.globalProduct?.category || '',
          sheens: config.sheens || [],
          // Get the first sheen's price for display (or calculate average)
          pricePerGallon: config.sheens?.[0]?.price || 0,
          coverage: config.sheens?.[0]?.coverage || 350,
          laborRates: config.laborRates || { interior: [], exterior: [] },
          defaultMarkup: config.defaultMarkup || '0.00',
          description: config.globalProduct?.notes || config.globalProduct?.sheenOptions || ''
        }));
        setAvailableProducts(transformedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Modal.error({
        title: 'Error Loading Products',
        content: 'Failed to load product configurations. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Group areas by surface type
  const getSurfaceTypes = () => {
    const surfaces = new Set();
    (formData.areas || []).forEach(area => {
      area.surfaces.forEach(surface => {
        if (surface.selected) {
          surfaces.add(surface.type);
        }
      });
    });
    return Array.from(surfaces);
  };

  const surfaceTypes = getSurfaceTypes();

  // Initialize product sets if empty
  useEffect(() => {
    if (productSets.length === 0 && surfaceTypes.length > 0) {
      const initialSets = surfaceTypes.map(surfaceType => ({
        surfaceType,
        products: productStrategy === 'GBB' 
          ? { good: null, better: null, best: null }
          : { single: null },
        gallons: null
      }));
      setProductSets(initialSets);
    }
  }, [surfaceTypes]);

  const updateProductSet = (surfaceType, tier, productId) => {
    setProductSets(productSets.map(set => {
      if (set.surfaceType === surfaceType) {
        return {
          ...set,
          products: {
            ...set.products,
            [tier]: productId
          }
        };
      }
      return set;
    }));
  };

  const calculateGallons = (surfaceType) => {
    let totalSqft = 0;
    (formData.areas || []).forEach(area => {
      area.surfaces.forEach(surface => {
        console.log('Calculating for surface:', surface);
        if (surface.selected && surface.type === surfaceType && surface.sqft) {
          totalSqft += parseFloat(surface.sqft) || 0;
        }
      });
    });

    // Assuming 400 sqft per gallon coverage (adjust as needed)
    const gallons = Math.ceil(totalSqft / 400);
    
    setProductSets(productSets.map(set => {
      if (set.surfaceType === surfaceType) {
        return { ...set, gallons };
      }
      return set;
    }));
  };

  const quickApplyToAll = (tier, productId) => {
    setProductSets(productSets.map(set => ({
      ...set,
      products: {
        ...set.products,
        [tier]: productId
      }
    })));
  };

  const handleStrategyChange = (value) => {
    setProductStrategy(value);
    // Reset product selections when strategy changes
    const resetSets = productSets.map(set => ({
      ...set,
      products: value === 'GBB' 
        ? { good: null, better: null, best: null }
        : { single: null }
    }));
    setProductSets(resetSets);
  };

  const handleNext = () => {
    const hasProducts = productSets.every(set => {
      if (productStrategy === 'GBB') {
        return set.products.good || set.products.better || set.products.best;
      } else {
        return set.products.single;
      }
    });

    if (!hasProducts) {
      Modal.warning({
        title: 'Products Not Selected',
        content: 'Please select at least one product for each surface type before continuing.',
      });
      return;
    }

    onNext();
  };

  const getProductById = (productId) => {
    return availableProducts.find(p => p.id === productId);
  };

  return (
    <div className="products-step">
      <Alert
        message="Step 4: Product Selection"
        description="Choose products for each surface type. You can offer Good-Better-Best options or a single product recommendation."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title="Product Strategy" style={{ marginBottom: 24 }}>
        <Radio.Group 
          value={productStrategy} 
          onChange={(e) => handleStrategyChange(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical">
            <Radio value="GBB">
              <strong>Good-Better-Best</strong> - Offer 3 tiers for customer to choose from
            </Radio>
            <Radio value="single">
              <strong>Single Product</strong> - Recommend one product per surface
            </Radio>
          </Space>
        </Radio.Group>

        {productStrategy === 'GBB' && (
          <Checkbox
            checked={allowCustomerChoice}
            onChange={(e) => setAllowCustomerChoice(e.target.checked)}
          >
            Allow customer to choose different products per area (default: same product for all areas)
          </Checkbox>
        )}
      </Card>

      {productSets.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Title level={4}>Select Products by Surface Type</Title>

          {productSets.map(set => (
            <Card 
              key={set.surfaceType}
              title={set.surfaceType}
              style={{ marginBottom: 16 }}
            >
              {productStrategy === 'GBB' ? (
                <Row gutter={[16, 16]}>
                  {/* Good Tier */}
                  <Col xs={24} md={8}>
                    <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 4, height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Tag color="blue">GOOD</Tag>
                        {set.products.good && (
                          <Button 
                            type="link" 
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => quickApplyToAll('good', set.products.good)}
                          >
                            Apply to All
                          </Button>
                        )}
                      </div>
                      <Select
                        placeholder="Select Good Option"
                        style={{ width: '100%' }}
                        value={set.products.good}
                        onChange={(value) => updateProductSet(set.surfaceType, 'good', value)}
                        loading={loading}
                      >
                        {availableProducts.map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                          </Option>
                        ))}
                      </Select>
                      {set.products.good && (
                        <div style={{ marginTop: 8 }}>
                          {(() => {
                            const product = getProductById(set.products.good);
                            return product ? (
                              <>
                                <Text strong>${product.pricePerGallon}/gal</Text>
                                <br />
                                <Text type="secondary">{product.description}</Text>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </Col>

                  {/* Better Tier */}
                  <Col xs={24} md={8}>
                    <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4, height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Tag color="cyan">BETTER</Tag>
                        {set.products.better && (
                          <Button 
                            type="link" 
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => quickApplyToAll('better', set.products.better)}
                          >
                            Apply to All
                          </Button>
                        )}
                      </div>
                      <Select
                        placeholder="Select Better Option"
                        style={{ width: '100%' }}
                        value={set.products.better}
                        onChange={(value) => updateProductSet(set.surfaceType, 'better', value)}
                        loading={loading}
                      >
                        {availableProducts.map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                          </Option>
                        ))}
                      </Select>
                      {set.products.better && (
                        <div style={{ marginTop: 8 }}>
                          {(() => {
                            const product = getProductById(set.products.better);
                            return product ? (
                              <>
                                <Text strong>${product.pricePerGallon}/gal</Text>
                                <br />
                                <Text type="secondary">{product.description}</Text>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </Col>

                  {/* Best Tier */}
                  <Col xs={24} md={8}>
                    <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4, height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Tag color="green">BEST</Tag>
                        {set.products.best && (
                          <Button 
                            type="link" 
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => quickApplyToAll('best', set.products.best)}
                          >
                            Apply to All
                          </Button>
                        )}
                      </div>
                      <Select
                        placeholder="Select Best Option"
                        style={{ width: '100%' }}
                        value={set.products.best}
                        onChange={(value) => updateProductSet(set.surfaceType, 'best', value)}
                        loading={loading}
                      >
                        {availableProducts.map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                          </Option>
                        ))}
                      </Select>
                      {set.products.best && (
                        <div style={{ marginTop: 8 }}>
                          {(() => {
                            const product = getProductById(set.products.best);
                            return product ? (
                              <>
                                <Text strong>${product.pricePerGallon}/gal</Text>
                                <br />
                                <Text type="secondary">{product.description}</Text>
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              ) : (
                <Row gutter={16}>
                  <Col xs={24} md={16}>
                    <Select
                      placeholder="Select Product"
                      style={{ width: '100%' }}
                      value={set.products.single}
                      onChange={(value) => updateProductSet(set.surfaceType, 'single', value)}
                      loading={loading}
                      size="large"
                    >
                      {availableProducts.map(product => (
                        <Option key={product.id} value={product.id}>
                          {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} md={8}>
                    {set.products.single && (
                      <Button 
                        type="primary"
                        icon={<CopyOutlined />}
                        onClick={() => quickApplyToAll('single', set.products.single)}
                      >
                        Apply to All Surfaces
                      </Button>
                    )}
                  </Col>
                </Row>
              )}

              <Divider />

              <Row gutter={16} align="middle">
                <Col xs={12}>
                  <Button 
                    icon={<ThunderboltOutlined />}
                    onClick={() => calculateGallons(set.surfaceType)}
                  >
                    Auto-Calculate Gallons
                  </Button>
                </Col>
                <Col xs={12}>
                  <InputNumber
                    placeholder="Gallons needed"
                    style={{ width: '100%' }}
                    min={0}
                    value={set.gallons}
                    onChange={(value) => {
                      setProductSets(productSets.map(s => 
                        s.surfaceType === set.surfaceType ? { ...s, gallons: value } : s
                      ));
                    }}
                    addonAfter="gallons"
                  />
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      )}

      {surfaceTypes.length === 0 && (
        <Alert
          message="No Surfaces Selected"
          description="Please go back and select surfaces in the Areas step."
          type="warning"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
        <Button size="large" onClick={onPrevious}>
          Previous
        </Button>
        <Button 
          type="primary" 
          size="large" 
          onClick={handleNext}
        >
          Next: Review & Send
        </Button>
      </div>
    </div>
  );
};

export default ProductsStep;
