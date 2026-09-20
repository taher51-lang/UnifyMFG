/**
 * Unit conversion utility — single source of truth for the frontend.
 * Any component that needs unit conversion should import from here.
 */

export const UNITS = ['kg', 'g', 'mg', 'L', 'ml', 'pcs', 'oz', 'lb'];

// Conversion factors: multiply qty by this to go from → to
const CONVERSIONS = {
  'kg-g':    1000,
  'kg-mg':   1_000_000,
  'kg-lb':   2.20462,
  'g-kg':    0.001,
  'g-mg':    1000,
  'g-oz':    0.035274,
  'mg-g':    0.001,
  'mg-kg':   0.000_001,
  'L-ml':    1000,
  'ml-L':    0.001,
  'oz-g':    28.3495,
  'lb-kg':   0.453592,
};

/**
 * Convert a quantity from one unit to another.
 * Returns the converted value, or null if no conversion is defined.
 */
export function convertQty(qty, fromUnit, toUnit) {
  if (fromUnit === toUnit) return parseFloat(qty);
  const factor = CONVERSIONS[`${fromUnit}-${toUnit}`];
  if (factor === undefined) return null;
  return parseFloat((parseFloat(qty) * factor).toPrecision(8));
}

/**
 * Check whether a conversion path exists between two units.
 */
export function canConvert(fromUnit, toUnit) {
  return fromUnit === toUnit || `${fromUnit}-${toUnit}` in CONVERSIONS;
}
