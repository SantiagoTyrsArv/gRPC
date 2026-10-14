import { useCallback, useEffect, useReducer } from 'react';
import { createTypingState, typingReducer, type TypingState } from '../../lib/typing-engine';

export interface TypingEngine {
  state: TypingState;
  /** Procesa texto escrito (uno o varios caracteres). Ignorado si `enabled` es falso. */
  input: (chars: string) => void;
  backspace: () => void;
}

/**
 * Lógica de escritura separada de la UI. Se reinicia al cambiar el texto
 * (por ejemplo, en una revancha).
 */
export function useTypingEngine(text: string, enabled: boolean): TypingEngine {
  const [state, dispatch] = useReducer(typingReducer, text, createTypingState);

  useEffect(() => {
    dispatch({ type: 'reset', text });
  }, [text]);

  const input = useCallback(
    (chars: string) => {
      if (enabled && chars) dispatch({ type: 'input', chars });
    },
    [enabled],
  );

  const backspace = useCallback(() => {
    if (enabled) dispatch({ type: 'backspace' });
  }, [enabled]);

  return { state, input, backspace };
}
