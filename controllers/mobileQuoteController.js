// controllers/mobileQuoteController.js
/**
 * Mobile Quote Builder Controller
 * Handles product selection, pricing calculation, and booking for mobile app users
 * Phase 2: Product Selection + Pricing + Booking
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const Quote = require('../models/Quote');
const ProductConfig = require('../models/ProductConfig');
const GlobalProduct = require('../models/GlobalProduct');
const GlobalColor = require('../models/GlobalColor');
const Brand = require('../models/Brand');
const PricingScheme = require('../models/PricingScheme');
const ContractorSettings = require('../models/ContractorSettings');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const GBBProductDefaults = require('../models/GBBProductDefaults');
const LaborCategory = require('../models/LaborCategory');
const LaborRate = require('../models/LaborRate');


// Bobby's tenant email for mobile users
const BOBBY_TENANT_EMAIL = "bobby@primechoicepainting.com";

/**
 * Get Bobby's tenant ID
 */
const getBobbyTenantId = async () => {
  const tenant = await Tenant.findOne({
    where: { email: BOBBY_TENANT_EMAIL }
  });
  
  if (!tenant) {
    throw new Error('Bobby\'s tenant not found. Please contact support.');
  }
  
  return tenant.id;
};

/**
 * GET /api/v1/mbl/quote/pricing-schemes
 * Get available pricing schemes for mobile users
 */
exports.getPricingSchemes = async (req, res) => {
  try {
    

    const pricingSchemes = await PricingScheme.findAll({
      where: {
       
        isActive: true
      },
      attributes: ['id', 'name', 'description', 'isDefault'],
      order: [['isDefault', 'DESC'], ['name', 'ASC']]
    });

    return res.json({
      success: true,
      data: pricingSchemes,
      total: pricingSchemes.length
    });

  } catch (error) {
    console.error('Error fetching pricing schemes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing schemes',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/mbl/quote/brands
 * Get available brands for color selection
 */
exports.getBrands = async (req, res) => {
  try {
    const brands = await Brand.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'name', 'description'],
      order: [['name', 'ASC']]
    });

    return res.json({
      success: true,
      data: brands,
      total: brands.length
    });

  } catch (error) {
    console.error('Error fetching brands:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch brands',
      error: error.message
    });
  }
};

/**
 * POST /api/v1/mbl/quote/products-for-areas
 * Get products based on service areas and job type (GBB or Single Product strategy)
 * Uses GBBProductDefaults to get recommended products by tier
 */
