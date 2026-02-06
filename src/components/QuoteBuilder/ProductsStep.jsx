// src/components/QuoteBuilder/ProductsStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Select, Radio, Checkbox, Space, Modal, Divider, Tag, Collapse, Empty, Grid } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { apiService } from '../../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

// Flat rate item definitions with labels
const FLAT_RATE_ITEMS = {
    interior: {
        doors: { label: 'Interior Doors', unit: 'each' },
        smallRooms: { label: 'Small Rooms', unit: 'each' },
        mediumRooms: { label: 'Medium Rooms', unit: 'each' },
        largeRooms: { label: 'Large Rooms', unit: 'each' },
        closets: { label: 'Closets', unit: 'each' },
        accentWalls: { label: 'Accent Walls', unit: 'each' },
        cabinetFaces: { label: 'Cabinet Faces', unit: 'each' },
        cabinetDoors: { label: 'Cabinet Doors', unit: 'each' }
    },
    exterior: {
        doors: { label: 'Exterior Doors', unit: 'each' },
        windows: { label: 'Windows', unit: 'each' },
        garageDoors1Car: { label: '1-Car Garage Doors', unit: 'each' },
        garageDoors2Car: { label: '2-Car Garage Doors', unit: 'each' },
        garageDoors3Car: { label: '3-Car Garage Doors', unit: 'each' },
        shutters: { label: 'Shutters', unit: 'each' }
    }
};

