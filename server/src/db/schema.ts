
import { serial, text, pgTable, timestamp, numeric, integer, index, pgEnum } from 'drizzle-orm/pg-core';

// Define enums for PostgreSQL
export const stockSymbolEnum = pgEnum('stock_symbol', ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA']);
export const intervalEnum = pgEnum('interval', ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']);

// Stock ticks table for time-series data
export const stockTicksTable = pgTable('stock_ticks', {
  id: serial('id').primaryKey(),
  symbol: stockSymbolEnum('symbol').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  open: numeric('open', { precision: 12, scale: 4 }).notNull(),
  high: numeric('high', { precision: 12, scale: 4 }).notNull(),
  low: numeric('low', { precision: 12, scale: 4 }).notNull(),
  close: numeric('close', { precision: 12, scale: 4 }).notNull(),
  volume: integer('volume').notNull(),
  interval: intervalEnum('interval').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes for efficient time-series queries
  symbolTimestampIdx: index('stock_ticks_symbol_timestamp_idx').on(table.symbol, table.timestamp),
  timestampIdx: index('stock_ticks_timestamp_idx').on(table.timestamp),
  symbolIntervalIdx: index('stock_ticks_symbol_interval_idx').on(table.symbol, table.interval),
  // Unique constraint to prevent duplicate entries
  uniqueTickIdx: index('stock_ticks_unique_idx').on(table.symbol, table.timestamp, table.interval),
}));

// TypeScript types for the table schema
export type StockTick = typeof stockTicksTable.$inferSelect;
export type NewStockTick = typeof stockTicksTable.$inferInsert;

// Export all tables for proper query building
export const tables = { 
  stockTicks: stockTicksTable 
};
