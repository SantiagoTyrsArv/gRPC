import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlayerSession } from '../api/types';

interface SessionState {
  /** Sesión de la sala actual; se persiste para reconectar al recargar. */
  session: PlayerSession | null;
  /** Último apodo usado, para rellenar el formulario. */
  lastNickname: string;
  setSession: (session: PlayerSession) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      lastNickname: '',
      setSession: (session) => {
        set({ session, lastNickname: session.nickname });
      },
      clearSession: () => {
        set({ session: null });
      },
    }),
    { name: 'typerace-session', storage: createJSONStorage(() => localStorage) },
  ),
);