exports.getProductsForAreas = async (req, res) => {
  try {
    const {
      jobType, // 'interior' or 'exterior'
      areas, // Array of areas with surfaces and measurements
      productStrategy = 'GBB', // 'GBB' or 'Single'
      pricingSchemeId
    } = req.body;

    if (!jobType || !areas || !Array.isArray(areas)) {
      return res.status(400).json({
        success: false,
        message: 'jobType and areas array are required'
      });
    }

    const tenantId = await getBobbyTenantId();

    // Get all unique surface types from areas
    const surfaceTypes = [...new Set(areas.flatMap(area => 
      area.surfaces.map(s => s.type)
    ))];

    // Get labor rates for this tenant
    const laborRates = await LaborRate.findAll({
      where: {
      
        isActive: true
      },
      include: [
        {
          model: LaborCategory,
          as: 'category',
          where: { isActive: true },
          required: true
        }
      ]
    });

    // Build labor rates map by category name
    const laborRatesMap = {};
    laborRates.forEach(lr => {
      laborRatesMap[lr.category.categoryName.toLowerCase()] = {
        categoryId: lr.laborCategoryId,
        categoryName: lr.category.categoryName,
        categoryType: lr.category.categoryType,
        measurementUnit: lr.category.measurementUnit,
        rate: parseFloat(lr.rate),
        description: lr.category.description
      };
    });

    // Build product recommendations per surface type
    const productRecommendations = {};

    for (const surfaceType of surfaceTypes) {
      // Map surface type to GBB surface type format
      let gbbSurfaceType = '';
      
      if (surfaceType === 'walls') {
        gbbSurfaceType = jobType === 'interior' ? 'interior_walls' : 'exterior_siding';
      } else if (surfaceType === 'ceiling') {
        gbbSurfaceType = 'interior_ceilings';
      } else if (surfaceType === 'trim' || surfaceType === 'baseboards' || surfaceType === 'doors') {
        gbbSurfaceType = jobType === 'interior' ? 'interior_trim_doors' : 'exterior_trim';
      } else if (surfaceType === 'cabinets') {
        gbbSurfaceType = 'cabinets';
      } else {
        // Default to walls
        gbbSurfaceType = jobType === 'interior' ? 'interior_walls' : 'exterior_siding';
      }

      if (productStrategy === 'GBB') {
        // Get GBB defaults for this surface type
        const gbbDefaults = await GBBProductDefaults.findOne({
          where: {
            surfaceType: gbbSurfaceType,
            isActive: true
          }
        });
      
        if (!gbbDefaults) {
          productRecommendations[surfaceType] = {
            surfaceType,
            strategy: 'GBB',
            good: null,
            better: null,
            best: null,
            allGoodProducts: [],
            allBetterProducts: [],
            allBestProducts: [],
            message: 'No GBB defaults configured for this surface type'
          };
          continue;
        }

        // Fetch Good, Better, Best products
        const productIds = [
          gbbDefaults.goodProductId,
          gbbDefaults.betterProductId,
          gbbDefaults.bestProductId
        ].filter(id => id !== null);

        if (productIds.length === 0) {
          productRecommendations[surfaceType] = {
            surfaceType,
            strategy: 'GBB',
            good: null,
            better: null,
            best: null,
            allGoodProducts: [],
            allBetterProducts: [],
            allBestProducts: []
          };
          continue;
        }

        const products = await ProductConfig.findAll({
          where: {
          
            globalProductId: { [Op.in]: productIds },
            isActive: true
          },
          include: [
            {
              model: GlobalProduct,
              as: 'globalProduct',
              where: {
                isActive: true
              },
              required: true,
              attributes: [
                'id', 'name', 'category', 'tier',
                'sheenOptions', 'notes'
              ],
              include: [
                {
                  model: Brand,
                  as: 'brand',
                  attributes: ['id', 'name', 'description']
                }
              ]
            }
          ],
          attributes: [
            'id', 'globalProductId', 'sheens', 'laborRates',
            'defaultMarkup', 'productMarkups', 'taxRate'
          ]
        });

        // Map products to their tiers using GBB defaults
        let goodProduct = null;
        let betterProduct = null;
        let bestProduct = null;

        products.forEach(config => {
          const formattedProduct = formatProductForMobile(config);
          
          if (config.globalProductId === gbbDefaults.goodProductId) {
            goodProduct = formattedProduct;
          } else if (config.globalProductId === gbbDefaults.betterProductId) {
            betterProduct = formattedProduct;
          } else if (config.globalProductId === gbbDefaults.bestProductId) {
            bestProduct = formattedProduct;
          }
        });

        // Get labor rate for this surface type
        let laborRate = null;
        if (surfaceType === 'walls') {
          laborRate = laborRatesMap['walls'] || null;
        } else if (surfaceType === 'ceiling') {
          laborRate = laborRatesMap['ceilings'] || null;
        } else if (surfaceType === 'trim' || surfaceType === 'baseboards') {
          laborRate = laborRatesMap['trim'] || null;
        } else if (surfaceType === 'doors') {
          laborRate = laborRatesMap['doors'] || null;
        } else if (surfaceType === 'cabinets') {
          laborRate = laborRatesMap['cabinets'] || null;
        }

        productRecommendations[surfaceType] = {
          surfaceType,
          strategy: 'GBB',
          good: goodProduct,
          better: betterProduct,
          best: bestProduct,
          allGoodProducts: goodProduct ? [goodProduct] : [],
          allBetterProducts: betterProduct ? [betterProduct] : [],
          allBestProducts: bestProduct ? [bestProduct] : [],
          laborRate: laborRate
        };
      } else {
        // Single Product strategy - return all products without GBB filtering
        const products = await ProductConfig.findAll({
          where: {
          
            isActive: true
          },
          include: [
            {
              model: GlobalProduct,
              as: 'globalProduct',
              where: {
                isActive: true,
                category: jobType === 'interior' ? 'Interior' : 'Exterior'
              },
              required: true,
              attributes: [
                'id', 'name', 'category', 'tier',
                'sheenOptions', 'notes'
              ],
              include: [
                {
                  model: Brand,
                  as: 'brand',
                  attributes: ['id', 'name', 'description']
                }
              ]
            }
          ],
          attributes: [
            'id', 'globalProductId', 'sheens', 'laborRates',
            'defaultMarkup', 'productMarkups', 'taxRate'
          ]
        });

        // Get labor rate for this surface type
        let laborRate = null;
        if (surfaceType === 'walls') {
          laborRate = laborRatesMap['walls'] || laborRatesMap['exterior walls'] || null;
        } else if (surfaceType === 'ceiling') {
          laborRate = laborRatesMap['ceilings'] || null;
        } else if (surfaceType === 'trim' || surfaceType === 'baseboards') {
          laborRate = laborRatesMap['trim'] || laborRatesMap['exterior trim'] || null;
        } else if (surfaceType === 'doors') {
          laborRate = laborRatesMap['doors'] || laborRatesMap['exterior doors'] || null;
        } else if (surfaceType === 'cabinets') {
          laborRate = laborRatesMap['cabinets'] || null;
        }

        productRecommendations[surfaceType] = {
          surfaceType,
          strategy: 'Single',
          products: products.map(config => formatProductForMobile(config)),
          laborRate: laborRate
        };
      }
    }

    return res.json({
      success: true,
      data: {
        jobType,
        productStrategy,
        surfaceTypes,
        productRecommendations
      }
    });

  } catch (error) {
    console.error('Error fetching products for areas:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

// Helper function to format product for mobile response
function formatProductForMobile(config) {
  const product = config.globalProduct;
  const sheens = config.sheens || [];
  
  // Calculate price range
  const prices = sheens.map(s => Number.parseFloat(s.price || 0));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  
  // Get contractor discount (retail price vs discounted price)
  const retailMarkup = 1.4; // 40% typical retail markup
  const discountedPrice = minPrice;
  const retailPrice = discountedPrice * retailMarkup;
  const savings = retailPrice - discountedPrice;
  const savingsPercent = retailPrice > 0 ? ((savings / retailPrice) * 100).toFixed(0) : 0;

  return {
    id: config.id,
    globalProductId: product.id,
    name: product.name,
    brand: product.brand?.name || 'Unknown',
    brandDescription: product.brand?.description || '',
    category: product.category,
    tier: product.tier,
    coverage: sheens[0]?.coverage || 350,
    notes: product.notes,
    sheenOptions: product.sheenOptions || [],
    availableSheens: sheens.map(s => ({
      name: s.sheen || s.name, // sheens array has 'sheen' property, not 'name'
      price: Number.parseFloat(s.price || 0),
      coverage: s.coverage || 350
    })),
    priceRange: {
      min: minPrice,
      max: maxPrice,
      currency: 'USD'
    },
    pricing: {
      discountedPrice: discountedPrice.toFixed(2),
      retailPrice: retailPrice.toFixed(2),
      yourSavings: savings.toFixed(2),
      savingsPercent: `${savingsPercent}%`,
      pricePerGallon: discountedPrice.toFixed(2)
    }
  };
}

/**
 * POST /api/v1/mbl/quote/calculate-pricing
 * Calculate complete pricing breakdown with materials, labor, markup, tax
 * Shows cost breakdown summary for mobile users
 */
exports.calculatePricing = async (req, res) => {
  try {
    const {
      areas, // Array of areas with surfaces, measurements, and product selections
      pricingSchemeId, // Optional pricing scheme
      useContractorDiscount // Boolean: if customer wants to use discount
    } = req.body;

    if (!areas || !Array.isArray(areas) || areas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Areas array is required'
      });
    }

    const tenantId = await getBobbyTenantId();

    // Get contractor settings for markup and tax
    const settings = await ContractorSettings.findOne({
      where: { tenantId }
    });

    const defaultMarkup = Number.parseFloat(settings?.defaultMarkupPercentage || 25);
    const taxRate = Number.parseFloat(settings?.taxRatePercentage || 8.25);
    const depositPercentage = Number.parseFloat(settings?.depositPercentage || 50);

    // Get labor rates
    const laborRates = await LaborRate.findAll({
      where: {
        tenantId,
        isActive: true
      },
      include: [
        {
          model: LaborCategory,
          as: 'category',
          where: { isActive: true },
          required: true
        }
      ]
    });

    // Build labor rates map
    const laborRatesMap = {};
    laborRates.forEach(lr => {
      const key = lr.category.categoryName.toLowerCase();
      laborRatesMap[key] = {
        categoryId: lr.laborCategoryId,
        categoryName: lr.category.categoryName,
        categoryType: lr.category.categoryType,
        measurementUnit: lr.category.measurementUnit,
        rate: parseFloat(lr.rate),
        description: lr.category.description
      };
    });

    let totalMaterialCost = 0;
    let totalLaborCost = 0;
    let totalSquareFeet = 0;
    const areaBreakdown = [];

    // Calculate for each area
    for (const area of areas) {
      const { 
        name,
        surfaces,
        productId,
        sheenName,
        numberOfCoats = 2,
        colorName,
        colorCode
      } = area;

      if (!productId || !sheenName) {
        return res.status(400).json({
          success: false,
          message: `Product and sheen are required for area: ${name}`
        });
      }

      // Get product details
      const productConfig = await ProductConfig.findByPk(productId, {
        include: [
          {
            model: GlobalProduct,
            as: 'globalProduct',
            include: [{ model: Brand, as: 'brand' }]
          }
        ]
      });

      if (!productConfig) {
        return res.status(404).json({
          success: false,
          message: `Product ${productId} not found`
        });
      }

      // Get selected sheen price and coverage
      const sheen = productConfig.sheens?.find(s => s.sheen === sheenName);
      if (!sheen) {
        return res.status(400).json({
          success: false,
          message: `Sheen ${sheenName} not found for product ${productConfig.globalProduct.name}`
        });
      }

      const pricePerGallon = Number.parseFloat(sheen.price || 0);
      const coverage = Number.parseFloat(sheen.coverage || 350);

      // Calculate labor and material costs per surface
      let areaLaborCost = 0;
      let areaMaterialCost = 0;
      let areaTotalSqft = 0;
      const surfaceDetails = [];

      for (const surface of surfaces) {
        const { type, width, height, length, measurementUnit, units = 1 } = surface;
        
        // Get labor rate for this surface type
        let laborRateData = null;
        if (type === 'walls') {
          laborRateData = laborRatesMap['walls'] || laborRatesMap['exterior walls'];
        } else if (type === 'ceiling' || type === 'ceilings') {
          laborRateData = laborRatesMap['ceilings'];
        } else if (type === 'trim' || type === 'baseboards') {
          laborRateData = laborRatesMap['trim'] || laborRatesMap['exterior trim'];
        } else if (type === 'doors') {
          laborRateData = laborRatesMap['doors'] || laborRatesMap['exterior doors'];
        } else if (type === 'cabinets') {
          laborRateData = laborRatesMap['cabinets'];
        }

        let surfaceLaborCost = 0;
        let surfaceSqft = 0;
        let dimensionDisplay = '';

        if (laborRateData) {
          // Calculate based on labor category's measurement unit
          if (laborRateData.measurementUnit === 'sqft') {
            // Calculate square feet based on surface measurement
            if (measurementUnit === 'sqft') {
              surfaceSqft = Number.parseFloat(width || 0);
            } else if (measurementUnit === 'linear_foot') {
              surfaceSqft = Number.parseFloat(length || 0) * Number.parseFloat(height || 8);
            } else if (measurementUnit === 'dimensions') {
              surfaceSqft = Number.parseFloat(width || 0) * Number.parseFloat(height || 0);
            }
            surfaceLaborCost = surfaceSqft * laborRateData.rate * numberOfCoats;
            dimensionDisplay = measurementUnit === 'linear_foot' 
              ? `${length}' L × ${height}' H`
              : `${width}' × ${height}'`;
              
          } else if (laborRateData.measurementUnit === 'linear_foot') {
            // Calculate linear feet
            const linearFeet = measurementUnit === 'linear_foot'
              ? Number.parseFloat(length || 0)
              : Number.parseFloat(width || 0);
            surfaceLaborCost = linearFeet * laborRateData.rate * numberOfCoats;
            // Still need sqft for material calculation
            surfaceSqft = measurementUnit === 'linear_foot'
              ? linearFeet * Number.parseFloat(height || 0.5)
              : linearFeet * 0.5; // Estimate for trim
            dimensionDisplay = `${linearFeet}' linear`;
            
          } else if (laborRateData.measurementUnit === 'unit') {
            // Unit-based (doors, cabinets)
            const unitCount = Number.parseFloat(units || 1);
            surfaceLaborCost = laborRateData.rate * unitCount * numberOfCoats;
            // Estimate sqft for material calculation (e.g., 20 sqft per door)
            surfaceSqft = unitCount * 20;
            dimensionDisplay = `${unitCount} unit(s)`;
            
          } else if (laborRateData.measurementUnit === 'hour') {
            // Hourly rate (drywall repair, prep work)
            const hours = Number.parseFloat(width || 1);
            surfaceLaborCost = laborRateData.rate * hours;
            surfaceSqft = 0; // No material needed for hourly work
            dimensionDisplay = `${hours} hour(s)`;
          }
        } else {
          // Fallback: default sqft calculation
          if (measurementUnit === 'sqft') {
            surfaceSqft = Number.parseFloat(width || 0);
          } else if (measurementUnit === 'linear_foot') {
            surfaceSqft = Number.parseFloat(length || 0) * Number.parseFloat(height || 8);
          } else {
            surfaceSqft = Number.parseFloat(width || 0) * Number.parseFloat(height || 0);
          }
          surfaceLaborCost = surfaceSqft * 1.5 * numberOfCoats; // Default $1.50/sqft
          dimensionDisplay = measurementUnit === 'linear_foot' 
            ? `${length}' L × ${height}' H`
            : `${width}' × ${height}'`;
        }

        areaLaborCost += surfaceLaborCost;
        areaTotalSqft += surfaceSqft;

        surfaceDetails.push({
          type,
          sqft: surfaceSqft.toFixed(2),
          dimensions: dimensionDisplay,
          laborRate: laborRateData ? laborRateData.rate : 1.5,
          laborCost: surfaceLaborCost.toFixed(2),
          measurementUnit: laborRateData?.measurementUnit || 'sqft'
        });
      }

      // Calculate material cost based on total square feet
      const gallonsNeeded = (areaTotalSqft / coverage) * numberOfCoats;
      areaMaterialCost = gallonsNeeded * pricePerGallon;

      totalMaterialCost += areaMaterialCost;
      totalLaborCost += areaLaborCost;
      totalSquareFeet += areaTotalSqft;

      areaBreakdown.push({
        area: name,
        product: productConfig.globalProduct.name,
        brand: productConfig.globalProduct.brand?.name || 'Unknown',
        sheen: sheenName,
        color: colorName || 'Not selected',
        colorCode: colorCode || '',
        squareFeet: areaTotalSqft.toFixed(2),
        surfaces: surfaceDetails,
        gallonsNeeded: gallonsNeeded.toFixed(2),
        pricePerGallon: pricePerGallon.toFixed(2),
        coverage: coverage.toFixed(0),
        materialCost: areaMaterialCost.toFixed(2),
        laborCost: areaLaborCost.toFixed(2),
        numberOfCoats,
        totalCostForArea: (areaMaterialCost + areaLaborCost).toFixed(2)
      });
    }

    // Calculate pricing with and without contractor discount
    const retailMarkup = 1.4; // 40% retail markup
    const materialCostRetail = totalMaterialCost * retailMarkup;
    const materialSavings = materialCostRetail - totalMaterialCost;

    // Contractor discount option
    const contractorDiscountFee = totalMaterialCost * 0.15; // 15% fee to use discount
    const totalIfDiscountOnly = totalMaterialCost + contractorDiscountFee;
    
    // Full job option - Apply markup and tax
    const markup = totalMaterialCost * (defaultMarkup / 100);
    const subtotal = totalMaterialCost + markup;
    const tax = subtotal * (taxRate / 100);
    const totalWithTax = subtotal + tax + totalLaborCost;
    
    // Calculate deposit
    const depositAmount = totalWithTax * (depositPercentage / 100);
    const remainingBalance = totalWithTax - depositAmount;

    return res.json({
      success: true,
      data: {
        areaBreakdown, // Detailed breakdown per area
        summary: {
          totalSquareFeet: totalSquareFeet.toFixed(2),
          totalGallons: areaBreakdown.reduce((sum, b) => sum + Number.parseFloat(b.gallonsNeeded), 0).toFixed(2),
          totalAreas: areas.length,
          
          // Material costs
          materialCostWithDiscount: totalMaterialCost.toFixed(2),
          materialCostRetail: materialCostRetail.toFixed(2),
          materialSavings: materialSavings.toFixed(2),
          savingsPercent: ((materialSavings / materialCostRetail) * 100).toFixed(0) + '%',
          
          // Labor costs
          laborCost: totalLaborCost.toFixed(2),
          
          // Discount-only option
          contractorDiscountFee: contractorDiscountFee.toFixed(2),
          totalIfDiscountOnly: totalIfDiscountOnly.toFixed(2),
          
          // Full job option
          markup: markup.toFixed(2),
          markupPercent: defaultMarkup.toFixed(2) + '%',
          subtotalBeforeTax: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          taxPercent: taxRate.toFixed(2) + '%',
          fullJobTotal: totalWithTax.toFixed(2),
          
          // Payment terms
          depositRequired: depositAmount.toFixed(2),
          depositPercent: depositPercentage.toFixed(0) + '%',
          remainingBalance: remainingBalance.toFixed(2),
          
          // Comparison
          fullJobSavings: materialSavings.toFixed(2),
          youSave: materialSavings.toFixed(2),
          recommendedOption: useContractorDiscount ? 'discount' : 'fullJob'
        },
        paymentSchedule: {
          deposit: {
            amount: depositAmount.toFixed(2),
            percentage: depositPercentage,
            dueAt: 'Upon approval'
          },
          finalPayment: {
            amount: remainingBalance.toFixed(2),
            percentage: (100 - depositPercentage),
            dueAt: 'Upon completion'
          }
        }
      }
    });

  } catch (error) {
    console.error('Error calculating pricing:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate pricing',
      error: error.message
    });
  }
};

