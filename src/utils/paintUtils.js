// Utility functions for paint calculations

/**
 * Calculate gallons needed based on square footage, coats, and coverage per gallon.
 * Applies an optional waste factor and rounds up to the nearest `roundTo` fraction (default 0.25).
 *
 * @param {number} sqft - Total square footage to cover
 * @param {number} coats - Number of coats to apply
 * @param {number} coveragePerGallon - Coverage in sqft per gallon (e.g., 350 or 400)
 * @param {object} opts - Optional parameters
 * @param {number} [opts.wasteFactor=1.1] - Multiplier to account for waste/overlap (default 10%)
 * @param {number} [opts.roundTo=0.25] - Round up to nearest fraction of a gallon (default quarter gallon)
 * @returns {number} - Gallons required (rounded up)
 */
export function calculateGallonsNeeded(sqft, coats, coveragePerGallon, opts = {}) {
    const { wasteFactor = 1.1, roundTo = 0.25 } = opts;

    const sqftNum = parseFloat(sqft) || 0;
    const coatsNum = parseFloat(coats) || 1;
    const coverage = parseFloat(coveragePerGallon) || 400;

    if (coverage <= 0) return 0;

    const totalSqft = sqftNum * coatsNum;
    const rawGallons = (totalSqft / coverage) * wasteFactor;

    // Round up to nearest `roundTo` increment
    const multiplier = 1 / roundTo;
    const rounded = Math.ceil(rawGallons * multiplier) / multiplier;

    // Avoid negative/NaN
    return Number.isFinite(rounded) ? rounded : 0;
}
