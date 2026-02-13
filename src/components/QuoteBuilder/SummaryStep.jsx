// src/components/QuoteBuilder/SummaryStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Descriptions, Divider, Input, Modal, Table, Tag, Space, Statistic, Collapse, Grid } from 'antd';
import { EditOutlined, SendOutlined, SaveOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { quoteBuilderApi } from '../../services/quoteBuilderApi';
import { apiService } from '../../services/apiService';
import loadingService from '../../services/loadingService';
import ProposalPreviewModal from './ProposalPreviewModal';
import { calculateGallonsNeeded } from '../../utils/paintUtils';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

/**
 * Helper function to detect pricing scheme category
 * @param {string} schemeType - The pricing scheme type
 * @returns {string} - Category: 'turnkey', 'rate_based', 'production_based', 'flat_rate', or 'unknown'
 */
const getPricingSchemeCategory = (schemeType) => {
    const TURNKEY_TYPES = ['turnkey', 'sqft_turnkey'];
    const RATE_BASED_TYPES = ['rate_based_sqft', 'sqft_labor_paint'];
    const PRODUCTION_TYPES = ['production_based', 'hourly_time_materials'];
    const FLAT_RATE_TYPES = ['flat_rate_unit', 'unit_pricing', 'room_flat_rate'];
    
    if (TURNKEY_TYPES.includes(schemeType)) return 'turnkey';
    if (RATE_BASED_TYPES.includes(schemeType)) return 'rate_based';
    if (PRODUCTION_TYPES.includes(schemeType)) return 'production_based';
    if (FLAT_RATE_TYPES.includes(schemeType)) return 'flat_rate';
    return 'unknown';
};

/**
 * Turnkey Pricing Summary Component
 * Displays simplified pricing for turnkey quotes (no detailed breakdown)
 */
const TurnkeyPricingSummary = ({ formData, calculatedQuote, turnkeyProducts = [] }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    const conditionMultipliers = {
        excellent: 1.00,
        good: 1.05,
        average: 1.12,
        fair: 1.25,
        poor: 1.45
    };
    
    const multiplier = conditionMultipliers[formData.conditionModifier] || 1.12;
    
    return (
        <Card title="Turnkey Pricing Summary" style={{ marginBottom: 16 }}>
            <Row gutter={isMobile ? 8 : 16}>
                <Col xs={24} sm={8}>
                    <Statistic
                        title="Home Size"
                        value={formData.homeSqft || 0}
                        suffix="sq ft"
                        valueStyle={{ fontSize: isMobile ? 16 : 20 }}
                    />
                </Col>
                <Col xs={24} sm={8}>
                    <Statistic
                        title="Base Rate"
                        value={calculatedQuote.baseRate || formData.baseRate || 0}
                        prefix="$"
                        suffix="/ sq ft"
                        precision={2}
                        valueStyle={{ fontSize: isMobile ? 16 : 20 }}
                    />
                </Col>
                <Col xs={24} sm={8}>
                    <Statistic
                        title="Condition Multiplier"
                        value={`${multiplier}x`}
                        valueStyle={{ fontSize: isMobile ? 16 : 20 }}
                    />
                </Col>
            </Row>
            
            <Divider />
            
            <Row gutter={isMobile ? 8 : 16}>
                <Col xs={24} sm={12}>
                    <Descriptions column={1} size="small">
                        <Descriptions.Item label="Job Type">
                            {formData.jobType === 'interior' ? 'Interior' : 
                             formData.jobType === 'exterior' ? 'Exterior' : 'Both'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Stories">
                            {formData.numberOfStories || 1} {formData.numberOfStories === 1 ? 'Story' : 'Stories'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Condition">
                            <Tag color={
                                formData.conditionModifier === 'excellent' ? 'green' :
                                formData.conditionModifier === 'good' ? 'blue' :
                                formData.conditionModifier === 'average' ? 'default' :
                                formData.conditionModifier === 'fair' ? 'orange' : 'red'
                            }>
                                {formData.conditionModifier?.charAt(0).toUpperCase() + 
                                 formData.conditionModifier?.slice(1)}
                            </Tag>
                        </Descriptions.Item>
                    </Descriptions>
                </Col>
                <Col xs={24} sm={12}>
                    <div style={{ textAlign: isMobile ? 'left' : 'right', marginTop: isMobile ? 16 : 0 }}>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                            Calculation:
                        </Text>
                        <div style={{ fontSize: isMobile ? '14px' : '16px', marginBottom: 8 }}>
                            {(formData.homeSqft || 0).toLocaleString()} sq ft × 
                            ${calculatedQuote.baseRate || formData.baseRate || 0} × {multiplier}
                        </div>
                        <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#1890ff' }}>
                            = ${calculatedQuote.total?.toLocaleString('en-US', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                            })}
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            All-inclusive base price
                        </Text>
                    </div>
                </Col>
            </Row>
            
            {calculatedQuote.productCost > 0 && (
                <>
                    <Divider />
                    <Row gutter={16}>
                        <Col xs={24}>
                            <Alert
                                message="Additional Product Costs"
                                description={
                                    <div>
                                        <Text>Premium products selected: ${calculatedQuote.productCost.toFixed(2)}</Text>
                                    </div>
                                }
                                type="info"
                                showIcon
                            />
                        </Col>
                    </Row>
                </>
            )}

            <Divider />

            <Row gutter={16}>
                <Col xs={24}>
                    <Statistic
                        title="Total Price"
                        value={calculatedQuote.total || 0}
                        prefix="$"
                        precision={2}
                        valueStyle={{ color: '#3f8600', fontWeight: 'bold', fontSize: '28px' }}
                    />
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        All-inclusive price (no tax applied)
                    </Text>

                    {turnkeyProducts && turnkeyProducts.length > 0 && (
                        <>
                            <Divider />
                            <Row>
                                <Col xs={24}>
                                    <Title level={5}>Selected Products</Title>
                                    {turnkeyProducts.map(p => (
                                        <Card size="small" key={`${p.tier}-${p.productId || p.productName}`} style={{ marginBottom: 8 }}>
                                            <Row>
                                                <Col span={6}><Text strong>{p.tier}</Text></Col>
                                                <Col span={10}><Text>{p.productName || 'Product'}</Text></Col>
                                                <Col span={4}><Text>${(p.pricePerGallon || 0).toFixed(2)}/gal</Text></Col>
                                                <Col span={4}><Text>{Math.ceil(p.quantity) || ''} {p.unit || ''}</Text></Col>
                                            </Row>
                                        </Card>
                                    ))}
                                </Col>
                            </Row>
                        </>
                    )}
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        All-inclusive price (no tax applied)
                    </Text>
                </Col>
            </Row>
            
            <Divider />
            
            <Alert
                message="Turnkey Pricing Includes Everything"
                description="This all-inclusive price covers labor, materials, preparation, overhead, profit, and tax. No hidden fees or additional charges."
                type="success"
                showIcon
            />
        </Card>
    );
};

const SummaryStep = ({ formData, onUpdate, onPrevious, onEdit, pricingSchemes, tierPricing, selectedTier }) => {
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    // Get current pricing scheme and detect category
    const currentScheme = pricingSchemes?.find(s => s.id === formData.pricingSchemeId);
    const schemeCategory = getPricingSchemeCategory(currentScheme?.type);
    const isTurnkey = schemeCategory === 'turnkey';
    const isProductionBased = schemeCategory === 'production_based';
    const isFlatRate = schemeCategory === 'flat_rate';
    
    // Check if GBB is enabled
    const gbbEnabled = tierPricing && tierPricing.gbbEnabled;
    const hasSelectedTier = selectedTier && gbbEnabled;

    // DEBUG: Log what we have
    console.log('=== SummaryStep Debug ===');
    console.log('formData.pricingSchemeId:', formData.pricingSchemeId);
    console.log('currentScheme:', currentScheme);
    console.log('isTurnkey:', isTurnkey);
    console.log('formData.homeSqft:', formData.homeSqft, 'type:', typeof formData.homeSqft);
    console.log('Condition check:', isTurnkey && (formData.homeSqft && parseFloat(formData.homeSqft) > 0));
    console.log('======================');

    const [notes, setNotes] = useState(formData.notes || '');
    const [calculatedQuote, setCalculatedQuote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [showProposalPreview, setShowProposalPreview] = useState(false);
    const [totalEstimatedHours, setTotalEstimatedHours] = useState(0);
    const [productsMap, setProductsMap] = useState({});

    // Calculate total estimated hours for production-based model
    useEffect(() => {
        if (isProductionBased && formData.areas && formData.contractorSettings?.productionRates) {
            let totalHours = 0;
            const prodRates = formData.contractorSettings.productionRates;
            const crewSize = formData.contractorSettings.other?.crewSize || 1;

            const getProductionRate = (categoryName) => {
                const keyMap = {
                    'Walls': 'interiorWalls',
                    'Ceilings': 'interiorCeilings',
                    'Trim': 'interiorTrim',
                    'Cabinets': 'cabinets',
                    'Doors': 'doors',
                    'Exterior Walls': 'exteriorWalls',
                    'Exterior Trim': 'exteriorTrim',
                    'Deck': 'deck',
                    'Fence': 'fence'
                };
                const key = keyMap[categoryName] || 'interiorWalls';
                return prodRates[key] || 300;
            };

            formData.areas.forEach(area => {
                if (area.laborItems) {
                    area.laborItems.forEach(item => {
                        if (item.quantity > 0) {
                            const productionRate = getProductionRate(item.categoryName);
                            const hours = (item.quantity / productionRate) / crewSize;
                            totalHours += hours;
                        }
                    });
                }
            });

            setTotalEstimatedHours(totalHours);
        }
    }, [isProductionBased, formData.areas, formData.contractorSettings]);

    useEffect(() => {
        // calculateQuote();
        fetchProducts();
    }, []);

    // Recalculate when key inputs change (areas, product sets, turnkey fields)
    useEffect(() => {
        calculateQuote();
    }, [
        JSON.stringify(formData.areas),
        JSON.stringify(formData.productSets),
        formData.pricingSchemeId,
        formData.jobType,
        formData.homeSqft,
        formData.jobType,
        formData.numberOfStories,
        formData.conditionModifier
    ]);

    useEffect(() => {
        onUpdate({ notes });
    }, [notes]);

    const fetchProducts = async () => {
        try {
            const response = await apiService.get('/contractor/product-configs');
            if (response.success) {
                const productMap = {};
                const list = response.data || [];
                list.forEach(config => {
                    // Support both custom and global products
                    let brandName, productName;
                    
                    if (config.isCustom && config.customProduct) {
                        // Custom product
                        brandName = config.customProduct.brandName || 'Custom';
                        productName = config.customProduct.name || 'Custom Product';
                    } else if (config.globalProduct) {
                        // Global product
                        brandName = config.globalProduct.brand?.name || 'Unknown';
                        productName = config.globalProduct.name || 'Unknown';
                    } else {
                        // Fallback
                        brandName = 'Unknown';
                        productName = 'Unknown Product';
                    }
                    
                    productMap[config.id] = {
                        brandName,
                        productName,
                        pricePerGallon: config.sheens?.[0]?.price || 0,
                        globalProductId: config.globalProductId,
                        isCustom: config.isCustom || false
                    };
                });
                
                // Also map by globalProductId so productSets using global ids resolve names
                list.forEach(config => {
                    if (config.globalProductId && !productMap[config.globalProductId]) {
                        let brandName, productName;
                        
                        if (config.isCustom && config.customProduct) {
                            brandName = config.customProduct.brandName || 'Custom';
                            productName = config.customProduct.name || 'Custom Product';
                        } else if (config.globalProduct) {
                            brandName = config.globalProduct.brand?.name || 'Unknown';
                            productName = config.globalProduct.name || 'Unknown';
                        } else {
                            brandName = 'Unknown';
                            productName = 'Unknown Product';
                        }
                        
                        productMap[config.globalProductId] = {
                            brandName,
                            productName,
                            pricePerGallon: config.sheens?.[0]?.price || 0,
                            globalProductId: config.globalProductId,
                            isCustom: config.isCustom || false
                        };
                    }
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
                {
                    distance: 0, // TODO: Calculate from customer address
                    homeSqft: formData.homeSqft,
                    jobType: formData.jobType,
                    numberOfStories: formData.numberOfStories,
                    conditionModifier: formData.conditionModifier,
                    flatRateItems: formData.flatRateItems, // CRITICAL: Pass flat rate items
                    // Material calculation settings
                    includeMaterials: formData.includeMaterials,
                    coverage: formData.coverage,
                    applicationMethod: formData.applicationMethod,
                    coats: formData.coats,
                    // Crew size and material toggle overrides
                    paintersOnSite: formData.paintersOnSite,
                    laborOnly: formData.laborOnly
                }
            );
            console.log('Calculate Quote Response:', response);
            console.log('Turnkey values - homeSqft:', formData.homeSqft, 'jobType:', formData.jobType, 'isTurnkey:', isTurnkey);
            if (response.success) {
                console.log('Setting calculatedQuote:', response.calculation);
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

            // CRITICAL FIX: Save the quote first if it doesn't have an ID
            let currentQuoteId = formData?.quoteId;
            if (!currentQuoteId) {
                console.log('[SummaryStep] No quote ID found, saving draft first...');
                
                const quoteData = {
                    ...formData,
                    notes,
                    status: 'draft',
                    calculation: calculatedQuote // Include the calculated quote data
                };

                const response = await quoteBuilderApi.saveDraft(quoteData);
                
                if (response.success && response.quote?.id) {
                    console.log('[SummaryStep] Quote saved with ID:', response.quote.id);
                    currentQuoteId = response.quote.id;
                    // Update formData with the new quote ID
                    onUpdate({ quoteId: currentQuoteId });
                } else {
                    throw new Error('Failed to save quote before sending');
                }
            }

            // Fetch email settings from backend using apiService
            let emailSettings = {};
            let companyName = 'Our Company';
            
            try {
                const settingsData = await apiService.get('/settings');
                if (settingsData.success && settingsData.data) {
                    const { data } = settingsData;
                    
                    // Extract email settings from Tenant
                    if (data.Tenant?.defaultEmailMessage) {
                        emailSettings = {
                            subject: data.Tenant.defaultEmailMessage.subject,
                            body: data.Tenant.defaultEmailMessage.body,
                            bodyHtml: data.Tenant.defaultEmailMessage.body
                        };
                    }
                    
                    // Extract company name
                    if (data.Tenant?.companyName) {
                        companyName = data.Tenant.companyName;
                    }
                }
            } catch (settingsError) {
                console.warn('Could not fetch email settings, using defaults:', settingsError);
                // Continue with default settings instead of failing
            }

            // Use email template from settings with defaults
            const emailData = {
                emailSubject: emailSettings.subject || `Your Painting Quote from ${companyName}`,
                emailBody: emailSettings.bodyHtml || emailSettings.body || `Hello ${formData.customerName},\n\nPlease find your painting quote attached. You can view and respond to this quote using the link below.\n\nThank you for considering our services!`
            };

            // Send the quote email directly
            const response = await quoteBuilderApi.sendQuote(currentQuoteId, emailData);

            Modal.success({
                title: 'Quote Sent Successfully!',
                content: (
                    <div>
                        <p>Quote #{currentQuoteId} has been sent to {formData.customerEmail}</p>
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
        // For flat rate pricing, show flat rate items instead of areas
        if (isFlatRate) {
            const flatRateItems = formData.flatRateItems || { interior: {}, exterior: {} };
            const items = [];

            // Add interior items
            Object.entries(flatRateItems.interior || {}).forEach(([key, count]) => {
                if (count > 0) {
                    const itemLabels = {
                        doors: 'Interior Doors',
                        smallRooms: 'Small Rooms',
                        mediumRooms: 'Medium Rooms',
                        largeRooms: 'Large Rooms',
                        closets: 'Closets',
                        accentWalls: 'Accent Walls',
                        cabinetFaces: 'Cabinet Faces',
                        cabinetDoors: 'Cabinet Doors'
                    };

                    items.push({
                        type: itemLabels[key] || key,
                        quantity: count,
                        unit: 'each',
                        coats: 0, // Not applicable for flat rate
                        gallons: 0, // Not applicable for flat rate
                        laborRate: formData.contractorSettings?.flatRateUnitPrices?.[key] || 0
                    });
                }
            });

            // Add exterior items
            Object.entries(flatRateItems.exterior || {}).forEach(([key, count]) => {
                if (count > 0) {
                    const itemLabels = {
                        doors: 'Exterior Doors',
                        windows: 'Windows',
                        garageDoors1Car: '1-Car Garage Doors',
                        garageDoors2Car: '2-Car Garage Doors',
                        garageDoors3Car: '3-Car Garage Doors',
                        shutters: 'Shutters'
                    };

                    items.push({
                        type: itemLabels[key] || key,
                        quantity: count,
                        unit: 'each',
                        coats: 0, // Not applicable for flat rate
                        gallons: 0, // Not applicable for flat rate
                        laborRate: formData.contractorSettings?.flatRateUnitPrices?.[key] || 0
                    });
                }
            });

            return [{
                areaName: 'Flat Rate Items',
                items,
                totalSqft: 0,
                totalGallons: 0
            }];
        }

        // Regular area-based display for other pricing models
        return (formData.areas || []).map(area => {
            let items = [];
            let totalSqft = 0;
            let totalGallons = 0;

            // New structure: laborItems
            if (area.laborItems) {
                const selectedItems = area.laborItems.filter(i => i.selected);
                items = selectedItems.map(item => {
                    // Calculate gallons for each item based on its type
                    let itemGallons = item.gallons || 0;

                    // If gallons not already calculated, calculate it
                    if (!itemGallons && item.numberOfCoats > 0) {
                        const qty = parseFloat(item.quantity) || 0;
                        const coats = parseInt(item.numberOfCoats) || 2;
                        const coverage = 350; // Standard coverage rate

                        if (item.measurementUnit === 'sqft') {
                            // For square footage items
                            itemGallons = (qty * coats) / coverage;
                        } else if (item.measurementUnit === 'linear_foot') {
                            // For linear footage (trim, etc.) - assume 6" width
                            const sqft = qty * 0.5; // 6 inches = 0.5 feet width
                            itemGallons = (sqft * coats) / coverage;
                        } else if (item.measurementUnit === 'unit') {
                            // For units (doors, cabinets) - estimate surface area
                            let estimatedSqft = 0;
                            const category = item.categoryName.toLowerCase();
                            if (category.includes('door')) {
                                estimatedSqft = qty * 21; // Standard door ~21 sq ft per side
                            } else if (category.includes('cabinet')) {
                                estimatedSqft = qty * 30; // Cabinet ~30 sq ft per unit
                            } else if (category.includes('window')) {
                                estimatedSqft = qty * 15; // Window ~15 sq ft
                            } else if (category.includes('shutter')) {
                                estimatedSqft = qty * 10; // Shutter ~10 sq ft per pair
                            } else {
                                estimatedSqft = qty * 20; // Generic estimate
                            }
                            itemGallons = (estimatedSqft * coats) / coverage;
                        }
                    }

                    return {
                        type: item.categoryName,
                        quantity: item.quantity,
                        unit: item.measurementUnit,
                        coats: item.numberOfCoats,
                        gallons: itemGallons,
                        laborRate: item.laborRate,
                        dimensions: item.dimensions ? `${item.dimensions.length}' x ${item.dimensions.width}'${item.dimensions.height ? ` x ${item.dimensions.height}'` : ''}` : null
                    };
                });

                // Calculate total square footage - only for sqft items
                totalSqft = selectedItems
                    .filter(i => i.measurementUnit === 'sqft')
                    .reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

                // Calculate total gallons from all items
                totalGallons = items.reduce((sum, i) => sum + (parseFloat(i.gallons) || 0), 0);
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
    const areaDetails = getAreaDetails();

    /**
     * Get product summary by surface type
     * Groups products selected for each surface type with tier and gallons
     */
    /**
     * Get product summary with correct routing based on pricing scheme
     * Routes to appropriate display function based on scheme category
     */
    const getSurfaceProductSummary = () => {
        // Determine which display logic to use based on pricing scheme
        const schemeCategory = getPricingSchemeCategory(currentScheme?.type);
        
        // Route to appropriate display function
        switch (schemeCategory) {
            case 'turnkey':
                // For surface-type rendering, build a surface-shaped summary that includes gallons
                return getTurnkeySurfaceSummary();
            case 'production_based':
            case 'rate_based':
                return getAreaWiseProductSummary();
            case 'flat_rate':
                return getFlatRateProductSummary();
            default:
                return [];
        }
    };

    /**
     * Turnkey: Whole-home product selection (no surface types)
     * Products are selected for the entire home, not per surface
     */
    const getTurnkeyProductSummary = () => {
        console.log("FormData Product Sets:", formData);
        if (!formData.productSets) return [];

        const summary = [];

        // Support two shapes:
        // 1) Legacy: formData.productSets.wholeHome = { good, better, best, single }
        // 2) New: formData.productSets is an Array of productSet objects with { type: 'turnkey', products: { good, better, best } }
        let wholeHomeProducts = null;
        if (Array.isArray(formData.productSets)) {
            // Find first turnkey productSet
            wholeHomeProducts = formData.productSets.find(ps => ps.type === 'turnkey' || (ps.id && String(ps.id).toLowerCase().includes('turnkey')))?.products || null;
        } else if (formData.productSets.wholeHome) {
            wholeHomeProducts = formData.productSets.wholeHome;
        }

        if (!wholeHomeProducts) return [];

        // Determine gallons for whole-home based on coverage/coats/homeSqft
        const coverage = calculatedQuote?.coverage || formData.coverage || 350;
        const coats = calculatedQuote?.coats || formData.coats || 2;
        const homeSqft = calculatedQuote?.homeSqft || formData.homeSqft || 0;
        const totalGallonsForHome = calculateGallonsNeeded(homeSqft, coats, coverage, { wasteFactor: 1.1, roundTo: 0.25 });

        // Check for Good-Better-Best strategy
        if (wholeHomeProducts.good || wholeHomeProducts.better || wholeHomeProducts.best) {
            ['good', 'better', 'best'].forEach(tier => {
                const productData = wholeHomeProducts[tier];
                if (!productData && productData !== 0) return;

                // productData may be an id (number/string) or an object { productId, productName, quantity, cost }
                let productId = null;
                let productName = null;
                let quantity = 0;
                let unit = 'gallons';
                let cost = 0;
                let pricePerGallon = 0;

                if (typeof productData === 'object') {
                    productId = productData.productId || productData.id || null;
                    productName = productData.productName || null;
                    quantity = productData.quantity || 0;
                    unit = productData.unit || 'gallons';
                    cost = productData.cost || 0;
                    pricePerGallon = productData.pricePerGallon || 0;
                } else {
                    productId = productData;
                }

                const productInfo = productsMap[productId] || {};

                summary.push({
                    tier: tier.charAt(0).toUpperCase() + tier.slice(1),
                    productName: productName || `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
                    productId,
                    // If a quantity is not explicitly stored, use the computed total gallons for whole-home
                    quantity: quantity || totalGallonsForHome || 0,
                    unit,
                    cost: cost || 0,
                    pricePerGallon: pricePerGallon || productInfo.pricePerGallon || 0
                });
            });
        }
        // Check for single product strategy
        else if (wholeHomeProducts.single) {
            const productData = wholeHomeProducts.single;
            if (productData) {
                let productId = null;
                let productName = null;
                let quantity = 0;
                let unit = 'gallons';
                let cost = 0;
                let pricePerGallon = 0;

                if (typeof productData === 'object') {
                    productId = productData.productId || productData.id || null;
                    productName = productData.productName || null;
                    quantity = productData.quantity || 0;
                    unit = productData.unit || 'gallons';
                    cost = productData.cost || 0;
                    pricePerGallon = productData.pricePerGallon || 0;
                } else {
                    productId = productData;
                }

                const productInfo = productsMap[productId] || {};

                summary.push({
                    tier: 'Selected',
                    productName: productName || `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
                    productId,
                    quantity: quantity || 0,
                    unit,
                    cost: cost || 0,
                    pricePerGallon: pricePerGallon || productInfo.pricePerGallon || 0
                });
            }
        }
        
        return summary;
    };

    /**
     * Build surface-shaped summary for turnkey displays
     * Returns array of surfaces with tiers and totalGallons so UI can render consistently
     */
    const getTurnkeySurfaceSummary = () => {
        if (!formData.productSets) return [];

        let wholeHomeProducts = null;
        if (Array.isArray(formData.productSets)) {
            wholeHomeProducts = formData.productSets.find(ps => ps.type === 'turnkey' || (ps.id && String(ps.id).toLowerCase().includes('turnkey')))?.products || null;
        } else if (formData.productSets.wholeHome) {
            wholeHomeProducts = formData.productSets.wholeHome;
        }
        if (!wholeHomeProducts) return [];

        const coverage = calculatedQuote?.coverage || formData.coverage || 350;
        const coats = calculatedQuote?.coats || formData.coats || 2;
        const homeSqft = calculatedQuote?.homeSqft || formData.homeSqft || 0;
        const totalGallons = calculateGallonsNeeded(homeSqft, coats, coverage, { wasteFactor: 1.1, roundTo: 0.25 });

        const tiersObj = {};
        ['good', 'better', 'best'].forEach(tier => {
            const productData = wholeHomeProducts[tier];
            if (!productData && productData !== 0) return;

            let productId = null;
            let productName = null;
            let pricePerGallon = 0;

            if (typeof productData === 'object') {
                productId = productData.productId || productData.id || null;
                productName = productData.productName || null;
                pricePerGallon = productData.pricePerGallon || 0;
            } else {
                productId = productData;
            }

            const productInfo = productsMap[productId] || {};

            tiersObj[tier] = {
                tier: tier.charAt(0).toUpperCase() + tier.slice(1),
                productId,
                productName: productName || `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
                pricePerGallon: pricePerGallon || productInfo.pricePerGallon || 0,
                gallons: totalGallons
            };
        });

        return [{
            surfaceType: 'Whole Home',
            surfaceId: 'wholeHome',
            totalGallons,
            tiers: tiersObj
        }];
    };

    /**
     * Flat Rate: Category-based organization
     * Products organized by interior/exterior categories
     */
    const getFlatRateProductSummary = () => {
        console.log('🎯 getFlatRateProductSummary called');
        console.log('📦 formData.productSets:', formData.productSets);
        console.log('🗺️ productsMap:', productsMap);
        
        if (!formData.productSets || !Array.isArray(formData.productSets)) {
            console.log('❌ No productSets array found');
            return [];
        }
        
        const summary = [];
        
        // Filter flat rate product sets
        const flatRateSets = formData.productSets.filter(ps => ps.type === 'flat_rate_item');
        console.log('🔍 Found flat rate sets:', flatRateSets);
        
        flatRateSets.forEach(set => {
            const category = set.category; // 'interior' or 'exterior'
            const itemType = set.label || set.surfaceType; // e.g., 'Interior Doors'
            
            // Get products for this item
            const products = [];
            
            if (formData.productStrategy === 'GBB' && set.products) {
                // Good-Better-Best strategy
                ['good', 'better', 'best'].forEach(tier => {
                    const productId = set.products[tier];
                    if (productId) {
                        const productInfo = productsMap[productId] || {};
                        products.push({
                            tier: tier.charAt(0).toUpperCase() + tier.slice(1),
                            productId,
                            productName: `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim() || 'Unknown Product',
                            pricePerGallon: productInfo.pricePerGallon || 0
                        });
                    }
                });
            } else if (set.products?.single) {
                // Single product strategy
                const productId = set.products.single;
                const productInfo = productsMap[productId] || {};
                products.push({
                    tier: 'Single',
                    productId,
                    productName: `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim() || 'Unknown Product',
                    pricePerGallon: productInfo.pricePerGallon || 0
                });
            }
            
            if (products.length > 0) {
                summary.push({
                    category: category.charAt(0).toUpperCase() + category.slice(1), // 'Interior' or 'Exterior'
                    itemType,
                    products
                });
            }
        });
        
        console.log('✅ Flat rate product summary:', summary);
        return summary;
    };

    /**
     * Get product summary organized by area and surface type
     * Used for area-wise pricing schemes (flat rate, production-based, rate-based)
     */
    const getAreaWiseProductSummary = () => {
        console.log('🏘️ getAreaWiseProductSummary called');
        console.log('📍 formData.areas:', formData.areas);
        console.log('📦 formData.productSets:', formData.productSets);
        console.log('🗺️ productsMap:', productsMap);

        const areasMap = {};

        // Build area structure from labor items
        (formData.areas || []).forEach(area => {
            console.log(`🏠 Processing area: ${area.name} (id: ${area.id})`);

            if (!areasMap[area.id]) {
                areasMap[area.id] = {
                    areaId: area.id,
                    areaName: area.name,
                    surfaces: {}
                };
            }

            // Process labor items for this area
            if (area.laborItems) {
                area.laborItems.forEach(item => {
                    if (item.selected) {
                        const surfaceType = item.categoryName;
                        console.log(`  📋 Processing surface: ${surfaceType} (selected: ${item.selected})`);

                        if (!areasMap[area.id].surfaces[surfaceType]) {
                            areasMap[area.id].surfaces[surfaceType] = {
                                surfaceType,
                                tiers: {},
                                quantity: item.quantity,
                                unit: item.measurementUnit,
                                totalGallons: 0,
                                totalCost: 0
                            };
                        }

                        // Find product set for this area+surface combination
                        const productSet = formData.productSets?.find(ps =>
                            ps.areaId === area.id && ps.surfaceType === surfaceType
                        );
                        console.log(`  🔍 Looking for productSet with areaId=${area.id}, surfaceType=${surfaceType}`);
                        console.log(`  ✅ Found productSet:`, productSet);

                        // GBB strategy - multiple tiers
                        if (productSet && formData.productStrategy === 'GBB' && productSet.products) {
                            console.log(`  🎯 Processing GBB tiers:`, productSet.products);
                            ['good', 'better', 'best'].forEach(tier => {
                                const productId = productSet.products[tier];
                                if (productId) {
                                    console.log(`    ✓ ${tier}: ${productId}`);
                                    const productInfo = productsMap[productId] || {};
                                    console.log(`    📦 Product info:`, productInfo);
                                    const gallons = calculateGallonsForAreaSurface(area.id, surfaceType);

                                    if (!areasMap[area.id].surfaces[surfaceType].tiers[tier]) {
                                        areasMap[area.id].surfaces[surfaceType].tiers[tier] = {
                                            tier: tier.charAt(0).toUpperCase() + tier.slice(1),
                                            productId,
                                            productName: `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
                                            pricePerGallon: productInfo.pricePerGallon || 0,
                                            gallons
                                        };
                                    }

                                    areasMap[area.id].surfaces[surfaceType].totalGallons += gallons;
                                    areasMap[area.id].surfaces[surfaceType].totalCost += (gallons * (productInfo.pricePerGallon || 0));
                                }
                            });
                        }
                        // Single product strategy
                        else if (productSet && productSet.products?.single) {
                            const productId = productSet.products.single;
                            const productInfo = productsMap[productId] || {};
                            const gallons = calculateGallonsForAreaSurface(area.id, surfaceType);

                            areasMap[area.id].surfaces[surfaceType].tiers['single'] = {
                                tier: 'Selected',
                                productId,
                                productName: `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
                                pricePerGallon: productInfo.pricePerGallon || 0,
                                gallons
                            };

                            areasMap[area.id].surfaces[surfaceType].totalGallons += gallons;
                            areasMap[area.id].surfaces[surfaceType].totalCost += (gallons * (productInfo.pricePerGallon || 0));
                        }
                    }
                });
            }
        });

        const result = Object.values(areasMap);
        console.log('🎁 getAreaWiseProductSummary result:', result);
        console.log('📊 Result length:', result.length);

        return result;
    };

    /**
     * Calculate gallons needed for a specific area and surface combination
     * Used in area-wise pricing schemes
     */
    const calculateGallonsForAreaSurface = (areaId, surfaceType) => {
        const area = formData.areas?.find(a => a.id === areaId);
        if (!area || !area.laborItems) return 0;

        let totalSqft = 0;
        const COVERAGE_PER_GALLON = 400;

        area.laborItems.forEach(item => {
            if (item.selected && item.categoryName === surfaceType) {
                const quantity = parseFloat(item.quantity) || 0;
                const coats = parseInt(item.numberOfCoats) || 1;

                // Convert different measurement units to sqft
                if (item.measurementUnit === 'sqft') {
                    totalSqft += quantity * coats;
                } else if (item.measurementUnit === 'linear_foot') {
                    // Assume 6 inches (0.5 ft) height for trim/linear
                    totalSqft += (quantity * 0.5) * coats;
                } else if (item.measurementUnit === 'unit') {
                    // Estimate sqft per unit based on surface type
                    let sqftPerUnit = 20; // default for doors
                    if (surfaceType.toLowerCase().includes('cabinet')) {
                        sqftPerUnit = 15;
                    } else if (surfaceType.toLowerCase().includes('window')) {
                        sqftPerUnit = 10;
                    }
                    totalSqft += (quantity * sqftPerUnit) * coats;
                }
            }
        });

        // Calculate gallons using shared utility (wasteFactor 1.1, round to 0.25)
        return calculateGallonsNeeded(totalSqft, 1, COVERAGE_PER_GALLON, { wasteFactor: 1.1, roundTo: 0.25 });
    };

    /**
     * Calculate total gallons needed for a specific surface type
     * Sums up all areas with that surface type based on coverage
     */
    const calculateGallonsForSurface = (surfaceType) => {
        let totalSqft = 0;

        // Sum square footage for all areas with this surface type
        (formData.areas || []).forEach(area => {
            if (area.laborItems) {
                area.laborItems.forEach(item => {
                    if (item.selected && item.categoryName === surfaceType && item.quantity) {
                        // For paint, quantity is in sqft
                        totalSqft += Number(item.quantity) || 0;
                    }
                });
            }
        });

        if (totalSqft === 0) return 0;

        // Calculate gallons needed based on coverage and coats
        const coverage = formData.coverage || 350; // sq ft per gallon
        const coats = formData.coats || 2; // number of coats

        return calculateGallonsNeeded(totalSqft, coats, coverage, { wasteFactor: 1.1, roundTo: 0.25 });
    };

    /**
     * Get running product totals by product ID
     * Shows which products are used and in how many gallons
     */
    const getRunningProductTotals = () => {
        const totals = {};
        const surfaceSummary = getSurfaceProductSummary();

        surfaceSummary.forEach(surface => {
            Object.values(surface.tiers || {}).forEach(tierInfo => {
                if (tierInfo.productId) {
                    if (!totals[tierInfo.productId]) {
                        totals[tierInfo.productId] = {
                            productName: tierInfo.productName,
                            pricePerGallon: tierInfo.pricePerGallon,
                            gallons: 0,
                            surfaceTypes: new Set()
                        };
                    }
                    totals[tierInfo.productId].gallons += tierInfo.gallons;
                    totals[tierInfo.productId].surfaceTypes.add(surface.surfaceType);
                }
            });
        });

        return totals;
    };

    const runningTotals = getRunningProductTotals();

    return (
        <div className="summary-step">
            <Alert
                message="Step 5: Review & Send Quote"
                description="Review all details and send the quote to your customer. They'll receive an email with a link to view and accept the quote."
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                style={{ marginBottom: isMobile ? 16 : 24 }}
            />

            {/* Pricing Model Display Banner */}
            {formData.pricingSchemeId && currentScheme && (
                <Card
                    style={{
                        marginBottom: 16,
                        backgroundColor: '#f0f5ff',
                        borderColor: '#1890ff',
                        borderWidth: 2
                    }}
                >
                    <div style={{ textAlign: 'center', padding: isMobile ? '4px' : '8px' }}>
                        <Tag color="purple" className='!whitespace-wrap' style={{ fontSize: isMobile ? 13 : 16, padding: isMobile ? '4px 10px' : '8px 16px', marginBottom: 8 }}>
                            {formData.pricingModelFriendlyName || currentScheme.name}
                        </Tag>
                        <div>
                            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                                {currentScheme.description ||
                                    (currentScheme.type.includes('turnkey') ? 'All-inclusive pricing based on total square footage' :
                                        currentScheme.type.includes('production') ? 'Time & materials with estimated hours' :
                                            currentScheme.type.includes('flat') || currentScheme.type.includes('unit') ? 'Fixed pricing per unit/item' :
                                                'Square foot based labor pricing')}
                            </Text>
                        </div>
                    </div>
                </Card>
            )}

            {/* GBB Tier Selection Display */}
            {hasSelectedTier && (
                <Card
                    style={{
                        marginBottom: 16,
                        backgroundColor: selectedTier === 'good' ? '#e6f7ff' : 
                                       selectedTier === 'better' ? '#f6ffed' : '#f9f0ff',
                        borderColor: selectedTier === 'good' ? '#1890ff' : 
                                    selectedTier === 'better' ? '#52c41a' : '#722ed1',
                        borderWidth: 2
                    }}
                >
                    <Row gutter={isMobile ? 8 : 16}>
                        <Col xs={24} sm={isMobile ? 24 : 12}>
                            <Space direction="vertical" size="small">
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Selected Tier:</Text>
                                </div>
                                <div>
                                    <Tag 
                                        color={selectedTier === 'good' ? 'blue' : 
                                               selectedTier === 'better' ? 'green' : 'purple'}
                                        style={{ fontSize: isMobile ? 16 : 18, padding: isMobile ? '6px 12px' : '8px 16px' }}
                                    >
                                        {selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Tier
                                    </Tag>
                                    {selectedTier === 'better' && (
                                        <Tag color="gold" style={{ marginLeft: 8 }}>Recommended</Tag>
                                    )}
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                        {tierPricing[selectedTier]?.tierDescription || 
                                         (selectedTier === 'good' ? 'Quality work at competitive prices' :
                                          selectedTier === 'better' ? 'Enhanced quality and attention to detail' :
                                          'Premium service with finest materials')}
                                    </Text>
                                </div>
                            </Space>
                        </Col>
                        <Col xs={24} sm={isMobile ? 24 : 12}>
                            <div style={{ textAlign: isMobile ? 'left' : 'right', marginTop: isMobile ? 16 : 0 }}>
                                <Statistic
                                    title="Total Price"
                                    value={tierPricing[selectedTier]?.total || 0}
                                    precision={2}
                                    prefix="$"
                                    valueStyle={{ 
                                        color: selectedTier === 'good' ? '#1890ff' : 
                                               selectedTier === 'better' ? '#52c41a' : '#722ed1',
                                        fontSize: isMobile ? 24 : 32,
                                        fontWeight: 'bold'
                                    }}
                                />
                                <Button
                                    type="link"
                                    icon={<EditOutlined />}
                                    onClick={() => onEdit(gbbEnabled ? 4 : 3)}
                                    style={{ marginTop: 8 }}
                                    size={isMobile ? 'small' : 'middle'}
                                >
                                    Change Tier
                                </Button>
                            </div>
                        </Col>
                    </Row>
                    
                    <Divider style={{ margin: '16px 0' }} />
                    
                    <Row gutter={isMobile ? 8 : 16}>
                        <Col xs={8}>
                            <Statistic
                                title="Labor Cost"
                                value={tierPricing[selectedTier]?.laborCost || 0}
                                precision={2}
                                prefix="$"
                                valueStyle={{ fontSize: isMobile ? 14 : 16 }}
                            />
                        </Col>
                        <Col xs={8}>
                            <Statistic
                                title="Material Cost"
                                value={tierPricing[selectedTier]?.materialCost || 0}
                                precision={2}
                                prefix="$"
                                valueStyle={{ fontSize: isMobile ? 14 : 16 }}
                            />
                        </Col>
                        <Col xs={8}>
                            <Statistic
                                title="Product Cost"
                                value={tierPricing[selectedTier]?.productCost || 0}
                                precision={2}
                                prefix="$"
                                valueStyle={{ fontSize: isMobile ? 14 : 16 }}
                            />
                        </Col>
                    </Row>
                </Card>
            )}

            {/* Tier Comparison - Show savings/premium vs other tiers */}
            {hasSelectedTier && tierPricing && (
                <Card
                    title="Tier Comparison"
                    size="small"
                    style={{ marginBottom: 16 }}
                >
                    <Row gutter={isMobile ? 8 : 16}>
                        {['good', 'better', 'best'].map(tier => {
                            if (tier === selectedTier) return null;
                            
                            const tierTotal = tierPricing[tier]?.total || 0;
                            const selectedTotal = tierPricing[selectedTier]?.total || 0;
                            const difference = tierTotal - selectedTotal;
                            const percentDiff = selectedTotal > 0 ? ((difference / selectedTotal) * 100).toFixed(1) : 0;
                            const isCheaper = difference < 0;
                            
                            return (
                                <Col xs={24} sm={12} key={tier}>
                                    <div style={{ 
                                        padding: '12px', 
                                        background: '#fafafa', 
                                        borderRadius: '4px',
                                        border: '1px solid #d9d9d9'
                                    }}>
                                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                            <div>
                                                <Tag color={tier === 'good' ? 'blue' : tier === 'better' ? 'green' : 'purple'}>
                                                    {tier.charAt(0).toUpperCase() + tier.slice(1)} Tier
                                                </Tag>
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: 16 }}>
                                                    ${tierTotal.toFixed(2)}
                                                </Text>
                                            </div>
                                            <div>
                                                <Text 
                                                    type={isCheaper ? 'success' : 'danger'}
                                                    style={{ fontSize: 13 }}
                                                >
                                                    {isCheaper ? (
                                                        <>Save ${Math.abs(difference).toFixed(2)} ({Math.abs(percentDiff)}%)</>
                                                    ) : (
                                                        <>+${difference.toFixed(2)} ({percentDiff}% more)</>
                                                    )}
                                                </Text>
                                            </div>
                                        </Space>
                                    </div>
                                </Col>
                            );
                        })}
                    </Row>
                </Card>
            )}

            {/* Customer Information */}
            <Card
                title={
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        gap: isMobile ? 8 : 0
                    }}>
                        <span style={{ fontSize: isMobile ? 16 : 18 }}>Customer Information</span>
                        <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => onEdit(0)}
                            size={isMobile ? 'small' : 'middle'}
                            style={{ padding: isMobile ? '0' : undefined }}
                        >
                            Edit
                        </Button>
                    </div>
                }
                style={{ marginBottom: 16 }}
            >
                <Descriptions 
                    column={isMobile ? 1 : 2}
                    size={isMobile ? 'small' : 'default'}
                    labelStyle={{ 
                        fontWeight: 600,
                        fontSize: isMobile ? 13 : 14
                    }}
                    contentStyle={{
                        fontSize: isMobile ? 13 : 14
                    }}
                >
                    <Descriptions.Item label="Name">{formData.customerName}</Descriptions.Item>
                    <Descriptions.Item label="Email">
                        <div style={{ 
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}>
                            {formData.customerEmail}
                        </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone">{formData.customerPhone}</Descriptions.Item>
                    <Descriptions.Item label="Address" span={isMobile ? 1 : 1}>
                        <div style={{ 
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}>
                            {formData.street}, {formData.city}, {formData.state} {formData.zipCode}
                        </div>
                    </Descriptions.Item>
                    {formData.pricingSchemeId && (
                        <Descriptions.Item  label="Pricing Scheme" span={isMobile ? 1 : 2}>
                            <Tag 
                                color="blue"
                                style={{ 
                                    fontSize: isMobile ? 12 : 14,
                                    padding: isMobile ? '2px 8px' : '4px 12px',
                                    wordBreak: 'break-all'
                                }}
                            >
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

            {/* Job Type - Hidden for Turnkey */}
            {!isTurnkey && (
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
            )}

            {/* Home Size & Scope - Shown for Turnkey */}
            {isTurnkey && (formData.homeSqft && parseFloat(formData.homeSqft) > 0) && (
                <Card
                    title={
                        <Space>
                            <span>Home Size & Scope</span>
                            <Button
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => onEdit(2)}
                                size={isMobile ? 'small' : 'middle'}
                            >
                                Edit
                            </Button>
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                >
                    <Descriptions column={isMobile ? 1 : 2}>
                        <Descriptions.Item label="Home Square Footage">{parseFloat(formData.homeSqft).toLocaleString()} sq ft</Descriptions.Item>
                        <Descriptions.Item label="Job Type">
                            <Tag color={formData.jobType === 'interior' ? 'blue' : formData.jobType === 'exterior' ? 'green' : 'purple'}>
                                {formData.jobType === 'interior' ? 'Interior Only' : formData.jobType === 'exterior' ? 'Exterior Only' : 'Both Interior & Exterior'}
                            </Tag>
                        </Descriptions.Item>
                        {formData.numberOfStories && (
                            <Descriptions.Item label="Number of Stories">
                                {formData.numberOfStories === 1 ? 'Single Story' : formData.numberOfStories === 2 ? 'Two Story' : 'Three Story+'}
                            </Descriptions.Item>
                        )}
                        {formData.conditionModifier && (
                            <Descriptions.Item label="Property Condition">
                                <Tag color={
                                    formData.conditionModifier === 'excellent' ? 'green' :
                                        formData.conditionModifier === 'good' ? 'blue' :
                                            formData.conditionModifier === 'average' ? 'default' :
                                                formData.conditionModifier === 'fair' ? 'orange' : 'red'
                                }>
                                    {formData.conditionModifier.charAt(0).toUpperCase() + formData.conditionModifier.slice(1)}
                                </Tag>
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                </Card>
            )}

            {/* Areas & Surfaces - Hidden for Turnkey and Flat Rate */}
            {!isTurnkey && !isFlatRate && (
                <Card
                    title={
                        <Space>
                            <span>Areas & Surfaces</span>
                            <Button
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => onEdit(2)}
                                size={isMobile ? 'small' : 'middle'}
                            >
                                Edit
                            </Button>
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                >
                    {areaDetails.map(area => (
                        <div key={area.areaName} style={{ marginBottom: 16 }}>
                            <Title level={5} style={{ fontSize: isMobile ? 16 : 18 }}>{area.areaName}</Title>
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={area.items}
                                rowKey={(record, index) => index}
                                scroll={{ x: isMobile ? 800 : undefined }}
                                columns={[
                                    { 
                                        title: 'Category', 
                                        dataIndex: 'type', 
                                        key: 'type',
                                        width: isMobile ? 120 : undefined,
                                        ellipsis: isMobile
                                    },
                                    {
                                        title: 'Quantity',
                                        dataIndex: 'quantity',
                                        key: 'quantity',
                                        width: isMobile ? 80 : undefined,
                                        render: (val) => val || 'N/A'
                                    },
                                    {
                                        title: 'Unit',
                                        dataIndex: 'unit',
                                        key: 'unit',
                                        width: isMobile ? 70 : undefined,
                                        render: (val) => val === 'sqft' ? 'sq ft' : val === 'linear_foot' ? 'LF' : val === 'unit' ? 'units' : val === 'hour' ? 'hrs' : val || '-'
                                    },
                                    ...(!isFlatRate ? [
                                        {
                                            title: 'Coats',
                                            dataIndex: 'coats',
                                            key: 'coats',
                                            width: isMobile ? 70 : undefined,
                                            render: (val) => val > 0 ? `${val} coat${val > 1 ? 's' : ''}` : '-'
                                        },
                                        {
                                            title: 'Gallons',
                                            dataIndex: 'gallons',
                                            key: 'gallons',
                                            width: isMobile ? 80 : undefined,
                                            render: (val) => {
                                                if (!val || val === 0) return '-';
                                                return val < 1 ? `${val.toFixed(2)} gal` : `${Math.ceil(val)} gal`;
                                            }
                                        }
                                    ] : []),
                                    {
                                        title: 'Labor Rate',
                                        dataIndex: 'laborRate',
                                        key: 'laborRate',
                                        width: isMobile ? 90 : undefined,
                                        render: (val, record) => {
                                            if (!val) return '-';
                                            if (isFlatRate) {
                                                // Flat-rate: show fixed price per item
                                                return `$${val}/item`;
                                            }
                                            return `$${val}/${record.unit === 'sqft' ? 'sqft' : record.unit === 'linear_foot' ? 'LF' : record.unit === 'unit' ? 'unit' : 'hr'}`;
                                        }
                                    },
                                    ...(!isFlatRate ? [
                                        { 
                                            title: 'Dimensions', 
                                            dataIndex: 'dimensions', 
                                            key: 'dimensions', 
                                            width: isMobile ? 100 : undefined,
                                            ellipsis: isMobile,
                                            render: (val) => val || '-' 
                                        }
                                    ] : []),
                                ]}
                            />
                            {!isFlatRate && (
                                <Space style={{ marginTop: 8 }} wrap>
                                    {area.totalSqft > 0 && <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Total Area: {area.totalSqft.toFixed(0)} sq ft</Text>}
                                    {area.totalGallons > 0 && <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>• Total Gallons: {Math.ceil(area.totalGallons)} gal</Text>}
                                </Space>
                            )}
                            {isFlatRate && (
                                <Space style={{ marginTop: 8 }}>
                                    <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Total Items: {area.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</Text>
                                </Space>
                            )}
                        </div>
                    ))}
                </Card>
            )}

            {/* Flat Rate Items - Shown ONLY for Flat Rate */}
            {isFlatRate && (
                <Card
                    title={
                        <Space>
                            <span>Flat Rate Items</span>
                            <Button
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => onEdit(2)}
                                size={isMobile ? 'small' : 'middle'}
                            >
                                Edit
                            </Button>
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                >
                    {/* Display from calculation breakdown if available */}
                    {calculatedQuote && calculatedQuote.breakdown && calculatedQuote.breakdown.length > 0 ? (
                        <Table
                            size="small"
                            pagination={false}
                            dataSource={calculatedQuote.breakdown}
                            rowKey={(record, index) => `${record.category}-${record.itemKey}-${index}`}
                            scroll={{ x: isMobile ? 700 : undefined }}
                            columns={[
                                { 
                                    title: 'Item Type', 
                                    dataIndex: 'itemName', 
                                    key: 'itemName',
                                    width: isMobile ? 150 : undefined,
                                    ellipsis: isMobile,
                                    render: (val, record) => (
                                        <Space wrap>
                                            <Text style={{ fontSize: isMobile ? 13 : 14 }}>{val}</Text>
                                            <Tag color={record.category === 'Interior' ? 'blue' : 'green'} style={{ fontSize: isMobile ? 11 : 12 }}>
                                                {record.category}
                                            </Tag>
                                        </Space>
                                    )
                                },
                                {
                                    title: 'Quantity',
                                    dataIndex: 'quantity',
                                    key: 'quantity',
                                    width: isMobile ? 80 : undefined,
                                    render: (val) => val || 'N/A'
                                },
                                {
                                    title: 'Unit',
                                    key: 'unit',
                                    width: isMobile ? 70 : undefined,
                                    render: () => 'each'
                                },
                                {
                                    title: 'Unit Price',
                                    dataIndex: 'unitPrice',
                                    key: 'unitPrice',
                                    width: isMobile ? 90 : undefined,
                                    render: (val) => val ? `$${val.toFixed(2)}` : '-'
                                },
                                {
                                    title: 'Total',
                                    dataIndex: 'cost',
                                    key: 'cost',
                                    width: isMobile ? 90 : undefined,
                                    render: (val) => val ? `$${val.toFixed(2)}` : '-',
                                    align: 'right'
                                }
                            ]}
                            summary={(pageData) => {
                                const totalItems = pageData.reduce((sum, item) => sum + (item.quantity || 0), 0);
                                const totalCost = pageData.reduce((sum, item) => sum + (item.cost || 0), 0);
                                return (
                                    <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                                        <Table.Summary.Cell index={0}>
                                            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>Total</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={1}>
                                            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>{totalItems}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={2} />
                                        <Table.Summary.Cell index={3} />
                                        <Table.Summary.Cell index={4} align="right">
                                            <Text strong style={{ color: '#1890ff', fontSize: isMobile ? 13 : 14 }}>
                                                ${totalCost.toFixed(2)}
                                            </Text>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                );
                            }}
                        />
                    ) : (
                        // Fallback to formData if calculation not available
                        areaDetails.map(area => (
                            <div key={area.areaName} style={{ marginBottom: 16 }}>
                                <Title level={5} style={{ fontSize: isMobile ? 16 : 18 }}>{area.areaName}</Title>
                                <Table
                                    size="small"
                                    pagination={false}
                                    dataSource={area.items}
                                    rowKey={(record, index) => index}
                                    scroll={{ x: isMobile ? 600 : undefined }}
                                    columns={[
                                        { 
                                            title: 'Item Type', 
                                            dataIndex: 'type', 
                                            key: 'type',
                                            width: isMobile ? 150 : undefined,
                                            ellipsis: isMobile
                                        },
                                        {
                                            title: 'Quantity',
                                            dataIndex: 'quantity',
                                            key: 'quantity',
                                            width: isMobile ? 80 : undefined,
                                            render: (val) => val || 'N/A'
                                        },
                                        {
                                            title: 'Unit',
                                            dataIndex: 'unit',
                                            key: 'unit',
                                            width: isMobile ? 70 : undefined,
                                            render: (val) => val === 'each' ? 'each' : val || '-'
                                        },
                                        {
                                            title: 'Unit Price',
                                            dataIndex: 'laborRate',
                                            key: 'laborRate',
                                            width: isMobile ? 90 : undefined,
                                            render: (val) => val ? `$${val.toFixed(2)}` : '-'
                                        }
                                    ]}
                                />
                                <Space style={{ marginTop: 8 }}>
                                    <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Total Items: {area.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</Text>
                                </Space>
                            </div>
                        ))
                    )}
                </Card>
            )}

            {/* Products by Surface Type */}
            <Card
                title={
                    <Space>
                        <span>{isFlatRate || currentScheme?.type === 'production_based' ? 'Products by Area & Surface' : 'Product Selections by Surface Type'}</span>
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
                    <strong>Strategy:</strong> {formData.productStrategy === 'GBB' ? 'Good-Better-Best' : 'Single Product'}
                </Paragraph>

                {(() => {
                    const surfaceSummary = getSurfaceProductSummary();

                    console.log('🎨 Rendering products - surfaceSummary:', surfaceSummary);

                    if (surfaceSummary.length === 0) {
                        return (
                            <Alert
                                message="No products selected"
                                description="Products will appear here after you select them in Step 4."
                                type="info"
                                showIcon
                            />
                        );
                    }

                    // Flat Rate specific display (organized by category and item type)
                    if (isFlatRate && surfaceSummary[0]?.category) {
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {surfaceSummary.map((item, index) => (
                                    <Card key={index} size="small" style={{ backgroundColor: '#fafafa', borderRadius: '4px' }}>
                                        <Row gutter={isMobile ? 8 : 16} align="middle">
                                            <Col xs={24} md={6}>
                                                <div style={{ marginBottom: isMobile ? 12 : 0 }}>
                                                    <Space wrap>
                                                        <Text strong style={{ fontSize: isMobile ? 14 : 16 }}>{item.itemType}</Text>
                                                        <Tag color={item.category === 'Interior' ? 'blue' : 'green'} style={{ fontSize: isMobile ? 11 : 12 }}>
                                                            {item.category}
                                                        </Tag>
                                                    </Space>
                                                </div>
                                            </Col>
                                            <Col xs={24} md={18}>
                                                <Space direction="vertical" style={{ width: '100%' }} size="small">
                                                    {item.products.map((product, pIndex) => (
                                                        <div key={pIndex} style={{ padding: '8px', background: '#fff', borderRadius: '4px', border: '1px solid #e8e8e8' }}>
                                                            <Row gutter={[8, 8]} align="middle">
                                                                <Col flex="auto">
                                                                    <Space direction="vertical" size={0}>
                                                                        <Space>
                                                                            <Tag color={
                                                                                product.tier === 'Good' ? 'blue' :
                                                                                product.tier === 'Better' ? 'cyan' :
                                                                                product.tier === 'Best' ? 'green' : 'default'
                                                                            }>
                                                                                {product.tier}
                                                                            </Tag>
                                                                            <Text strong>{product.productName}</Text>
                                                                        </Space>
                                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                                            ${product.pricePerGallon || 0}/gallon
                                                                        </Text>
                                                                    </Space>
                                                                </Col>
                                                            </Row>
                                                        </div>
                                                    ))}
                                                </Space>
                                            </Col>
                                        </Row>
                                    </Card>
                                ))}
                            </div>
                        );
                    }

                    // Check if we have area-wise data (has areaId field)
                    const hasAreaWiseData = surfaceSummary[0]?.areaId !== undefined;
                    console.log('🔍 hasAreaWiseData:', hasAreaWiseData, 'First item:', surfaceSummary[0]);

                    // Area-wise display (when products are organized by area + surface)
                    if (hasAreaWiseData) {
                        // Calculate product totals across all areas and surfaces
                        const productTotals = {};
                        surfaceSummary.forEach(area => {
                            Object.values(area.surfaces || {}).forEach(surface => {
                                Object.values(surface.tiers || {}).forEach(tierInfo => {
                                    if (tierInfo.productId) {
                                        const key = tierInfo.productId;
                                        if (!productTotals[key]) {
                                            productTotals[key] = {
                                                productName: tierInfo.productName,
                                                pricePerGallon: tierInfo.pricePerGallon,
                                                totalGallons: 0,
                                                totalCost: 0,
                                                usedIn: []
                                            };
                                        }
                                        productTotals[key].totalGallons += tierInfo.gallons || 0;
                                        productTotals[key].totalCost += (tierInfo.gallons || 0) * (tierInfo.pricePerGallon || 0);
                                        productTotals[key].usedIn.push(`${area.areaName} - ${surface.surfaceType}`);
                                    }
                                });
                            });
                        });

                        const collapseItems = surfaceSummary.map(area => {
                            // Calculate area totals
                            const areaTotalGallons = Object.values(area.surfaces || {}).reduce((sum, surface) => sum + (surface.totalGallons || 0), 0);
                            const areaTotalCost = Object.values(area.surfaces || {}).reduce((sum, surface) => sum + (surface.totalCost || 0), 0);
                            const surfaceCount = Object.keys(area.surfaces || {}).length;

                            // Create nested collapse items for surfaces
                            const surfaceCollapseItems = Object.entries(area.surfaces || {}).map(([surfaceKey, surface]) => ({
                                key: surfaceKey,
                                label: (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 16 }}>
                                        <Space>
                                            <Text strong>{surface.surfaceType}</Text>
                                            <Tag color="geekblue" style={{ fontSize: 11 }}>
                                                {surface.quantity} {surface.unit === 'sqft' ? 'sq ft' : surface.unit}
                                            </Tag>
                                        </Space>
                                        <Text strong style={{ color: '#1890ff', fontSize: 13 }}>
                                            ${surface.totalCost.toFixed(2)}
                                        </Text>
                                    </div>
                                ),
                                children: (
                                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                                        {Object.entries(surface.tiers || {}).length === 0 ? (
                                            <Text type="secondary">No product selected</Text>
                                        ) : (
                                            Object.entries(surface.tiers || {}).map(([tierKey, tierInfo]) => (
                                                <div key={tierKey} style={{ padding: '10px 12px', background: '#fafafa', borderRadius: '4px', border: '1px solid #e8e8e8' }}>
                                                    <Row gutter={[8, 8]} align="middle">
                                                        <Col flex="auto">
                                                            <Space direction="vertical" size={0}>
                                                                <Space>
                                                                    <Tag color={
                                                                        tierInfo.tier === 'Good' ? 'blue' :
                                                                            tierInfo.tier === 'Better' ? 'cyan' :
                                                                                tierInfo.tier === 'Best' ? 'green' : 'default'
                                                                    } style={{ fontSize: 11 }}>
                                                                        {tierInfo.tier}
                                                                    </Tag>
                                                                    <Text strong style={{ fontSize: 13 }}>{tierInfo.productName || 'Unknown'}</Text>
                                                                </Space>
                                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                                    ${tierInfo.pricePerGallon || 0}/gallon
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
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        width: '100%', 
                                        paddingRight: isMobile ? 8 : 16,
                                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                                        gap: 8
                                    }}>
                                        <Space wrap>
                                            <Text strong style={{ fontSize: isMobile ? 14 : 15 }}>{area.areaName}</Text>
                                            <Tag color="blue" style={{ fontSize: isMobile ? 11 : 12, margin: 0 }}>
                                                {surfaceCount} surface{surfaceCount !== 1 ? 's' : ''}
                                            </Tag>
                                        </Space>
                                        <Space wrap>
                                            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                                                {Math.ceil(areaTotalGallons)} gal
                                            </Text>
                                            <Text strong style={{ fontSize: isMobile ? 13 : 14, color: '#1890ff' }}>
                                                ${areaTotalCost.toFixed(2)}
                                            </Text>
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
                                    defaultActiveKey={surfaceSummary.length === 1 ? [surfaceSummary[0].areaId] : []}
                                    style={{ backgroundColor: '#fafafa', marginBottom: 24 }}
                                />

                                {/* Product Totals Summary */}
                                {Object.keys(productTotals).length > 0 && (
                                    <Card
                                        title="Product Summary (Total Gallons Required)"
                                        size="small"
                                        style={{ marginTop: 16, backgroundColor: '#f0f5ff', borderColor: '#adc6ff' }}
                                    >
                                        <Space direction="vertical" style={{ width: '100%' }} size={isMobile ? 'small' : 'middle'}>
                                            {Object.entries(productTotals).map(([productId, totals]) => (
                                                <div key={productId} style={{ padding: isMobile ? '10px' : '12px', background: '#fff', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
                                                    <Row gutter={isMobile ? 8 : 16} align="middle">
                                                        <Col xs={24} sm="auto" flex={isMobile ? undefined : "auto"}>
                                                            <Space direction="vertical" size={2}>
                                                                <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>{totals.productName}</Text>
                                                                <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
                                                                    ${totals.pricePerGallon}/gallon • Used in {totals.usedIn.length} location{totals.usedIn.length !== 1 ? 's' : ''}
                                                                </Text>
                                                            </Space>
                                                        </Col>
                                                        <Col xs={24} sm="auto" style={{ marginTop: isMobile ? 8 : 0 }}>
                                                            <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                                                <div>
                                                                    <Text strong style={{ fontSize: isMobile ? 14 : 16, color: '#1890ff' }}>
                                                                        {Math.ceil(totals.totalGallons)} gallons
                                                                    </Text>
                                                                </div>
                                                                <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
                                                                    Total: ${totals.totalCost.toFixed(2)}
                                                                </Text>
                                                            </div>
                                                        </Col>
                                                    </Row>
                                                </div>
                                            ))}
                                        </Space>
                                    </Card>
                                )}
                            </>
                        );
                    }

                    // Global surface-type display (for turnkey)
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {surfaceSummary.map(surface => (
                                <Card key={surface.surfaceType} size="small" style={{ backgroundColor: '#fafafa', borderRadius: '4px' }}>
                                    <Row gutter={isMobile ? 8 : 16} align="middle">
                                        <Col xs={24} md={6}>
                                            <div style={{ marginBottom: isMobile ? 12 : 0 }}>
                                                <Text strong style={{ fontSize: isMobile ? 14 : 16 }}>{surface.surfaceType}</Text>
                                                <br />
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    {Math.ceil(surface.totalGallons)} gallons needed
                                                </Text>
                                            </div>
                                        </Col>
                                        <Col xs={24} md={18}>
                                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                                                {Object.entries(surface.tiers || {}).map(([tierKey, tierInfo]) => (
                                                    <div key={tierKey} style={{ padding: '8px', background: '#fff', borderRadius: '4px', border: '1px solid #e8e8e8' }}>
                                                        <Row gutter={[8, 8]} align="middle">
                                                            <Col flex="auto">
                                                                <Space direction="vertical" size={0}>
                                                                    <Space>
                                                                        <Tag color={
                                                                            tierInfo.tier === 'Good' ? 'blue' :
                                                                                tierInfo.tier === 'Better' ? 'cyan' :
                                                                                    tierInfo.tier === 'Best' ? 'green' : 'default'
                                                                        }>
                                                                            {tierInfo.tier}
                                                                        </Tag>
                                                                        <Text strong>{tierInfo.productName || 'Unknown Product'}</Text>
                                                                    </Space>
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        ${tierInfo.pricePerGallon || 0}/gallon
                                                                    </Text>
                                                                </Space>
                                                            </Col>
                                                            <Col>
                                                                <div style={{ textAlign: 'right' }}>
                                                                    <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                                                                        {Math.ceil(tierInfo.gallons)} gal
                                                                    </Text>
                                                                    <br />
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        ${(tierInfo.gallons * tierInfo.pricePerGallon).toFixed(2)}
                                                                    </Text>
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                ))}
                                            </Space>
                                        </Col>
                                    </Row>
                                </Card>
                            ))}
                        </div>
                    );
                })()}

            </Card>

            {/* Running Product Totals - Aggregated Across Surfaces */}
            {(() => {
                const runningTotals = getRunningProductTotals();
                const totalProducts = Object.keys(runningTotals).length;

                if (totalProducts === 0) return null;

                return (
                    <Card
                        title={
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: isMobile ? 14 : 16 }}>Selected Products Summary</span>
                                <Tag color="blue" style={{ fontSize: isMobile ? 11 : 12 }}>
                                    {totalProducts} unique product{totalProducts > 1 ? 's' : ''}
                                </Tag>
                            </div>
                        }
                        style={{ marginBottom: 16, borderColor: '#1890ff', borderWidth: 1 }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
                            {Object.entries(runningTotals).map(([productId, info]) => (
                                <div
                                    key={productId}
                                    style={{
                                        display: 'flex',
                                        flexDirection: isMobile ? 'column' : 'row',
                                        justifyContent: 'space-between',
                                        alignItems: isMobile ? 'flex-start' : 'center',
                                        padding: isMobile ? '10px' : '12px',
                                        background: '#f5f7fa',
                                        borderRadius: '4px',
                                        border: '1px solid #d9d9d9',
                                        gap: isMobile ? 8 : 0
                                    }}
                                >
                                    <div>
                                        <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>{info.productName}</Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
                                            Used on: {Array.from(info.surfaceTypes).join(', ')}
                                        </Text>
                                    </div>
                                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                                        <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 'bold', color: '#1890ff' }}>
                                            {Math.ceil(info.gallons)} gal
                                        </div>
                                        <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
                                            @ ${info.pricePerGallon}/gal
                                        </Text>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Divider style={{ margin: isMobile ? '12px 0' : '16px 0' }} />

                        <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                            <Text strong style={{ display: 'block', fontSize: isMobile ? 13 : 14 }}>
                                Total Gallons: {Math.ceil(Object.values(runningTotals).reduce((sum, p) => sum + p.gallons, 0))} gal
                            </Text>
                            <Text strong style={{ display: 'block', fontSize: isMobile ? 13 : 14, marginTop: 8, color: '#3f8600' }}>
                                Est. Material Cost: ${Object.values(runningTotals).reduce((sum, p) => sum + (p.gallons * p.pricePerGallon), 0).toFixed(2)}
                            </Text>
                        </div>
                    </Card>
                );
            })()}


            {/* PRICING SCHEME-SPECIFIC KEY METRICS */}
            {calculatedQuote && (
                <>
                    {/* Production-Based: Emphasize Hours & Time */}
                    {isProductionBased && (
                        <Card
                            title={
                                <Space>
                                    <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, color: '#1890ff' }}>
                                        ⏱️ Production-Based Time Estimate
                                    </span>
                                </Space>
                            }
                            style={{ marginBottom: 16, borderColor: '#1890ff', borderWidth: 2 }}
                        >
                            <Row gutter={isMobile ? 8 : 16}>
                                <Col xs={24} md={8}>
                                    <Statistic
                                        title="Total Estimated Hours"
                                        value={totalEstimatedHours}
                                        precision={1}
                                        suffix="hrs"
                                        valueStyle={{ color: '#1890ff', fontSize: isMobile ? 24 : 32 }}
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Based on production rates & crew size
                                    </Text>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Statistic
                                        title="Crew Size"
                                        value={formData?.paintersOnSite || formData.contractorSettings?.other?.crewSize || 1}
                                        suffix="workers"
                                        valueStyle={{ fontSize: isMobile ? 20 : 24 }}
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Standard crew configuration
                                    </Text>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Statistic
                                        title="Est. Days to Complete"
                                        value={Math.ceil(totalEstimatedHours / ((formData.contractorSettings?.other?.crewSize || 2) * 8)).toFixed(1)}
                                        suffix="days"
                                        valueStyle={{ fontSize: isMobile ? 20 : 24 }}
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Based on 8-hour work days
                                    </Text>
                                </Col>
                            </Row>
                            <Divider style={{ margin: '16px 0' }} />
                            <Row gutter={isMobile ? 8 : 16}>
                                <Col xs={12} md={6}>
                                    <Statistic
                                        title="Billable Labor Rate"
                                        value={formData.billableLaborRate || formData.contractorSettings?.other?.defaultBillableLaborRate || calculatedQuote?.billableLaborRate || 0}
                                        prefix="$"
                                        precision={2}
                                        suffix="/hr"
                                        valueStyle={{ fontSize: isMobile ? 14 : 16 }}
                                    />
                                </Col>
                                <Col xs={12} md={6}>
                                    <Statistic
                                        title="Labor Cost"
                                        value={calculatedQuote.laborTotal || 0}
                                        prefix="$"
                                        precision={2}
                                        valueStyle={{ fontSize: isMobile ? 14 : 16 }}
                                    />
                                </Col>
                                <Col xs={12} md={6}>
                                    <Statistic
                                        title="Materials"
                                        value={calculatedQuote.materialTotal || 0}
                                        prefix="$"
                                        precision={2}
                                        valueStyle={{ fontSize: isMobile ? 14 : 16 }}
                                    />
                                </Col>
                                <Col xs={12} md={6}>
                                    <Statistic
                                        title="Total Price"
                                        value={calculatedQuote.total || 0}
                                        prefix="$"
                                        precision={2}
                                        valueStyle={{ color: '#3f8600', fontWeight: 'bold', fontSize: isMobile ? 16 : 18 }}
                                    />
                                </Col>
                            </Row>
                        </Card>
                    )}





                </>
            )}

            {/* Pricing Summary - Conditional based on pricing scheme */}
            {calculatedQuote && (
                <>
                    {isTurnkey ? (
                        // Turnkey: Show simplified summary ONLY
                        <TurnkeyPricingSummary 
                            formData={formData} 
                            calculatedQuote={calculatedQuote}
                            turnkeyProducts={getTurnkeyProductSummary()}
                        />
                    ) : isFlatRate ? (
                        // Flat Rate: Show simplified summary (unit prices already include everything)
                        <Card title="Flat Rate Pricing Summary" style={{ marginBottom: 16 }}>
                            <Alert
                                message="All-Inclusive Unit Pricing"
                                description="Unit prices include labor, materials, overhead, and profit. Only tax is applied separately."
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                            />
                            
                            <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
                                <Col xs={24} sm={12}>
                                    <Statistic
                                        title="Base Total (All Items)"
                                        value={calculatedQuote.subtotal || 0}
                                        prefix="$"
                                        precision={2}
                                        valueStyle={{ fontSize: isMobile ? '20px' : '24px' }}
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Includes labor, materials, overhead & profit
                                    </Text>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Statistic
                                        title="Final Total (with tax)"
                                        value={calculatedQuote.total || 0}
                                        prefix="$"
                                        precision={2}
                                        valueStyle={{ color: '#3f8600', fontWeight: 'bold', fontSize: isMobile ? '24px' : '28px' }}
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Tax ({calculatedQuote.taxPercent || 0}%): ${calculatedQuote.tax?.toFixed(2) || '0.00'}
                                    </Text>
                                </Col>
                            </Row>

                            {/* Quote Validity Notice */}
                            {calculatedQuote.quoteValidityDays && (
                                <Alert
                                    message={`Quote Valid for ${calculatedQuote.quoteValidityDays} Days`}
                                    description={`This quote is valid until ${new Date(Date.now() + calculatedQuote.quoteValidityDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                                        month: 'short', day: 'numeric', year: 'numeric'
                                    })}`}
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />
                            )}

                            <Divider />

                            <Descriptions column={isMobile ? 1 : 2} bordered size="small">
                                <Descriptions.Item label="Base Total (All Items)" span={isMobile ? 1 : 2}>
                                    <strong>${calculatedQuote.subtotal?.toFixed(2) || '0.00'}</strong>
                                </Descriptions.Item>

                                <Descriptions.Item label={`Sales Tax (${calculatedQuote.taxPercent || 0}%)`} span={isMobile ? 1 : 2}>
                                    +${calculatedQuote.tax?.toFixed(2) || '0.00'}
                                </Descriptions.Item>

                                <Descriptions.Item label={<strong>Grand Total</strong>} span={isMobile ? 1 : 2}>
                                    <div style={{ textAlign: 'right', width: '100%' }}>
                                        <strong style={{ fontSize: '18px', color: '#3f8600' }}>
                                            ${calculatedQuote.total?.toFixed(2) || '0.00'}
                                        </strong>
                                    </div>
                                </Descriptions.Item>
                            </Descriptions>

                            <Divider />

                            <Alert
                                message="What's Included in Unit Prices"
                                description={
                                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                        <li>All labor costs</li>
                                        <li>All materials and supplies</li>
                                        <li>Overhead expenses (insurance, equipment, transportation)</li>
                                        <li>Profit margin</li>
                                    </ul>
                                }
                                type="success"
                                showIcon
                            />
                        </Card>
                    ) : (
                        // Non-Turnkey, Non-Flat-Rate: Show full cost breakdown
                        <Card title="Cost Breakdown" loading={loading} style={{ marginBottom: 16 }}>
                    <Row gutter={isMobile ? 8 : 16} style={{ marginBottom: isMobile ? 16 : 24 }}>
                        <Col xs={24} sm={isProductionBased ? 6 : 8}>
                            <Statistic
                                title="Labor Total"
                                value={calculatedQuote.laborTotal || 0}
                                prefix="$"
                                precision={2}
                                valueStyle={{ fontSize: isMobile ? 16 : 20 }}
                            />
                        </Col>
                        <Col xs={24} sm={isProductionBased ? 6 : 8}>
                            <Statistic
                                title="Materials Total"
                                value={calculatedQuote.materialTotal || 0}
                                prefix="$"
                                precision={2}
                                valueStyle={{ fontSize: isMobile ? 16 : 20 }}
                            />
                        </Col>
                        {isProductionBased && totalEstimatedHours > 0 && (
                            <Col xs={24} sm={6}>
                                <Statistic
                                    title="Estimated Hours"
                                    value={totalEstimatedHours}
                                    precision={1}
                                    suffix="hrs"
                                    valueStyle={{ color: '#1890ff', fontSize: isMobile ? 16 : 20 }}
                                />
                            </Col>
                        )}
                        <Col xs={24} sm={isProductionBased ? 6 : 8}>
                            <Statistic
                                title="Final Total"
                                value={calculatedQuote.total || 0}
                                prefix="$"
                                precision={2}
                                valueStyle={{ color: '#3f8600', fontWeight: 'bold', fontSize: isMobile ? 20 : 28 }}
                            />
                        </Col>
                    </Row>

                    <Divider orientation="left">Detailed Breakdown</Divider>

                    {/* Material Calculation Settings */}
                    {calculatedQuote.includeMaterials !== undefined && (
                        <Alert
                            message={calculatedQuote.includeMaterials ? "Materials Included in Quote" : "Labor-Only Quote (Materials Not Included)"}
                            description={
                                calculatedQuote.includeMaterials ? (
                                    <Space direction="vertical" size={0}>
                                        <Text>Coverage: {calculatedQuote.coverage || 350} sq ft per gallon</Text>
                                        <Text>Application Method: {(calculatedQuote.applicationMethod || 'roll').toUpperCase()}</Text>
                                        <Text>Coats: {calculatedQuote.coats || 2}</Text>
                                    </Space>
                                ) : (
                                    <Text>Customer is providing all paint and materials. Quote includes labor only.</Text>
                                )
                            }
                            type={calculatedQuote.includeMaterials ? "success" : "warning"}
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    {/* Quote Validity Notice */}
                    {calculatedQuote.quoteValidityDays && (
                        <Alert
                            message={`Quote Valid for ${calculatedQuote.quoteValidityDays} Days`}
                            description={`This quote is valid until ${new Date(Date.now() + calculatedQuote.quoteValidityDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                                month: 'short', day: 'numeric', year: 'numeric'
                            })}`}
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    {/* Pricing Settings Info */}
                    {calculatedQuote.laborMarkupPercent !== undefined && calculatedQuote.materialMarkupPercent !== undefined && (
                        <Alert
                            message="Pricing Engine Settings Applied"
                            description={
                                <Space direction="vertical" size={0}>
                                    <Text>Labor Markup: {calculatedQuote.laborMarkupPercent}%</Text>
                                    <Text>Material Markup: {calculatedQuote.materialMarkupPercent}%</Text>
                                    <Text>Overhead: {calculatedQuote.overheadPercent}%</Text>
                                    <Text>Net Profit: {calculatedQuote.profitMarginPercent}%</Text>
                                    <Text>Tax Rate: {calculatedQuote.taxPercent}%</Text>
                                </Space>
                            }
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    <Descriptions column={isMobile ? 1 : 2} bordered size="small">
                        {/* Base Costs */}
                        <Descriptions.Item label="Labor Cost (Base)">
                            ${calculatedQuote.laborTotal?.toFixed(2) || '0.00'}
                        </Descriptions.Item>
                        <Descriptions.Item label={`Labor Markup (${calculatedQuote.laborMarkupPercent || 0}%)`}>
                            +${calculatedQuote.laborMarkupAmount?.toFixed(2) || '0.00'}
                        </Descriptions.Item>

                        <Descriptions.Item label="Material Cost (Base)">
                            ${calculatedQuote.materialTotal?.toFixed(2) || '0.00'}
                        </Descriptions.Item>
                        <Descriptions.Item label={`Material Markup (${calculatedQuote.materialMarkupPercent || 0}%)`}>
                            +${calculatedQuote.materialMarkupAmount?.toFixed(2) || '0.00'}
                        </Descriptions.Item>

                        {/* Subtotal with markups */}
                        <Descriptions.Item label="Labor with Markup" span={isMobile ? 1 : 2}>
                            <strong>${calculatedQuote.laborCostWithMarkup?.toFixed(2) || '0.00'}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Materials with Markup" span={isMobile ? 1 : 2}>
                            <strong>${calculatedQuote.materialCostWithMarkup?.toFixed(2) || '0.00'}</strong>
                        </Descriptions.Item>

                        {/* Overhead */}
                        <Descriptions.Item label={`Overhead (${calculatedQuote.overheadPercent || 0}%)`} span={isMobile ? 1 : 2}>
                            +${calculatedQuote.overhead?.toFixed(2) || '0.00'}
                        </Descriptions.Item>

                        {/* Subtotal before profit */}
                        <Descriptions.Item label="Subtotal Before Profit" span={isMobile ? 1 : 2}>
                            <strong>${calculatedQuote.subtotalBeforeProfit?.toFixed(2) || '0.00'}</strong>
                        </Descriptions.Item>

                        {/* Net Profit */}
                        <Descriptions.Item label={`Net Profit (${calculatedQuote.profitMarginPercent || 0}%)`} span={isMobile ? 1 : 2}>
                            +${calculatedQuote.profitAmount?.toFixed(2) || '0.00'}
                        </Descriptions.Item>

                        {/* Subtotal before tax */}
                        <Descriptions.Item label="Subtotal" span={isMobile ? 1 : 2}>
                            <strong>${calculatedQuote.subtotal?.toFixed(2) || '0.00'}</strong>
                        </Descriptions.Item>

                        {/* Tax */}
                        <Descriptions.Item label={`Tax (${calculatedQuote.taxPercent || 0}%)`} span={isMobile ? 1 : 2}>
                            +${calculatedQuote.tax?.toFixed(2) || '0.00'}
                        </Descriptions.Item>

                        {/* Grand Total */}
                        <Descriptions.Item label={<strong>Grand Total</strong>} span={isMobile ? 1 : 2}>
                            <div style={{ textAlign: 'right', width: '100%' }}>
                                <strong style={{ fontSize: '18px', color: '#3f8600' }}>
                                    ${calculatedQuote.total?.toFixed(2) || '0.00'}
                                </strong>
                            </div>
                        </Descriptions.Item>
                    </Descriptions>

                    {/* Hide detailed breakdown for turnkey and flat rate pricing - show only final totals */}
                    {!isTurnkey && !isFlatRate && calculatedQuote.breakdown && calculatedQuote.breakdown.length > 0 && (
                        <>
                            <Divider orientation="left">Area-by-Area Breakdown</Divider>
                            {calculatedQuote.breakdown.map((area, index) => (
                                <Card
                                    key={index}
                                    size="small"
                                    title={<span style={{ fontSize: isMobile ? 14 : 16 }}>{area.areaName}</span>}
                                    style={{ marginBottom: 12 }}
                                    type="inner"
                                >
                                    <Table
                                        size="small"
                                        pagination={false}
                                        dataSource={area.items || []}
                                        scroll={{ x: isMobile ? 900 : undefined }}
                                        columns={[
                                            {
                                                title: 'Surface/Category',
                                                key: 'type',
                                                width: isMobile ? 120 : undefined,
                                                ellipsis: isMobile,
                                                render: (_, record) => record.categoryName || record.type || '-'
                                            },
                                            {
                                                title: 'Quantity',
                                                key: 'quantity',
                                                width: isMobile ? 80 : undefined,
                                                render: (_, record) => {
                                                    const qty = record.quantity || record.sqft || 0;
                                                    return qty?.toFixed(0);
                                                }
                                            },
                                            {
                                                title: 'Unit',
                                                key: 'unit',
                                                width: isMobile ? 70 : undefined,
                                                render: (_, record) => {
                                                    const unit = record.measurementUnit || 'sqft';
                                                    return unit === 'sqft' ? 'sq ft' :
                                                        unit === 'linear_foot' ? 'LF' :
                                                            unit === 'unit' ? 'units' :
                                                                unit === 'hour' ? 'hrs' : unit;
                                                }
                                            },
                                            {
                                                title: 'Coats',
                                                dataIndex: 'numberOfCoats',
                                                key: 'coats',
                                                width: isMobile ? 70 : undefined,
                                                render: (val) => val > 0 ? `${val}` : '-'
                                            },
                                            {
                                                title: 'Gallons',
                                                dataIndex: 'gallons',
                                                key: 'gallons',
                                                width: isMobile ? 80 : undefined,
                                                render: (val) => val ? Math.ceil(val) : '-'
                                            },
                                            {
                                                title: 'Labor Cost',
                                                dataIndex: 'laborCost',
                                                key: 'laborCost',
                                                width: isMobile ? 90 : undefined,
                                                render: (val) => `$${val?.toFixed(2) || '0.00'}`
                                            },
                                            {
                                                title: 'Material Cost',
                                                dataIndex: 'materialCost',
                                                key: 'materialCost',
                                                width: isMobile ? 100 : undefined,
                                                render: (val) => `$${val?.toFixed(2) || '0.00'}`
                                            },

                                        ]}
                                    />
                                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                                        <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>
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
                </>
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
                <Space 
                    direction={isMobile ? 'vertical' : 'horizontal'}
                    style={{ width: isMobile ? '100%' : 'auto' }}
                >
                    <Button
                        size={isMobile ? 'middle' : 'large'}
                        icon={<EyeOutlined />}
                        onClick={() => setShowProposalPreview(true)}
                        block={isMobile}
                    >
                        Preview Proposal
                    </Button>
                    <Button
                        size={isMobile ? 'middle' : 'large'}
                        icon={<SaveOutlined />}
                        onClick={handleSaveDraft}
                        block={isMobile}
                    >
                        Save as Draft
                    </Button>
                    <Button
                        type="primary"
                        size={isMobile ? 'middle' : 'large'}
                        icon={<SendOutlined />}
                        onClick={handleSendQuote}
                        loading={sending}
                        block={isMobile}
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
                pricingSchemes={pricingSchemes}
            />
        </div>
    );
};

export default SummaryStep;



