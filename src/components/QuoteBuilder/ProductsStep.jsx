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
  const [gbbDefaults, setGbbDefaults] = useState([]);
  const [loading, setLoading] = useState(false);

  const pricingSchemeId = formData.pricingSchemeId;

  useEffect(() => {
    fetchProducts();
    fetchGBBDefaults();
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

  const fetchGBBDefaults = async () => {
    try {
      const response = await apiService.get('/gbb-defaults');
      if (response.success) {
        setGbbDefaults(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching GBB defaults:', error);
    }
  };

  // Group areas by surface type - supports both old (surfaces) and new (laborItems) structure
  const getSurfaceTypes = () => {
    const surfaces = new Set();
    (formData.areas || []).forEach(area => {
      // New structure: laborItems
      if (area.laborItems) {
        area.laborItems.forEach(item => {
          if (item.selected) {
            surfaces.add(item.categoryName);
          }
        });
      }
      // Old structure: surfaces (for backward compatibility)
      else if (area.surfaces) {
        area.surfaces.forEach(surface => {
          if (surface.selected) {
            surfaces.add(surface.type);
          }
        });
      }
    });
    return Array.from(surfaces);
  };

  const surfaceTypes = getSurfaceTypes();

  // Initialize product sets if empty - auto-populate from GBB defaults
  useEffect(() => {
    if (productSets.length === 0 && surfaceTypes.length > 0 && gbbDefaults.length > 0) {
      const initialSets = surfaceTypes.map(surfaceType => {
        // Map surface type name to GBB defaults surface type enum
        // Supports both old surface names and new labor category names
        const surfaceTypeMap = {
          // Old surface names
          'Walls': 'interior_walls',
          'Ceiling': 'interior_ceilings',
          'Ceilings': 'interior_ceilings',
          'Trim': 'interior_trim_doors',
          'Doors': 'interior_trim_doors',
          'Cabinets': 'cabinets',
          'Siding': 'exterior_siding',
          'Windows': 'exterior_trim',
          'Soffit & Fascia': 'exterior_trim',
          // New labor category names
          'Accent Walls': 'interior_walls',
          'Drywall Repair': 'interior_walls',
          'Exterior Walls': 'exterior_siding',
          'Exterior Trim': 'exterior_trim',
          'Exterior Doors': 'exterior_trim',
          'Shutters': 'exterior_trim',
          'Decks & Railings': 'exterior_siding',
          'Prep Work': 'exterior_siding'
        };

        const mappedType = surfaceTypeMap[surfaceType] || 'interior_walls';
        const defaults = gbbDefaults.find(d => d.surfaceType === mappedType);

        return {
          surfaceType,
          products: productStrategy === 'GBB' 
            ? { 
                good: defaults?.goodProductId || null, 
                better: defaults?.betterProductId || null, 
                best: defaults?.bestProductId || null 
              }
            : { single: null },
          prices: productStrategy === 'GBB' && defaults
            ? {
                good: defaults.goodPricePerGallon,
                better: defaults.betterPricePerGallon,
                best: defaults.bestPricePerGallon
              }
            : null,
          gallons: null
        };
      });
      setProductSets(initialSets);
    }
  }, [surfaceTypes, gbbDefaults]);

  const updateProductSet = (surfaceType, tier, productId) => {
    setProductSets(productSets.map(set => {
      if (set.surfaceType === surfaceType) {
        const updatedSet = {
          ...set,
          products: {
            ...set.products,
            [tier]: productId
          }
        };
        // Auto-calculate material cost when product is selected
        if (productId) {
          calculateMaterialCost(surfaceType, tier, productId, updatedSet);
        }
        return updatedSet;
      }
      return set;
    }));
  };

  // Auto-calculate material cost based on gallons and product price
  const calculateMaterialCost = (surfaceType, tier, productId, currentSet) => {
    const product = getProductById(productId);
    if (!product) return;

    // Get gallons from areas
    let totalGallons = 0;
    (formData.areas || []).forEach(area => {
      if (area.laborItems) {
        area.laborItems.forEach(item => {
          if (item.selected && item.categoryName === surfaceType && item.gallons) {
            totalGallons += parseFloat(item.gallons) || 0;
          }
        });
      }
    });

    // Apply waste factor (default 10% = 1.1)
    const wasteFactor = 1.1;
    const gallonsWithWaste = totalGallons * wasteFactor;
    
    // Round up to nearest 0.25 gallon
    const finalGallons = Math.ceil(gallonsWithWaste * 4) / 4;
    
    // Calculate material cost
    const materialCost = finalGallons * parseFloat(product.pricePerGallon || 0);

    // Update the set with calculated values
    setProductSets(prev => prev.map(set => {
      if (set.surfaceType === surfaceType) {
        return {
          ...set,
          gallons: finalGallons,
          materialCost: materialCost.toFixed(2),
          wasteFactor,
          rawGallons: totalGallons.toFixed(2)
        };
      }
      return set;
    }));
  };

  // Get available products filtered by what's already selected in other tiers for this surface
  const getAvailableProductsForTier = (surfaceType, currentTier) => {
    const currentSet = productSets.find(set => set.surfaceType === surfaceType);
    if (!currentSet) return availableProducts;

    const selectedInOtherTiers = [];
    if (currentTier !== 'good' && currentSet.products.good) {
      selectedInOtherTiers.push(currentSet.products.good);
    }
    if (currentTier !== 'better' && currentSet.products.better) {
      selectedInOtherTiers.push(currentSet.products.better);
    }
    if (currentTier !== 'best' && currentSet.products.best) {
      selectedInOtherTiers.push(currentSet.products.best);
    }

    return availableProducts.filter(product => !selectedInOtherTiers.includes(product.id));
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
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {getAvailableProductsForTier(set.surfaceType, 'good').map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                            {set.products.good === product.id && ' ✓'}
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
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {getAvailableProductsForTier(set.surfaceType, 'better').map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                            {set.products.better === product.id && ' ✓'}
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
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {getAvailableProductsForTier(set.surfaceType, 'best').map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                            {set.products.best === product.id && ' ✓'}
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

              {set.gallons > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: '#f0f9ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Raw Gallons:</Text>
                      <div><Text strong>{set.rawGallons || '0.00'}</Text></div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 12 }}>+ Waste (10%):</Text>
                      <div><Text strong>{set.gallons?.toFixed(2)} gal</Text></div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Material Cost:</Text>
                      <div><Text strong style={{ fontSize: 16, color: '#1890ff' }}>${set.materialCost || '0.00'}</Text></div>
                    </Col>
                  </Row>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
                    Formula: ({set.rawGallons} × {set.wasteFactor}) = {set.gallons?.toFixed(2)} gal × ${getProductById(set.products.good || set.products.better || set.products.best)?.pricePerGallon || 0}/gal
                  </Text>
                </div>
              )}
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
