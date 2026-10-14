/**
 * Motor de escritura puro (sin React). Reglas:
 * - Solo se avanza escribiendo el carácter correcto.
 * - Tras un error, lo que se escriba se acumula como "erróneo" y hay que
 *   borrarlo antes de continuar: no se puede avanzar con un error.
 * - No se puede borrar texto ya correcto (el progreso nunca retrocede).
 */
export const MAX_WRONG_CHARS = 10;

export interface TypingState {
  text: string;
  /** Caracteres correctos desde el inicio (posición del cursor). */
  position: number;
  /** Caracteres escritos tras el primer error, pendientes de borrar. */
  wrong: string;
  /** Pulsaciones incorrectas acumuladas (para la precisión). */
  errors: number;
  finished: boolean;
}

export type TypingAction =
  { type: 'input'; chars: string } | { type: 'backspace' } | { type: 'reset'; text: string };

export function createTypingState(text: string): TypingState {
  return { text, position: 0, wrong: '', errors: 0, finished: text.length === 0 };
}

function typeChar(state: TypingState, char: string): TypingState {
  if (state.finished) return state;
  if (state.wrong.length > 0) {
    if (state.wrong.length >= MAX_WRONG_CHARS) return { ...state, errors: state.errors + 1 };
    return { ...state, wrong: state.wrong + char, errors: state.errors + 1 };
  }
  if (char === state.text[state.position]) {
    const position = state.position + 1;
    return { ...state, position, finished: position === state.text.length };
  }
  return { ...state, wrong: char, errors: state.errors + 1 };
}

export function typingReducer(state: TypingState, action: TypingAction): TypingState {
  switch (action.type) {
    case 'input':
      return Array.from(action.chars).reduce(typeChar, state);
    case 'backspace':
      return state.wrong.length > 0 ? { ...state, wrong: state.wrong.slice(0, -1) } : state;
    case 'reset':
      return createTypingState(action.text);
  }
}

/** Segmentos para pintar el texto: hecho, error, cursor y pendiente. */
export function splitForDisplay(state: TypingState): {
  done: string;
  wrong: string;
  current: string;
  rest: string;
} {
  const errorEnd = state.position + state.wrong.length;
  return {
    done: state.text.slice(0, state.position),
    // Los caracteres del texto que el error "tapa" se muestran en rojo.
    wrong: state.text.slice(state.position, errorEnd),
    current: state.text.charAt(errorEnd),
    rest: state.text.slice(errorEnd + 1),
  };
}