/**
 * POST /api/mobile/quote/create-draft
 * Create a draft quote with selected products
 */
exports.createDraftQuote = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      areas,
      useContractorDiscount,
      notes
    } = req.body;

    const tenantId = await getBobbyTenantId();

    // Get user details
    const user = await User.findByPk(userId);

    // Calculate pricing first
    const pricingResult = await calculatePricingHelper(areas, tenantId);

    // Create quote
    const quote = await Quote.create({
      tenantId,
      userId,
      customerName: user.fullName,
      customerEmail: user.email,
      customerPhone: user.phoneNumber,
      propertyAddress: user.address,
      jobType: 'residential',
      jobCategory: 'interior',
      status: 'draft',
      areas: areas,
      useContractorDiscount: useContractorDiscount || false,
      notes: notes || '',
      ...pricingResult.totals
    });

    return res.json({
      success: true,
      message: 'Draft quote created successfully',
      data: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        ...pricingResult
      }
    });

  } catch (error) {
    console.error('Error creating draft quote:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create draft quote',
      error: error.message
    });
  }
};

/**
 * GET /api/v1/mbl/quote/colors-by-brand/:brandId
 * Get colors for a specific brand
 */
exports.getColorsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { search, colorFamily, limit = 100 } = req.query;

    const where = {
      brandId: parseInt(brandId),
      isActive: true
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Note: GlobalColor doesn't have colorFamily field in schema
    // Colors are not grouped by family

    const colors = await GlobalColor.findAll({
      where,
      include: [
        {
          model: Brand,
          as: 'brand',
          attributes: ['id', 'name']
        }
      ],
      attributes: ['id', 'name', 'code', 'hexValue', 'red', 'green', 'blue', 'sampleImage'],
      order: [['name', 'ASC']],
      limit: parseInt(limit)
    });

    return res.json({
      success: true,
      data: {
        brandId: parseInt(brandId),
        brandName: colors[0]?.brand?.name || 'Unknown',
        colors: colors.map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
          hexValue: c.hexValue,
          rgb: c.red && c.green && c.blue ? {
            r: c.red,
            g: c.green,
            b: c.blue
          } : null,
          sampleImage: c.sampleImage
        })),
        total: colors.length
      }
    });

  } catch (error) {
    console.error('Error fetching colors by brand:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch colors',
      error: error.message
    });
  }
};

