import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PlayerSession } from '../api/types';

interface SessionState {
  /** Sesión de la sala actual. */
  session: PlayerSession | null;
  setSession: (session: PlayerSession) => void;
  clearSession: () => void;
}

/**
 * La sesión se guarda en `sessionStorage`: sobrevive a recargar la página
 * (para reconectar con el token), pero cada pestaña tiene la suya, de modo
 * que dos pestañas del mismo navegador pueden competir como jugadores distintos.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => {
        set({ session });
        useNicknameStore.getState().remember(session.nickname);
      },
      clearSession: () => {
        set({ session: null });
      },
    }),
    { name: 'typerace-session', storage: createJSONStorage(() => sessionStorage) },
  ),
);

interface NicknameState {
  lastNickname: string;
  remember: (nickname: string) => void;
}

/** Último apodo usado, compartido entre pestañas para rellenar los formularios. */
export const useNicknameStore = create<NicknameState>()(
  persist(
    (set) => ({
      lastNickname: '',
      remember: (nickname) => {
        set({ lastNickname: nickname });
      },
    }),
    { name: 'typerace-nickname', storage: createJSONStorage(() => localStorage) },
  ),
);
