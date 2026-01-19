// src/components/QuoteBuilder/SummaryStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Descriptions, Divider, Input, Modal, Table, Tag, Space, Statistic, Collapse } from 'antd';
import { EditOutlined, SendOutlined, SaveOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { quoteBuilderApi } from '../../services/quoteBuilderApi';
import { apiService } from '../../services/apiService';
import ProposalPreviewModal from './ProposalPreviewModal';
import SendQuoteEmailModal from './SendQuoteEmailModal';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SummaryStep = ({ formData, onUpdate, onPrevious, onEdit, pricingSchemes }) => {
  // Check if current pricing scheme is turnkey
  const currentScheme = pricingSchemes?.find(s => s.id === formData.pricingSchemeId);
  const isTurnkey = currentScheme && (currentScheme.type === 'turnkey' || currentScheme.type === 'sqft_turnkey');
  const isProductionBased = formData.pricingModelType === 'production_based';
  const isFlatRate = formData.pricingModelType === 'flat_rate_unit';
  
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [totalEstimatedHours, setTotalEstimatedHours] = useState(0);
  const [productsMap, setProductsMap] = useState({});

  // Calculate total estimated hours for production-based model
  useEffect(() => {
    if (isProductionBased && formData.areas && formData.contractorSettings?.productionRates) {
      let totalHours = 0;
      const prodRates = formData.contractorSettings.productionRates;
      const crewSize = formData.contractorSettings.other?.crewSize || 2;
      
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
    calculateQuote();
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
          productMap[config.id] = {
            brandName: config.globalProduct?.brand?.name || 'Unknown',
            productName: config.globalProduct?.name || 'Unknown',
            pricePerGallon: config.sheens?.[0]?.price || 0,
            globalProductId: config.globalProductId
          };
        });
        // Also map by globalProductId so productSets using global ids resolve names
        list.forEach(config => {
          if (config.globalProductId && !productMap[config.globalProductId]) {
            productMap[config.globalProductId] = {
              brandName: config.globalProduct?.brand?.name || 'Unknown',
              productName: config.globalProduct?.name || 'Unknown',
              pricePerGallon: config.sheens?.[0]?.price || 0,
              globalProductId: config.globalProductId
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
          // Material calculation settings
          includeMaterials: formData.includeMaterials,
          coverage: formData.coverage,
          applicationMethod: formData.applicationMethod,
          coats: formData.coats
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
      
      // First save the draft with all data
      const quoteData = {
        ...formData,
        notes,
        status: 'sent'
      };

      const saveResponse = await quoteBuilderApi.saveDraft(quoteData);
      console.log('Draft saved before sending:', saveResponse);
      const quoteId = formData?.quoteId || saveResponse?.quote?.id;
      
      if (!quoteId) {
        throw new Error('Failed to save quote');
      }

      // Open email modal instead of sending directly
      setShowEmailModal(true);
    } catch (error) {
      console.error('Error preparing quote for send:', error);
      Modal.error({
        title: 'Send Failed',
        content: error.message || 'Failed to prepare quote for sending. Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async (emailData) => {
    try {
      // Save quote with email content before sending
      const quoteData = {
        ...formData,
        notes,
        status: 'sent',
        emailSubject: emailData.emailSubject,
        emailBody: emailData.emailBody
      };

      const saveResponse = await quoteBuilderApi.saveDraft(quoteData);
      const quoteId = formData?.quoteId || saveResponse?.quote?.id;

      // Send the quote email
      const response = await quoteBuilderApi.sendQuote(quoteId, {
        emailSubject: emailData.emailSubject,
        emailBody: emailData.emailBody
      });
      
      setShowEmailModal(false);

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
      console.error('Error sending quote email:', error);
      throw error;
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
   * Get product summary organized by area and surface type
   * Dynamically routes to global or area-wise summary based on pricing scheme
   */
  const getSurfaceProductSummary = () => {
    console.log('🔍 getSurfaceProductSummary called');
    console.log('📦 formData.productSets:', formData.productSets);
    console.log('📋 isFlatRate:', isFlatRate, 'currentScheme?.type:', currentScheme?.type);
    console.log('🎯 productStrategy:', formData.productStrategy);
    
    // Check if we have any product sets with areaId (area-wise selection)
    const hasAreaWiseProducts = formData.productSets?.some(set => set.areaId);
    console.log('🏠 hasAreaWiseProducts:', hasAreaWiseProducts);
    
    // If we have area-wise products, always use area-wise display
    if (hasAreaWiseProducts) {
      console.log('✅ Using area-wise display (products have areaId)');
      return getAreaWiseProductSummary();
    }
    
    // For area-wise pricing schemes, use area-organized display
    if (isFlatRate || currentScheme?.type === 'production_based' || currentScheme?.type === 'rate_based') {
      console.log('✅ Using area-wise display (pricing scheme)');
      return getAreaWiseProductSummary();
    }
    
    // For turnkey schemes, use global surface-type organization
    console.log('✅ Using global surface-type display');
    const summary = {};
    
    (formData.productSets || []).forEach(set => {
      // Skip area-specific entries for global display
      if (set.areaId) return;
      if (!set.surfaceType) return;
      
      if (!summary[set.surfaceType]) {
        summary[set.surfaceType] = {
          surfaceType: set.surfaceType,
          tiers: {},
          totalGallons: 0,
          totalCost: 0
        };
      }
      
      // Add products for each tier (Good, Better, Best)
      if (formData.productStrategy === 'GBB' && set.products) {
        ['good', 'better', 'best'].forEach(tier => {
          const productId = set.products[tier];
          if (productId) {
            const productInfo = productsMap[productId] || {};
            
            // Calculate gallons for this surface type
            const gallons = calculateGallonsForSurface(set.surfaceType);
            
            if (!summary[set.surfaceType].tiers[tier]) {
              summary[set.surfaceType].tiers[tier] = {
                tier: tier.charAt(0).toUpperCase() + tier.slice(1),
                productId,
                productName: `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
                pricePerGallon: productInfo.pricePerGallon || 0,
                gallons
              };
            }
            
            summary[set.surfaceType].totalGallons += gallons;
            summary[set.surfaceType].totalCost += (gallons * (productInfo.pricePerGallon || 0));
          }
        });
      }
      // Single product strategy
      else if (set.products?.single) {
        const productId = set.products.single;
        const productInfo = productsMap[productId] || {};
        const gallons = calculateGallonsForSurface(set.surfaceType);
        
        summary[set.surfaceType].tiers['single'] = {
          tier: 'Selected',
          productId,
          productName: `${productInfo.brandName || ''} ${productInfo.productName || ''}`.trim(),
          pricePerGallon: productInfo.pricePerGallon || 0,
          gallons
        };
        
        summary[set.surfaceType].totalGallons += gallons;
        summary[set.surfaceType].totalCost += (gallons * (productInfo.pricePerGallon || 0));
      }
    });
    
    return Object.values(summary);
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
    
    // Calculate gallons with waste factor (10%)
    const gallons = (totalSqft / COVERAGE_PER_GALLON) * 1.1;
    return Math.ceil(gallons * 4) / 4; // Round to nearest 0.25
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
    const gallons = (totalSqft / coverage) * coats;
    
    return Math.max(gallons, 0);
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
        style={{ marginBottom: 24 }}
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
          <div style={{ textAlign: 'center' }}>
            <Tag color="purple" style={{ fontSize: 16, padding: '8px 16px', marginBottom: 8 }}>
              {formData.pricingModelFriendlyName || currentScheme.name}
            </Tag>
            <div>
              <Text type="secondary" style={{ fontSize: 14 }}>
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
              >
                Edit
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Descriptions column={2}>
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

      {/* Areas & Surfaces - Hidden for Turnkey */}
      {!isTurnkey && (
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
                    dataIndex: 'quantity',
                    key: 'quantity', 
                    render: (val) => val || 'N/A'
                  },
                  {
                    title: 'Unit',
                    dataIndex: 'unit',
                    key: 'unit',
                    render: (val) => val === 'sqft' ? 'sq ft' : val === 'linear_foot' ? 'LF' : val === 'unit' ? 'units' : val === 'hour' ? 'hrs' : val || '-'
                  },
                  ...(!isFlatRate ? [
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
                    { title: 'Dimensions', dataIndex: 'dimensions', key: 'dimensions', render: (val) => val || '-' }
                  ] : []),
                ]}
              />
              {!isFlatRate && (
                <Space style={{ marginTop: 8 }}>
                  {area.totalSqft > 0 && <Text type="secondary">Total Area: {area.totalSqft.toFixed(0)} sq ft</Text>}
                  {area.totalGallons > 0 && <Text type="secondary">• Total Gallons: {Math.ceil(area.totalGallons)} gal</Text>}
                </Space>
              )}
              {isFlatRate && (
                <Space style={{ marginTop: 8 }}>
                  <Text type="secondary">Total Items: {area.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</Text>
                </Space>
              )}
            </div>
          ))}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 16 }}>
                    <Space>
                      <Text strong style={{ fontSize: 15 }}>{area.areaName}</Text>
                      <Tag color="blue">{surfaceCount} surface{surfaceCount !== 1 ? 's' : ''}</Tag>
                    </Space>
                    <Space>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {Math.ceil(areaTotalGallons)} gal
                      </Text>
                      <Text strong style={{ fontSize: 14, color: '#1890ff' }}>
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
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {Object.entries(productTotals).map(([productId, totals]) => (
                        <div key={productId} style={{ padding: '12px', background: '#fff', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
                          <Row gutter={16} align="middle">
                            <Col flex="auto">
                              <Space direction="vertical" size={2}>
                                <Text strong style={{ fontSize: 14 }}>{totals.productName}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  ${totals.pricePerGallon}/gallon • Used in {totals.usedIn.length} location{totals.usedIn.length !== 1 ? 's' : ''}
                                </Text>
                              </Space>
                            </Col>
                            <Col>
                              <div style={{ textAlign: 'right' }}>
                                <div>
                                  <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                                    {Math.ceil(totals.totalGallons)} gallons
                                  </Text>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
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
                  <Row gutter={16} align="middle">
                    <Col xs={24} md={6}>
                      <div>
                        <Text strong style={{ fontSize: 16 }}>{surface.surfaceType}</Text>
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
              <Space>
                <span>Selected Products Summary</span>
                <Tag color="blue">{totalProducts} unique product{totalProducts > 1 ? 's' : ''}</Tag>
              </Space>
            }
            style={{ marginBottom: 16, borderColor: '#1890ff', borderWidth: 1 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(runningTotals).map(([productId, info]) => (
                <div 
                  key={productId} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '12px', 
                    background: '#f5f7fa',
                    borderRadius: '4px',
                    border: '1px solid #d9d9d9'
                  }}
                >
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{info.productName}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Used on: {Array.from(info.surfaceTypes).join(', ')}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                      {Math.ceil(info.gallons)} gal
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      @ ${info.pricePerGallon}/gal
                    </Text>
                  </div>
                </div>
              ))}
            </div>
            
            <Divider style={{ margin: '16px 0' }} />
            
            <div style={{ textAlign: 'right' }}>
              <Text strong style={{ display: 'block', fontSize: 14 }}>
                Total Gallons: {Math.ceil(Object.values(runningTotals).reduce((sum, p) => sum + p.gallons, 0))} gal
              </Text>
              <Text strong style={{ display: 'block', fontSize: 14, marginTop: 8, color: '#3f8600' }}>
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
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
                    ⏱️ Production-Based Time Estimate
                  </span>
                </Space>
              }
              style={{ marginBottom: 16, borderColor: '#1890ff', borderWidth: 2 }}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Statistic 
                    title="Total Estimated Hours" 
                    value={totalEstimatedHours} 
                    precision={1}
                    suffix="hrs"
                    valueStyle={{ color: '#1890ff', fontSize: 32 }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Based on production rates & crew size
                  </Text>
                </Col>
                <Col xs={24} md={8}>
                  <Statistic 
                    title="Crew Size" 
                    value={formData.contractorSettings?.other?.crewSize || 2} 
                    suffix="workers"
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Standard crew configuration
                  </Text>
                </Col>
                <Col xs={24} md={8}>
                  <Statistic 
                    title="Est. Days to Complete" 
                    value={(totalEstimatedHours / ((formData.contractorSettings?.other?.crewSize || 2) * 8)).toFixed(1)} 
                    suffix="days"
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Based on 8-hour work days
                  </Text>
                </Col>
              </Row>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={16}>
                <Col xs={12} md={6}>
                  <Statistic 
                    title="Hourly Labor Rate" 
                    value={formData.contractorSettings?.productionRates?.hourlyLaborRate || 0} 
                    prefix="$"
                    precision={2}
                    suffix="/hr"
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic 
                    title="Labor Cost" 
                    value={calculatedQuote.laborTotal || 0} 
                    prefix="$"
                    precision={2}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic 
                    title="Materials" 
                    value={calculatedQuote.materialTotal || 0} 
                    prefix="$"
                    precision={2}
                  />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic 
                    title="Total Price" 
                    value={calculatedQuote.total || 0} 
                    prefix="$"
                    precision={2}
                    valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                  />
                </Col>
              </Row>
            </Card>
          )}

        

         

        </>
      )}

      {/* Cost Breakdown */}
      {calculatedQuote && (
        <Card title="Cost Breakdown" loading={loading} style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={isProductionBased ? 6 : 8}>
              <Statistic 
                title="Labor Total" 
                value={calculatedQuote.laborTotal || 0} 
                prefix="$"
                precision={2}
              />
            </Col>
            <Col xs={24} sm={isProductionBased ? 6 : 8}>
              <Statistic 
                title="Materials Total" 
                value={calculatedQuote.materialTotal || 0} 
                prefix="$"
                precision={2}
              />
            </Col>
            {isProductionBased && totalEstimatedHours > 0 && (
              <Col xs={24} sm={6}>
                <Statistic 
                  title="Estimated Hours" 
                  value={totalEstimatedHours} 
                  precision={1}
                  suffix="hrs"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
            )}
            <Col xs={24} sm={isProductionBased ? 6 : 8}>
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
              description={`This quote is valid until ${new Date(Date.now() + calculatedQuote.quoteValidityDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US",{
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
          
          <Descriptions column={2} bordered size="small">
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
            <Descriptions.Item label="Labor with Markup" span={2}>
              <strong>${calculatedQuote.laborCostWithMarkup?.toFixed(2) || '0.00'}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Materials with Markup" span={2}>
              <strong>${calculatedQuote.materialCostWithMarkup?.toFixed(2) || '0.00'}</strong>
            </Descriptions.Item>
            
            {/* Overhead */}
            <Descriptions.Item label={`Overhead (${calculatedQuote.overheadPercent || 0}%)`} span={2}>
              +${calculatedQuote.overhead?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            
            {/* Subtotal before profit */}
            <Descriptions.Item label="Subtotal Before Profit" span={2}>
              <strong>${calculatedQuote.subtotalBeforeProfit?.toFixed(2) || '0.00'}</strong>
            </Descriptions.Item>
            
            {/* Net Profit */}
            <Descriptions.Item label={`Net Profit (${calculatedQuote.profitMarginPercent || 0}%)`} span={2}>
              +${calculatedQuote.profitAmount?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            
            {/* Subtotal before tax */}
            <Descriptions.Item label="Subtotal" span={2}>
              <strong>${calculatedQuote.subtotal?.toFixed(2) || '0.00'}</strong>
            </Descriptions.Item>
            
            {/* Tax */}
            <Descriptions.Item label={`Tax (${calculatedQuote.taxPercent || 0}%)`} span={2}>
              +${calculatedQuote.tax?.toFixed(2) || '0.00'}
            </Descriptions.Item>
            
            {/* Grand Total */}
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
                          return qty?.toFixed(0);
                        }
                      },
                      {
                        title: 'Unit',
                        key: 'unit',
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
                        render: (val) => val > 0 ? `${val}` : '-'
                      },
                      { 
                        title: 'Gallons', 
                        dataIndex: 'gallons', 
                        key: 'gallons',
                        render: (val) => val ? Math.ceil(val) : '-'
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
        pricingSchemes={pricingSchemes}
      />

      {/* Send Quote Email Modal */}
      <SendQuoteEmailModal
        visible={showEmailModal}
        loading={sending}
        customerEmail={formData.customerEmail}
        customerName={formData.customerName}
        quoteId={formData?.quoteId}
        onSend={handleSendEmail}
        onCancel={() => setShowEmailModal(false)}
      />
    </div>
  );
};

export default SummaryStep;
