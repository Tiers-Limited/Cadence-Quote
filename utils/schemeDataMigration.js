// utils/schemeDataMigration.js
/**
 * Data Migration and Validation Utilities for Pricing Scheme Changes
 * **Feature: cadence-quote-builder-update, Task 7.2**
 * **Validates: Requirements 6.4**
 */

/**
 * Validate data compatibility when switching pricing schemes
 * @param {object} currentData - Current quote data
 * @param {string} fromScheme - Current pricing scheme type
 * @param {string} toScheme - Target pricing scheme type
 * @returns {object} - Validation result with compatibility info
 */
function validateSchemeCompatibility(currentData, fromScheme, toScheme) {
  const compatibility = {
    isCompatible: true,
    warnings: [],
    dataLoss: [],
    migrations: []
  };

  // Define scheme data requirements
  const schemeRequirements = {
    'turnkey': ['homeSqft', 'jobScope', 'propertyCondition'],
    'rate_based_sqft': ['areas'],
    'production_based': ['areas', 'paintersOnSite'],
    'flat_rate_unit': ['flatRateItems']
  };

  // Check if current data has required fields for target scheme
  const requiredFields = schemeRequirements[toScheme] || [];
  const missingFields = requiredFields.filter(field => {
    if (field === 'areas') {
      return !currentData.areas || !Array.isArray(currentData.areas) || currentData.areas.length === 0;
    }
    if (field === 'flatRateItems') {
      return !currentData.flatRateItems || Object.keys(currentData.flatRateItems).length === 0;
    }
    return !currentData[field];
  });

  if (missingFields.length > 0) {
    compatibility.warnings.push(`Target scheme requires: ${missingFields.join(', ')}`);
  }

  // Check for data that will be lost in transition
  const currentFields = schemeRequirements[fromScheme] || [];
  const targetFields = schemeRequirements[toScheme] || [];
  const lostFields = currentFields.filter(field => !targetFields.includes(field));

  if (lostFields.length > 0) {
    compatibility.dataLoss = lostFields;
    compatibility.warnings.push(`Data will be lost: ${lostFields.join(', ')}`);
  }

  // Specific compatibility checks
  switch (`${fromScheme}_to_${toScheme}`) {
    case 'turnkey_to_rate_based_sqft':
    case 'turnkey_to_production_based':
      if (!currentData.areas || currentData.areas.length === 0) {
        compatibility.isCompatible = false;
        compatibility.warnings.push('Areas must be defined before switching to area-based pricing');
      }
      break;

    case 'rate_based_sqft_to_turnkey':
    case 'production_based_to_turnkey':
      if (!currentData.homeSqft || currentData.homeSqft <= 0) {
        compatibility.warnings.push('Home square footage should be set for turnkey pricing');
      }
      break;

    case 'flat_rate_unit_to_rate_based_sqft':
    case 'flat_rate_unit_to_production_based':
      if (currentData.flatRateItems && Object.keys(currentData.flatRateItems).length > 0) {
        compatibility.migrations.push('Convert flat rate items to areas');
        compatibility.warnings.push('Flat rate items will be converted to areas - review quantities');
      }
      break;

    case 'rate_based_sqft_to_flat_rate_unit':
    case 'production_based_to_flat_rate_unit':
      if (currentData.areas && currentData.areas.length > 0) {
        compatibility.migrations.push('Convert areas to flat rate items');
        compatibility.warnings.push('Areas will be converted to flat rate items - review quantities');
      }
      break;
  }

  return compatibility;
}

/**
 * Migrate quote data when changing pricing schemes
 * @param {object} quoteData - Current quote data
 * @param {string} fromScheme - Current pricing scheme type
 * @param {string} toScheme - Target pricing scheme type
 * @returns {object} - Migrated quote data
 */