/**
 * POST /api/v1/mbl/quote/assign-products
 * Assign products to areas (either apply to all or individually)
 */
exports.assignProducts = async (req, res) => {
  try {
    const {
      areas, // Updated areas with product selections
      applyToAll, // Boolean: apply same product to all areas
      productSelections // If applyToAll: { productId, sheenName } else array of selections per area
    } = req.body;

    if (!areas || !Array.isArray(areas)) {
      return res.status(400).json({
        success: false,
        message: 'Areas array is required'
      });
    }

    const tenantId = await getBobbyTenantId();
    const updatedAreas = [];

    if (applyToAll && productSelections) {
      // Apply same product to all areas
      const { productId, sheenName } = productSelections;

      // Validate product exists
      const productConfig = await ProductConfig.findByPk(productId, {
        include: [{ model: GlobalProduct, as: 'globalProduct' }]
      });

      if (!productConfig) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Apply to all areas
      for (const area of areas) {
        updatedAreas.push({
          ...area,
          productId,
          sheenName,
          productName: productConfig.globalProduct.name
        });
      }
    } else {
      // Individual product selection per area
      for (const area of areas) {
        if (area.productId) {
          const productConfig = await ProductConfig.findByPk(area.productId, {
            include: [{ model: GlobalProduct, as: 'globalProduct' }]
          });

          updatedAreas.push({
            ...area,
            productName: productConfig?.globalProduct?.name || 'Unknown Product'
          });
        } else {
          updatedAreas.push(area);
        }
      }
    }

    return res.json({
      success: true,
      message: 'Products assigned successfully',
      data: {
        areas: updatedAreas,
        applyToAll
      }
    });

  } catch (error) {
    console.error('Error assigning products:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign products',
      error: error.message
    });
  }
};

