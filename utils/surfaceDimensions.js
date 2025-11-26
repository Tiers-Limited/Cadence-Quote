// utils/surfaceDimensions.js
// Professional surface dimension configurations for quote builder
// Defines which dimensions are required/relevant for each surface type

/**
 * Surface dimension configurations
 * Defines which measurements are needed based on surface type
 */
const SURFACE_DIMENSION_CONFIG = {
  // Walls - need length and height
  walls: {
    required: ['length', 'height'],
    optional: ['width'], // For room perimeter calculation
    calculation: 'perimeter', // or 'direct'
    unit: 'sq ft',
    formula: '(length + width) * 2 * height',
    description: 'Calculate wall area using room dimensions'
  },
  
  // Ceilings - need length and width (no height)
  ceiling: {
    required: ['length', 'width'],
    optional: [],
    calculation: 'area',
    unit: 'sq ft',
    formula: 'length * width',
    description: 'Calculate ceiling area'
  },
  
  // Trim - linear measurement only
  trim: {
    required: ['linearFeet'],
    optional: ['height'], // For baseboard height or crown molding
    calculation: 'linear',
    unit: 'linear ft',
    formula: 'linearFeet',
    description: 'Measure trim in linear feet'
  },
  
  // Doors - count or individual measurements
  doors: {
    required: ['count'],
    optional: ['height', 'width'],
    calculation: 'unit',
    unit: 'each',
    formula: 'count * (height * width || standardSize)',
    description: 'Count doors or measure individually',
    standardSize: 21 // Standard door area in sq ft (7ft x 3ft)
  },
  
  // Windows - count or individual measurements  
  windows: {
    required: ['count'],
    optional: ['height', 'width'],
    calculation: 'unit',
    unit: 'each',
    formula: 'count * (height * width || standardSize)',
    description: 'Count windows or measure individually',
    standardSize: 15 // Standard window area in sq ft
  },
  
  // Cabinets - linear feet or square feet
  cabinets: {
    required: ['linearFeet'],
    optional: ['height', 'depth'],
    calculation: 'linear_or_area',
    unit: 'linear ft',
    alternateUnit: 'sq ft',
    formula: 'linearFeet || (width * height)',
    description: 'Measure cabinet fronts in linear feet or total area'
  },
  
  // Shutters - count
  shutters: {
    required: ['count'],
    optional: ['height', 'width'],
    calculation: 'unit',
    unit: 'each',
    formula: 'count',
    description: 'Count individual shutters'
  },
  
  // Deck/Fence - square feet or linear feet
  deck: {
    required: ['length', 'width'],
    optional: [],
    calculation: 'area',
    unit: 'sq ft',
    formula: 'length * width',
    description: 'Calculate deck surface area'
  },
  
  fence: {
    required: ['linearFeet', 'height'],
    optional: [],
    calculation: 'linear',
    unit: 'linear ft',
    formula: 'linearFeet * height',
    description: 'Measure fence in linear feet with height'
  },
  
  // Garage Door
  garageDoor: {
    required: ['count'],
    optional: ['height', 'width'],
    calculation: 'unit',
    unit: 'each',
    formula: 'count * (height * width || standardSize)',
    description: 'Count garage doors',
    standardSize: 120 // Standard 2-car garage door (16ft x 7.5ft)
  },
  
  // Custom/Other - allow any combination
  custom: {
    required: [],
    optional: ['length', 'width', 'height', 'linearFeet', 'count', 'directArea'],
    calculation: 'flexible',
    unit: 'sq ft',
    formula: 'user_defined',
    description: 'Custom surface with flexible measurements'
  }
};

/**
 * Get dimension fields for a specific surface type
 * @param {string} surfaceType - Type of surface (walls, ceiling, trim, etc.)
 * @returns {object} Configuration object with required/optional fields
 */
function getDimensionFields(surfaceType) {
  const normalizedType = surfaceType.toLowerCase().replace(/\s+/g, '');
  
  // Map common variations to standard types
  const typeMap = {
    'wall': 'walls',
    'walls': 'walls',
    'ceiling': 'ceiling',
    'ceilings': 'ceiling',
    'trim': 'trim',
    'baseboard': 'trim',
    'crownmolding': 'trim',
    'door': 'doors',
    'doors': 'doors',
    'window': 'windows',
    'windows': 'windows',
    'cabinet': 'cabinets',
    'cabinets': 'cabinets',
    'shutter': 'shutters',
    'shutters': 'shutters',
    'deck': 'deck',
    'fence': 'fence',
    'garagedoor': 'garageDoor',
    'garage': 'garageDoor'
  };
  
  const standardType = typeMap[normalizedType] || 'custom';
  return SURFACE_DIMENSION_CONFIG[standardType] || SURFACE_DIMENSION_CONFIG.custom;
}

