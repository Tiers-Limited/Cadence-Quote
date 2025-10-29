// services/zipCodePricingService.js
/**
 * Zip-Code Rubric AI Service
 * Calculates ballpark quotes based on zip code and project details
 */

class ZipCodePricingService {
  constructor() {
    // Regional pricing rates per square foot (base rates)
    this.regionalRates = {
      // Zip prefix -> rate per sq ft
      '0': 3.8,  // Northeast (CT, MA, ME, NH, NJ, RI, VT)
      '1': 3.5,  // Mid-Atlantic (DE, NY, PA)
      '2': 3.0,  // Southeast (DC, MD, NC, SC, VA, WV)
      '3': 2.8,  // Deep South (AL, FL, GA, MS, TN)
      '4': 2.7,  // Midwest (IN, KY, MI, OH)
      '5': 2.6,  // Plains (IA, MN, MT, ND, SD, WI)
      '6': 2.9,  // Southwest (IL, KS, MO, NE)
      '7': 3.0,  // South Central (AR, LA, OK, TX)
      '8': 3.5,  // Mountain (AZ, CO, ID, NM, NV, UT, WY)
      '9': 4.2   // West Coast (AK, CA, HI, OR, WA)
    };

    // Project type multipliers
    this.projectTypeMultipliers = {
      'interior': 1.0,
      'exterior': 1.3,
      'trim': 0.4,
      'cabinets': 0.7,
      'whole_house': 1.5,
      'other': 1.0
    };

    // Room count pricing (if homeSize not provided)
    this.roomBasePrices = {
      1: 800,
      2: 1400,
      3: 2000,
      4: 2600,
      5: 3200,
      6: 3800,
      7: 4400,
      8: 5000
    };
  }

  /**
   * Get regional rate based on zip code
   * @param {string} zipCode - 5-digit zip code
   * @returns {number} - Rate per square foot
   */
  getRegionalRate(zipCode) {
    if (!zipCode || zipCode.length < 1) {
      return 3.0; // Default rate
    }

    const firstDigit = zipCode[0];
    return this.regionalRates[firstDigit] || 3.0;
  }

  /**
   * Calculate ballpark quote
   * @param {Object} params
   * @param {string} params.zipCode - Property zip code
   * @param {number} params.homeSize - Home size in square feet
   * @param {number} params.roomCount - Number of rooms
   * @param {string} params.projectType - Type of project
   * @returns {number} - Ballpark quote in dollars
   */
  calculateBallparkQuote({ zipCode, homeSize, roomCount, projectType = 'interior' }) {
    try {
      let basePrice = 0;

      // Method 1: Calculate based on home size (preferred)
      if (homeSize && homeSize > 0) {
        const regionalRate = this.getRegionalRate(zipCode);
        basePrice = homeSize * regionalRate;
      } 
      // Method 2: Calculate based on room count (fallback)
      else if (roomCount && roomCount > 0) {
        // Use room-based pricing
        if (roomCount <= 8) {
          basePrice = this.roomBasePrices[roomCount];
        } else {
          // For more than 8 rooms, extrapolate
          basePrice = this.roomBasePrices[8] + ((roomCount - 8) * 600);
        }
        
        // Apply regional adjustment for room-based pricing
        const regionalRate = this.getRegionalRate(zipCode);
        const regionalAdjustment = regionalRate / 3.0; // Normalize to baseline
        basePrice = basePrice * regionalAdjustment;
      }
      // Method 3: Default minimum quote
      else {
        const regionalRate = this.getRegionalRate(zipCode);
        basePrice = 2000 * (regionalRate / 3.0); // Base minimum adjusted by region
      }

      // Apply project type multiplier
      const projectMultiplier = this.projectTypeMultipliers[projectType] || 1.0;
      const finalPrice = basePrice * projectMultiplier;

      // Round to nearest $50
      const roundedPrice = Math.round(finalPrice / 50) * 50;

      // Ensure minimum quote of $500
      return Math.max(roundedPrice, 500);

    } catch (error) {
      console.error('Error calculating ballpark quote:', error);
      // Return default fallback quote
      return 2000;
    }
  }

  /**
   * Get quote range (for displaying ± range)
   * @param {number} quote - Base quote
   * @param {number} variance - Variance percentage (default 15%)
   * @returns {Object} - { low, high, quote }
   */
  getQuoteRange(quote, variance = 0.15) {
    const varianceAmount = Math.round(quote * variance / 50) * 50; // Round to $50
    return {
      quote: quote,
      low: quote - varianceAmount,
      high: quote + varianceAmount
    };
  }

  /**
   * Get detailed pricing breakdown
   * @param {Object} params - Same as calculateBallparkQuote
   * @returns {Object} - Detailed breakdown
   */
  getPricingBreakdown(params) {
    const { zipCode, homeSize, roomCount, projectType = 'interior' } = params;
    
    const regionalRate = this.getRegionalRate(zipCode);
    const baseQuote = this.calculateBallparkQuote(params);
    const range = this.getQuoteRange(baseQuote);
    const projectMultiplier = this.projectTypeMultipliers[projectType] || 1.0;

    return {
      quote: baseQuote,
      range: range,
      breakdown: {
        regionalRate: regionalRate,
        projectType: projectType,
        projectMultiplier: projectMultiplier,
        calculationMethod: homeSize ? 'square_footage' : (roomCount ? 'room_count' : 'default'),
        homeSize: homeSize,
        roomCount: roomCount,
        zipCode: zipCode
      },
      message: this.getQuoteMessage(range)
    };
  }

  /**
   * Get human-readable quote message
   * @param {Object} range - Quote range object
   * @returns {string} - Message for homeowner
   */
  getQuoteMessage(range) {
    return `Based on your location and project details, your estimated cost is between $${range.low.toLocaleString()} and $${range.high.toLocaleString()}. This is a preliminary estimate - we'll provide a detailed quote after our free on-site assessment.`;
  }

  /**
   * Validate if we have enough data for accurate quote
   * @param {Object} params
   * @returns {boolean}
   */
  canProvideAccurateQuote({ zipCode, homeSize, roomCount }) {
    return !!zipCode && (!!homeSize || !!roomCount);
  }
}

module.exports = new ZipCodePricingService();
