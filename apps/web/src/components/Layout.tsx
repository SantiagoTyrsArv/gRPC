import { Link, NavLink, Outlet } from 'react-router';
import { ThemeToggle } from './ThemeToggle';

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-flag focus:px-4 focus:py-2 focus:text-flag-ink"
      >
        Saltar al contenido
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="font-display text-2xl tracking-tight text-ink">
            TypeRace
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1">
            <NavLink
              to="/ranking"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 font-semibold hover:bg-surface-2 hover:text-ink ${isActive ? 'text-ink underline decoration-best decoration-[3px] underline-offset-[10px]' : 'text-muted'}`
              }
            >
              Ranking
            </NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted sm:px-6">
          Proyecto académico de programación web. Comunicación en tiempo real con gRPC.
        </p>
      </footer>
    </div>
  );
}
