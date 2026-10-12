import { HornillaLogo } from '@/components/brand/hornilla-logo';
import { Bone, LoadingRegion } from '@/components/common/skeleton';

const LOGO_PX = 28;

/**
 * What shows while the session, the profile or the role of the account are still being read:
 * the frame of a screen (bar, title, a card) instead of a blank page or a lone spinner.
 */
export function AreaLoading() {
  return (
    <LoadingRegion label="Cargando tu cuenta" className="flex flex-1 flex-col">
      <div className="flex min-h-14 items-center px-4 py-2 lg:px-8 lg:py-5">
        <HornillaLogo size={LOGO_PX} />
      </div>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 lg:px-8 lg:pt-10">
        <Bone className="h-10 w-3/5 max-w-md" />
        <Bone className="mt-4 h-5 w-4/5 max-w-lg" />
        <div className="mt-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Bone className="h-56 rounded-xl" />
          <Bone className="hidden h-56 rounded-xl lg:block" />
        </div>
      </div>
    </LoadingRegion>
  );
}
