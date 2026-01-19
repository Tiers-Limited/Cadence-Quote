/**
 * Seeder for default pricing schemes
 * Creates 4 default pricing schemes for each new tenant:
 * 1. Turnkey Pricing
 * 2. Flat Rate Unit Pricing
 * 3. Production-Based Pricing
 * 4. Rate-Based Square Foot Pricing
 */

const defaultPricingSchemes = [
  {
    name: 'Turnkey Pricing (Whole-Home)',
    type: 'turnkey',
    description: 'A single all-in price for the entire home based on total home square footage. Labor and materials are always included.',
    isDefault: true,
    isActive: true,
    pricingRules: {
      includeMaterials: true,
      coverage: 350,
      applicationMethod: 'roll',
      coats: 2,
      costPerGallon: 40,
      turnkeyRate: 3.50,
      interiorRate: 3.25,
      exteriorRate: 3.75,
    }
  },
  {
    name: 'Flat Rate Unit Pricing',
    type: 'flat_rate_unit',
    description: 'A fixed price per unit multiplied by quantity. Labor and materials are baked into the unit price.',
    isDefault: false,
    isActive: true,
    pricingRules: {
      includeMaterials: true,
      coverage: 350,
      applicationMethod: 'roll',
      coats: 2,
      costPerGallon: 40,
      unitPrices: {
        walls_sqft: 2.50,
        ceilings_sqft: 2.00,
        trim_linear_ft: 1.50,
        exterior_walls_sqft: 3.00,
        exterior_trim_linear_ft: 1.80,
        soffit_fascia_linear_ft: 2.00,
        gutters_linear_ft: 4.00,
        decks_railings_sqft: 2.50,
        door_unit: 85.00,
        window_unit: 75.00,
        cabinet_unit: 125.00,
        small_room_unit: 350.00,
        medium_room_unit: 450.00,
        large_room_unit: 600.00,
      }
    }
  },
  {
    name: 'Production-Based Pricing',
    type: 'production_based',
    description: 'Labor is calculated using production rates and hourly labor rates. Materials are calculated using paint coverage and are included by default.',
    isDefault: false,
    isActive: true,
    pricingRules: {
      includeMaterials: true,
      coverage: 350,
      applicationMethod: 'roll',
      coats: 2,
      costPerGallon: 40,
      hourlyLaborRate: 35.00,
      crewSize: 2,
      productionRates: {
        interior_walls: 5.00,
        interior_ceilings: 6.00,
        interior_trim: 5.00,
        exterior_siding: 6.00,
        exterior_trim: 5.00,
        soffit_fascia: 10.00,
      }
    }
  },
  {
    name: 'Rate-Based Square Foot Pricing',
    type: 'rate_based_sqft',
    description: 'Labor is calculated using a rate per square foot for each area. Materials are calculated using paint coverage and are included by default.',
    isDefault: false,
    isActive: true,
    pricingRules: {
      includeMaterials: true,
      coverage: 350,
      applicationMethod: 'roll',
      coats: 2,
      costPerGallon: 40,
      laborRates: {
        interior_walls: 5.00,
        interior_ceilings: 3.00,
        interior_trim: 5.00,
        interior_doors: 8.00,
        interior_cabinets: 10.00,
        drywall_repair: 10.00,
        accent_walls: 10.00,
        exterior_walls: 9.75,
        exterior_trim: 20.00,
        exterior_doors: 10.00,
        shutters: 50.00,
        decks_railings: 10.00,
        soffit_fascia: 10.00,
        prep_work: 10.00,
      }
    }
  }
];

/**
 * Create default pricing schemes for a tenant
 */
async function createDefaultPricingSchemesForTenant(tenantId, models) {
  try {
    const { PricingScheme } = models;
    
    // Check if schemes already exist for this tenant
    const existingSchemes = await PricingScheme.count({
      where: { tenantId }
    });
    
    if (existingSchemes > 0) {
      console.log(`Pricing schemes already exist for tenant ${tenantId}`);
      return;
    }

    // Create all default pricing schemes
    const createdSchemes = [];
    for (const scheme of defaultPricingSchemes) {
      const created = await PricingScheme.create({
        tenantId,
        ...scheme
      });
      createdSchemes.push(created);
      console.log(`Created pricing scheme: ${scheme.name} for tenant ${tenantId}`);
    }

    return createdSchemes;
  } catch (error) {
    console.error('Error creating default pricing schemes:', error);
    throw error;
  }
}

module.exports = {
  createDefaultPricingSchemesForTenant,
  defaultPricingSchemes
};
