export interface NewPlayer {
  id: string;
  /** Secreto opaco con el que el jugador se autentica y reconecta. */
  token: string;
  /** Apodo ya normalizado (ver `normalizeNickname`). */
  nickname: string;
}

/** Avance del jugador en la carrera en curso. */
export interface PlayerRaceState {
  typedCorrect: number;
  errors: number;
  /** Instante en que completó el texto (ms epoch) o `null`. */
  finishedAt: number | null;
  /** Posición de llegada asignada al terminar, o `null`. */
  position: number | null;
}

export function emptyRaceState(): PlayerRaceState {
  return { typedCorrect: 0, errors: 0, finishedAt: null, position: null };
}

/** Jugador dentro de una sala. Solo `Room` modifica su estado. */
export class Player {
  readonly id: string;
  readonly token: string;
  readonly nickname: string;
  ready = false;
  connected = false;
  race: PlayerRaceState = emptyRaceState();

  constructor(data: NewPlayer) {
    this.id = data.id;
    this.token = data.token;
    this.nickname = data.nickname;
  }

  get finished(): boolean {
    return this.race.finishedAt !== null;
  }
}