/**
 * POST /api/mobile/quote/assign-colors
 * Assign colors to areas in a quote
 */
exports.assignColors = async (req, res) => {
  try {
    const { quoteId, colorAssignments } = req.body;
    
    if (!quoteId || !colorAssignments || !Array.isArray(colorAssignments)) {
      return res.status(400).json({
        success: false,
        message: 'quoteId and colorAssignments array are required'
      });
    }

    const quote = await Quote.findByPk(quoteId);
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Verify ownership
    if (quote.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this quote'
      });
    }

    // Update areas with color assignments
    const updatedAreas = quote.areas.map(area => {
      const assignment = colorAssignments.find(ca => ca.areaName === area.name);
      if (assignment) {
        return {
          ...area,
          colorId: assignment.colorId,
          colorName: assignment.colorName,
          colorCode: assignment.colorCode
        };
      }
      return area;
    });

    quote.areas = updatedAreas;
    await quote.save();

    return res.json({
      success: true,
      message: 'Colors assigned successfully',
      data: {
        quoteId: quote.id,
        areas: updatedAreas
      }
    });

  } catch (error) {
    console.error('Error assigning colors:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign colors',
      error: error.message
    });
  }
};

/**
 * POST /api/mobile/quote/request-booking
 * Request a booking date for the quote
 */
