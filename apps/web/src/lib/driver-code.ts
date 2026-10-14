/** Código de tres letras, como en las pantallas de cronometraje (VAL, MAT…). */
export function driverCode(nickname: string): string {
  const letters = Array.from(nickname.normalize('NFC').replace(/\s+/g, ''));
  return letters.slice(0, 3).join('').toLocaleUpperCase('es');
}
