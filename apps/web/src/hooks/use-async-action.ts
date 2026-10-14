import { useCallback, useState } from 'react';
import { errorMessage } from '../api/errors';

/** Ejecuta una acción asíncrona exponiendo `pending` y un mensaje de error legible. */
export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<Result | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await action(...args);
      } catch (err) {
        setError(errorMessage(err));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { run, pending, error, clearError };
}
