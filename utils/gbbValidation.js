// utils/gbbValidation.js
/**
 * GBB (Good-Better-Best) Configuration Validation
 * 
 * Validates GBB tier configurations to ensure all values are within acceptable ranges.
 * Returns validation results with detailed error messages for any issues found.
 */

/**
 * Validate complete GBB configuration
 * @param {object} config - GBB configuration object
 * @returns {object} Validation result with isValid flag and errors array
 */
function validateGBBConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return {
      isValid: false,
      errors: [{
        code: 'INVALID_CONFIG',
        message: 'Configuration must be a valid object',
        severity: 'error'
      }]
    };
  }

  // Validate each pricing scheme if present
  if (config.rateBased) {
    const rateBasedErrors = validateRateBasedConfig(config.rateBased);
    errors.push(...rateBasedErrors);
  }

  if (config.flatRate) {
    const flatRateErrors = validateFlatRateConfig(config.flatRate);
    errors.push(...flatRateErrors);
  }

  if (config.productionBased) {
    const productionBasedErrors = validateProductionBasedConfig(config.productionBased);
    errors.push(...productionBasedErrors);
  }

  if (config.turnkey) {
    const turnkeyErrors = validateTurnkeyConfig(config.turnkey);
    errors.push(...turnkeyErrors);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate rate-based pricing configuration
 * @param {object} config - Rate-based configuration
 * @returns {array} Array of validation errors
 */
function validateRateBasedConfig(config) {
  const errors = [];
  const tiers = ['good', 'better', 'best'];

  for (const tier of tiers) {
    if (!config[tier]) continue;

    const tierConfig = config[tier];
    const prefix = `rateBased.${tier}`;

    // Validate labor rates
    if (tierConfig.laborRates) {
      const laborRateFields = [
        'walls', 'ceilings', 'trim', 'doors', 'cabinets',
        'exteriorWalls', 'exteriorTrim', 'exteriorDoors',
        'deck', 'soffitFascia', 'shutters'
      ];

      for (const field of laborRateFields) {
        if (tierConfig.laborRates[field] !== undefined) {
          const value = tierConfig.laborRates[field];
          if (typeof value !== 'number' || value < 0) {
            errors.push({
              code: 'INVALID_LABOR_RATE',
              field: `${prefix}.laborRates.${field}`,
              message: `Labor rate for ${field} must be a number greater than or equal to 0`,
              value,
              severity: 'error'
            });
          }
        }
      }
    }

    // Validate material settings
    if (tierConfig.materialSettings) {
      const { costPerGallon, coverage, coats, wasteFactor } = tierConfig.materialSettings;

      if (costPerGallon !== undefined) {
        if (typeof costPerGallon !== 'number' || costPerGallon < 0) {
          errors.push({
            code: 'INVALID_COST_PER_GALLON',
            field: `${prefix}.materialSettings.costPerGallon`,
            message: 'Cost per gallon must be a number greater than or equal to 0',
            value: costPerGallon,
            severity: 'error'
          });
        }
      }

      if (coverage !== undefined) {
        if (!Number.isInteger(coverage) || coverage < 100 || coverage > 500) {
          errors.push({
            code: 'INVALID_COVERAGE',
            field: `${prefix}.materialSettings.coverage`,
            message: 'Coverage must be an integer between 100 and 500 sqft per gallon',
            value: coverage,
            severity: 'error'
          });
        }
      }

      if (coats !== undefined) {
        if (!Number.isInteger(coats) || coats < 1 || coats > 5) {
          errors.push({
            code: 'INVALID_COATS',
            field: `${prefix}.materialSettings.coats`,
            message: 'Number of coats must be an integer between 1 and 5',
            value: coats,
            severity: 'error'
          });
        }
      }

      if (wasteFactor !== undefined) {
        if (typeof wasteFactor !== 'number' || wasteFactor < 1.0 || wasteFactor > 2.0) {
          errors.push({
            code: 'INVALID_WASTE_FACTOR',
            field: `${prefix}.materialSettings.wasteFactor`,
            message: 'Waste factor must be a number between 1.0 and 2.0',
            value: wasteFactor,
            severity: 'error'
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate flat rate pricing configuration
 * @param {object} config - Flat rate configuration
 * @returns {array} Array of validation errors
 */
function validateFlatRateConfig(config) {
  const errors = [];
  const tiers = ['good', 'better', 'best'];

  for (const tier of tiers) {
    if (!config[tier]) continue;

    const tierConfig = config[tier];
    const prefix = `flatRate.${tier}`;

    // Validate unit prices
    if (tierConfig.unitPrices) {
      const unitPriceFields = [
        'doors', 'smallRooms', 'mediumRooms', 'largeRooms',
        'closets', 'accentWalls', 'cabinets', 'cabinetsFace', 'cabinetsDoors',
        'exteriorDoors', 'windows', 'garageDoor',
        'garageDoor1Car', 'garageDoor2Car', 'garageDoor3Car', 'shutters'
      ];

      for (const field of unitPriceFields) {
        if (tierConfig.unitPrices[field] !== undefined) {
          const value = tierConfig.unitPrices[field];
          if (typeof value !== 'number' || value < 0) {
            errors.push({
              code: 'INVALID_UNIT_PRICE',
              field: `${prefix}.unitPrices.${field}`,
              message: `Unit price for ${field} must be a number greater than or equal to 0`,
              value,
              severity: 'error'
            });
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate production-based pricing configuration
 * @param {object} config - Production-based configuration
 * @returns {array} Array of validation errors
 */
function validateProductionBasedConfig(config) {
  const errors = [];
  const tiers = ['good', 'better', 'best'];

  for (const tier of tiers) {
    if (!config[tier]) continue;

    const tierConfig = config[tier];
    const prefix = `productionBased.${tier}`;

    // Validate hourly rate
    if (tierConfig.hourlyRate !== undefined) {
      const value = tierConfig.hourlyRate;
      if (typeof value !== 'number' || value < 0) {
        errors.push({
          code: 'INVALID_HOURLY_RATE',
          field: `${prefix}.hourlyRate`,
          message: 'Hourly rate must be a number greater than or equal to 0',
          value,
          severity: 'error'
        });
      }
    }

    // Validate production rates
    if (tierConfig.productionRates) {
      const productionRateFields = [
        'interiorWalls', 'interiorCeilings', 'interiorTrim',
        'doors', 'cabinets', 'exteriorWalls', 'exteriorTrim', 'soffitFascia'
      ];

      for (const field of productionRateFields) {
        if (tierConfig.productionRates[field] !== undefined) {
          const value = tierConfig.productionRates[field];
          if (typeof value !== 'number' || value <= 0) {
            errors.push({
              code: 'INVALID_PRODUCTION_RATE',
              field: `${prefix}.productionRates.${field}`,
              message: `Production rate for ${field} must be a number greater than 0`,
              value,
              severity: 'error'
            });
          }
        }
      }
    }

    // Validate material settings (same as rate-based)
    if (tierConfig.materialSettings) {
      const { costPerGallon, coverage, coats } = tierConfig.materialSettings;

      if (costPerGallon !== undefined) {
        if (typeof costPerGallon !== 'number' || costPerGallon < 0) {
          errors.push({
            code: 'INVALID_COST_PER_GALLON',
            field: `${prefix}.materialSettings.costPerGallon`,
            message: 'Cost per gallon must be a number greater than or equal to 0',
            value: costPerGallon,
            severity: 'error'
          });
        }
      }

      if (coverage !== undefined) {
        if (!Number.isInteger(coverage) || coverage < 100 || coverage > 500) {
          errors.push({
            code: 'INVALID_COVERAGE',
            field: `${prefix}.materialSettings.coverage`,
            message: 'Coverage must be an integer between 100 and 500 sqft per gallon',
            value: coverage,
            severity: 'error'
          });
        }
      }

      if (coats !== undefined) {
        if (!Number.isInteger(coats) || coats < 1 || coats > 5) {
          errors.push({
            code: 'INVALID_COATS',
            field: `${prefix}.materialSettings.coats`,
            message: 'Number of coats must be an integer between 1 and 5',
            value: coats,
            severity: 'error'
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Validate turnkey pricing configuration
 * @param {object} config - Turnkey configuration
 * @returns {array} Array of validation errors
 */
function validateTurnkeyConfig(config) {
  const errors = [];
  const tiers = ['good', 'better', 'best'];

  for (const tier of tiers) {
    if (!config[tier]) continue;

    const tierConfig = config[tier];
    const prefix = `turnkey.${tier}`;

    // Validate base rate
    if (tierConfig.baseRate !== undefined) {
      const value = tierConfig.baseRate;
      if (typeof value !== 'number' || value < 0) {
        errors.push({
          code: 'INVALID_BASE_RATE',
          field: `${prefix}.baseRate`,
          message: 'Base rate must be a number greater than or equal to 0',
          value,
          severity: 'error'
        });
      }
    }
  }

  return errors;
}

/**
 * Validate tier price ordering (good <= better <= best)
 * @param {object} tierPricing - Tier pricing object with good, better, best
 * @returns {object} Validation result
 */
function validateTierPriceOrdering(tierPricing) {
  const errors = [];

  if (!tierPricing || typeof tierPricing !== 'object') {
    return { isValid: true, errors: [] };
  }

  const goodTotal = tierPricing.good?.total;
  const betterTotal = tierPricing.better?.total;
  const bestTotal = tierPricing.best?.total;

  if (goodTotal !== undefined && betterTotal !== undefined && goodTotal > betterTotal) {
    errors.push({
      code: 'TIER_PRICE_ORDERING_VIOLATION',
      message: 'Good tier price should not exceed Better tier price',
      prices: { good: goodTotal, better: betterTotal },
      severity: 'warning'
    });
  }

  if (betterTotal !== undefined && bestTotal !== undefined && betterTotal > bestTotal) {
    errors.push({
      code: 'TIER_PRICE_ORDERING_VIOLATION',
      message: 'Better tier price should not exceed Best tier price',
      prices: { better: betterTotal, best: bestTotal },
      severity: 'warning'
    });
  }

  if (goodTotal !== undefined && bestTotal !== undefined && goodTotal > bestTotal) {
    errors.push({
      code: 'TIER_PRICE_ORDERING_VIOLATION',
      message: 'Good tier price should not exceed Best tier price',
      prices: { good: goodTotal, best: bestTotal },
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateGBBConfig,
  validateRateBasedConfig,
  validateFlatRateConfig,
  validateProductionBasedConfig,
  validateTurnkeyConfig,
  validateTierPriceOrdering
};
