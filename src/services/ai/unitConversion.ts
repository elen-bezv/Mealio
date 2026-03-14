/**
 * Central: unit conversion and quantity formatting (used by merge, pantry, agent).
 * Re-exports from lib/unit-conversion.
 */

export {
  toPreferredUnit,
  parseQuantity,
  formatQuantity,
  addQuantities,
  type VolumeUnit,
  type WeightUnit,
  type NormalizedQuantity,
} from "@/lib/unit-conversion";
export { DENSITY_G_PER_ML } from "@/lib/unit-conversion";
