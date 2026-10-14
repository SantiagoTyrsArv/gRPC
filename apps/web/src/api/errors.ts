import { Code, ConnectError } from '@connectrpc/connect';

/**
 * Mensaje para mostrar al usuario. Los errores de negocio ya llegan en español
 * desde el servidor; los de red o internos se reemplazan por uno comprensible.
 */
export function errorMessage(error: unknown): string {
  const err = ConnectError.from(error);
  switch (err.code) {
    case Code.Unavailable:
    case Code.Unknown:
      return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    case Code.Internal:
      return 'El servidor tuvo un problema. Inténtalo de nuevo en unos segundos.';
    case Code.DeadlineExceeded:
      return 'El servidor tardó demasiado en responder.';
    case Code.Canceled:
      return 'La operación se canceló.';
    default:
      return err.rawMessage;
  }
}

export function isUnauthenticated(error: unknown): boolean {
  return ConnectError.from(error).code === Code.Unauthenticated;
}

export function isCanceled(error: unknown): boolean {
  return ConnectError.from(error).code === Code.Canceled;
}
