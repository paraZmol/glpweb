import { Hammer } from 'lucide-react';
import kettlePhoto from '../../../docs/design/images/pexels-13772359-tetera-llama-cocina.jpg';
import { BurnerRing } from '@/components/brand/burner-ring';
import { Highlight } from '@/components/brand/highlight';
import { ComingNext } from '@/components/finder/coming-next';
import { DistributorFinder } from '@/components/finder/distributor-finder';
import { LocationField } from '@/components/finder/location-field';
import { OwnersBand } from '@/components/finder/owners-band';
import { useDeliveryLocation } from '@/features/location/use-delivery-location';
import { ICON_STROKE } from '@/lib/icons';
import { usePageTitle } from '@/lib/page-title';
import { registerPathFrom, ROUTES } from '@/lib/routes';

/** A visitor who owns a distributor most likely has no account yet: `/registro` explains it. */
const OWNERS_ENTRY = registerPathFrom(ROUTES.newDistributor);

/** The kitchen photo with the ring behind it. The photo stays clean. */
function HeroPhoto() {
  return (
    <div className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:ml-10">
      <BurnerRing className="-right-11 -bottom-10 hidden size-56 lg:block" />
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted lg:aspect-auto lg:h-130 lg:rounded-3xl lg:shadow-float">
        <img
          src={kettlePhoto}
          alt="Tetera sobre una hornilla encendida con llama azul"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[66%_50%] brightness-(--photo-brightness)"
        />
      </div>
    </div>
  );
}

/**
 * Home of Hornilla for everybody, with or without a session (PLAN 2.6): say where you are and
 * see which distributors reach you. Phone: stamp, headline, photo and the "Entregar en" card riding
 * on it; the photo is 4:3 and the card rides high so that "Usar mi ubicación" stays in the first
 * view of a 390 × 844 phone, also with the storage notice open. Desktop: headline and card on the
 * left, photo on the right, results on a soft band.
 */
export function HomePage() {
  usePageTitle('');
  const delivery = useDeliveryLocation();

  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl gap-y-5 px-4 pt-2 pb-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-x-14 lg:gap-y-8 lg:px-8 lg:pt-6 lg:pb-16">
        <header className="lg:col-start-1 lg:row-start-1 lg:self-end">
          {/* Next to the headline, not on the photo: ordering and tracking are not built yet,
              and whoever reads only the headline must know it (PLAN 2.11). */}
          <p className="inline-flex items-center gap-1.5 rounded-full bg-aji px-3 py-1 text-[0.8125rem] font-bold text-aji-foreground lg:text-sm">
            <Hammer aria-hidden="true" className="size-4" strokeWidth={ICON_STROKE} />
            En construcción
          </p>
          <h1 className="mt-3 text-[2.625rem] font-extrabold text-balance lg:mt-4 lg:text-7xl">
            Pide tu gas a <Highlight>quien llega a tu puerta.</Highlight>
          </h1>
          <p className="mt-4 max-w-120 text-lg text-pretty text-muted-foreground lg:mt-5 lg:text-xl">
            Hornilla reúne distribuidoras de gas que reparten en tu zona. Dinos dónde estás, mira
            quién llega hasta ahí y llámala o escríbele. Pedir desde aquí llega pronto.
          </p>
        </header>
        <HeroPhoto />
        <LocationField
          delivery={delivery}
          className="relative z-10 mx-3 -mt-16 lg:col-start-1 lg:row-start-2 lg:m-0 lg:max-w-xl lg:self-start"
        />
      </div>
      <div className="lg:bg-surface-soft">
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 lg:px-8 lg:py-12">
          <DistributorFinder point={delivery.location?.point ?? null} />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-10 lg:gap-20 lg:px-8 lg:py-20">
        <ComingNext />
        <OwnersBand to={OWNERS_ENTRY} />
      </div>
    </>
  );
}
