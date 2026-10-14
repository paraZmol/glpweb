import { useState } from 'react';
import { GasCylinder } from '@/components/brand/gas-cylinder';
import { ProductCard } from '@/components/catalog/product-card';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { EmptyState, ErrorState } from '@/components/common/state-views';
import { Stagger } from '@/components/motion/stagger';
import { type Product, toProductOffer } from '@/domain/catalog/product';
import type { SaleMode } from '@/domain/catalog/sale-mode';
import { OfflineError } from '@/domain/tenancy/errors';
import { usePublicCatalog } from '@/features/catalog/use-public-catalog';
import type { AsyncResource } from '@/lib/use-async-resource';
import { useOnlineStatus } from '@/lib/use-online-status';

const EMPTY_CYLINDER_PX = 72;
const SKELETON_CARDS = 3;
// docs/marketing/oferta-y-promociones.md §2.2 and its annex: the note above the list.
const REFILL_NOTE = 'Precios de recarga: cambias tu balón vacío por uno lleno.';
const FULL_NOTE = '¿No tienes balón? Elige “Balón completo”.';

/** The shape of the cards while the prices arrive: a list on a phone, three across on desktop. */
function ProductsSkeleton() {
  return (
    <LoadingRegion label="Cargando los precios" className="mt-2">
      <Bone className="h-5 w-96 max-w-full" />
      <div className="mt-4 grid gap-3 lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-xl bg-card p-3 shadow-card lg:flex-col lg:p-4"
          >
            <Bone className="h-30 w-22 shrink-0 rounded-[1.25rem] lg:h-44 lg:w-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-6 w-32" />
              <Bone className="h-4 w-24" />
              <Bone className="mt-1 h-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function ProductGrid({ products }: { products: readonly Product[] }) {
  // Refill on arrival for every product (marketing §2.2); the choice only shows the price.
  const [modes, setModes] = useState<Record<string, SaleMode>>({});
  const sellsAnyFull = products.some((product) => product.fullPriceCents !== null);
  return (
    <>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {REFILL_NOTE} {sellsAnyFull && FULL_NOTE}
      </p>
      <Stagger className="mt-4 grid gap-3 lg:grid-cols-3 lg:gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={toProductOffer(product)}
            mode={modes[product.id] ?? 'refill'}
            onModeChange={(mode) => setModes((current) => ({ ...current, [product.id]: mode }))}
          />
        ))}
      </Stagger>
    </>
  );
}

type ProductsBodyProps = { catalog: AsyncResource<Product[]>; onRetry: () => void };

/** Each state of the prices of a distributor: loading, failed, none yet, or the cards. */
export function ProductsBody({ catalog, onRetry }: ProductsBodyProps) {
  const isOnline = useOnlineStatus();
  if (catalog.status === 'error') {
    const isOffline = !isOnline || catalog.error instanceof OfflineError;
    return (
      <ErrorState
        className="mt-4"
        title={isOffline ? 'Sin conexión.' : 'No pudimos cargar los precios.'}
        description={
          isOffline
            ? 'Los precios se ven cuando vuelva la señal. Mientras tanto puedes llamar a la distribuidora.'
            : 'Vuelve a intentar en un momento, o llama a la distribuidora.'
        }
        onRetry={onRetry}
      />
    );
  }
  if (catalog.status !== 'ready') return <ProductsSkeleton />;
  if (catalog.data.length === 0) {
    return (
      <EmptyState
        className="mt-4 rounded-xl bg-card p-6 shadow-card"
        symbol={<GasCylinder weightKg={10} tone="mono" height={EMPTY_CYLINDER_PX} />}
        title="Esta distribuidora todavía no publicó sus precios."
        description="Llámala o escríbele."
      />
    );
  }
  return <ProductGrid products={catalog.data} />;
}

/**
 * The products on sale of a distributor and their two prices (PLAN 3.1), in the order it chose.
 * Ordering arrives with phase 4: until then the page keeps calling and WhatsApp as its action.
 */
export function DistributorProducts({ distributorId }: { distributorId: string }) {
  const catalog = usePublicCatalog(distributorId);
  return (
    <section aria-labelledby="catalogo">
      <h2 id="catalogo" className="text-[1.75rem] font-extrabold lg:text-4xl">
        Balones y precios
      </h2>
      <ProductsBody catalog={catalog} onRetry={catalog.reload} />
    </section>
  );
}