const ProductsStep = ({ formData, onUpdate, onNext, onPrevious, pricingSchemes }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    const [productStrategy, setProductStrategy] = useState(formData.productStrategy || 'GBB');
    const [allowCustomerChoice, setAllowCustomerChoice] = useState(formData.allowCustomerProductChoice || false);
    const [productSets, setProductSets] = useState(formData.productSets || []);
    const [availableProducts, setAvailableProducts] = useState([]);
    const [gbbDefaults, setGbbDefaults] = useState([]);
    const [loading, setLoading] = useState(false);

    const pricingSchemeId = formData.pricingSchemeId;

    // Determine pricing scheme types
    const currentScheme = pricingSchemes?.find(s => s.id === pricingSchemeId);
    const isTurnkey = currentScheme && (currentScheme.type === 'turnkey' || currentScheme.type === 'sqft_turnkey');
    const isFlatRate = formData.pricingModelType === 'flat_rate_unit';
    const isProductionBased = formData.pricingModelType === 'production_based';
    const isRateBased = formData.pricingModelType === 'rate_based_sqft';

    useEffect(() => {
        fetchProducts();
        fetchGBBDefaults();
    }, [formData.jobType]);

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
            const jobType = formData.jobType;
            const response = await apiService.get('/contractor/product-configs' + `?&jobType=${jobType || ''}&pricingSchemeId=${pricingSchemeId || ''}`);
            if (response.success) {
                const transformedProducts = (response.data || []).map(config => {
                    // Support both custom and global products
                    let brandName, productName, category, description;

                    if (config.isCustom && config.customProduct) {
                        // Custom product
                        brandName = config.customProduct.brandName || 'Custom';
                        productName = config.customProduct.name || 'Custom Product';
                        category = config.customProduct.category || '';
                        description = config.customProduct.description || '';
                    } else if (config.globalProduct) {
                        // Global product
                        brandName = config.globalProduct.brand?.name || 'Unknown Brand';
                        productName = config.globalProduct.name || 'Unknown Product';
                        category = config.globalProduct.category || '';
                        description = config.globalProduct.notes || config.globalProduct.sheenOptions || '';
                    } else {
                        // Fallback
                        brandName = 'Unknown Brand';
                        productName = 'Unknown Product';
                        category = '';
                        description = '';
                    }

                    return {
                        id: config.id,
                        configId: config.id,
                        globalProductId: config.globalProductId,
                        isCustom: config.isCustom || false,
                        brandName,
                        productName,
                        category,
                        sheens: config.sheens || [],
                        pricePerGallon: config.sheens?.[0]?.price || 0,
                        coverage: config.sheens?.[0]?.coverage || 350,
                        laborRates: config.laborRates || { interior: [], exterior: [] },
                        defaultMarkup: config.defaultMarkup || '0.00',
                        description
                    };
                });
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

    // Get areas with their selected surfaces for area-based pricing
    const getAreasWithSurfaces = () => {
        return (formData.areas || []).map(area => {
            let selectedSurfaces = [];

            if (area.laborItems) {
                selectedSurfaces = area.laborItems
                    .filter(item => item.selected)
                    .map(item => ({
                        id: item.categoryName,
                        name: item.categoryName,
                        quantity: item.quantity,
                        unit: item.measurementUnit,
                        coats: item.numberOfCoats
                    }));
            } else if (area.surfaces) {
                selectedSurfaces = area.surfaces
                    .filter(surface => surface.selected)
                    .map(surface => ({
                        id: surface.type,
                        name: surface.type,
                        sqft: surface.sqft
                    }));
            }

            return {
                id: area.id,
                name: area.name,
                surfaces: selectedSurfaces
            };
        }).filter(area => area.surfaces.length > 0);
    };

    // Get available products for a specific area and tier (for filtering)
    const getAvailableProductsForAreaTier = (areaId, tier) => {
        // For now, return all available products
        // In the future, this could filter based on area requirements or tier restrictions
        return availableProducts;
    };

    // Update product set function
    const updateProductSet = (areaId, tier, productId, surfaceType = null) => {
        setProductSets(prev => {
            return prev.map(set => {
                // Match by areaId and surfaceType for area-based pricing
                if (surfaceType && set.areaId === areaId && set.surfaceType === surfaceType) {
                    return {
                        ...set,
                        products: {
                            ...set.products,
                            [tier]: productId
                        },
                        overridden: true
                    };
                }
                // Match by areaId only for area-based pricing without surface specificity
                else if (!surfaceType && set.areaId === areaId) {
                    return {
                        ...set,
                        products: {
                            ...set.products,
                            [tier]: productId
                        },
                        overridden: true
                    };
                }
                // Match by type for general product sets (turnkey)
                else if (set.type && set.type === 'turnkey') {
                    return {
                        ...set,
                        products: {
                            ...set.products,
                            [tier]: productId
                        },
                        overridden: true
                    };
                }
                // Match flat rate items by ID
                else if (set.type === 'flat_rate_item' && set.id === areaId) { // We use areaId arg to pass ID for flat rate
                    return {
                        ...set,
                        products: {
                            ...set.products,
                            [tier]: productId
                        },
                        overridden: true
                    };
                }
                return set;
            });
        });
    };

    // Copy product to all surfaces for the same tier (for production/rate-based pricing)
    const copyProductToAllSurfaces = (tier, productId) => {
        Modal.confirm({
            title: `Apply to All ${tier.toUpperCase()} Tiers?`,
            content: `Apply this product to all ${tier.toUpperCase()} tier selections across all areas and surfaces?`,
            onOk: () => {
                console.log(`🔄 Copying product ${productId} to all ${tier} tiers`);
                setProductSets(prev => {
                    const updated = prev.map(set => {
                        if (set.type === 'area_surface') {
                            console.log(`✅ Updating set: ${set.areaName} - ${set.surfaceName} (${tier})`);
                            return {
                                ...set,
                                products: {
                                    ...set.products,
                                    [tier]: productId
                                },
                                overridden: true
                            };
                        }
                        return set;
                    });
                    console.log('📦 Updated productSets:', updated);
                    return updated;
                });
            }
        });
    };

    // Copy product to all flat rate items
    const copyProductToAllFlatRateItems = (tier, productId) => {
        Modal.confirm({
            title: 'Apply to All Flat Rate Items?',
            content: `Apply this ${tier.toUpperCase()} product to all flat rate items?`,
            onOk: () => {
                setProductSets(prev => prev.map(set => {
                    if (set.type === 'flat_rate_item') {
                        return {
                            ...set,
                            products: {
                                ...set.products,
                                [tier]: productId
                            },
                            overridden: true
                        };
                    }
                    return set;
                }));
            }
        });
    };

    // Copy product to all areas (for production/rate-based pricing)
    const copyProductToAllAreas = (tier, productId) => {
        Modal.confirm({
            title: 'Apply to All Areas?',
            content: `Apply this ${tier.toUpperCase()} product to all areas and surfaces?`,
            onOk: () => {
                setProductSets(prev => prev.map(set => {
                    if (set.type === 'area_surface') {
                        return {
                            ...set,
                            products: {
                                ...set.products,
                                [tier]: productId
                            },
                            overridden: true
                        };
                    }
                    return set;
                }));
            }
        });
    };

    // Get surface types for validation (derived from areas)
    const surfaceTypes = React.useMemo(() => {
        const types = new Set();
        (formData.areas || []).forEach(area => {
            if (area.laborItems) {
                area.laborItems.forEach(item => {
                    if (item.selected) {
                        types.add(item.categoryName);
                    }
                });
            } else if (area.surfaces) {
                area.surfaces.forEach(surface => {
                    if (surface.selected) {
                        types.add(surface.type);
                    }
                });
            }
        });
        return Array.from(types);
    }, [formData.areas]);

    // Initialize product sets based on pricing scheme
    useEffect(() => {
        if (availableProducts.length === 0) return; // Wait for products to load

        console.log('🚀 Initializing productSets for pricing scheme:', currentScheme?.type);

        if (isTurnkey) {
            // TURNKEY: Single general product set for whole house
            if (productSets.length === 0) {
                const initialSet = {
                    id: 'turnkey_general',
                    type: 'turnkey',
                    label: `General ${formData.jobType || 'Interior'} Products`,
                    products: productStrategy === 'GBB'
                        ? { good: null, better: null, best: null }
                        : { single: null },
                    overridden: false
                };
                setProductSets([initialSet]);
            }
        } else if (isFlatRate) {
            // FLAT RATE: Single general product set for all flat rate items
            // FLAT RATE: Generate product sets for each active items
            const newSets = [];
            const flatRateItems = formData.flatRateItems || { interior: {}, exterior: {} };

            // Helper to add set if not exists
            const addSet = (category, itemKey) => {
                const id = `flat_rate_${category}_${itemKey}`;
                if (!productSets.some(s => s.id === id)) {
                    const itemDef = FLAT_RATE_ITEMS[category]?.[itemKey];
                    newSets.push({
                        id: id,
                        type: 'flat_rate_item',
                        surfaceType: itemKey, // Using item key as surface type identifier
                        category: category,
                        label: itemDef ? itemDef.label : itemKey,
                        products: productStrategy === 'GBB'
                            ? { good: null, better: null, best: null }
                            : { single: null },
                        overridden: false
                    });
                }
            };

            // Iterate interior items
            Object.entries(flatRateItems.interior || {}).forEach(([key, count]) => {
                if (count > 0) addSet('interior', key);
            });

            // Iterate exterior items
            Object.entries(flatRateItems.exterior || {}).forEach(([key, count]) => {
                if (count > 0) addSet('exterior', key);
            });

            if (newSets.length > 0) {
                // Keep existing sets that are still valid (count > 0), add new ones
                // Ideally we should sync completely, removing those that are 0 count now.
                // For simplicity, we just append new ones. 
                // A better approach: Filter existing sets to keep only those with count > 0, then add new.

                const activeIds = new Set();
                Object.entries(flatRateItems.interior || {}).forEach(([key, count]) => {
                    if (count > 0) activeIds.add(`flat_rate_interior_${key}`);
                });
                Object.entries(flatRateItems.exterior || {}).forEach(([key, count]) => {
                    if (count > 0) activeIds.add(`flat_rate_exterior_${key}`);
                });

                const filteredExisting = productSets.filter(s => activeIds.has(s.id));
                const existingIds = new Set(filteredExisting.map(s => s.id));
                const reallyNewSets = newSets.filter(s => !existingIds.has(s.id));

                if (reallyNewSets.length > 0 || filteredExisting.length !== productSets.length) {
                    setProductSets([...filteredExisting, ...reallyNewSets]);
                }
            } else if (productSets.length > 0 && productSets[0].id === 'flat_rate_general') {
                // Clear old legacy general set if moving to granular
                setProductSets([]);
            }
        } else if (isProductionBased || isRateBased) {
            // PRODUCTION/RATE BASED: Product set for each area + surface combination
            const areasWithSurfaces = getAreasWithSurfaces();
            if (areasWithSurfaces.length > 0) {
                // Build a map of existing productSet IDs
                const existingSetIds = new Set(productSets.map(s => s.id));

                // Create productSets for any missing area+surface combinations
                const newSets = [];
                areasWithSurfaces.forEach(area => {
                    area.surfaces.forEach(surface => {
                        const setId = `${area.id}_${surface.name}`;
                        if (!existingSetIds.has(setId)) {
                            console.log(`➕ Creating missing productSet: ${area.name} - ${surface.name}`);
                            newSets.push({
                                id: setId,
                                type: 'area_surface',
                                areaId: area.id,
                                areaName: area.name,
                                surfaceType: surface.name,
                                surfaceName: surface.name,
                                quantity: surface.quantity,
                                unit: surface.unit,
                                products: productStrategy === 'GBB'
                                    ? { good: null, better: null, best: null }
                                    : { single: null },
                                overridden: false
                            });
                        }
                    });
                });

                // Add new sets to existing ones
                if (newSets.length > 0) {
                    console.log(`📦 Adding ${newSets.length} new productSets to existing ${productSets.length}`);
                    setProductSets([...productSets, ...newSets]);
                }
            }
        }
    }, [currentScheme?.type, availableProducts.length, productStrategy]);

    // Handle strategy change
    const handleStrategyChange = (value) => {
        setProductStrategy(value);

        // Reset all product selections when strategy changes
        setProductSets(prev => prev.map(set => ({
            ...set,
            products: value === 'GBB'
                ? { good: null, better: null, best: null }
                : { single: null },
            overridden: false
        })));
    };

    // Validate and handle next step
    const handleNext = () => {
        // Products are optional for turnkey and flat rate
        if (isTurnkey || isFlatRate) {
            onNext();
            return;
        }

        // For production/rate based, validate that products are selected if sets exist
        const hasIncompleteProducts = productSets.some(set => {
            if (productStrategy === 'GBB') {
                return !(set.products.good || set.products.better || set.products.best);
            } else {
                return !set.products.single;
            }
        });

        if (hasIncompleteProducts && productSets.length > 0) {
            Modal.warning({
                title: 'Products Not Selected',
                content: 'Please select at least one product for each item before continuing.',
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
                style={{ marginBottom: isMobile ? 16 : 24 }}
            />

            {/* Show special message for turnkey pricing with no areas */}
            {isTurnkey && (!formData.areas || formData.areas.length === 0) && (
                <Alert
                    message="Turnkey Pricing - Simplified Product Selection"
                    description="With turnkey pricing, you can select general products for the entire home without specifying individual room products. These will be used for material cost estimation based on your home's total square footage."
                    type="warning"
                    showIcon
                    style={{ marginBottom: isMobile ? 16 : 24 }}
                />
            )}

            {/* Show special message for flat rate pricing */}
            {isFlatRate && (
                <Alert
                    message="Flat Rate Pricing - Item-Based Product Selection"
                    description="With flat rate pricing, you can select products that will be used across all your flat rate items. Products are optional since pricing is based on fixed unit rates."
                    type="info"
                    showIcon
                    style={{ marginBottom: isMobile ? 16 : 24 }}
                />
            )}


            {/* Show message if no surface types are available for non-turnkey, non-flat-rate pricing */}
            {!isTurnkey && !isFlatRate && (!surfaceTypes || surfaceTypes.length === 0) && (
                <Alert
                    message="No Surface Types Found"
                    description="Please go back to the Areas step and add rooms/areas before selecting products."
                    type="warning"
                    showIcon
                    style={{ marginBottom: isMobile ? 16 : 24 }}
                    action={
                        <Button size="small" onClick={onPrevious}>
                            Go Back to Areas
                        </Button>
                    }
                />
            )}

            <Card title="Product Strategy" style={{ marginBottom: isMobile ? 16 : 24 }}>
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

            {/* Turnkey Simplified Product Selection */}
            {isTurnkey && (
                <div style={{ marginTop: isMobile ? 16 : 24 }}>
                    <Card
                        title={`General ${formData.jobType === 'interior' ? 'Interior' : 'Exterior'} Products`}
                        style={{ marginBottom: 16 }}
                    >
                        {productStrategy === 'GBB' ? (
                            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
                                {/* Good Tier */}
                                <Col xs={24} md={8}>
                                    <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 4, height: '100%' }}>
                                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Tag color="blue">GOOD</Tag>
                                            {productSets.find(ps => ps.type === 'turnkey')?.products?.good && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<CopyOutlined />}
                                                    onClick={() => copyProductToAllAreas('good', productSets.find(ps => ps.type === 'turnkey')?.products?.good)}
                                                    style={{ padding: 0, height: 'auto' }}
                                                >
                                                    Copy to All
                                                </Button>
                                            )}
                                        </div>
                                        <Select
                                            placeholder="Select Good Option"
                                            style={{ width: '100%' }}
                                            value={productSets.find(ps => ps.type === 'turnkey')?.products?.good}
                                            onChange={(value) => updateProductSet(null, 'good', value)}
                                            loading={loading}
                                            showSearch
                                            filterOption={(input, option) =>
                                                option.label && typeof option.label === 'string'
                                                    ? option.label.toLowerCase().includes(input.toLowerCase())
                                                    : true
                                            }
                                        >
                                            {availableProducts.map(product => (
                                                <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} (${product.pricePerGallon}/gal)`}>
                                                    {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                                                </Option>
                                            ))}
                                        </Select>
                                        {(() => {
                                            const productId = productSets.find(ps => ps.type === 'turnkey')?.products?.good;
                                            if (productId) {
                                                const product = getProductById(productId);
                                                return product ? (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Text strong>${product.pricePerGallon}/gal</Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
                                                    </div>
                                                ) : null;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </Col>

                                {/* Better Tier */}
                                <Col xs={24} md={8}>
                                    <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4, height: '100%' }}>
                                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Tag color="cyan">BETTER</Tag>
                                            {productSets.find(ps => ps.type === 'turnkey')?.products?.better && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<CopyOutlined />}
                                                    onClick={() => copyProductToAllAreas('better', productSets.find(ps => ps.type === 'turnkey')?.products?.better)}
                                                    style={{ padding: 0, height: 'auto' }}
                                                >
                                                    Copy to All
                                                </Button>
                                            )}
                                        </div>
                                        <Select
                                            placeholder="Select Better Option"
                                            style={{ width: '100%' }}
                                            value={productSets.find(ps => ps.type === 'turnkey')?.products?.better}
                                            onChange={(value) => updateProductSet(null, 'better', value)}
                                            loading={loading}
                                            showSearch
                                            filterOption={(input, option) =>
                                                option.label && typeof option.label === 'string'
                                                    ? option.label.toLowerCase().includes(input.toLowerCase())
                                                    : true
                                            }
                                        >
                                            {availableProducts.map(product => (
                                                <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} (${product.pricePerGallon}/gal)`}>
                                                    {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                                                </Option>
                                            ))}
                                        </Select>
                                        {(() => {
                                            const productId = productSets.find(ps => ps.type === 'turnkey')?.products?.better;
                                            if (productId) {
                                                const product = getProductById(productId);
                                                return product ? (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Text strong>${product.pricePerGallon}/gal</Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
                                                    </div>
                                                ) : null;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </Col>

                                {/* Best Tier */}
                                <Col xs={24} md={8}>
                                    <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4, height: '100%' }}>
                                        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Tag color="green">BEST</Tag>
                                            {productSets.find(ps => ps.type === 'turnkey')?.products?.best && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<CopyOutlined />}
                                                    onClick={() => copyProductToAllAreas('best', productSets.find(ps => ps.type === 'turnkey')?.products?.best)}
                                                    style={{ padding: 0, height: 'auto' }}
                                                >
                                                    Copy to All
                                                </Button>
                                            )}
                                        </div>
                                        <Select
                                            placeholder="Select Best Option"
                                            style={{ width: '100%' }}
                                            value={productSets.find(ps => ps.type === 'turnkey')?.products?.best}
                                            onChange={(value) => updateProductSet(null, 'best', value)}
                                            loading={loading}
                                            showSearch
                                            filterOption={(input, option) =>
                                                option.label && typeof option.label === 'string'
                                                    ? option.label.toLowerCase().includes(input.toLowerCase())
                                                    : true
                                            }
                                        >
                                            {availableProducts.map(product => (
                                                <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} (${product.pricePerGallon}/gal)`}>
                                                    {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                                                </Option>
                                            ))}
                                        </Select>
                                        {(() => {
                                            const productId = productSets.find(ps => ps.type === 'turnkey')?.products?.best;
                                            if (productId) {
                                                const product = getProductById(productId);
                                                return product ? (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Text strong>${product.pricePerGallon}/gal</Text>
                                                        <br />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
                                                    </div>
                                                ) : null;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </Col>
                            </Row>
                        ) : (
                            // Single Product Strategy
                            <Row gutter={16} align="middle">
                                <Col xs={24} md={16}>
                                    <Select
                                        placeholder="Select Product"
                                        style={{ width: '100%' }}
                                        value={productSets.find(ps => ps.type === 'turnkey')?.products?.single}
                                        onChange={(value) => updateProductSet(null, 'single', value)}
                                        loading={loading}
                                        size="large"
                                        showSearch
                                        filterOption={(input, option) =>
                                            option.children.toLowerCase().includes(input.toLowerCase())
                                        }
                                    >
                                        {availableProducts.map(product => (
                                            <Option key={product.id} value={product.id}>
                                                {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                                            </Option>
                                        ))}
                                    </Select>
                                </Col>
                                <Col xs={24} md={8}>
                                    {(() => {
                                        const productId = productSets.find(ps => ps.type === 'turnkey')?.products?.single;
                                        if (productId) {
                                            const product = getProductById(productId);
                                            return product ? (
                                                <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                                                    <Text strong>${product.pricePerGallon}/gal</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
                                                </div>
                                            ) : null;
                                        }
                                        return null;
                                    })()}
                                </Col>
                            </Row>
                        )}
                    </Card>
                </div>
            )}

            {isFlatRate && (
                <div style={{ marginTop: isMobile ? 16 : 24 }}>
                    <Title level={4} style={{ fontSize: isMobile ? 18 : 20 }}>Select Products by Item Type</Title>
                    <Alert
                        message="Optional Product Selection"
                        description="Select products for each item type included in your quote."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />

                    {productSets.length === 0 ? (
                        <Empty description="No items selected in the previous step" />
                    ) : (
                        productSets.map(set => (
                            <Card
                                key={set.id}
                                size="small"
                                title={
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                                        gap: 8
                                    }}>
                                        <span style={{ fontSize: isMobile ? 13 : 14 }}>{set.label}</span>
                                        {/* Optional: Add Copy Button if we want to copy to all similar categories */}
                                    </div>
                                }
                                style={{ marginBottom: 12 }}
                            >
                                {productStrategy === 'GBB' ? (
                                    <Row gutter={isMobile ? 8 : 16}>
                                        {['good', 'better', 'best'].map(tier => (
                                            <Col xs={24} sm={8} key={tier}>
                                                <div style={{ padding: 10, background: tier === 'good' ? '#f0f0f0' : tier === 'better' ? '#e6f7ff' : '#f6ffed', borderRadius: 4, marginBottom: isMobile ? 12 : 0 }}>
                                                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                        <Tag color={tier === 'good' ? 'blue' : tier === 'better' ? 'cyan' : 'green'} style={{ fontSize: isMobile ? 11 : 12 }}>
                                                            {tier.toUpperCase()}
                                                        </Tag>
                                                        {set.products[tier] && (
                                                            <Button
                                                                size="small"
                                                                type="link"
                                                                icon={<CopyOutlined />}
                                                                onClick={() => copyProductToAllFlatRateItems(tier, set.products[tier])}
                                                                style={{ padding: 0, height: 'auto', fontSize: isMobile ? 11 : 12 }}
                                                            >
                                                                {isMobile ? 'Copy' : 'Copy All'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <Select
                                                        style={{ width: '100%' }}
                                                        placeholder={`Select ${tier}`}
                                                        value={set.products[tier]}
                                                        onChange={(val) => updateProductSet(set.id, tier, val)}
                                                        showSearch
                                                        filterOption={(input, option) => option.label && option.label.toLowerCase().includes(input.toLowerCase())}
                                                    >
                                                        {availableProducts.map(p => (
                                                            <Option key={p.id} value={p.id} label={`${p.brandName} - ${p.productName}`}>
                                                                {p.brandName} - {p.productName}
                                                            </Option>
                                                        ))}
                                                    </Select>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                ) : (
                                    <Row gutter={isMobile ? 8 : 16} align="middle">
                                        <Col xs={24} sm={16}>
                                            <Select
                                                style={{ width: '100%' }}
                                                placeholder="Select Product"
                                                value={set.products.single}
                                                onChange={(val) => updateProductSet(set.id, 'single', val)}
                                                showSearch
                                                filterOption={(input, option) => option.children && option.children.toLowerCase().includes(input.toLowerCase())}
                                            >
                                                {availableProducts.map(p => (
                                                    <Option key={p.id} value={p.id}>
                                                        {p.brandName} - {p.productName} ({p.pricePerGallon}/gal)
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Col>
                                        <Col xs={24} sm={8} style={{ marginTop: isMobile ? 8 : 0 }}>
                                            {set.products.single && (
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    icon={<CopyOutlined />}
                                                    onClick={() => copyProductToAllFlatRateItems('single', set.products.single)}
                                                    block={isMobile}
                                                >
                                                    Copy to All
                                                </Button>
                                            )}
                                        </Col>
                                    </Row>
                                )}
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Area-Wise Product Selection with Surfaces (Production/Rate Based Pricing) */}
            {(isProductionBased || isRateBased) && productSets.length > 0 && (
                <div style={{ marginTop: isMobile ? 16 : 24 }}>
                    <Title level={4} style={{ fontSize: isMobile ? 18 : 20 }}>Select Products by Area</Title>

                    {(() => {
                        const areasWithSurfaces = getAreasWithSurfaces();

                        if (areasWithSurfaces.length === 0) {
                            return (
                                <Alert
                                    message="No areas with surfaces selected"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />
                            );
                        }

                        // Build collapse items for each area
                        const collapseItems = areasWithSurfaces.map((area) => {
                            // Check if this area has all surfaces with products selected
                            const allSurfacesHaveProducts = area.surfaces.every(surface => {
                                // Find the specific product set for THIS surface
                                const set = productSets.find(ps =>
                                    ps.areaId === area.id &&
                                    (ps.surfaceType === surface.name || ps.surfaceType === surface.id)
                                );

                                if (!set) return false;
                                if (productStrategy === 'GBB') {
                                    return set.products.good || set.products.better || set.products.best;
                                } else {
                                    return set.products.single;
                                }
                            });

                            return {
                                key: area.id,
                                label: (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        width: '100%',
                                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                                        gap: 8
                                    }}>
                                        <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 500 }}>{area.name}</span>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {allSurfacesHaveProducts && (
                                                <Tag color="green" style={{ margin: 0, fontSize: isMobile ? 11 : 12 }}>Complete</Tag>
                                            )}
                                        </div>
                                    </div>
                                ),
                                children: (
                                    <div>
                                        {area.surfaces.length === 0 ? (
                                            <Text type="secondary">No surfaces selected for this area</Text>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
                                                {area.surfaces.map((surface, surfaceIdx) => {
                                                    // Find the product set for this specific area and surface
                                                    let set = productSets.find(ps =>
                                                        ps.areaId === area.id &&
                                                        (ps.surfaceType === surface.name || ps.surfaceType === surface.id)
                                                    );

                                                    // If not found, this is an error - log it
                                                    if (!set) {
                                                        console.error(`❌ No productSet found for area ${area.id} (${area.name}), surface ${surface.name}`);
                                                        console.log('📦 Available productSets:', productSets);
                                                        // Create placeholder to prevent crash
                                                        set = {
                                                            areaId: area.id,
                                                            surfaceType: surface.name || surface.id,
                                                            products: productStrategy === 'GBB'
                                                                ? { good: null, better: null, best: null }
                                                                : { single: null },
                                                            overridden: false
                                                        };
                                                    }

                                                    return (
                                                        <Card
                                                            key={surface.id || surfaceIdx}
                                                            size="small"
                                                            title={
                                                                <div style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                                                                    gap: 8
                                                                }}>
                                                                    <span style={{ fontSize: isMobile ? 13 : 14 }}>{surface.name || surface.id}</span>
                                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                                        {set.overridden && (
                                                                            <Tag color="orange" style={{ margin: 0, fontSize: isMobile ? 11 : 12 }}>Overridden</Tag>
                                                                        )}
                                                                        {surface.quantity && (
                                                                            <Tag color="blue" style={{ margin: 0, fontSize: isMobile ? 11 : 12 }}>
                                                                                {surface.quantity} {surface.unit || surface.sqft ? 'sqft' : ''}
                                                                            </Tag>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            }
                                                            style={{ marginBottom: 12 }}
                                                        >
                                                            {productStrategy === 'GBB' ? (
                                                                <Row gutter={isMobile ? 8 : 16}>
                                                                    {['good', 'better', 'best'].map(tier => (
                                                                        <Col xs={24} sm={8} key={tier}>
                                                                            <div style={{ padding: 10, background: tier === 'good' ? '#f0f0f0' : tier === 'better' ? '#e6f7ff' : '#f6ffed', borderRadius: 4, marginBottom: isMobile ? 12 : 0 }}>
                                                                                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                                                    <Tag color={tier === 'good' ? 'blue' : tier === 'better' ? 'cyan' : 'green'} style={{ fontSize: isMobile ? 11 : 12 }}>
                                                                                        {tier.toUpperCase()}
                                                                                    </Tag>
                                                                                    {set.products[tier] && (
                                                                                        <Button
                                                                                            size="small"
                                                                                            type="link"
                                                                                            icon={<CopyOutlined />}
                                                                                            onClick={() => copyProductToAllSurfaces(tier, set.products[tier])}
                                                                                            style={{ padding: 0, height: 'auto', fontSize: isMobile ? 11 : 12 }}
                                                                                        >
                                                                                            {isMobile ? 'Copy' : 'Copy All'}
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                                <Select
                                                                                    style={{ width: '100%' }}
                                                                                    placeholder={`Select ${tier}`}
                                                                                    value={set.products[tier]}
                                                                                    onChange={(val) => updateProductSet(area.id, tier, val, surface.name || surface.id)}
                                                                                    loading={loading}
                                                                                    size="small"
                                                                                    showSearch
                                                                                    filterOption={(input, option) => option.label && option.label.toLowerCase().includes(input.toLowerCase())}
                                                                                >
                                                                                    {getAvailableProductsForAreaTier(area.id, tier).map(product => (
                                                                                        <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName}`}>
                                                                                            {product.brandName} - {product.productName}
                                                                                        </Option>
                                                                                    ))}
                                                                                </Select>
                                                                            </div>
                                                                        </Col>
                                                                    ))}
                                                                </Row>
                                                            ) : (
                                                                <Row gutter={isMobile ? 8 : 16} align="middle">
                                                                    <Col xs={24} sm={16}>
                                                                        <Select
                                                                            style={{ width: '100%' }}
                                                                            placeholder="Select Product"
                                                                            value={set.products.single}
                                                                            onChange={(val) => updateProductSet(area.id, 'single', val, surface.name || surface.id)}
                                                                            loading={loading}
                                                                            size="small"
                                                                            showSearch
                                                                            filterOption={(input, option) => option.children && option.children.toLowerCase().includes(input.toLowerCase())}
                                                                        >
                                                                            {availableProducts.map(product => (
                                                                                <Option key={product.id} value={product.id}>
                                                                                    {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                                                                                </Option>
                                                                            ))}
                                                                        </Select>
                                                                    </Col>
                                                                    <Col xs={24} sm={8} style={{ marginTop: isMobile ? 8 : 0 }}>
                                                                        {set.products.single && (
                                                                            <Button
                                                                                size="small"
                                                                                type="link"
                                                                                icon={<CopyOutlined />}
                                                                                onClick={() => copyProductToAllAreas('single', set.products.single)}
                                                                                block={isMobile}
                                                                            >
                                                                                Copy to All
                                                                            </Button>
                                                                        )}
                                                                    </Col>
                                                                </Row>
                                                            )
                                                            }
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )
                                        }
                                    </div>
                                )
                            };
                        });

                        return (
                            <Collapse
                                items={collapseItems}
                                defaultActiveKey={areasWithSurfaces.length === 1 ? [areasWithSurfaces[0].id] : []}
                                style={{ marginBottom: isMobile ? 16 : 24 }}
                            />
                        );
                    })()}
                </div>
            )
            }

            {
                surfaceTypes.length === 0 && !isTurnkey && !isFlatRate && (
                    <Alert
                        message="No Surfaces Selected"
                        description="Please go back and select surfaces in the Areas step."
                        type="warning"
                        showIcon
                        style={{ marginTop: isMobile ? 16 : 24 }}
                    />
                )
            }

            <div

                style={{
                    marginTop: isMobile ? 24 : 32,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    gap: isMobile ? 12 : 0
                }}
            >
                <Button
                    size={isMobile ? 'middle' : 'large'}
                    onClick={onPrevious}
                    block={isMobile}
                >
                    Previous
                </Button>
                <Button
                    type="primary"
                    size={isMobile ? 'middle' : 'large'}
                    onClick={handleNext}
                    block={isMobile}
                >
                    Next: Review & Send
                </Button>
            </div>
        </div >
    );
};

ProductsStep.propTypes = {
    formData: PropTypes.shape({
        productStrategy: PropTypes.string,
        allowCustomerProductChoice: PropTypes.bool,
        productSets: PropTypes.array,
        pricingSchemeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        areas: PropTypes.array,
        jobType: PropTypes.string,
        pricingModelType: PropTypes.string,
    }).isRequired,
    onUpdate: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onPrevious: PropTypes.func.isRequired,
    pricingSchemes: PropTypes.array,
};

export default ProductsStep;