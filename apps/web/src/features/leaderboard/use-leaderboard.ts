import { useCallback, useEffect, useState } from 'react';
import { leaderboardClient } from '../../api/client';
import { errorMessage } from '../../api/errors';
import { fromProtoLeaderboardEntry } from '../../api/mappers';
import type { LeaderboardEntry } from '../../api/types';

type LeaderboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: LeaderboardEntry[] };

/** Carga el ranking global (top 20 por WPM). */
export function useLeaderboard(limit = 20) {
  const [state, setState] = useState<LeaderboardState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    leaderboardClient
      .getLeaderboard({ limit }, { signal: controller.signal })
      .then((res) => {
        setState({ status: 'ready', entries: res.entries.map(fromProtoLeaderboardEntry) });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      controller.abort();
    };
  }, [limit, reloadKey]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setReloadKey((k) => k + 1);
  }, []);

  return { state, reload };
}
