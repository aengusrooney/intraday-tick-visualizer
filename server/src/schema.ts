
import { z } from 'zod';

// Stock symbols enum
export const stockSymbolSchema = z.enum(['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA']);
export type StockSymbol = z.infer<typeof stockSymbolSchema>;

// Interval enum for different time periods
export const intervalSchema = z.enum(['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']);
export type Interval = z.infer<typeof intervalSchema>;

// Stock tick data schema - represents OHLCV data
export const stockTickSchema = z.object({
  id: z.number(),
  symbol: stockSymbolSchema,
  timestamp: z.coerce.date(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int(),
  interval: intervalSchema,
  created_at: z.coerce.date()
});

export type StockTick = z.infer<typeof stockTickSchema>;

// Input schema for fetching stock data
export const fetchStockDataInputSchema = z.object({
  symbol: stockSymbolSchema,
  interval: intervalSchema.default('1m'),
  period: z.string().default('1d') // 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
});

export type FetchStockDataInput = z.infer<typeof fetchStockDataInputSchema>;

// Input schema for getting historical data
export const getHistoricalDataInputSchema = z.object({
  symbol: stockSymbolSchema.optional(),
  interval: intervalSchema.default('1m'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.number().int().positive().max(1000).default(100)
});

export type GetHistoricalDataInput = z.infer<typeof getHistoricalDataInputSchema>;

// Candlestick data point for D3.js visualization
export const candlestickDataPointSchema = z.object({
  timestamp: z.coerce.date(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int()
});

export type CandlestickDataPoint = z.infer<typeof candlestickDataPointSchema>;

// Response schema for chart data
export const chartDataResponseSchema = z.object({
  symbol: stockSymbolSchema,
  interval: intervalSchema,
  data: z.array(candlestickDataPointSchema)
});

export type ChartDataResponse = z.infer<typeof chartDataResponseSchema>;

// Batch fetch input for multiple symbols
export const batchFetchInputSchema = z.object({
  symbols: z.array(stockSymbolSchema).min(1).max(6),
  interval: intervalSchema.default('1m'),
  period: z.string().default('1d')
});

export type BatchFetchInput = z.infer<typeof batchFetchInputSchema>;

// Yahoo Finance raw data structure (for internal use)
export const yahooFinanceDataSchema = z.object({
  timestamp: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int()
});

export type YahooFinanceData = z.infer<typeof yahooFinanceDataSchema>;
