import { useState } from 'react';
import { Button } from '../../components/Button';

/** Código de sala dibujado como teclas, con botón para copiar el enlace de invitación. */
export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <p className="text-sm text-muted" id="codigo-sala">
          Código de la sala
        </p>
        {/* Las letras separadas se leen una a una en lectores de pantalla. */}
        <p className="mt-1 flex gap-1.5" aria-label={code.split('').join(' ')} role="text">
          {code.split('').map((char, index) => (
            <kbd
              key={index}
              aria-hidden="true"
              className="grid h-12 w-10 place-items-center rounded-md border-2 border-ink bg-surface font-mono text-2xl font-semibold shadow-[0_3px_0_0_var(--c-ink)]"
            >
              {char}
            </kbd>
          ))}
        </p>
      </div>
      <Button variant="secondary" onClick={() => void copyLink()}>
        {copied ? 'Enlace copiado' : 'Copiar enlace de invitación'}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Enlace copiado al portapapeles' : ''}
      </span>
    </div>
  );
}
