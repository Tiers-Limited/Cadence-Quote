// utils/gbbDefaults.js
/**
 * GBB (Good-Better-Best) Default Configuration Generator
 * 
 * Provides default tier configurations for all pricing schemes.
 * These defaults serve as starting points for contractors to customize.
 */

/**
 * Generate complete default GBB configuration for all pricing schemes
 * @returns {object} Complete GBB configuration with defaults for all schemes
 */
function generateDefaultGBBConfig() {
  return {
    rateBased: generateRateBasedDefaults(),
    flatRate: generateFlatRateDefaults(),
    productionBased: generateProductionBasedDefaults(),
    turnkey: generateTurnkeyDefaults()
  };
}

/**
 * Generate default configuration for Rate-Based Square Foot Pricing
 * @returns {object} Rate-based tier configuration
 */
function generateRateBasedDefaults() {
  return {
    enabled: false,
    good: {
      laborRates: {
        walls: 1.80,
        ceilings: 1.50,
        trim: 3.00,
        doors: 45.00,
        cabinets: 65.00,
        exteriorWalls: 2.20,
        exteriorTrim: 3.50,
        exteriorDoors: 50.00,
        deck: 2.00,
        soffitFascia: 2.50,
        shutters: 50.00
      },
      materialSettings: {
        costPerGallon: 40.00,
        coverage: 350,
        coats: 2,
        wasteFactor: 1.10
      },
      description: 'Standard quality paint and workmanship'
    },
    better: {
      laborRates: {
        walls: 2.50,
        ceilings: 2.00,
        trim: 4.00,
        doors: 60.00,
        cabinets: 85.00,
        exteriorWalls: 3.00,
        exteriorTrim: 4.50,
        exteriorDoors: 65.00,
        deck: 2.75,
        soffitFascia: 3.25,
        shutters: 65.00
      },
      materialSettings: {
        costPerGallon: 55.00,
        coverage: 350,
        coats: 2,
        wasteFactor: 1.10
      },
      description: 'Premium paint with enhanced durability'
    },
    best: {
      laborRates: {
        walls: 3.50,
        ceilings: 2.80,
        trim: 5.50,
        doors: 80.00,
        cabinets: 110.00,
        exteriorWalls: 4.20,
        exteriorTrim: 6.00,
        exteriorDoors: 85.00,
        deck: 3.75,
        soffitFascia: 4.25,
        shutters: 85.00
      },
      materialSettings: {
        costPerGallon: 70.00,
        coverage: 400,
        coats: 3,
        wasteFactor: 1.15
      },
      description: 'Top-tier low-VOC paint with maximum coverage'
    }
  };
}

/**
 * Generate default configuration for Flat Rate Unit Pricing
 * @returns {object} Flat rate tier configuration
 */
function generateFlatRateDefaults() {
  return {
    enabled: false,
    good: {
      unitPrices: {
        // Interior items
        doors: 85.00,
        smallRooms: 350.00,
        mediumRooms: 450.00,
        largeRooms: 600.00,
        closets: 150.00,
        accentWalls: 200.00,
        cabinets: 125.00,
        cabinetsFace: 300.00,
        cabinetsDoors: 400.00,
        // Exterior items
        exteriorDoors: 95.00,
        windows: 75.00,
        garageDoor: 200.00,
        garageDoor1Car: 100.00,
        garageDoor2Car: 200.00,
        garageDoor3Car: 300.00,
        shutters: 50.00
      },
      description: 'Quality work at competitive prices'
    },
    better: {
      unitPrices: {
        // Interior items
        doors: 110.00,
        smallRooms: 450.00,
        mediumRooms: 575.00,
        largeRooms: 775.00,
        closets: 195.00,
        accentWalls: 260.00,
        cabinets: 160.00,
        cabinetsFace: 390.00,
        cabinetsDoors: 520.00,
        // Exterior items
        exteriorDoors: 125.00,
        windows: 95.00,
        garageDoor: 260.00,
        garageDoor1Car: 130.00,
        garageDoor2Car: 260.00,
        garageDoor3Car: 390.00,
        shutters: 65.00
      },
      description: 'Enhanced quality and attention to detail'
    },
    best: {
      unitPrices: {
        // Interior items
        doors: 140.00,
        smallRooms: 600.00,
        mediumRooms: 750.00,
        largeRooms: 1000.00,
        closets: 250.00,
        accentWalls: 340.00,
        cabinets: 210.00,
        cabinetsFace: 510.00,
        cabinetsDoors: 680.00,
        // Exterior items
        exteriorDoors: 160.00,
        windows: 125.00,
        garageDoor: 340.00,
        garageDoor1Car: 170.00,
        garageDoor2Car: 340.00,
        garageDoor3Car: 510.00,
        shutters: 85.00
      },
      description: 'Premium service with finest materials'
    }
  };
}

/**
 * Generate default configuration for Production-Based Pricing
 * @returns {object} Production-based tier configuration
 */
function generateProductionBasedDefaults() {
  return {
    enabled: false,
    good: {
      hourlyRate: 45.00,
      productionRates: {
        interiorWalls: 300,
        interiorCeilings: 350,
        interiorTrim: 150,
        doors: 2.0,
        cabinets: 1.5,
        exteriorWalls: 250,
        exteriorTrim: 120,
        soffitFascia: 100
      },
      materialSettings: {
        costPerGallon: 40.00,
        coverage: 350,
        coats: 2
      },
      description: 'Standard production rates with quality workmanship'
    },
    better: {
      hourlyRate: 60.00,
      productionRates: {
        interiorWalls: 280,
        interiorCeilings: 320,
        interiorTrim: 140,
        doors: 1.8,
        cabinets: 1.3,
        exteriorWalls: 230,
        exteriorTrim: 110,
        soffitFascia: 90
      },
      materialSettings: {
        costPerGallon: 55.00,
        coverage: 350,
        coats: 2
      },
      description: 'Enhanced attention to detail with premium materials'
    },
    best: {
      hourlyRate: 80.00,
      productionRates: {
        interiorWalls: 250,
        interiorCeilings: 300,
        interiorTrim: 125,
        doors: 1.5,
        cabinets: 1.0,
        exteriorWalls: 200,
        exteriorTrim: 100,
        soffitFascia: 80
      },
      materialSettings: {
        costPerGallon: 70.00,
        coverage: 400,
        coats: 3
      },
      description: 'Meticulous craftsmanship with top-tier materials'
    }
  };
}

/**
 * Generate default configuration for Turnkey Pricing
 * @returns {object} Turnkey tier configuration
 */
function generateTurnkeyDefaults() {
  return {
    enabled: false,
    good: {
      baseRate: 3.50,
      description: 'Complete interior/exterior painting'
    },
    better: {
      baseRate: 4.50,
      description: 'Premium paint and enhanced prep work'
    },
    best: {
      baseRate: 6.00,
      description: 'Luxury finish with top-tier materials'
    }
  };
}

module.exports = {
  generateDefaultGBBConfig,
  generateRateBasedDefaults,
  generateFlatRateDefaults,
  generateProductionBasedDefaults,
  generateTurnkeyDefaults
};
