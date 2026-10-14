import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

interface ThemeState {
  /** `null` = seguir la preferencia del sistema. */
  theme: Theme | null;
  toggle: () => void;
}

/** Tema activo: el elegido por el usuario o, si no eligió, el del sistema. */
export function resolveTheme(theme: Theme | null): Theme {
  return theme ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: null,
      toggle: () => {
        const next: Theme = resolveTheme(get().theme) === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ theme: next });
      },
    }),
    // La misma clave la lee el script inline de index.html para evitar parpadeo.
    { name: 'typerace-theme', storage: createJSONStorage(() => localStorage) },
  ),
);