function migrateQuoteData(quoteData, fromScheme, toScheme) {
  const migratedData = { ...quoteData };
  const migrationLog = [];

  // Reset pricing-specific calculations
  migratedData.subtotal = 0;
  migratedData.laborTotal = 0;
  migratedData.materialTotal = 0;
  migratedData.total = 0;
  migratedData.breakdown = null;

  switch (`${fromScheme}_to_${toScheme}`) {
    case 'turnkey_to_rate_based_sqft':
    case 'turnkey_to_production_based':
      // Preserve home sqft as reference, but areas will need to be defined
      if (!migratedData.areas || migratedData.areas.length === 0) {
        migratedData.areas = [];
        migrationLog.push('Cleared areas - will need to be redefined for area-based pricing');
      }
      break;

    case 'rate_based_sqft_to_turnkey':
    case 'production_based_to_turnkey':
      // Calculate total sqft from areas if homeSqft not set
      if ((!migratedData.homeSqft || migratedData.homeSqft <= 0) && migratedData.areas) {
        const totalSqft = calculateTotalSqftFromAreas(migratedData.areas);
        if (totalSqft > 0) {
          migratedData.homeSqft = totalSqft;
          migrationLog.push(`Set home sqft to ${totalSqft} based on area calculations`);
        }
      }
      // Clear area-specific data
      migratedData.areas = [];
      migrationLog.push('Cleared areas data for turnkey pricing');
      break;

    case 'flat_rate_unit_to_rate_based_sqft':
    case 'flat_rate_unit_to_production_based':
      // Convert flat rate items to basic areas structure
      if (migratedData.flatRateItems && Object.keys(migratedData.flatRateItems).length > 0) {
        migratedData.areas = convertFlatRateItemsToAreas(migratedData.flatRateItems);
        migrationLog.push('Converted flat rate items to areas - review and adjust quantities');
      }
      migratedData.flatRateItems = {};
      break;

    case 'rate_based_sqft_to_flat_rate_unit':
    case 'production_based_to_flat_rate_unit':
      // Convert areas to flat rate items (best effort)
      if (migratedData.areas && migratedData.areas.length > 0) {
        migratedData.flatRateItems = convertAreasToFlatRateItems(migratedData.areas);
        migrationLog.push('Converted areas to flat rate items - review and adjust quantities');
      }
      migratedData.areas = [];
      break;

    case 'production_based_to_rate_based_sqft':
    case 'rate_based_sqft_to_production_based':
      // These are compatible - just preserve areas
      migrationLog.push('Preserved areas data - compatible schemes');
      break;

    default:
      migrationLog.push('No specific migration needed');
  }

  // Set default values for new scheme requirements
  switch (toScheme) {
    case 'production_based':
      if (!migratedData.paintersOnSite) {
        migratedData.paintersOnSite = 2;
        migrationLog.push('Set default painters on site to 2');
      }
      break;
    case 'turnkey':
      if (!migratedData.propertyCondition) {
        migratedData.propertyCondition = 'average';
        migrationLog.push('Set default property condition to average');
      }
      break;
  }

  return {
    data: migratedData,
    migrationLog
  };
}

/**
 * Create rollback data for failed scheme changes
 * @param {object} originalData - Original quote data before migration
 * @param {string} originalScheme - Original pricing scheme
 * @returns {object} - Rollback information
 */
function createRollbackData(originalData, originalScheme) {
  return {
    timestamp: new Date().toISOString(),
    originalScheme,
    originalData: JSON.parse(JSON.stringify(originalData)), // Deep copy
    rollbackAvailable: true
  };
}

/**
 * Rollback quote data to previous state
 * @param {object} rollbackInfo - Rollback information
 * @returns {object} - Restored quote data
 */
function rollbackQuoteData(rollbackInfo) {
  if (!rollbackInfo || !rollbackInfo.rollbackAvailable) {
    throw new Error('No rollback data available');
  }

  return {
    data: rollbackInfo.originalData,
    scheme: rollbackInfo.originalScheme,
    restoredAt: new Date().toISOString()
  };
}

/**
 * Calculate total square footage from areas
 * @param {array} areas - Quote areas
 * @returns {number} - Total square footage
 */
function calculateTotalSqftFromAreas(areas) {
  let totalSqft = 0;
  
  for (const area of areas) {
    if (area.items) {
      for (const item of area.items) {
        if (item.measurementUnit === 'sqft' && item.quantity) {
          totalSqft += parseFloat(item.quantity) || 0;
        }
      }
    }
  }
  
  return Math.round(totalSqft);
}

/**
 * Convert flat rate items to areas structure
 * @param {object} flatRateItems - Flat rate items data
 * @returns {array} - Areas array
 */
