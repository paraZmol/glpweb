import { useCallback, useRef, useState } from 'react';

/**
 * Runs one asynchronous action at a time: a second tap or an Enter key while the first is still
 * going is ignored. `isRunning` drives the loading state of the button that started it.
 */
export function useAsyncAction() {
  const [isRunning, setRunning] = useState(false);
  const isBusy = useRef(false);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (isBusy.current) return;
    isBusy.current = true;
    setRunning(true);
    try {
      await action();
    } finally {
      isBusy.current = false;
      setRunning(false);
    }
  }, []);

  return { isRunning, run };
}
