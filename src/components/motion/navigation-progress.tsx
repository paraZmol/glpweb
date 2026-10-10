import { useNavigation } from 'react-router';
import { useDelayedFlag } from '@/lib/use-delayed-flag';

/**
 * Thin bar at the top while the next screen downloads its code or data (motion-system §2).
 * Follows the 300 ms rule: a fast navigation never flashes it.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const isShown = useDelayedFlag(navigation.state !== 'idle');
  if (!isShown) return null;

  return (
    <div
      role="progressbar"
      aria-label="Cargando la pantalla"
      className="pointer-events-none fixed inset-x-0 top-(--top-inset) z-50 h-[3px] overflow-hidden"
    >
      <div className="navigation-progress h-full w-2/5 rounded-full bg-primary" />
    </div>
  );
}