function convertFlatRateItemsToAreas(flatRateItems) {
  const areas = [];
  
  // Convert interior items
  if (flatRateItems.interior) {
    const interiorItems = [];
    Object.entries(flatRateItems.interior).forEach(([itemKey, quantity]) => {
      if (quantity > 0) {
        let categoryName = '';
        let measurementUnit = 'each';
        
        switch (itemKey) {
          case 'doors':
            categoryName = 'Interior Doors';
            break;
          case 'smallRooms':
            categoryName = 'Small Room Walls';
            measurementUnit = 'sqft';
            quantity = quantity * 300; // Estimate 300 sqft per small room
            break;
          case 'mediumRooms':
            categoryName = 'Medium Room Walls';
            measurementUnit = 'sqft';
            quantity = quantity * 450; // Estimate 450 sqft per medium room
            break;
          case 'largeRooms':
            categoryName = 'Large Room Walls';
            measurementUnit = 'sqft';
            quantity = quantity * 600; // Estimate 600 sqft per large room
            break;
          case 'closets':
            categoryName = 'Closet Walls';
            measurementUnit = 'sqft';
            quantity = quantity * 100; // Estimate 100 sqft per closet
            break;
          case 'accentWalls':
            categoryName = 'Accent Walls';
            measurementUnit = 'sqft';
            quantity = quantity * 120; // Estimate 120 sqft per accent wall
            break;
          case 'cabinets':
            categoryName = 'Kitchen Cabinets';
            break;
        }
        
        if (categoryName) {
          interiorItems.push({
            categoryName,
            quantity,
            measurementUnit,
            selected: true
          });
        }
      }
    });
    
    if (interiorItems.length > 0) {
      areas.push({
        id: 'interior-converted',
        name: 'Interior (Converted)',
        items: interiorItems
      });
    }
  }
  
  // Convert exterior items
  if (flatRateItems.exterior) {
    const exteriorItems = [];
    Object.entries(flatRateItems.exterior).forEach(([itemKey, quantity]) => {
      if (quantity > 0) {
        let categoryName = '';
        let measurementUnit = 'each';
        
        switch (itemKey) {
          case 'doors':
            categoryName = 'Exterior Doors';
            break;
          case 'windows':
            categoryName = 'Windows';
            break;
          case 'garageDoors':
            categoryName = 'Garage Doors';
            break;
          case 'shutters':
            categoryName = 'Shutters';
            break;
        }
        
        if (categoryName) {
          exteriorItems.push({
            categoryName,
            quantity,
            measurementUnit,
            selected: true
          });
        }
      }
    });
    
    if (exteriorItems.length > 0) {
      areas.push({
        id: 'exterior-converted',
        name: 'Exterior (Converted)',
        items: exteriorItems
      });
    }
  }
  
  return areas;
}

/**
 * Convert areas to flat rate items structure
 * @param {array} areas - Areas array
 * @returns {object} - Flat rate items data
 */
function convertAreasToFlatRateItems(areas) {
  const flatRateItems = {
    interior: {},
    exterior: {}
  };
  
  for (const area of areas) {
    if (area.items) {
      for (const item of area.items) {
        const category = item.categoryName?.toLowerCase() || '';
        const quantity = parseInt(item.quantity) || 0;
        
        if (quantity > 0) {
          // Map to flat rate items (best effort)
          if (category.includes('door') && !category.includes('exterior')) {
            flatRateItems.interior.doors = (flatRateItems.interior.doors || 0) + quantity;
          } else if (category.includes('exterior door')) {
            flatRateItems.exterior.doors = (flatRateItems.exterior.doors || 0) + quantity;
          } else if (category.includes('window')) {
            flatRateItems.exterior.windows = (flatRateItems.exterior.windows || 0) + quantity;
          } else if (category.includes('garage')) {
            flatRateItems.exterior.garageDoors = (flatRateItems.exterior.garageDoors || 0) + quantity;
          } else if (category.includes('shutter')) {
            flatRateItems.exterior.shutters = (flatRateItems.exterior.shutters || 0) + quantity;
          } else if (category.includes('cabinet')) {
            flatRateItems.interior.cabinets = (flatRateItems.interior.cabinets || 0) + quantity;
          } else if (category.includes('closet')) {
            // Estimate closets from sqft (100 sqft per closet)
            const closets = Math.ceil(quantity / 100);
            flatRateItems.interior.closets = (flatRateItems.interior.closets || 0) + closets;
          } else if (category.includes('accent')) {
            // Estimate accent walls from sqft (120 sqft per wall)
            const walls = Math.ceil(quantity / 120);
            flatRateItems.interior.accentWalls = (flatRateItems.interior.accentWalls || 0) + walls;
          }
          // Note: Room conversions are complex and may not be accurate
        }
      }
    }
  }
  
  return flatRateItems;
}

module.exports = {
  validateSchemeCompatibility,
  migrateQuoteData,
  createRollbackData,
  rollbackQuoteData,
  calculateTotalSqftFromAreas,
  convertFlatRateItemsToAreas,
  convertAreasToFlatRateItems
};