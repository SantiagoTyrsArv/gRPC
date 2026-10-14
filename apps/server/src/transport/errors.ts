import { Code, ConnectError } from '@connectrpc/connect';
import type { Logger } from '../application/ports/system.js';
import { DomainError, type DomainErrorKind } from '../domain/errors.js';

/** Único punto de traducción de errores de dominio a códigos gRPC. */
const CODE_BY_KIND: Record<DomainErrorKind, Code> = {
  NOT_FOUND: Code.NotFound,
  VALIDATION: Code.InvalidArgument,
  CHEAT_DETECTED: Code.InvalidArgument,
  INVALID_STATE: Code.FailedPrecondition,
  FORBIDDEN: Code.PermissionDenied,
  ROOM_FULL: Code.ResourceExhausted,
  UNAUTHENTICATED: Code.Unauthenticated,
};

/**
 * Convierte cualquier error en un `ConnectError`. Los errores inesperados se
 * registran y se devuelven como `INTERNAL` sin filtrar detalles al cliente.
 */
export function toConnectError(error: unknown, logger: Logger): ConnectError {
  if (error instanceof ConnectError) return error;
  if (error instanceof DomainError)
    return new ConnectError(error.message, CODE_BY_KIND[error.kind]);
  logger.error({ err: error }, 'Error inesperado en una RPC');
  return new ConnectError('Error interno del servidor', Code.Internal);
}
