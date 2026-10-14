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
    <div className="flex flex-col gap-3 self-start rounded-lg bg-surface p-5">
      <p className="text-sm text-muted" id="codigo-sala">
        Código de la sala
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {/* Las letras separadas se leen una a una en lectores de pantalla. */}
        <p className="flex gap-1.5" aria-label={code.split('').join(' ')} role="text">
          {code.split('').map((char, index) => (
            <kbd
              key={index}
              aria-hidden="true"
              className="grid h-14 w-11 place-items-center rounded-md bg-strip font-mono text-3xl font-semibold text-strip-ink"
            >
              {char}
            </kbd>
          ))}
        </p>
        <Button variant="secondary" onClick={() => void copyLink()}>
          {copied ? 'Enlace copiado' : 'Copiar enlace de invitación'}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Enlace copiado al portapapeles' : ''}
      </span>
    </div>
  );
}
