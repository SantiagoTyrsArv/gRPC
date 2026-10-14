import { describe, expect, it } from 'vitest';
import {
  createTypingState,
  MAX_WRONG_CHARS,
  splitForDisplay,
  typingReducer,
  type TypingState,
} from '../../src/lib/typing-engine';

const type = (state: TypingState, chars: string) => typingReducer(state, { type: 'input', chars });
const backspace = (state: TypingState) => typingReducer(state, { type: 'backspace' });

describe('typingReducer', () => {
  it('avanza con caracteres correctos y termina al completar el texto', () => {
    let state = type(createTypingState('hola'), 'hol');
    expect(state).toMatchObject({ position: 3, wrong: '', errors: 0, finished: false });
    state = type(state, 'a');
    expect(state).toMatchObject({ position: 4, finished: true });
  });

  it('no avanza con un error hasta corregirlo', () => {
    let state = type(createTypingState('hola'), 'hx');
    expect(state).toMatchObject({ position: 1, wrong: 'x', errors: 1 });

    state = type(state, 'ola'); // sigue escribiendo sin corregir
    expect(state).toMatchObject({ position: 1, wrong: 'xola', errors: 4 });

    state = [1, 2, 3, 4].reduce(backspace, state);
    expect(state).toMatchObject({ position: 1, wrong: '' });
    state = type(state, 'ola');
    expect(state).toMatchObject({ position: 4, finished: true, errors: 4 });
  });

  it('no permite borrar texto ya correcto', () => {
    const state = backspace(type(createTypingState('hola'), 'ho'));
    expect(state.position).toBe(2);
  });

  it('limita los caracteres erróneos acumulados', () => {
    const state = type(createTypingState('abc'), 'x'.repeat(MAX_WRONG_CHARS + 5));
    expect(state.wrong).toHaveLength(MAX_WRONG_CHARS);
    expect(state.errors).toBe(MAX_WRONG_CHARS + 5);
  });

  it('ignora entradas después de terminar', () => {
    const done = type(createTypingState('ok'), 'ok');
    expect(type(done, 'zzz')).toBe(done);
  });

  it('distingue mayúsculas, tildes y espacios', () => {
    const state = type(createTypingState('Él es'), 'el');
    expect(state).toMatchObject({ position: 0, wrong: 'el' });
    expect(type(createTypingState('Él es'), 'Él es').finished).toBe(true);
  });

  it('se reanuda desde un avance previo (recarga en plena carrera)', () => {
    const resumed = createTypingState('hola mundo', { position: 5, errors: 2 });
    expect(resumed).toMatchObject({ position: 5, errors: 2, wrong: '', finished: false });
    expect(type(resumed, 'mundo').finished).toBe(true);
    // Valores fuera de rango se acotan.
    expect(createTypingState('abc', { position: 99, errors: -1 })).toMatchObject({
      position: 3,
      errors: 0,
      finished: true,
    });
  });

  it('se reinicia con un texto nuevo', () => {
    const state = typingReducer(type(createTypingState('abc'), 'ab'), {
      type: 'reset',
      text: 'xyz',
    });
    expect(state).toEqual(createTypingState('xyz'));
  });
});

describe('splitForDisplay', () => {
  it('separa hecho, error, cursor y resto', () => {
    expect(splitForDisplay(type(createTypingState('hola mundo'), 'hol'))).toEqual({
      done: 'hol',
      wrong: '',
      current: 'a',
      rest: ' mundo',
    });
    expect(splitForDisplay(type(createTypingState('hola mundo'), 'hoxy'))).toEqual({
      done: 'ho',
      wrong: 'la',
      current: ' ',
      rest: 'mundo',
    });
  });
});
