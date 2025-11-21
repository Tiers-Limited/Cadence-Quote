// utils/laborDefaults.js
// NEW FEATURE: Default labor rates for contractor product configurations
// These defaults are used when creating new product configs and can be customized per tenant

/**
 * Default labor rates for interior painting work
 * Each rate includes category, rate, unit, and description
 */
const DEFAULT_INTERIOR_LABOR_RATES = [
  {
    id: 1,
    category: 'Walls',
    rate: 3.50,
    unit: 'per sq ft',
    description: 'Interior wall painting including prep, primer, and two coats'
  },
  {
    id: 2,
    category: 'Ceiling',
    rate: 2.50,
    unit: 'per sq ft',
    description: 'Ceiling painting with standard prep and two coats'
  },
  {
    id: 3,
    category: 'Trim',
    rate: 12.00,
    unit: 'per LF',
    description: 'Baseboards, crown molding, door/window trim'
  },
  {
    id: 4,
    category: 'Doors',
    rate: 75.00,
    unit: 'per door',
    description: 'Interior door painting (both sides), including frame'
  },
  {
    id: 5,
    category: 'Cabinets',
    rate: 8.00,
    unit: 'per sq ft',
    description: 'Cabinet painting with prep, primer, and finish coats'
  },
  {
    id: 6,
    category: 'Custom',
    rate: 0.00,
    unit: 'per sq ft',
    description: 'Custom interior work - rate to be determined'
  }
];

/**
 * Default labor rates for exterior painting work
 * Typically higher rates due to outdoor conditions and complexity
 */
const DEFAULT_EXTERIOR_LABOR_RATES = [
  {
    id: 1,
    category: 'Walls/Siding',
    rate: 4.50,
    unit: 'per sq ft',
    description: 'Exterior wall/siding painting including power wash, prep, primer, and two coats'
  },
  {
    id: 2,
    category: 'Trim',
    rate: 15.00,
    unit: 'per LF',
    description: 'Exterior trim, fascia, and soffit'
  },
  {
    id: 3,
    category: 'Doors',
    rate: 125.00,
    unit: 'per door',
    description: 'Exterior door painting including frame and threshold'
  },
  {
    id: 4,
    category: 'Windows',
    rate: 45.00,
    unit: 'per window',
    description: 'Window painting including frames and sills'
  },
  {
    id: 5,
    category: 'Deck/Fence',
    rate: 3.50,
    unit: 'per sq ft',
    description: 'Deck or fence staining/painting with prep'
  },
  {
    id: 6,
    category: 'Custom',
    rate: 0.00,
    unit: 'per sq ft',
    description: 'Custom exterior work - rate to be determined'
  }
];

/**
 * Complete labor rates object combining interior and exterior
 * This structure is stored in JSONB column in database
 */
const DEFAULT_LABOR_RATES = {
  interior: DEFAULT_INTERIOR_LABOR_RATES,
  exterior: DEFAULT_EXTERIOR_LABOR_RATES
};

/**
 * Default coverage value for paint products (square feet per gallon)
 * Industry standard for most interior/exterior paints
 */
const DEFAULT_COVERAGE = 350;

/**
 * Default markup percentage for products
 */
const DEFAULT_MARKUP = 15.00;

/**
 * Default tax rate (0% as it varies by location)
 */
const DEFAULT_TAX_RATE = 0.00;

module.exports = {
  DEFAULT_LABOR_RATES,
  DEFAULT_INTERIOR_LABOR_RATES,
  DEFAULT_EXTERIOR_LABOR_RATES,
  DEFAULT_COVERAGE,
  DEFAULT_MARKUP,
  DEFAULT_TAX_RATE
};
