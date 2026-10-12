import kitchenPhoto from '../../../docs/design/images/pexels-16782087-cocinera-olla-cocina.jpg';
import { BurnerRing } from '@/components/brand/burner-ring';
import { Monogram } from '@/components/brand/monogram';
import { StateChip } from '@/components/common/state-chip';
import type { PublicDistributor } from '@/domain/tenancy/types';
import { useIsDesktop } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { DistributorFacts } from './distributor-facts';

const PHOTO_ALT = 'Persona cocinando con ollas sobre una cocina a gas';
const PHOTO_CLASS =
  'absolute inset-0 size-full object-cover object-[50%_22%] brightness-(--photo-brightness)';
const KIND = 'Distribuidora de gas';

export type HeroProps = {
  distributor: PublicDistributor;
  /** "Abierto · cierra a las 8:00 p. m.", or that it is not taking orders. */
  status: { isOpen: boolean; text: string };
};

/** Who sells: said next to the name, so nobody takes Hornilla for the seller (terms §1). */
function sellerNote(name: string): string {
  return `${name} vende y reparte el gas: los precios y la entrega son suyos. Hornilla te ayuda a encontrarla.`;
}

/** Phone: the photo with a veil, and the monogram, the name and the status riding on it. */
function PhoneHero({ distributor, status }: HeroProps) {
  return (
    <header>
      <div className="relative h-82 overflow-hidden rounded-b-2xl bg-muted">
        <img src={kitchenPhoto} alt={PHOTO_ALT} fetchPriority="high" className={PHOTO_CLASS} />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-band/0 from-15% to-band/85"
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 pb-14 text-band-foreground">
          <Monogram
            name={distributor.name}
            className="size-14 rounded-[1.125rem] text-xl ring-2 ring-band-foreground/70"
          />
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-bold text-band-foreground/85">{KIND}</p>
            <h1 className="text-[2rem] font-extrabold text-balance">{distributor.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-[0.9375rem] font-semibold tabular-nums">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  status.isOpen ? 'bg-state-free' : 'bg-state-offline',
                )}
              />
              {status.text}
            </p>
          </div>
        </div>
      </div>
      <div className="relative z-10 -mt-8 px-4">
        <DistributorFacts distributor={distributor} />
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          {sellerNote(distributor.name)}
        </p>
      </div>
    </header>
  );
}

/** Desktop: the name at full size on the left, the clean photo with the ring on the right. */
function DesktopHero({ distributor, status }: HeroProps) {
  return (
    <header className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_32.5rem] items-center gap-12 px-8 pt-4 pb-10">
      <div>
        <div className="flex items-center gap-4">
          <Monogram name={distributor.name} className="size-18 rounded-xl text-[1.75rem]" />
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-sm font-bold text-muted-foreground">{KIND}</p>
            <StateChip state={status.isOpen ? 'free' : 'offline'} className="tabular-nums">
              {status.text}
            </StateChip>
          </div>
        </div>
        <h1 className="mt-5 text-7xl font-extrabold text-balance">{distributor.name}</h1>
        <p className="mt-4 max-w-128 text-xl text-pretty text-muted-foreground">
          {sellerNote(distributor.name)}
        </p>
        <DistributorFacts distributor={distributor} className="mt-7 max-w-136" />
      </div>
      <div className="relative">
        <BurnerRing className="-bottom-9 -left-10 size-48" />
        <div className="relative h-100 overflow-hidden rounded-3xl bg-muted shadow-float">
          <img src={kitchenPhoto} alt={PHOTO_ALT} fetchPriority="high" className={PHOTO_CLASS} />
        </div>
      </div>
    </header>
  );
}

/** Cover of the public page of a distributor (PLAN 2.5), inside its `BrandTheme`. */
export function DistributorHero(props: HeroProps) {
  return useIsDesktop() ? <DesktopHero {...props} /> : <PhoneHero {...props} />;
}
