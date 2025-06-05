
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type StockTick, type StockSymbol, type Interval } from '../schema';
import { desc, eq, and, max } from 'drizzle-orm';

// Mapping between database interval format and schema format
const intervalMapping: Record<string, Interval> = {
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
  '1 mon': '1mo',
  '3 mons': '3mo'
};

// Reverse mapping for database insertion
const reverseIntervalMapping: Record<Interval, string> = {
  '1m': '1m',
  '2m': '2m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '60m': '1h',
  '90m': '90m',
  '1h': '1h',
  '1d': '1d',
  '5d': '5d',
  '1wk': '1wk',
  '1mo': '1mo',
  '3mo': '3mo'
};

// Yahoo Finance API simulation (in production, replace with actual API)
const fetchYahooFinanceData = async (symbol: StockSymbol, interval: string = '1m', period: string = '1d') => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate Yahoo Finance response structure
  const now = new Date();
  const basePrice = Math.random() * 200 + 100; // Random price between 100-300
  
  const mockData = [{
    timestamp: Math.floor(now.getTime() / 1000),
    open: parseFloat((basePrice + Math.random() * 10 - 5).toFixed(4)),
    high: parseFloat((basePrice + Math.random() * 15).toFixed(4)),
    low: parseFloat((basePrice - Math.random() * 15).toFixed(4)),
    close: parseFloat((basePrice + Math.random() * 10 - 5).toFixed(4)),
    volume: Math.floor(Math.random() * 1000000) + 100000
  }];
  
  return mockData;
};

const upsertStockTicks = async (ticks: Omit<StockTick, 'id' | 'created_at'>[]) => {
  if (ticks.length === 0) return [];
  
  const results = [];
  
  for (const tick of ticks) {
    try {
      // Check if record already exists
      const existing = await db
        .select()
        .from(stockTicksTable)
        .where(
          and(
            eq(stockTicksTable.symbol, tick.symbol),
            eq(stockTicksTable.timestamp, tick.timestamp),
            eq(stockTicksTable.interval, reverseIntervalMapping[tick.interval] as any)
          )
        )
        .limit(1)
        .execute();

      let result;
      if (existing.length > 0) {
        // Update existing record
        const updated = await db
          .update(stockTicksTable)
          .set({
            open: tick.open.toString(),
            high: tick.high.toString(),
            low: tick.low.toString(),
            close: tick.close.toString(),
            volume: tick.volume
          })
          .where(eq(stockTicksTable.id, existing[0].id))
          .returning()
          .execute();
        result = updated[0];
      } else {
        // Insert new record
        const inserted = await db
          .insert(stockTicksTable)
          .values({
            symbol: tick.symbol,
            timestamp: tick.timestamp,
            open: tick.open.toString(),
            high: tick.high.toString(),
            low: tick.low.toString(),
            close: tick.close.toString(),
            volume: tick.volume,
            interval: reverseIntervalMapping[tick.interval] as any
          })
          .returning()
          .execute();
        result = inserted[0];
      }
      
      // Convert the database interval back to schema format
      const dbInterval = result.interval as string;
      const schemaInterval = intervalMapping[dbInterval] || tick.interval;
      
      results.push({
        ...result,
        open: parseFloat(result.open),
        high: parseFloat(result.high),
        low: parseFloat(result.low),
        close: parseFloat(result.close),
        interval: schemaInterval
      });
    } catch (error) {
      console.error(`Failed to upsert tick for ${tick.symbol}:`, error);
      throw error;
    }
  }
  
  return results;
};

export const getLatestPrices = async (fetchFresh: boolean = false): Promise<StockTick[]> => {
  try {
    // If fetchFresh is true, fetch new data from Yahoo Finance for all symbols
    if (fetchFresh) {
      const symbols: StockSymbol[] = ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
      const allTicks: Omit<StockTick, 'id' | 'created_at'>[] = [];
      
      for (const symbol of symbols) {
        try {
          const yahooData = await fetchYahooFinanceData(symbol);
          
          const ticks = yahooData.map(data => ({
            symbol,
            timestamp: new Date(data.timestamp * 1000),
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
            interval: '1m' as const
          }));
          
          allTicks.push(...ticks);
        } catch (error) {
          console.error(`Failed to fetch data for ${symbol}:`, error);
          // Continue with other symbols even if one fails
        }
      }
      
      // Upsert all fetched data
      if (allTicks.length > 0) {
        await upsertStockTicks(allTicks);
      }
    }

    // Get the latest timestamp for each symbol from database
    const subquery = db
      .select({
        symbol: stockTicksTable.symbol,
        maxTimestamp: max(stockTicksTable.timestamp).as('max_timestamp')
      })
      .from(stockTicksTable)
      .groupBy(stockTicksTable.symbol)
      .as('latest_timestamps');

    // Join with main table to get full records for latest timestamps
    const results = await db
      .select()
      .from(stockTicksTable)
      .innerJoin(
        subquery,
        and(
          eq(stockTicksTable.symbol, subquery.symbol),
          eq(stockTicksTable.timestamp, subquery.maxTimestamp)
        )
      )
      .orderBy(desc(stockTicksTable.timestamp))
      .execute();

    // Convert numeric fields back to numbers and extract stock tick data
    return results.map(result => {
      const stockTick = result.stock_ticks;
      
      // Convert the database interval back to schema format
      const dbInterval = stockTick.interval as string;
      const schemaInterval = intervalMapping[dbInterval] || dbInterval;
      
      return {
        ...stockTick,
        open: parseFloat(stockTick.open),
        high: parseFloat(stockTick.high),
        low: parseFloat(stockTick.low),
        close: parseFloat(stockTick.close),
        interval: schemaInterval as Interval
      };
    });
  } catch (error) {
    console.error('Failed to get latest prices:', error);
    throw error;
  }
};
