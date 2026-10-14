import { Link } from 'react-router';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { LeaderboardTable } from '../features/leaderboard/LeaderboardTable';
import { useLeaderboard } from '../features/leaderboard/use-leaderboard';

export function LeaderboardPage() {
  const { state, reload } = useLeaderboard(20);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">Ranking global</h1>
        <p className="mt-2 text-muted">Las 20 mejores velocidades en carreras completadas.</p>
      </div>

      {state.status === 'loading' && (
        <p role="status" className="text-muted">
          Cargando el ranking…
        </p>
      )}
      {state.status === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <Alert>{state.message}</Alert>
          <Button variant="secondary" onClick={reload}>
            Reintentar
          </Button>
        </div>
      )}
      {state.status === 'ready' &&
        (state.entries.length > 0 ? (
          <LeaderboardTable entries={state.entries} />
        ) : (
          <p>
            Todavía no hay resultados.{' '}
            <Link to="/" className="font-semibold underline decoration-flag decoration-2">
              Crea una sala
            </Link>{' '}
            y sé el primero en el ranking.
          </p>
        ))}
    </div>
  );
}
