// src/components/QuoteBuilder/ProductsStep.jsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Row, Col, Typography, Select, Radio, Checkbox, Space, Modal, Divider, Tag, Collapse, Empty } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import { apiService } from '../../services/apiService';

const { Title, Text } = Typography;
const { Option } = Select;

const ProductsStep = ({ formData, onUpdate, onNext, onPrevious, pricingSchemes }) => {
  const [productStrategy, setProductStrategy] = useState(formData.productStrategy || 'GBB');
  const [allowCustomerChoice, setAllowCustomerChoice] = useState(formData.allowCustomerProductChoice || false);
  const [productSets, setProductSets] = useState(formData.productSets || []);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [gbbDefaults, setGbbDefaults] = useState([]);
  const [loading, setLoading] = useState(false);

  const pricingSchemeId = formData.pricingSchemeId;
  const isFlatRate = formData.pricingModelType === 'flat_rate_unit';
  
  // Check if current pricing scheme is turnkey
  const currentScheme = pricingSchemes?.find(s => s.id === pricingSchemeId);
  const isTurnkey = currentScheme && (currentScheme.type === 'turnkey' || currentScheme.type === 'sqft_turnkey');

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
      const jobType = formData.jobType; // 'interior' or 'exterior'
      const response = await apiService.get('/contractor/product-configs'+`?&jobType=${jobType || ''}&pricingSchemeId=${pricingSchemeId || ''}`);
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

  // Get areas with their selected surfaces - for area-wise grouping
  const getAreasWithSurfaces = () => {
    return (formData.areas || []).map(area => {
      let selectedSurfaces = [];
      
      // New structure: laborItems
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
      }
      // Old structure: surfaces
      else if (area.surfaces) {
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

  // Check if all areas have products selected for all surfaces
  const areAllProductsSelected = () => {
    const areasWithSurfaces = getAreasWithSurfaces();
    return areasWithSurfaces.every(area => {
      return area.surfaces.every(surface => {
        const areaProducts = productSets.find(ps => ps.areaId === area.id || ps.surfaceType === surface.name);
        if (!areaProducts) return false;
        
        if (productStrategy === 'GBB') {
          return areaProducts.products.good || areaProducts.products.better || areaProducts.products.best;
        } else {
          return areaProducts.products.single;
        }
      });
    });
  };

  const surfaceTypes = getSurfaceTypes();

  // For flat-rate per-area flow, target list is areas instead of surface types
  const flatRateAreas = isFlatRate ? (formData.areas || []).map(a => ({ id: a.id, name: a.name })) : [];

  // Map surface label to API default surface key
  const mapSurfaceToDefaultKey = (surfaceType) => {
    const surfaceTypeMap = {
      'Walls': 'interior_walls',
      'Ceiling': 'interior_ceilings',
      'Ceilings': 'interior_ceilings',
      'Trim': 'interior_trim_doors',
      'Doors': 'interior_trim_doors',
      'Cabinets': 'cabinets',
      'Siding': 'exterior_siding',
      'Exterior Siding': 'exterior_siding',
      'Windows': 'exterior_trim',
      'Soffit & Fascia': 'exterior_trim',
      'Accent Walls': 'interior_walls',
      'Drywall Repair': 'interior_walls',
      'Exterior Walls': 'exterior_siding',
      'Exterior Trim': 'exterior_trim',
      'Exterior Doors': 'exterior_trim',
      'Shutters': 'exterior_trim',
      'Decks & Railings': 'exterior_siding',
      'Prep Work': 'exterior_siding'
    };
    return surfaceTypeMap[surfaceType] || 'interior_walls';
  };

  const getDefaultsForSurface = (surfaceType) => {
    const key = mapSurfaceToDefaultKey(surfaceType);
    return gbbDefaults.find(d => d.surfaceType === key);
  };

  // Initialize product sets if empty - auto-populate
  useEffect(() => {
    // For ALL non-turnkey pricing models, use per-area-per-surface structure
    if (!isTurnkey && productSets.length === 0) {
      const areasWithSurfaces = getAreasWithSurfaces();
      
      if (areasWithSurfaces.length > 0) {
        console.log('🚀 Initializing productSets for area-based pricing');
        console.log('🏘️ areasWithSurfaces:', areasWithSurfaces);
        
        const initialSets = [];
        areasWithSurfaces.forEach(area => {
          area.surfaces.forEach(surface => {
            // Get GBB defaults for this surface type
            const defaults = getDefaultsForSurface(surface.name);
            const getConfigIdFromGlobalId = (globalId) => {
              if (!globalId) return null;
              const config = availableProducts.find(p => p.globalProductId === globalId);
              return config?.id || null;
            };
            
            const newSet = {
              areaId: area.id,
              areaName: area.name,
              surfaceType: surface.name,
              surfaceName: surface.name,
              quantity: surface.quantity,
              unit: surface.unit,
              products: productStrategy === 'GBB' 
                ? { 
                    good: getConfigIdFromGlobalId(defaults?.goodProductId), 
                    better: getConfigIdFromGlobalId(defaults?.betterProductId), 
                    best: getConfigIdFromGlobalId(defaults?.bestProductId) 
                  }
                : { single: null },
              prices: productStrategy === 'GBB' && defaults
                ? {
                    good: defaults.goodPricePerGallon,
                    better: defaults.betterPricePerGallon,
                    best: defaults.bestPricePerGallon
                  }
                : null,
              overridden: false,
              gallons: null
            };
            console.log('➕ Adding productSet:', newSet);
            initialSets.push(newSet);
          });
        });
        
        console.log('✅ Final initialSets:', initialSets);
        setProductSets(initialSets);
      }
      return;
    }
    
    // Legacy: Old surface-based initialization (for backward compatibility with old data)
    if (productSets.length === 0 && surfaceTypes.length > 0 && gbbDefaults.length > 0 && isTurnkey) {
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
          'Exterior Siding': 'exterior_siding',
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

        // Find product config IDs by matching global product IDs from GBB defaults
        const getConfigIdFromGlobalId = (globalId) => {
          if (!globalId) return null;
          const config = availableProducts.find(p => p.globalProductId === globalId);
          return config?.id || null;
        };

        return {
          surfaceType,
          products: productStrategy === 'GBB' 
            ? { 
                good: getConfigIdFromGlobalId(defaults?.goodProductId), 
                better: getConfigIdFromGlobalId(defaults?.betterProductId), 
                best: getConfigIdFromGlobalId(defaults?.bestProductId) 
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
  }, [surfaceTypes, gbbDefaults, isFlatRate, flatRateAreas, productStrategy]);

  // Sync productSets when the underlying selection changes
  useEffect(() => {
    // For non-turnkey pricing, sync area+surface changes
    if (!isTurnkey && productSets.length > 0) {
      const areasWithSurfaces = getAreasWithSurfaces();
      
      // Get current area+surface combinations
      const currentCombos = productSets.map(ps => `${ps.areaId}-${ps.surfaceType}`);
      const expectedCombos = areasWithSurfaces.flatMap(area => 
        area.surfaces.map(surface => `${area.id}-${surface.name}`)
      );
      
      // Find added and removed combinations
      const added = expectedCombos.filter(combo => !currentCombos.includes(combo));
      const removed = currentCombos.filter(combo => !expectedCombos.includes(combo));
      
      if (added.length > 0 || removed.length > 0) {
        console.log('🔄 Syncing productSets - added:', added, 'removed:', removed);
        
        // Keep existing products, but remove deleted combinations
        const kept = productSets.filter(ps => {
          const combo = `${ps.areaId}-${ps.surfaceType}`;
          return !removed.includes(combo);
        });
        
        // Add new combinations
        const newSets = [];
        areasWithSurfaces.forEach(area => {
          area.surfaces.forEach(surface => {
            const combo = `${area.id}-${surface.name}`;
            if (added.includes(combo)) {
              const defaults = getDefaultsForSurface(surface.name);
              const getConfigIdFromGlobalId = (globalId) => {
                if (!globalId) return null;
                const config = availableProducts.find(p => p.globalProductId === globalId);
                return config?.id || null;
              };
              
              newSets.push({
                areaId: area.id,
                areaName: area.name,
                surfaceType: surface.name,
                surfaceName: surface.name,
                quantity: surface.quantity,
                unit: surface.unit,
                products: productStrategy === 'GBB' 
                  ? { 
                      good: getConfigIdFromGlobalId(defaults?.goodProductId), 
                      better: getConfigIdFromGlobalId(defaults?.betterProductId), 
                      best: getConfigIdFromGlobalId(defaults?.bestProductId) 
                    }
                  : { single: null },
                prices: productStrategy === 'GBB' && defaults
                  ? {
                      good: defaults.goodPricePerGallon,
                      better: defaults.betterPricePerGallon,
                      best: defaults.bestPricePerGallon
                    }
                  : null,
                overridden: false,
                gallons: null
              });
            }
          });
        });
        
        setProductSets([...kept, ...newSets]);
      }
      return;
    }

    // Legacy sync for old surface-based structure (turnkey only)
    if (surfaceTypes.length === 0 || gbbDefaults.length === 0 || !isTurnkey) return;

    // Get current surface types in productSets
    const currentSurfaceTypes = productSets.map(set => set.surfaceType);

    // Check if surfaceTypes have changed
    const surfaceTypesAdded = surfaceTypes.filter(st => !currentSurfaceTypes.includes(st));
    const surfaceTypesRemoved = currentSurfaceTypes.filter(st => !surfaceTypes.includes(st));

    // If there are changes, rebuild productSets
    if (surfaceTypesAdded.length > 0 || surfaceTypesRemoved.length > 0) {
      const updatedSets = surfaceTypes.map(surfaceType => {
        // Try to find existing set to preserve selections
        const existingSet = productSets.find(set => set.surfaceType === surfaceType);
        if (existingSet) return existingSet;

        const surfaceTypeMap = {
          'Walls': 'interior_walls',
          'Ceiling': 'interior_ceilings',
          'Ceilings': 'interior_ceilings',
          'Trim': 'interior_trim_doors',
          'Doors': 'interior_trim_doors',
          'Cabinets': 'cabinets',
          'Siding': 'exterior_siding',
          'Exterior Siding': 'exterior_siding',
          'Windows': 'exterior_trim',
          'Soffit & Fascia': 'exterior_trim',
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
        const getConfigIdFromGlobalId = (globalId) => {
          if (!globalId) return null;
          const config = availableProducts.find(p => p.globalProductId === globalId);
          return config?.id || null;
        };
        return {
          surfaceType,
          products: productStrategy === 'GBB' 
            ? { 
                good: getConfigIdFromGlobalId(defaults?.goodProductId), 
                better: getConfigIdFromGlobalId(defaults?.betterProductId), 
                best: getConfigIdFromGlobalId(defaults?.bestProductId) 
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
      setProductSets(updatedSets);
    }
  }, [isFlatRate, flatRateAreas, surfaceTypes, gbbDefaults, productStrategy, availableProducts]);

  /**
   * Update product selection for a specific area and/or surface
   * @param {number|string} areaId - The area ID
   * @param {string} surfaceType - The surface type (categoryName) - optional for area-wide updates
   * @param {string} tier - The tier (good/better/best/single)
   * @param {string} productId - The product ID to select
   */
  const updateProductSet = (areaId, tier, productId, surfaceType = null) => {
    console.log('🔧 updateProductSet called:', { 
      areaId, 
      tier, 
      productId, 
      surfaceType,
      isFlatRate,
      isTurnkey
    });
    console.log('📦 Current productSets:', JSON.parse(JSON.stringify(productSets)));
    
    // Find existing set
    let found = false;
    const updated = productSets.map(set => {
      // For non-turnkey pricing, ALWAYS require both areaId and surfaceType
      const shouldMatch = !isTurnkey 
        ? (set.areaId === areaId && set.surfaceType === surfaceType)
        : (set.surfaceType === areaId); // Legacy: turnkey uses surfaceType only
      
      console.log('🔍 Checking set:', {
        setAreaId: set.areaId,
        setSurfaceType: set.surfaceType,
        areaId,
        surfaceType,
        isTurnkey,
        shouldMatch
      });
      
      if (shouldMatch) {
        found = true;
        const updatedSet = {
          ...set,
          products: {
            ...set.products,
            [tier]: productId
          },
          overridden: true
        };
        console.log('✅ Found matching set, updated:', updatedSet);
        return updatedSet;
      }
      return set;
    });
    
    // If no matching set found and we're in non-turnkey mode, create new entry
    if (!found && !isTurnkey && areaId && surfaceType) {
      console.log('⚠️ No matching set found, creating new entry');
      const area = formData.areas?.find(a => a.id === areaId);
      const areasWithSurfaces = getAreasWithSurfaces();
      const areaData = areasWithSurfaces.find(a => a.id === areaId);
      const surface = areaData?.surfaces?.find(s => s.name === surfaceType || s.id === surfaceType);
      
      const newSet = {
        areaId,
        areaName: area?.name || 'Unknown Area',
        surfaceType,
        surfaceName: surfaceType,
        quantity: surface?.quantity,
        unit: surface?.unit,
        products: productStrategy === 'GBB' 
          ? { good: null, better: null, best: null, [tier]: productId }
          : { single: productId },
        overridden: true,
        gallons: null
      };
      
      console.log('✨ Created new set:', newSet);
      setProductSets([...updated, newSet]);
    } else {
      console.log('📋 Updated productSets:', updated);
      setProductSets(updated);
    }
  };

  // Auto-calculate material cost based on gallons and product price
  const calculateMaterialCost = (surfaceType, tier, productId, currentSet) => {
    const product = getProductById(productId);
    if (!product) return;

    // Get gallons from areas - supports both sqft-based and unit-based calculations
    let totalGallons = 0;
    let hasGallons = false;
    
    (formData.areas || []).forEach(area => {
      if (area.laborItems) {
        area.laborItems.forEach(item => {
          if (item.selected && item.categoryName === surfaceType) {
            // If gallons are explicitly provided, use them
            if (item.gallons && item.gallons > 0) {
              totalGallons += Number.parseFloat(item.gallons) || 0;
              hasGallons = true;
            }
            // Otherwise calculate from quantity and coverage
            else if (item.quantity && item.numberOfCoats) {
              const quantity = Number.parseFloat(item.quantity) || 0;
              const coats = Number.parseInt(item.numberOfCoats) || 1;
              const coverage = product.coverage || 350; // sqft per gallon
              
              // For sqft measurements, calculate gallons
              if (item.measurementUnit === 'sqft') {
                const calculatedGallons = (quantity * coats) / coverage;
                totalGallons += calculatedGallons;
                hasGallons = true;
              }
              // For linear feet (trim, doors), estimate based on typical dimensions
              else if (item.measurementUnit === 'linear_foot') {
                // Assume 6 inches height for trim/doors = 0.5 ft width
                const estimatedSqFt = quantity * 0.5;
                const calculatedGallons = (estimatedSqFt * coats) / coverage;
                totalGallons += calculatedGallons;
                hasGallons = true;
              }
              // For units (doors, cabinets), estimate per unit
              else if (item.measurementUnit === 'unit') {
                // Estimate: door = ~20 sqft, cabinet = ~15 sqft
                const estimatedSqFtPerUnit = surfaceType.toLowerCase().includes('cabinet') ? 15 : 20;
                const estimatedSqFt = quantity * estimatedSqFtPerUnit;
                const calculatedGallons = (estimatedSqFt * coats) / coverage;
                totalGallons += calculatedGallons;
                hasGallons = true;
              }
            }
          }
        });
      }
    });

    // Only proceed if we have gallons to calculate
    if (!hasGallons || totalGallons === 0) {
      // Clear gallons if none calculated
      setProductSets(prev => prev.map(set => {
        if (set.surfaceType === surfaceType) {
          return {
            ...set,
            gallons: 0,
            materialCost: '0.00',
            wasteFactor: 1.1,
            rawGallons: '0.00'
          };
        }
        return set;
      }));
      return;
    }

    // Apply waste factor (default 10% = 1.1)
    const wasteFactor = 1.1;
    const gallonsWithWaste = totalGallons * wasteFactor;
    
    // Round up to nearest 0.25 gallon
    const finalGallons = Math.ceil(gallonsWithWaste * 4) / 4;
    
    // Calculate material cost
    const materialCost = finalGallons * Number.parseFloat(product.pricePerGallon || 0);

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

  const getAvailableProductsForAreaTier = (areaId, currentTier) => {
    const currentSet = productSets.find(set => set.areaId === areaId);
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

  // Copy a product selection to all surfaces (for area-wise pricing)
  const copyProductToAllSurfaces = (tier, productId, sourceSurfaceType) => {
    Modal.confirm({
      title: 'Apply to All Surfaces?',
      content: `Do you want to apply this ${tier.toUpperCase()} product to all ${sourceSurfaceType} surfaces across all areas?`,
      onOk: () => {
        console.log(`📋 Copying ${tier} product ${productId} to all ${sourceSurfaceType} surfaces`);
        const updated = productSets.map(set => {
          // Only update sets with matching surface type
          if (set.surfaceType === sourceSurfaceType) {
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
        setProductSets(updated);
      }
    });
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
    // For turnkey pricing with no areas, products are optional
    if (isTurnkey && (!formData.areas || formData.areas.length === 0)) {
      // Products are optional for turnkey, can proceed
      onNext();
      return;
    }
    
    // For non-turnkey, validate that products are selected
    const hasProducts = productSets.every(set => {
      if (productStrategy === 'GBB') {
        return set.products.good || set.products.better || set.products.best;
      } else {
        return set.products.single;
      }
    });

    if (!hasProducts && productSets.length > 0) {
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

      {/* Show special message for turnkey pricing with no areas */}
      {isTurnkey && (!formData.areas || formData.areas.length === 0) && (
        <Alert
          message="Turnkey Pricing - Simplified Product Selection"
          description="With turnkey pricing, you can select general products for the entire home without specifying individual room products. These will be used for material cost estimation based on your home's total square footage."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
    
      
      {/* Show message if no surface types are available */}
      {!isTurnkey && (!surfaceTypes || surfaceTypes.length === 0) && (
        <Alert
          message="No Surface Types Found"
          description="Please go back to the Areas step and add rooms/areas before selecting products."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          action={
            <Button size="small" onClick={onPrevious}>
              Go Back to Areas
            </Button>
          }
        />
      )}

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

      {/* Turnkey Simplified Product Selection */}
      {isTurnkey && (
        <div style={{ marginTop: 24 }}>
          <Card 
            title={`General ${formData.jobType === 'interior' ? 'Interior' : 'Exterior'} Products`}
            style={{ marginBottom: 16 }}
          >
            {productStrategy === 'GBB' ? (
              <Row gutter={[16, 16]}>
                {/* Good Tier */}
                <Col xs={24} md={8}>
                  <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 4, height: '100%' }}>
                    <Tag color="blue" style={{ marginBottom: 8 }}>GOOD</Tag>
                    <Select
                      placeholder="Select Good Option"
                      style={{ width: '100%' }}
                      value={productSets[0]?.products?.good}
                      onChange={(value) => {
                        const newProductSets = [{
                          surfaceType: `${formData.jobType || 'general'} - General`,
                          products: {
                            good: value,
                            better: productSets[0]?.products?.better,
                            best: productSets[0]?.products?.best
                          }
                        }];
                        setProductSets(newProductSets);
                      }}
                      loading={loading}
                      showSearch
                      filterOption={(input, option) =>
                        option.label && typeof option.label === 'string'
                          ? option.label.toLowerCase().includes(input.toLowerCase())
                          : true
                      }
                    >
                      {availableProducts.map(product => (
                        <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                          {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                        </Option>
                      ))}
                    </Select>
                    {productSets[0]?.products?.good && (
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const product = getProductById(productSets[0].products.good);
                          return product ? (
                            <>
                              <Text strong>${product.pricePerGallon}/gal</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
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
                    <Tag color="cyan" style={{ marginBottom: 8 }}>BETTER</Tag>
                    <Select
                      placeholder="Select Better Option"
                      style={{ width: '100%' }}
                      value={productSets[0]?.products?.better}
                      onChange={(value) => {
                        const newProductSets = [{
                          surfaceType: `${formData.jobType || 'general'} - General`,
                          products: {
                            good: productSets[0]?.products?.good,
                            better: value,
                            best: productSets[0]?.products?.best
                          }
                        }];
                        setProductSets(newProductSets);
                      }}
                      loading={loading}
                      showSearch
                      filterOption={(input, option) =>
                        option.label && typeof option.label === 'string'
                          ? option.label.toLowerCase().includes(input.toLowerCase())
                          : true
                      }
                    >
                      {availableProducts.map(product => (
                        <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                          {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                        </Option>
                      ))}
                    </Select>
                    {productSets[0]?.products?.better && (
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const product = getProductById(productSets[0].products.better);
                          return product ? (
                            <>
                              <Text strong>${product.pricePerGallon}/gal</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
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
                    <Tag color="green" style={{ marginBottom: 8 }}>BEST</Tag>
                    <Select
                      placeholder="Select Best Option"
                      style={{ width: '100%' }}
                      value={productSets[0]?.products?.best}
                      onChange={(value) => {
                        const newProductSets = [{
                          surfaceType: `${formData.jobType || 'general'} - General`,
                          products: {
                            good: productSets[0]?.products?.good,
                            better: productSets[0]?.products?.better,
                            best: value
                          }
                        }];
                        setProductSets(newProductSets);
                      }}
                      loading={loading}
                      showSearch
                      filterOption={(input, option) =>
                        option.label && typeof option.label === 'string'
                          ? option.label.toLowerCase().includes(input.toLowerCase())
                          : true
                      }
                    >
                      {availableProducts.map(product => (
                        <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                          {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                        </Option>
                      ))}
                    </Select>
                    {productSets[0]?.products?.best && (
                      <div style={{ marginTop: 8 }}>
                        {(() => {
                          const product = getProductById(productSets[0].products.best);
                          return product ? (
                            <>
                              <Text strong>${product.pricePerGallon}/gal</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
                            </>
                          ) : null;
                        })()}
                      </div>
                    )}
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
                    value={productSets[0]?.products?.single}
                    onChange={(value) => {
                      const newProductSets = [{
                        surfaceType: `${formData.jobType || 'general'} - General`,
                        products: { single: value }
                      }];
                      setProductSets(newProductSets);
                    }}
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
                  {productSets[0]?.products?.single && (
                    <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                      {(() => {
                        const product = getProductById(productSets[0].products.single);
                        return product ? (
                          <>
                            <Text strong>${product.pricePerGallon}/gal</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>{product.description}</Text>
                          </>
                        ) : null;
                      })()}
                    </div>
                  )}
                </Col>
              </Row>
            )}
          </Card>
        </div>
      )}

      {/* Flat-rate: Product Selection by Area - DEPRECATED: Use per-surface section below */}
      {false && isFlatRate && productSets.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Title level={4}>Select Products by Area</Title>

          {(formData.areas || []).map(area => {
            const set = productSets.find(s => s.areaId === area.id) || { products: productStrategy === 'GBB' ? { good: null, better: null, best: null } : { single: null } };
            return (
              <Card key={area.id} title={area.name} style={{ marginBottom: 16 }}>
                {productStrategy === 'GBB' ? (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 4, height: '100%' }}>
                        <Tag color="blue" style={{ marginBottom: 8 }}>GOOD</Tag>
                        <Select
                          placeholder="Select Good Option"
                          style={{ width: '100%' }}
                          value={set.products.good}
                          onChange={(value) => updateProductSet(area.id, 'good', value)}
                          loading={loading}
                          showSearch
                          filterOption={(input, option) =>
                            option.label && typeof option.label === 'string'
                              ? option.label.toLowerCase().includes(input.toLowerCase())
                              : true
                          }
                        >
                          {getAvailableProductsForAreaTier(area.id, 'good').map(product => (
                            <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                              {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4, height: '100%' }}>
                        <Tag color="cyan" style={{ marginBottom: 8 }}>BETTER</Tag>
                        <Select
                          placeholder="Select Better Option"
                          style={{ width: '100%' }}
                          value={set.products.better}
                          onChange={(value) => updateProductSet(area.id, 'better', value)}
                          loading={loading}
                          showSearch
                          filterOption={(input, option) =>
                            option.label && typeof option.label === 'string'
                              ? option.label.toLowerCase().includes(input.toLowerCase())
                              : true
                          }
                        >
                          {getAvailableProductsForAreaTier(area.id, 'better').map(product => (
                            <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                              {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                    <Col xs={24} md={8}>
                      <div style={{ padding: 12, background: '#f6ffed', borderRadius: 4, height: '100%' }}>
                        <Tag color="green" style={{ marginBottom: 8 }}>BEST</Tag>
                        <Select
                          placeholder="Select Best Option"
                          style={{ width: '100%' }}
                          value={set.products.best}
                          onChange={(value) => updateProductSet(area.id, 'best', value)}
                          loading={loading}
                          showSearch
                          filterOption={(input, option) =>
                            option.label && typeof option.label === 'string'
                              ? option.label.toLowerCase().includes(input.toLowerCase())
                              : true
                          }
                        >
                          {getAvailableProductsForAreaTier(area.id, 'best').map(product => (
                            <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                              {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                            </Option>
                          ))}
                        </Select>
                      </div>
                    </Col>
                  </Row>
                ) : (
                  <Row gutter={16} align="middle">
                    <Col xs={24} md={16}>
                      <Select
                        placeholder="Select Product"
                        style={{ width: '100%' }}
                        value={set.products.single}
                        onChange={(value) => updateProductSet(area.id, 'single', value)}
                        loading={loading}
                        size="large"
                        showSearch
                        filterOption={(input, option) =>
                          option.label && typeof option.label === 'string'
                            ? option.label.toLowerCase().includes(input.toLowerCase())
                            : true
                        }
                      >
                        {availableProducts.map(product => (
                          <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                            {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                          </Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Area-Wise Product Selection with Surfaces (All Non-Turnkey Pricing Models) */}
      {!isTurnkey && productSets.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Title level={4}>Select Products by Area</Title>
          
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
              // Get all product sets for this area (by areaId or by surfaceType for backward compat)
              const areaProductSets = productSets.filter(ps => ps.areaId === area.id);
              
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>{area.name}</span>
                    {allSurfacesHaveProducts && (
                      <Tag color="green" style={{ marginRight: 8 }}>Complete</Tag>
                    )}
                  </div>
                ),
                children: (
                  <div>
                    {area.surfaces.length === 0 ? (
                      <Text type="secondary">No surfaces selected for this area</Text>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>{surface.name || surface.id}</span>
                                  {set.overridden && (
                                    <Tag color="orange" style={{ marginRight: 8 }}>Overridden</Tag>
                                  )}
                                  {surface.quantity && (
                                    <Tag color="blue">
                                      {surface.quantity} {surface.unit || surface.sqft ? 'sqft' : ''}
                                    </Tag>
                                  )}
                                </div>
                              }
                              style={{ marginBottom: 12 }}
                            >
                              {productStrategy === 'GBB' ? (
                                <Row gutter={[12, 12]}>
                                  {/* Good Tier */}
                                  <Col xs={24} md={8}>
                                    <div style={{ padding: 10, background: '#f0f0f0', borderRadius: 4 }}>
                                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Tag color="blue">GOOD</Tag>
                                        {set.products.good && (
                                          <Button 
                                            size="small" 
                                            type="link" 
                                            icon={<CopyOutlined />}
                                            onClick={() => copyProductToAllSurfaces('good', set.products.good, surface.name)}
                                            style={{ padding: 0, height: 'auto' }}
                                          >
                                            Copy to All
                                          </Button>
                                        )}
                                      </div>
                                      <Select
                                        placeholder="Select Good"
                                        style={{ width: '100%' }}
                                        value={set.products.good}
                                        onChange={(value) => updateProductSet(area.id, 'good', value, surface.name || surface.id)}
                                        loading={loading}
                                        size="small"
                                        showSearch
                                        filterOption={(input, option) =>
                                          option.label && typeof option.label === 'string'
                                            ? option.label.toLowerCase().includes(input.toLowerCase())
                                            : true
                                        }
                                      >
                                        {getAvailableProductsForAreaTier(area.id, 'good').map(product => (
                                          <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName}`}>
                                            {product.brandName} - {product.productName}
                                          </Option>
                                        ))}
                                      </Select>
                                      {set.products.good && (
                                        <div style={{ marginTop: 8, fontSize: 12 }}>
                                          <Text strong>${getProductById(set.products.good)?.pricePerGallon}/gal</Text>
                                        </div>
                                      )}
                                    </div>
                                  </Col>

                                  {/* Better Tier */}
                                  <Col xs={24} md={8}>
                                    <div style={{ padding: 10, background: '#e6f7ff', borderRadius: 4 }}>
                                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Tag color="cyan">BETTER</Tag>
                                        {set.products.better && (
                                          <Button 
                                            size="small" 
                                            type="link" 
                                            icon={<CopyOutlined />}
                                            onClick={() => copyProductToAllSurfaces('better', set.products.better, surface.name)}
                                            style={{ padding: 0, height: 'auto' }}
                                          >
                                            Copy to All
                                          </Button>
                                        )}
                                      </div>
                                      <Select
                                        placeholder="Select Better"
                                        style={{ width: '100%' }}
                                        value={set.products.better}
                                        onChange={(value) => updateProductSet(area.id, 'better', value, surface.name || surface.id)}
                                        loading={loading}
                                        size="small"
                                        showSearch
                                        filterOption={(input, option) =>
                                          option.label && typeof option.label === 'string'
                                            ? option.label.toLowerCase().includes(input.toLowerCase())
                                            : true
                                        }
                                      >
                                        {getAvailableProductsForAreaTier(area.id, 'better').map(product => (
                                          <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName}`}>
                                            {product.brandName} - {product.productName}
                                          </Option>
                                        ))}
                                      </Select>
                                      {set.products.better && (
                                        <div style={{ marginTop: 8, fontSize: 12 }}>
                                          <Text strong>${getProductById(set.products.better)?.pricePerGallon}/gal</Text>
                                        </div>
                                      )}
                                    </div>
                                  </Col>

                                  {/* Best Tier */}
                                  <Col xs={24} md={8}>
                                    <div style={{ padding: 10, background: '#f6ffed', borderRadius: 4 }}>
                                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Tag color="green">BEST</Tag>
                                        {set.products.best && (
                                          <Button 
                                            size="small" 
                                            type="link" 
                                            icon={<CopyOutlined />}
                                            onClick={() => copyProductToAllSurfaces('best', set.products.best, surface.name)}
                                            style={{ padding: 0, height: 'auto' }}
                                          >
                                            Copy to All
                                          </Button>
                                        )}
                                      </div>
                                      <Select
                                        placeholder="Select Best"
                                        style={{ width: '100%' }}
                                        value={set.products.best}
                                        onChange={(value) => updateProductSet(area.id, 'best', value, surface.name || surface.id)}
                                        loading={loading}
                                        size="small"
                                        showSearch
                                        filterOption={(input, option) =>
                                          option.label && typeof option.label === 'string'
                                            ? option.label.toLowerCase().includes(input.toLowerCase())
                                            : true
                                        }
                                      >
                                        {getAvailableProductsForAreaTier(area.id, 'best').map(product => (
                                          <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName}`}>
                                            {product.brandName} - {product.productName}
                                          </Option>
                                        ))}
                                      </Select>
                                      {set.products.best && (
                                        <div style={{ marginTop: 8, fontSize: 12 }}>
                                          <Text strong>${getProductById(set.products.best)?.pricePerGallon}/gal</Text>
                                        </div>
                                      )}
                                    </div>
                                  </Col>
                                </Row>
                              ) : (
                                <Row gutter={16} align="middle">
                                  <Col xs={24} md={18}>
                                    <Select
                                      placeholder="Select Product"
                                      style={{ width: '100%' }}
                                      value={set.products.single}
                                      onChange={(value) => updateProductSet(area.id, 'single', value, surface.name || surface.id)}
                                      loading={loading}
                                      size="small"
                                      showSearch
                                      filterOption={(input, option) =>
                                        option.label && typeof option.label === 'string'
                                          ? option.label.toLowerCase().includes(input.toLowerCase())
                                          : true
                                      }
                                    >
                                      {availableProducts.map(product => (
                                        <Option key={product.id} value={product.id} label={`${product.brandName} - ${product.productName} ($${product.pricePerGallon}/gal)`}>
                                          {product.brandName} - {product.productName} (${product.pricePerGallon}/gal)
                                        </Option>
                                      ))}
                                    </Select>
                                  </Col>
                                  <Col xs={24} md={6}>
                                    {set.products.single && (
                                      <Text type="secondary" style={{ fontSize: 12 }}>
                                        ${getProductById(set.products.single)?.pricePerGallon}/gal
                                      </Text>
                                    )}
                                  </Col>
                                </Row>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              };
            });

            return (
              <Collapse
                items={collapseItems}
                defaultActiveKey={areasWithSurfaces.length === 1 ? [areasWithSurfaces[0].id] : []}
                style={{ marginBottom: 24 }}
              />
            );
          })()}
        </div>
      )}

      {surfaceTypes.length === 0 && !isTurnkey && (
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
