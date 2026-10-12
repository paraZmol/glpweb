import { useId } from 'react';
import { cylinderSilhouetteFor } from '@/domain/brand/cylinder-shape';
import { cn } from '@/lib/utils';

// Geometry of the drawing on a canvas 120 units wide (ui-system §9.4).
const CANVAS_WIDTH = 120;
const CENTER_X = CANVAS_WIDTH / 2;
const BODY_TOP = 46;
const CANVAS_EXTRA_HEIGHT = 62;
const FOOT_WIDTH_RATIO = 0.7;
const WELD_HEIGHT_RATIO = 0.62;
const SHADOW_WIDTH_RATIO = 0.52;

type GasCylinderProps = {
  /** Weight printed on the label. 10, 15 and 45 kg have their own silhouette. */
  weightKg: number;
  /** Height in px; the width follows the drawing. */
  height?: number;
  /** One flat colour, for empty states: no label, no shading. */
  tone?: 'color' | 'mono';
  className?: string;
};

/**
 * The product itself, drawn (there are no photos of cylinders). The body takes the colour of
 * the gas brand through `text-gas-brand`; wrap it in `GasBrandTheme` to set that colour.
 */
export function GasCylinder({ weightKg, height, tone = 'color', className }: GasCylinderProps) {
  const sheenId = useId();
  const { bodyWidth, bodyHeight, cornerRadius } = cylinderSilhouetteFor(weightKg);
  const isMono = tone === 'mono';
  const bodyX = (CANVAS_WIDTH - bodyWidth) / 2;
  const footWidth = bodyWidth * FOOT_WIDTH_RATIO;
  const footX = (CANVAS_WIDTH - footWidth) / 2;
  const footY = BODY_TOP + bodyHeight - 12;
  const weldY = BODY_TOP + bodyHeight * WELD_HEIGHT_RATIO;
  const body = { x: bodyX, y: BODY_TOP, width: bodyWidth, height: bodyHeight, rx: cornerRadius };
  const foot = { x: footX, y: footY, width: footWidth, height: 20, rx: 5 };
  const handle = { x: 41, y: 14, width: 38, height: 40, rx: 11, fill: 'none', strokeWidth: 7 };

  return (
    <svg
      viewBox={`0 0 ${CANVAS_WIDTH} ${bodyHeight + CANVAS_EXTRA_HEIGHT}`}
      height={height}
      role="img"
      aria-label={`Balón de ${weightKg} kg`}
      className={cn('block shrink-0', !isMono && 'text-gas-brand', className)}
    >
      {!isMono && (
        <defs>
          <linearGradient id={sheenId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--cylinder-shine)" stopOpacity="0.3" />
            <stop offset="0.38" stopColor="var(--cylinder-shine)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--cylinder-shade)" stopOpacity="0.28" />
          </linearGradient>
        </defs>
      )}
      {!isMono && (
        <ellipse
          cx={CENTER_X}
          cy={BODY_TOP + bodyHeight + 8}
          rx={bodyWidth * SHADOW_WIDTH_RATIO}
          ry="5"
          className="fill-cylinder-label-ink opacity-12"
        />
      )}
      <rect {...foot} fill="currentColor" />
      {!isMono && <rect {...foot} className="fill-cylinder-shade opacity-30" />}
      <rect
        x="54"
        y="24"
        width="12"
        height="24"
        rx="3"
        className={isMono ? 'fill-current' : 'fill-cylinder-valve'}
      />
      <rect
        x="49"
        y="22"
        width="22"
        height="7"
        rx="3.5"
        className={isMono ? 'fill-current' : 'fill-cylinder-valve-cap'}
      />
      <rect {...handle} stroke="currentColor" />
      {!isMono && <rect {...handle} className="stroke-cylinder-shade/16" />}
      <rect {...body} fill="currentColor" />
      {!isMono && (
        <CylinderDetails body={body} weldY={weldY} sheenId={sheenId} weightKg={weightKg} />
      )}
    </svg>
  );
}

type CylinderDetailsProps = {
  body: { x: number; y: number; width: number; height: number; rx: number };
  weldY: number;
  sheenId: string;
  weightKg: number;
};

/** Sheen, weld line, side highlight and the white label with the weight. */
function CylinderDetails({ body, weldY, sheenId, weightKg }: CylinderDetailsProps) {
  return (
    <>
      <rect {...body} fill={`url(#${sheenId})`} />
      <path
        d={`M${body.x + 2} ${weldY}h${body.width - 4}`}
        strokeWidth="2"
        className="stroke-cylinder-shade/16"
      />
      <rect
        x={body.x + 9}
        y={body.y + 20}
        width="6"
        height={body.height - 46}
        rx="3"
        className="fill-cylinder-shine opacity-40"
      />
      <rect
        x="36"
        y={weldY - 34}
        width="48"
        height="22"
        rx="11"
        className="fill-cylinder-label opacity-94"
      />
      <text
        x={CENTER_X}
        y={weldY - 18.5}
        textAnchor="middle"
        fontSize="13"
        className="fill-cylinder-label-ink font-heading font-extrabold"
      >
        {weightKg} kg
      </text>
    </>
  );
}
