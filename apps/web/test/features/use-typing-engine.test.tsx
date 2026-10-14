import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTypingEngine } from '../../src/features/race/use-typing-engine';

describe('useTypingEngine', () => {
  it('procesa la escritura solo cuando está habilitado', () => {
    const { result, rerender } = renderHook(({ enabled }) => useTypingEngine('hola', enabled), {
      initialProps: { enabled: false },
    });
    act(() => {
      result.current.input('h');
    });
    expect(result.current.state.position).toBe(0);

    rerender({ enabled: true });
    act(() => {
      result.current.input('hx');
    });
    expect(result.current.state).toMatchObject({ position: 1, wrong: 'x', errors: 1 });
    act(() => {
      result.current.backspace();
      result.current.input('ola');
    });
    expect(result.current.state.finished).toBe(true);
  });

  it('se reinicia cuando cambia el texto (revancha)', () => {
    const { result, rerender } = renderHook(({ text }) => useTypingEngine(text, true), {
      initialProps: { text: 'abc' },
    });
    act(() => {
      result.current.input('ab');
    });
    rerender({ text: 'xyz' });
    expect(result.current.state).toMatchObject({ text: 'xyz', position: 0, errors: 0 });
  });
});
