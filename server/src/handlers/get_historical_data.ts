
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type GetHistoricalDataInput, type StockTick } from '../schema';
import { eq, gte, lte, and, desc, SQL } from 'drizzle-orm';

// Helper function to convert interval enum to PostgreSQL interval format
const convertIntervalToPostgres = (interval: string): string => {
  const intervalMap: Record<string, string> = {
    '1m': '00:01:00',
    '2m': '00:02:00',
    '5m': '00:05:00',
    '15m': '00:15:00',
    '30m': '00:30:00',
    '60m': '01:00:00',
    '90m': '01:30:00',
    '1h': '01:00:00',
    '1d': '1 day',
    '5d': '5 days',
    '1wk': '7 days',
    '1mo': '1 month',
    '3mo': '3 months'
  };
  return intervalMap[interval] || interval;
};

// Helper function to convert PostgreSQL interval back to enum format
const convertIntervalFromPostgres = (pgInterval: string): string => {
  const reverseMap: Record<string, string> = {
    '00:01:00': '1m',
    '00:02:00': '2m',
    '00:05:00': '5m',
    '00:15:00': '15m',
    '00:30:00': '30m',
    '01:00:00': '1h',
    '01:30:00': '90m',
    '1 day': '1d',
    '5 days': '5d',
    '7 days': '1wk',
    '1 month': '1mo',
    '3 months': '3mo'
  };
  return reverseMap[pgInterval] || pgInterval;
};

export const getHistoricalData = async (input: GetHistoricalDataInput): Promise<StockTick[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Filter by symbol if provided
    if (input.symbol) {
      conditions.push(eq(stockTicksTable.symbol, input.symbol));
    }

    // Filter by interval (convert to PostgreSQL format)
    const pgInterval = convertIntervalToPostgres(input.interval);
    conditions.push(eq(stockTicksTable.interval, pgInterval as any));

    // Filter by start date if provided
    if (input.startDate) {
      conditions.push(gte(stockTicksTable.timestamp, input.startDate));
    }

    // Filter by end date if provided
    if (input.endDate) {
      conditions.push(lte(stockTicksTable.timestamp, input.endDate));
    }

    // Build the complete query in one chain
    const results = await db.select()
      .from(stockTicksTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(stockTicksTable.timestamp))
      .limit(input.limit)
      .execute();

    // Convert numeric fields from strings to numbers and interval back to enum format
    return results.map(tick => ({
      ...tick,
      open: parseFloat(tick.open),
      high: parseFloat(tick.high),
      low: parseFloat(tick.low),
      close: parseFloat(tick.close),
      interval: convertIntervalFromPostgres(tick.interval as string) as any
    }));
  } catch (error) {
    console.error('Historical data retrieval failed:', error);
    throw error;
  }
};
