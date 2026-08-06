import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  playPoints: integer("play_points").notNull().default(500),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  practiceUnlocked: integer("practice_unlocked").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

export const matchQueue = sqliteTable("match_queue", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mode: text("mode").notNull(),
  level: integer("level").notNull(),
  status: text("status").notNull().default("queued"),
  matchId: text("match_id"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  uniqueIndex("match_queue_user_unique").on(table.userId),
  index("match_queue_search_idx").on(table.mode, table.status, table.level, table.createdAt),
]);

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(),
  playerA: text("player_a").notNull(),
  playerB: text("player_b").notNull(),
  firstPlayer: text("first_player").notNull(),
  turnPlayer: text("turn_player").notNull(),
  phase: text("phase").notNull().default("placement"),
  stateJson: text("state_json").notNull().default("{}"),
  winner: text("winner"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("matches_player_a_idx").on(table.playerA, table.updatedAt),
  index("matches_player_b_idx").on(table.playerB, table.updatedAt),
]);

export const resultReceipts = sqliteTable("result_receipts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  processed: integer("processed").notNull().default(0),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("result_receipts_user_idx").on(table.userId, table.createdAt),
]);
