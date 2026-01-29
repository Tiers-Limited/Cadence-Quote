/**
 * Cost Allocation Service
 * 
 * Implements industry-standard cost allocation for job analytics with strict allocation order:
 * 1. Materials (actual costs when available)
 * 2. Overhead (percentage-based from settings)
 * 3. Labor (actual > target > $0 fallback)
 * 4. Net Profit (remainder, can be negative)
 */

class CostAllocationService {
  /**
   * Calculate cost allocation breakdown following strict allocation order
   * Per specification: Materials are NEVER estimated - only actual costs are used
   * @param {number} jobPrice - Final invoiced job price
   * @param {number} actualMaterialCost - Real material expenses (REQUIRED - never estimated)
   * @param {number} actualLaborCost - Real labor expenses (optional)
   * @param {number} overheadPercent - Overhead percentage from contractor settings (REQUIRED)
   * @param {number} laborTargetPercent - Labor target percentage from settings (optional)
   * @returns {Object} Cost allocation breakdown with amounts and percentages
   */
  static calculateAllocation(
    jobPrice,
    actualMaterialCost = null,
    actualLaborCost = null,
    overheadPercent = 0,
    laborTargetPercent = null
  ) {
    // Validate inputs
    if (jobPrice <= 0) {
      throw new Error('Job price must be greater than zero');
    }

    if (overheadPercent < 0 || overheadPercent > 50) {
      throw new Error('Overhead percentage must be between 0% and 50%');
    }

    // Step 1: Materials allocation (ACTUAL ONLY - never estimated per spec)
    const materialCost = actualMaterialCost !== null ? actualMaterialCost : 0;
    const materialSource = actualMaterialCost !== null ? 'actual' : 'none';

    // Step 2: Overhead allocation (percentage-based, ALWAYS allocated)
    const overheadCost = (jobPrice * overheadPercent) / 100;

    // Step 3: Labor allocation with fallback hierarchy
    let laborCost = 0;
    let laborSource = 'default';

    if (actualLaborCost !== null && actualLaborCost >= 0) {
      laborCost = actualLaborCost;
      laborSource = 'actual';
    } else if (laborTargetPercent !== null && laborTargetPercent >= 0) {
      laborCost = (jobPrice * laborTargetPercent) / 100;
      laborSource = 'target';
    } else {
      laborCost = 0;
      laborSource = 'default';
    }

    // Step 4: Net profit calculation (remainder)
    const netProfit = jobPrice - materialCost - overheadCost - laborCost;

    // Calculate percentages
    const breakdown = {
      materials: {
        amount: parseFloat(materialCost.toFixed(2)),
        percentage: parseFloat(((materialCost / jobPrice) * 100).toFixed(2)),
        source: materialSource
      },
      labor: {
        amount: parseFloat(laborCost.toFixed(2)),
        percentage: parseFloat(((laborCost / jobPrice) * 100).toFixed(2)),
        source: laborSource
      },
      overhead: {
        amount: parseFloat(overheadCost.toFixed(2)),
        percentage: parseFloat(((overheadCost / jobPrice) * 100).toFixed(2)),
        source: 'target'
      },
      profit: {
        amount: parseFloat(netProfit.toFixed(2)),
        percentage: parseFloat(((netProfit / jobPrice) * 100).toFixed(2)),
        source: 'calculated'
      }
    };

    // Validate allocation totals exactly 100%
    this.validateAllocation(breakdown, jobPrice);

    return {
      jobPrice: parseFloat(jobPrice.toFixed(2)),
      breakdown,
      calculatedAt: new Date().toISOString()
    };
  }

  /**
   * Validate that allocation percentages sum to exactly 100%
   * Handles rounding edge cases to ensure mathematical consistency
   * @param {Object} breakdown - Cost breakdown object
   * @param {number} jobPrice - Original job price for validation
   */
  static validateAllocation(breakdown, jobPrice) {
    // Check percentage totals
    const totalPercentage = breakdown.materials.percentage + 
                           breakdown.labor.percentage + 
                           breakdown.overhead.percentage + 
                           breakdown.profit.percentage;

    // Allow for small rounding differences (within 0.01%)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      // Adjust profit percentage to ensure exact 100% total
      const adjustment = 100 - (breakdown.materials.percentage + 
                               breakdown.labor.percentage + 
                               breakdown.overhead.percentage);
      breakdown.profit.percentage = parseFloat(adjustment.toFixed(2));
    }

    // Check amount totals
    const totalAmount = breakdown.materials.amount + 
                       breakdown.labor.amount + 
                       breakdown.overhead.amount + 
                       breakdown.profit.amount;

    // Allow for small rounding differences (within $0.01)
    if (Math.abs(totalAmount - jobPrice) > 0.01) {
      // Adjust profit amount to ensure exact job price total
      const adjustment = jobPrice - (breakdown.materials.amount + 
                                   breakdown.labor.amount + 
                                   breakdown.overhead.amount);
      breakdown.profit.amount = parseFloat(adjustment.toFixed(2));
    }
  }

  /**
   * Get industry-standard percentage ranges for validation
   * @returns {Object} Industry standard ranges for each cost category
   */
  static getIndustryStandards() {
    return {
      labor: { min: 35, max: 45, target: 40 },
      materials: { min: 15, max: 35, target: 25 },
      overhead: { min: 10, max: 20, target: 15 },
      profit: { min: 8, max: 20, target: 12 }
    };
  }

  /**
   * Analyze allocation against industry standards
   * @param {Object} breakdown - Cost breakdown from calculateAllocation
   * @returns {Object} Analysis with warnings and recommendations
   */
  static analyzeAgainstStandards(breakdown) {
    const standards = this.getIndustryStandards();
    const analysis = {
      warnings: [],
      recommendations: [],
      overallHealth: 'good'
    };

    // Check each category against standards
    Object.keys(standards).forEach(category => {
      const actual = breakdown[category].percentage;
      const standard = standards[category];

      if (actual < standard.min) {
        analysis.warnings.push(`${category} at ${actual}% is below industry minimum of ${standard.min}%`);
        analysis.recommendations.push(`Consider increasing ${category} allocation to at least ${standard.min}%`);
      } else if (actual > standard.max) {
        analysis.warnings.push(`${category} at ${actual}% is above industry maximum of ${standard.max}%`);
        analysis.recommendations.push(`Consider reducing ${category} allocation to below ${standard.max}%`);
      }
    });

    // Determine overall health
    if (breakdown.profit.percentage < 8) {
      analysis.overallHealth = 'poor';
      analysis.warnings.push('Profit margin below 8% indicates potential profitability issues');
    } else if (analysis.warnings.length > 2) {
      analysis.overallHealth = 'fair';
    }

    return analysis;
  }
}

module.exports = CostAllocationService;