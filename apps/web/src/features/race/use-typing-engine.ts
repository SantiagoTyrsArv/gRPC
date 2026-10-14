import { useCallback, useReducer, useState } from 'react';
import {
  createTypingState,
  typingReducer,
  type TypingResume,
  type TypingState,
} from '../../lib/typing-engine';

export interface TypingEngine {
  state: TypingState;
  /** Procesa texto escrito (uno o varios caracteres). Ignorado si `enabled` es falso. */
  input: (chars: string) => void;
  backspace: () => void;
}

/**
 * Lógica de escritura separada de la UI. Puede reanudarse desde un avance
 * previo (`resume`) y se reinicia si cambia el texto (por ejemplo, en una revancha).
 */
export function useTypingEngine(
  text: string,
  enabled: boolean,
  resume?: TypingResume,
): TypingEngine {
  const [state, dispatch] = useReducer(typingReducer, undefined, () =>
    createTypingState(text, resume),
  );

  // Patrón "ajustar estado al cambiar una prop": reinicia sin efecto extra.
  const [currentText, setCurrentText] = useState(text);
  if (text !== currentText) {
    setCurrentText(text);
    dispatch({ type: 'reset', text });
  }

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
