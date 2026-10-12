import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/common/button';
import { InlineAlert } from '@/components/common/inline-alert';
import { isJustFounded } from '@/lib/routes';

type FoundedWelcomeProps = {
  name: string;
  /**
   * The listing still waits for its first review and the distributor may operate: the only
   * moment the welcome is true. Once it is not, the welcome is over for good.
   */
  isWaitingFirstReview: boolean;
};

/**
 * What a new owner reads on landing in the office right after founding (PLAN 2.2). It lives in
 * the state of that history entry, so it is not shown on a later visit; it leaves when the
 * person closes it or when the platform decides (approved, sent back, suspended), and never
 * stands next to a state that contradicts it.
 */
export function FoundedWelcome({ name, isWaitingFirstReview }: FoundedWelcomeProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isOffered = isJustFounded(location.state);

  // Takes the mark out of the history entry: reloading or coming back does not bring it again.
  const forget = useCallback(
    () => void navigate(location, { replace: true, state: null, preventScrollReset: true }),
    // The location object changes on every navigation; its parts say whether it is the same.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [navigate, location.pathname, location.search],
  );
  useEffect(() => {
    if (isOffered && !isWaitingFirstReview) forget();
  }, [isOffered, isWaitingFirstReview, forget]);

  if (!isOffered || !isWaitingFirstReview) return null;
  return (
    <InlineAlert tone="success">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <p className="min-w-60 flex-1">
          {name} ya está en Hornilla. Empezaron tus 30 días de prueba gratis: puedes configurarla
          desde ahora, y aparecerá en el buscador cuando Hornilla revise sus datos.
        </p>
        <Button type="button" variant="line" size="sm" onClick={forget}>
          Entendido
        </Button>
      </div>
    </InlineAlert>
  );
}
