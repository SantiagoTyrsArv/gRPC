import {
  useEffect,
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { splitForDisplay } from '../../lib/typing-engine';
import type { TypingEngine } from './use-typing-engine';

interface TypingAreaProps {
  engine: TypingEngine;
  enabled: boolean;
}

/**
 * Muestra el texto con lo escrito (verde), el error actual (rojo) y el cursor.
 * Un input invisible captura el teclado (también en móviles). Pegar está bloqueado.
 */
export function TypingArea({ engine, enabled }: TypingAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { done, wrong, current, rest } = splitForDisplay(engine.state);
  const hasError = engine.state.wrong.length > 0;

  useEffect(() => {
    if (enabled) inputRef.current?.focus();
  }, [enabled]);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    engine.input(e.target.value);
    e.target.value = '';
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      engine.backspace();
    }
  };

  const blockPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  return (
    <div
      className={`relative cursor-text rounded-md border-2 bg-surface p-5 sm:p-6 ${
        hasError ? 'border-error' : enabled ? 'border-ink' : 'border-line'
      }`}
      onClick={() => inputRef.current?.focus()}
    >
      <p
        className="font-mono text-lg leading-[1.9] break-words select-none sm:text-xl"
        aria-hidden="true"
        data-testid="race-text"
      >
        <span className="text-correct">{done}</span>
        {wrong && (
          <span className="rounded-sm bg-error-bg text-error underline decoration-2">{wrong}</span>
        )}
        {current && (
          <span
            className={`border-b-4 ${hasError ? 'border-error' : 'border-flag'} ${enabled ? 'motion-safe:animate-pulse' : ''}`}
          >
            {current}
          </span>
        )}
        <span className="text-muted">{rest}</span>
      </p>

      <p className="sr-only">Texto de la carrera: {engine.state.text}</p>
      <label htmlFor="typing-input" className="sr-only">
        Escribe aquí el texto de la carrera
      </label>
      <input
        id="typing-input"
        ref={inputRef}
        type="text"
        disabled={!enabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={blockPaste}
        onDrop={(e) => {
          e.preventDefault();
        }}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />

      <p aria-live="polite" className="mt-3 min-h-5 text-sm font-semibold text-error">
        {hasError ? 'Corrige el error con la tecla de borrar para seguir avanzando.' : ''}
      </p>
    </div>
  );
}
