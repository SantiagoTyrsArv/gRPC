/**
 * Errores de dominio. Cada uno declara una categoría semántica (`kind`) que la
 * capa de transporte traduce a un código gRPC en un único lugar.
 * Los mensajes están en español porque se muestran al usuario.
 */
export type DomainErrorKind =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_STATE'
  | 'FORBIDDEN'
  | 'ROOM_FULL'
  | 'UNAUTHENTICATED'
  | 'CHEAT_DETECTED';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
}

export class NotFoundError extends DomainError {
  readonly kind = 'NOT_FOUND';
  override readonly name = 'NotFoundError';
}

export class ValidationError extends DomainError {
  readonly kind = 'VALIDATION';
  override readonly name = 'ValidationError';
}

/** Operación no permitida en el estado actual de la sala. */
export class InvalidStateError extends DomainError {
  readonly kind = 'INVALID_STATE';
  override readonly name = 'InvalidStateError';
}

export class ForbiddenError extends DomainError {
  readonly kind = 'FORBIDDEN';
  override readonly name = 'ForbiddenError';
}

export class RoomFullError extends DomainError {
  readonly kind = 'ROOM_FULL';
  override readonly name = 'RoomFullError';
}

export class UnauthenticatedError extends DomainError {
  readonly kind = 'UNAUTHENTICATED';
  override readonly name = 'UnauthenticatedError';
}

export type CheatReason =
  'BEFORE_START' | 'PROGRESS_REGRESSION' | 'ERRORS_REGRESSION' | 'EXCEEDS_TEXT' | 'IMPOSSIBLE_WPM';

export class CheatDetectedError extends DomainError {
  readonly kind = 'CHEAT_DETECTED';
  override readonly name = 'CheatDetectedError';

  constructor(
    readonly reason: CheatReason,
    message: string,
  ) {
    super(message);
  }
}