exports.requestBooking = async (req, res) => {
  try {
    const {
      quoteId,
      preferredDate,
      alternateDate1,
      alternateDate2,
      timePreference, // morning, afternoon, flexible
      additionalNotes
    } = req.body;

    if (!quoteId || !preferredDate) {
      return res.status(400).json({
        success: false,
        message: 'quoteId and preferredDate are required'
      });
    }

    const quote = await Quote.findByPk(quoteId);
    
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Verify ownership
    if (quote.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this quote'
      });
    }

    // Update quote with booking request
    quote.status = 'sent'; // Move from draft to sent
    quote.sentAt = new Date();
    quote.bookingRequest = {
      preferredDate,
      alternateDate1,
      alternateDate2,
      timePreference: timePreference || 'flexible',
      additionalNotes,
      requestedAt: new Date()
    };

    await quote.save();

    // TODO: Send notification to Bobby/contractor
    // TODO: Create booking/appointment record

    return res.json({
      success: true,
      message: 'Booking request submitted successfully',
      data: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        bookingRequest: quote.bookingRequest,
        nextSteps: [
          'Your booking request has been sent to Prime Choice Painting',
          'You will receive a confirmation within 24 hours',
          'We will contact you to confirm the final date and time'
        ]
      }
    });

  } catch (error) {
    console.error('Error requesting booking:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to request booking',
      error: error.message
    });
  }
};

