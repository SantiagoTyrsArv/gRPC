import { driverCode } from '../lib/driver-code';

interface DriverNameProps {
  nickname: string;
  isSelf?: boolean;
}

/**
 * Código del piloto en grande y el apodo completo al lado. Si el apodo ya es el
 * código (p. ej. «Ana»), no se repite a la vista, pero sí para lectores de pantalla.
 */
export function DriverName({ nickname, isSelf = false }: DriverNameProps) {
  const code = driverCode(nickname);
  const repeated = nickname.toLocaleUpperCase('es') === code;
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span aria-hidden="true" className="font-num text-lg leading-none tracking-wide">
        {code}
      </span>
      <span className="truncate text-sm text-muted">
        {repeated ? <span className="sr-only">{nickname}</span> : nickname}
        {isSelf && ' (tú)'}
      </span>
    </span>
  );
}