/**
 * Calculate surface area based on dimensions and surface type
 * @param {object} dimensions - Object containing measurement values
 * @param {string} surfaceType - Type of surface
 * @returns {number} Calculated area in square feet or linear feet
 */
function calculateSurfaceArea(dimensions, surfaceType) {
  const config = getDimensionFields(surfaceType);
  const { length = 0, width = 0, height = 0, linearFeet = 0, count = 0, directArea = 0 } = dimensions;
  
  // If direct area is provided, use it
  if (directArea > 0) return directArea;
  
  switch (config.calculation) {
    case 'perimeter':
      // Walls: (L + W) * 2 * H - openings
      if (length && width && height) {
        return (parseFloat(length) + parseFloat(width)) * 2 * parseFloat(height);
      } else if (length && height) {
        // Single wall
        return parseFloat(length) * parseFloat(height);
      }
      return 0;
      
    case 'area':
      // Ceiling/Deck: L * W
      if (length && width) {
        return parseFloat(length) * parseFloat(width);
      }
      return 0;
      
    case 'linear':
      // Trim/Fence: linear feet (or linear feet * height for fence)
      if (linearFeet) {
        if (height && surfaceType.toLowerCase().includes('fence')) {
          return parseFloat(linearFeet) * parseFloat(height);
        }
        return parseFloat(linearFeet);
      }
      return 0;
      
    case 'unit':
      // Doors/Windows/Shutters: count * area
      if (count) {
        if (height && width) {
          return parseFloat(count) * parseFloat(height) * parseFloat(width);
        }
        // Use standard size if dimensions not provided
        return parseFloat(count) * (config.standardSize || 1);
      }
      return 0;
      
    case 'linear_or_area':
      // Cabinets: prefer linear feet, fallback to area
      if (linearFeet) {
        return parseFloat(linearFeet);
      } else if (width && height) {
        return parseFloat(width) * parseFloat(height);
      }
      return 0;
      
    default:
      return 0;
  }
}

/**
 * Validate dimensions for a surface type
 * @param {object} dimensions - Dimension values to validate
 * @param {string} surfaceType - Type of surface
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateDimensions(dimensions, surfaceType) {
  const config = getDimensionFields(surfaceType);
  const errors = [];
  
  // Check required fields
  for (const field of config.required) {
    if (!dimensions[field] || parseFloat(dimensions[field]) <= 0) {
      errors.push(`${field} is required for ${surfaceType}`);
    }
  }
  
  // Check that at least one measurement method is provided
  if (config.calculation === 'flexible' && !dimensions.directArea) {
    const hasAnyMeasurement = config.optional.some(field => 
      dimensions[field] && parseFloat(dimensions[field]) > 0
    );
    if (!hasAnyMeasurement) {
      errors.push('At least one measurement is required');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get form fields configuration for frontend
 * @param {string} surfaceType - Type of surface
 * @returns {object} Field configuration for form rendering
 */
function getFormFields(surfaceType) {
  const config = getDimensionFields(surfaceType);
  
  const fieldDefinitions = {
    length: {
      label: 'Length',
      type: 'number',
      unit: 'ft',
      placeholder: 'Enter length',
      min: 0,
      step: 0.1
    },
    width: {
      label: 'Width',
      type: 'number',
      unit: 'ft',
      placeholder: 'Enter width',
      min: 0,
      step: 0.1
    },
    height: {
      label: 'Height',
      type: 'number',
      unit: 'ft',
      placeholder: 'Enter height',
      min: 0,
      step: 0.1
    },
    linearFeet: {
      label: 'Linear Feet',
      type: 'number',
      unit: 'linear ft',
      placeholder: 'Enter linear feet',
      min: 0,
      step: 0.1
    },
    count: {
      label: 'Quantity',
      type: 'number',
      unit: 'count',
      placeholder: 'Enter quantity',
      min: 1,
      step: 1
    },
    directArea: {
      label: 'Direct Area',
      type: 'number',
      unit: 'sq ft',
      placeholder: 'Enter area directly',
      min: 0,
      step: 0.1,
      help: 'Or enter area directly if already calculated'
    }
  };
  
  return {
    surfaceType,
    calculation: config.calculation,
    unit: config.unit,
    description: config.description,
    required: config.required.map(field => ({
      name: field,
      ...fieldDefinitions[field],
      required: true
    })),
    optional: config.optional.map(field => ({
      name: field,
      ...fieldDefinitions[field],
      required: false
    }))
  };
}

module.exports = {
  SURFACE_DIMENSION_CONFIG,
  getDimensionFields,
  calculateSurfaceArea,
  validateDimensions,
  getFormFields
};