/**
 * GET /api/mobile/quote/my-quotes
 * Get all quotes for the logged-in mobile user
 */
exports.getMyQuotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;

    const where = { userId };
    
    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows: quotes } = await Quote.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      attributes: [
        'id', 'quoteNumber', 'status', 'total', 'totalSqft',
        'useContractorDiscount', 'createdAt', 'sentAt', 'approvedAt'
      ]
    });

    return res.json({
      success: true,
      data: quotes.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        status: q.status,
        total: Number.parseFloat(q.total || 0).toFixed(2),
        totalSqft: q.totalSqft,
        useContractorDiscount: q.useContractorDiscount,
        createdAt: q.createdAt,
        sentAt: q.sentAt,
        approvedAt: q.approvedAt
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching user quotes:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch quotes',
      error: error.message
    });
  }
};

/**
 * GET /api/mobile/quote/:id
 * Get detailed quote information
 */
exports.getQuoteDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const quote = await Quote.findByPk(id);

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found'
      });
    }

    // Verify ownership
    if (quote.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this quote'
      });
    }

    return res.json({
      success: true,
      data: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
        customerPhone: quote.customerPhone,
        propertyAddress: quote.propertyAddress,
        areas: quote.areas,
        useContractorDiscount: quote.useContractorDiscount,
        pricing: {
          subtotal: quote.subtotal,
          laborTotal: quote.laborTotal,
          materialTotal: quote.materialTotal,
          markup: quote.markup,
          tax: quote.tax,
          total: quote.total,
          totalSqft: quote.totalSqft
        },
        bookingRequest: quote.bookingRequest,
        notes: quote.notes,
        createdAt: quote.createdAt,
        sentAt: quote.sentAt,
        approvedAt: quote.approvedAt
      }
    });

  } catch (error) {
    console.error('Error fetching quote details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch quote details',
      error: error.message
    });
  }
};

