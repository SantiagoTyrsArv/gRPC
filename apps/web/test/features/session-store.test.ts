import { describe, expect, it } from 'vitest';
import { useNicknameStore, useSessionStore } from '../../src/stores/session-store';

describe('session-store', () => {
  it('guarda la sesión por pestaña (sessionStorage) y el apodo compartido (localStorage)', () => {
    useSessionStore.getState().setSession({
      roomCode: 'ABCDEF',
      playerId: 'p1',
      playerToken: 'secreto',
      nickname: 'Ana',
    });

    expect(sessionStorage.getItem('typerace-session')).toContain('secreto');
    // El token nunca va a localStorage: otra pestaña no debe heredar la identidad.
    expect(localStorage.getItem('typerace-session')).toBeNull();
    expect(useNicknameStore.getState().lastNickname).toBe('Ana');
    expect(localStorage.getItem('typerace-nickname')).toContain('Ana');

    useSessionStore.getState().clearSession();
    expect(useSessionStore.getState().session).toBeNull();
    expect(useNicknameStore.getState().lastNickname).toBe('Ana');
  });
});
