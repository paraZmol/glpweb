/**
 * Silhouettes of the gas cylinder drawing (ui-system §9.4), on a canvas 120 units wide. Any
 * other weight uses the silhouette of the closest standard weight below it, with its real label.
 */
export interface CylinderSilhouette {
  bodyWidth: number;
  bodyHeight: number;
  cornerRadius: number;
}

export const STANDARD_CYLINDER_WEIGHTS_KG = [10, 15, 45] as const;
type StandardWeightKg = (typeof STANDARD_CYLINDER_WEIGHTS_KG)[number];

const SILHOUETTES: Record<StandardWeightKg, CylinderSilhouette> = {
  10: { bodyWidth: 78, bodyHeight: 86, cornerRadius: 30 },
  15: { bodyWidth: 78, bodyHeight: 116, cornerRadius: 30 },
  45: { bodyWidth: 62, bodyHeight: 176, cornerRadius: 24 },
};

const SMALLEST_WEIGHT_KG: StandardWeightKg = 10;

export function cylinderSilhouetteFor(weightKg: number): CylinderSilhouette {
  const below = STANDARD_CYLINDER_WEIGHTS_KG.filter((standard) => standard <= weightKg);
  return SILHOUETTES[below.at(-1) ?? SMALLEST_WEIGHT_KG];
}