// Helper function for pricing calculation
async function calculatePricingHelper(areas, tenantId) {
  const settings = await ContractorSettings.findOne({
    where: { tenantId }
  });

  const defaultMarkup = Number.parseFloat(settings?.defaultMarkupPercentage || 25);
  const taxRate = Number.parseFloat(settings?.taxRatePercentage || 8.25);

  let totalMaterialCost = 0;
  let totalLaborCost = 0;
  let totalSquareFeet = 0;

  for (const area of areas) {
    const productConfig = await ProductConfig.findByPk(area.productId, {
      include: [{ model: GlobalProduct, as: 'globalProduct' }]
    });

    const sheen = productConfig.sheens.find(s => s.sheen === area.sheenName);
    const pricePerGallon = Number.parseFloat(sheen?.price || 0);
    const coverage = sheen?.coverage || 350;

    let areaSqft = 0;
    for (const surface of area.surfaces) {
      if (surface.measurementUnit === 'sqft') {
        areaSqft += Number.parseFloat(surface.width || 0);
      } else {
        areaSqft += Number.parseFloat(surface.width || 0) * Number.parseFloat(surface.height || 0);
      }
    }

    totalSquareFeet += areaSqft;
    const gallonsNeeded = (areaSqft / coverage) * (area.numberOfCoats || 2);
    totalMaterialCost += gallonsNeeded * pricePerGallon;
    
    const laborRate = productConfig.laborRates?.walls || 1.5;
    totalLaborCost += areaSqft * laborRate * (area.numberOfCoats || 2);
  }

  const markup = totalMaterialCost * (defaultMarkup / 100);
  const subtotal = totalMaterialCost + markup;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax + totalLaborCost;

  return {
    totals: {
      subtotal: subtotal.toFixed(2),
      laborTotal: totalLaborCost.toFixed(2),
      materialTotal: totalMaterialCost.toFixed(2),
      markup: markup.toFixed(2),
      markupPercent: defaultMarkup,
      tax: tax.toFixed(2),
      taxPercent: taxRate,
      total: total.toFixed(2),
      totalSqft: totalSquareFeet.toFixed(2)
    }
  };
}
