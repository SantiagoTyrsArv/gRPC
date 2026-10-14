import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/domain/errors.js';
import { normalizeNickname } from '../../src/domain/nickname.js';
import { normalizeRoomCode } from '../../src/domain/room-code.js';

describe('normalizeNickname', () => {
  it('recorta y colapsa espacios', () => {
    expect(normalizeNickname('  Ana   María  ')).toBe('Ana María');
  });

  it('acepta letras con tilde, ñ, números y _ - .', () => {
    expect(normalizeNickname('Ñandú_99.x-y')).toBe('Ñandú_99.x-y');
  });

  it.each(['a', ' b ', 'x'.repeat(21)])('rechaza longitud inválida: %j', (raw) => {
    expect(() => normalizeNickname(raw)).toThrow(ValidationError);
  });

  it.each(['<script>', 'hola!', 'emoji😀', 'tab\tnope\u0000'])(
    'rechaza caracteres no permitidos: %j',
    (raw) => {
      expect(() => normalizeNickname(raw)).toThrow(ValidationError);
    },
  );

  it('cuenta caracteres Unicode y no bytes', () => {
    expect(normalizeNickname('ñ'.repeat(20))).toHaveLength(20);
  });
});

describe('normalizeRoomCode', () => {
  it('normaliza a mayúsculas y recorta', () => {
    expect(normalizeRoomCode(' k7q2xm ')).toBe('K7Q2XM');
  });

  it.each(['K7Q2X', 'K7Q2XMM', 'K7Q2X0', 'K7Q2XI', 'K7-2XM'])('rechaza %j', (raw) => {
    expect(() => normalizeRoomCode(raw)).toThrow(ValidationError);
  });
});
