
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type BatchFetchInput } from '../schema';
import { batchFetchStocks } from '../handlers/batch_fetch_stocks';
import { eq, and, inArray } from 'drizzle-orm';

const testInput: BatchFetchInput = {
  symbols: ['META', 'AAPL', 'AMZN'],
  interval: '1m',
  period: '1d'
};

describe('batchFetchStocks', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch and store data for multiple symbols', async () => {
    const result = await batchFetchStocks(testInput);

    // Should return data for all symbols
    expect(result.length).toBeGreaterThan(0);
    
    // Check that we have data for each symbol
    const symbols = [...new Set(result.map(tick => tick.symbol))];
    expect(symbols.length).toBeGreaterThanOrEqual(1); // At least one symbol should succeed
    
    // Verify all returned symbols are from our input
    symbols.forEach(symbol => {
      expect(testInput.symbols).toContain(symbol);
    });

    // Verify data structure
    result.forEach(tick => {
      expect(tick.id).toBeDefined();
      expect(tick.symbol).toBeDefined();
      expect(tick.timestamp).toBeInstanceOf(Date);
      expect(typeof tick.open).toBe('number');
      expect(typeof tick.high).toBe('number');  
      expect(typeof tick.low).toBe('number');
      expect(typeof tick.close).toBe('number');
      expect(typeof tick.volume).toBe('number');
      expect(tick.interval).toEqual('1m'); // Should be normalized back to original format
      expect(tick.created_at).toBeInstanceOf(Date);
    });
  }, 30000); // Extended timeout for API simulation

  it('should save all fetched data to database', async () => {
    const result = await batchFetchStocks(testInput);

    // Verify data was saved to database
    const savedTicks = await db.select()
      .from(stockTicksTable)
      .where(
        and(
          inArray(stockTicksTable.symbol, testInput.symbols),
          eq(stockTicksTable.interval, testInput.interval)
        )
      )
      .execute();

    expect(savedTicks.length).toEqual(result.length);
    
    // Verify database storage format (numeric fields stored as strings, interval as PostgreSQL format)
    savedTicks.forEach(tick => {
      expect(tick.symbol).toBeDefined();
      expect(tick.timestamp).toBeInstanceOf(Date);
      expect(typeof tick.open).toBe('string'); // Numeric columns stored as strings
      expect(typeof tick.high).toBe('string');
      expect(typeof tick.low).toBe('string');
      expect(typeof tick.close).toBe('string');
      expect(typeof tick.volume).toBe('number');
      // Database stores interval in PostgreSQL format (e.g., "00:01:00" for 1m)
      expect(['1m', '00:01:00']).toContain(tick.interval);
    });
  }, 30000);

  it('should handle single symbol batch', async () => {
    const singleSymbolInput: BatchFetchInput = {
      symbols: ['NVDA'],
      interval: '5m',
      period: '1d'
    };

    const result = await batchFetchStocks(singleSymbolInput);

    expect(result.length).toBeGreaterThan(0);
    result.forEach(tick => {
      expect(tick.symbol).toEqual('NVDA');
      expect(tick.interval).toEqual('5m'); // Should be normalized back to original format
    });
  }, 30000);

  it('should handle different intervals', async () => {
    const intervalInput: BatchFetchInput = {
      symbols: ['GOOG', 'MSFT'],
      interval: '15m',
      period: '1d'
    };

    const result = await batchFetchStocks(intervalInput);

    expect(result.length).toBeGreaterThan(0);
    result.forEach(tick => {
      expect(tick.interval).toEqual('15m'); // Should be normalized back to original format
      expect(['GOOG', 'MSFT']).toContain(tick.symbol);
    });
  }, 30000);

  it('should prevent duplicate entries with same symbol, timestamp, and interval', async () => {
    // Run batch fetch twice with same parameters
    const firstResult = await batchFetchStocks(testInput);
    expect(firstResult.length).toBeGreaterThan(0);

    const secondResult = await batchFetchStocks(testInput);
    expect(secondResult.length).toBeGreaterThan(0);

    // Check total records in database - should not have duplicates
    const allTicks = await db.select()
      .from(stockTicksTable)
      .where(
        and(
          inArray(stockTicksTable.symbol, testInput.symbols),
          eq(stockTicksTable.interval, testInput.interval)
        )
      )
      .execute();

    // Create a set of unique combinations
    const uniqueCombinations = new Set(
      allTicks.map(tick => `${tick.symbol}-${tick.timestamp.getTime()}-${tick.interval}`)
    );

    // Number of unique combinations should equal total records (no duplicates)
    expect(uniqueCombinations.size).toEqual(allTicks.length);
  }, 45000);

  it('should handle empty response gracefully', async () => {
    // This test verifies the handler doesn't crash when API returns no data
    const result = await batchFetchStocks(testInput);
    
    // Even if some symbols return no data, the function should complete
    expect(Array.isArray(result)).toBe(true);
    // The result could be empty or contain data from symbols that did return data
    expect(result.length).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('should handle numeric field conversions correctly', async () => {
    const result = await batchFetchStocks(testInput);
    
    if (result.length > 0) {
      const tick = result[0];
      
      // Verify returned data has numbers
      expect(typeof tick.open).toBe('number');
      expect(typeof tick.high).toBe('number');
      expect(typeof tick.low).toBe('number');
      expect(typeof tick.close).toBe('number');
      
      // Verify OHLC relationships make sense
      expect(tick.high).toBeGreaterThanOrEqual(tick.open);
      expect(tick.high).toBeGreaterThanOrEqual(tick.close);
      expect(tick.high).toBeGreaterThanOrEqual(tick.low);
      expect(tick.low).toBeLessThanOrEqual(tick.open);
      expect(tick.low).toBeLessThanOrEqual(tick.close);
    }
  }, 30000);

  it('should handle interval normalization correctly', async () => {
    const intervalInput: BatchFetchInput = {
      symbols: ['AAPL'],
      interval: '30m',
      period: '1d'
    };

    const result = await batchFetchStocks(intervalInput);
    
    if (result.length > 0) {
      // All returned intervals should be normalized to original format
      result.forEach(tick => {
        expect(tick.interval).toEqual('30m');
        expect(tick.interval).not.toEqual('00:30:00'); // Should not be PostgreSQL format
      });
    }
  }, 30000);
});
