import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-display text-3xl">Esta página no existe</h1>
      <p className="text-muted">Revisa la dirección o vuelve al inicio para crear una sala.</p>
      <Link to="/" className="font-semibold underline decoration-flag decoration-2">
        Ir al inicio
      </Link>
    </div>
  );
}
