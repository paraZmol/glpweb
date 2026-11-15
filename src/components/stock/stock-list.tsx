import { SlidersHorizontal } from 'lucide-react';
import { GasBrandTheme } from '@/components/brand/brand-theme';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { SaleSeal } from '@/components/catalog/catalog-row';
import { Button } from '@/components/common/button';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { Stagger } from '@/components/motion/stagger';
import { type Product, productTitle } from '@/domain/catalog/product';
import type { PlantStock } from '@/domain/stock/plant-stock';
import { ICON_STROKE } from '@/lib/icons';
import { cn } from '@/lib/utils';

const CYLINDER_HEIGHT_PX = 52;
const SKELETON_ROWS = 4;

/** One product of the catalogue with what the plant holds of it (zero if never moved). */
export interface StockLine {
  product: Product;
  stock: PlantStock;
}

/** "40 llenos" in big tabular digits, the word under it. */
export function StockCount({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex min-w-16 flex-col items-start">
      <span className="font-heading text-2xl leading-none font-extrabold tabular-nums">
        {value}
      </span>
      <span className="text-[0.8125rem] font-semibold text-muted-foreground">{label}</span>
    </p>
  );
}

type StockRowProps = {
  line: StockLine;
  /** Absent for whoever only reads, and while a form is open. */
  onAdjust?: () => void;
  isLocked?: boolean;
};

function StockRow({ line: { product, stock }, onAdjust, isLocked = false }: StockRowProps) {
  const title = productTitle(product);
  return (
    <article className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-4 lg:grid-cols-[3.5rem_minmax(0,1fr)_auto_auto]">
      <GasBrandTheme color={product.brandColor} className="row-span-2 self-start lg:row-span-1">
        <div
          className={cn(
            'grid h-16 place-items-end justify-center rounded-lg bg-gas-brand-soft lg:h-14',
            !product.active && 'opacity-60',
          )}
        >
          <GasCylinder weightKg={product.weightKg} height={CYLINDER_HEIGHT_PX} />
        </div>
      </GasBrandTheme>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h3 className="max-w-full text-lg font-bold text-pretty wrap-break-word">
          {product.name}{' '}
          <span className="font-semibold text-muted-foreground">· {product.brand}</span>
        </h3>
        {!product.active && <SaleSeal isOnSale={false} />}
      </div>
      {/* Phone: the counts and "Ajustar" share the row under the name. Desktop: two columns. */}
      <div className="col-start-2 flex items-end justify-between gap-3 lg:contents">
        <div className="flex gap-6">
          <StockCount value={stock.full} label={stock.full === 1 ? 'lleno' : 'llenos'} />
          <StockCount value={stock.empty} label={stock.empty === 1 ? 'vacío' : 'vacíos'} />
        </div>
        {onAdjust && (
          <Button type="button" variant="line" size="sm" disabled={isLocked} onClick={onAdjust}>
            <SlidersHorizontal aria-hidden="true" strokeWidth={ICON_STROKE} />
            Ajustar<span className="sr-only"> {title}</span>
          </Button>
        )}
      </div>
    </article>
  );
}

type StockListProps = {
  lines: readonly StockLine[];
  onAdjust?: (line: StockLine) => void;
  isLocked?: boolean;
};

/** The plant stock, one row per product of the catalogue, in its order (PLAN 3.4). */
export function StockList({ lines, onAdjust, isLocked }: StockListProps) {
  return (
    <Stagger as="ul" className="flex flex-col divide-y" itemClassName="list-none">
      {lines.map((line) => (
        <StockRow
          key={line.product.id}
          line={line}
          isLocked={isLocked}
          onAdjust={onAdjust && (() => onAdjust(line))}
        />
      ))}
    </Stagger>
  );
}

export function StockListSkeleton() {
  return (
    <LoadingRegion label="Cargando el stock" className="flex flex-col divide-y">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          <Bone className="h-16 w-16 shrink-0 rounded-lg lg:h-14 lg:w-14" />
          <Bone className="h-5 w-48 max-w-full flex-1" />
          <Bone className="h-10 w-32" />
        </div>
      ))}
    </LoadingRegion>
  );
}
