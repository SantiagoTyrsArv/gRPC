import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Textos en español para las carreras (cargados por el seed). */
export const texts = pgTable('texts', {
  id: serial('id').primaryKey(),
  content: text('content').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Una carrera terminada dentro de una sala. */
export const races = pgTable('races', {
  id: uuid('id').primaryKey(),
  roomCode: varchar('room_code', { length: 6 }).notNull(),
  textId: integer('text_id')
    .notNull()
    .references(() => texts.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
});

/** Resultado de cada jugador en una carrera. */
export const raceResults = pgTable(
  'race_results',
  {
    id: serial('id').primaryKey(),
    raceId: uuid('race_id')
      .notNull()
      .references(() => races.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id').notNull(),
    nickname: varchar('nickname', { length: 40 }).notNull(),
    position: integer('position').notNull(),
    wpm: doublePrecision('wpm').notNull(),
    accuracy: doublePrecision('accuracy').notNull(),
    elapsedMs: integer('elapsed_ms').notNull(),
    finished: boolean('finished').notNull(),
  },
  (table) => [
    index('race_results_race_id_idx').on(table.raceId),
    // Acelera el ranking: solo resultados completados, ordenados por WPM.
    index('race_results_leaderboard_idx').on(table.finished, table.wpm.desc()),
  ],
);
