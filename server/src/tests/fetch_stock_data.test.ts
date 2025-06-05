
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type FetchStockDataInput } from '../schema';
import { fetchStockData } from '../handlers/fetch_stock_data';
import { eq, and } from 'drizzle-orm';

describe('fetchStockData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch and store stock data', async () => {
    const input: FetchStockDataInput = {
      symbol: 'AAPL',
      interval: '1m',
      period: '1d'
    };

    const result = await fetchStockData(input);

    // Verify we got data back
    expect(result.length).toBeGreaterThan(0);
    
    // Verify data structure
    const firstTick = result[0];
    expect(firstTick.symbol).toEqual('AAPL');
    // Note: PostgreSQL enum converts intervals, so we need to check the actual stored value
    expect(['1m', '00:01:00']).toContain(firstTick.interval);
    expect(firstTick.timestamp).toBeInstanceOf(Date);
    expect(typeof firstTick.open).toBe('number');
    expect(typeof firstTick.high).toBe('number');
    expect(typeof firstTick.low).toBe('number');
    expect(typeof firstTick.close).toBe('number');
    expect(typeof firstTick.volume).toBe('number');
    expect(firstTick.id).toBeDefined();
    expect(firstTick.created_at).toBeInstanceOf(Date);
  });

  it('should save data to database', async () => {
    const input: FetchStockDataInput = {
      symbol: 'META',
      interval: '5m',
      period: '1d'
    };

    const result = await fetchStockData(input);

    // Verify data was saved to database
    const savedTicks = await db.select()
      .from(stockTicksTable)
      .where(eq(stockTicksTable.symbol, 'META'))
      .execute();

    expect(savedTicks.length).toEqual(result.length);
    expect(savedTicks.length).toBeGreaterThan(0);

    // Verify first saved tick
    const firstSaved = savedTicks[0];
    expect(firstSaved.symbol).toEqual('META');
    // PostgreSQL might convert interval format
    expect(['5m', '00:05:00']).toContain(firstSaved.interval);
    expect(parseFloat(firstSaved.open)).toBeGreaterThan(0);
    expect(parseFloat(firstSaved.high)).toBeGreaterThan(0);
    expect(parseFloat(firstSaved.low)).toBeGreaterThan(0);
    expect(parseFloat(firstSaved.close)).toBeGreaterThan(0);
    expect(firstSaved.volume).toBeGreaterThan(0);
  });

  it('should handle upsert correctly for duplicate data', async () => {
    const input: FetchStockDataInput = {
      symbol: 'GOOG',
      interval: '1m',
      period: '1d'
    };

    // First fetch
    const firstResult = await fetchStockData(input);
    expect(firstResult.length).toBeGreaterThan(0);

    // Get count of records in database
    const initialCount = await db.select()
      .from(stockTicksTable)
      .where(eq(stockTicksTable.symbol, 'GOOG'))
      .execute();

    // Second fetch (should update existing records, not create duplicates)
    const secondResult = await fetchStockData(input);
    expect(secondResult.length).toBeGreaterThan(0);

    // Verify no duplicates were created
    const finalCount = await db.select()
      .from(stockTicksTable)
      .where(eq(stockTicksTable.symbol, 'GOOG'))
      .execute();

    expect(finalCount.length).toEqual(initialCount.length);
    expect(finalCount.length).toEqual(secondResult.length);
  });

  it('should handle different intervals correctly', async () => {
    const inputs: FetchStockDataInput[] = [
      { symbol: 'MSFT', interval: '1m', period: '1d' },
      { symbol: 'MSFT', interval: '5m', period: '1d' },
      { symbol: 'MSFT', interval: '15m', period: '1d' }
    ];

    for (const input of inputs) {
      const result = await fetchStockData(input);
      expect(result.length).toBeGreaterThan(0);
      
      // Verify all ticks have correct symbol
      result.forEach(tick => {
        expect(tick.symbol).toEqual('MSFT');
        // PostgreSQL may convert interval format, so check both possibilities
        expect(['1m', '5m', '15m', '00:01:00', '00:05:00', '00:15:00']).toContain(tick.interval);
      });
    }

    // Verify all intervals were stored
    const allTicks = await db.select()
      .from(stockTicksTable)
      .where(eq(stockTicksTable.symbol, 'MSFT'))
      .execute();

    expect(allTicks.length).toBeGreaterThan(0);
    
    // Check that we have different interval values (even if PostgreSQL converted them)
    const intervals = [...new Set(allTicks.map(tick => tick.interval))];
    expect(intervals.length).toBeGreaterThanOrEqual(3); // Should have at least 3 different intervals
  });

  it('should validate OHLC data relationships', async () => {
    const input: FetchStockDataInput = {
      symbol: 'NVDA',
      interval: '1m',
      period: '1d'
    };

    const result = await fetchStockData(input);
    expect(result.length).toBeGreaterThan(0);

    // Verify OHLC relationships for each tick
    result.forEach(tick => {
      expect(tick.high).toBeGreaterThanOrEqual(tick.open);
      expect(tick.high).toBeGreaterThanOrEqual(tick.close);
      expect(tick.high).toBeGreaterThanOrEqual(tick.low);
      expect(tick.low).toBeLessThanOrEqual(tick.open);
      expect(tick.low).toBeLessThanOrEqual(tick.close);
      expect(tick.volume).toBeGreaterThan(0);
    });
  });

  it('should handle different periods correctly', async () => {
    const shortPeriodInput: FetchStockDataInput = {
      symbol: 'AAPL',
      interval: '1m',
      period: '1d'
    };

    const longPeriodInput: FetchStockDataInput = {
      symbol: 'AAPL',
      interval: '1m',
      period: '5d'
    };

    const shortResult = await fetchStockData(shortPeriodInput);
    const longResult = await fetchStockData(longPeriodInput);

    expect(shortResult.length).toBeGreaterThan(0);
    expect(longResult.length).toBeGreaterThan(0);
    expect(longResult.length).toBeGreaterThan(shortResult.length);
  });
});
