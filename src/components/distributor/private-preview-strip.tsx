import { EyeOff } from 'lucide-react';
import { Link } from 'react-router';
import { ICON_STROKE } from '@/lib/icons';
import { ROUTES } from '@/lib/routes';

/**
 * Strip over the page of a distributor that visitors cannot open yet (PLAN 2.11): waiting for
 * the review of the platform, or not operating. Only its own staff gets this far, so it speaks
 * to them. In ink, not in the colour of the brand: it is a message of the system.
 */
export function PrivatePreviewStrip() {
  return (
    <div role="status" className="bg-foreground text-background">
      <p className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[0.9375rem] font-semibold lg:px-8">
        <EyeOff aria-hidden="true" className="size-5 shrink-0" strokeWidth={ICON_STROKE} />
        <span>Solo el personal de tu distribuidora ve esta página: ahora no es pública.</span>
        <Link to={ROUTES.officeHome} className="rounded-sm underline underline-offset-4">
          Ir a mi central
        </Link>
      </p>
    </div>
  );
}
