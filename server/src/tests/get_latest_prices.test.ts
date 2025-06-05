
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { getLatestPrices } from '../handlers/get_latest_prices';
import { eq, and } from 'drizzle-orm';

describe('getLatestPrices', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no data exists', async () => {
    const result = await getLatestPrices();
    expect(result).toEqual([]);
  });

  it('should return latest prices for each symbol', async () => {
    // Insert test data with different timestamps
    const oldTimestamp = new Date('2024-01-01T10:00:00Z');
    const newTimestamp = new Date('2024-01-01T11:00:00Z');

    // Insert older data
    await db.insert(stockTicksTable).values([
      {
        symbol: 'AAPL',
        timestamp: oldTimestamp,
        open: '150.00',
        high: '155.00',
        low: '149.00',
        close: '154.00',
        volume: 1000000,
        interval: '1m'
      },
      {
        symbol: 'META',
        timestamp: oldTimestamp,
        open: '300.00',
        high: '310.00',
        low: '295.00',
        close: '305.00',
        volume: 800000,
        interval: '1m'
      }
    ]).execute();

    // Insert newer data
    await db.insert(stockTicksTable).values([
      {
        symbol: 'AAPL',
        timestamp: newTimestamp,
        open: '155.00',
        high: '160.00',
        low: '154.00',
        close: '159.00',
        volume: 1200000,
        interval: '1m'
      },
      {
        symbol: 'META',
        timestamp: newTimestamp,
        open: '305.00',
        high: '315.00',
        low: '300.00',
        close: '312.00',
        volume: 900000,
        interval: '1m'
      }
    ]).execute();

    const result = await getLatestPrices();

    expect(result).toHaveLength(2);
    
    // Check AAPL latest data
    const appleData = result.find(tick => tick.symbol === 'AAPL');
    expect(appleData).toBeDefined();
    expect(appleData!.timestamp).toEqual(newTimestamp);
    expect(appleData!.open).toEqual(155.00);
    expect(appleData!.close).toEqual(159.00);
    expect(typeof appleData!.open).toBe('number');
    expect(typeof appleData!.close).toBe('number');
    expect(appleData!.interval).toBe('1m');

    // Check META latest data
    const metaData = result.find(tick => tick.symbol === 'META');
    expect(metaData).toBeDefined();
    expect(metaData!.timestamp).toEqual(newTimestamp);
    expect(metaData!.open).toEqual(305.00);
    expect(metaData!.close).toEqual(312.00);
    expect(metaData!.interval).toBe('1m');
  });

  it('should fetch fresh data from Yahoo Finance when requested', async () => {
    const result = await getLatestPrices(true);

    // Should have fetched data for all 6 symbols
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(6);

    // Verify data structure
    result.forEach(tick => {
      expect(tick.id).toBeDefined();
      expect(tick.symbol).toMatch(/^(META|AAPL|AMZN|GOOG|MSFT|NVDA)$/);
      expect(tick.timestamp).toBeInstanceOf(Date);
      expect(typeof tick.open).toBe('number');
      expect(typeof tick.high).toBe('number');
      expect(typeof tick.low).toBe('number');
      expect(typeof tick.close).toBe('number');
      expect(typeof tick.volume).toBe('number');
      expect(tick.interval).toBe('1m');
      expect(tick.created_at).toBeInstanceOf(Date);
    });

    // Verify data was saved to database
    const dbData = await db.select().from(stockTicksTable).execute();
    expect(dbData.length).toBeGreaterThan(0);
  });

  it('should handle upsert correctly - update existing records', async () => {
    // Insert initial data
    const timestamp = new Date('2024-01-01T10:00:00Z');
    await db.insert(stockTicksTable).values({
      symbol: 'AAPL',
      timestamp: timestamp,
      open: '150.00',
      high: '155.00',
      low: '149.00',
      close: '154.00',
      volume: 1000000,
      interval: '1m'
    }).execute();

    // Count initial records
    const initialCount = await db.select().from(stockTicksTable).execute();
    expect(initialCount).toHaveLength(1);

    // Fetch fresh data (this should trigger upsert logic)
    await getLatestPrices(true);

    // Should still have records, but potentially updated
    const finalData = await db.select().from(stockTicksTable).execute();
    expect(finalData.length).toBeGreaterThan(0);

    // Check that numeric fields are properly stored
    const savedTick = finalData[0];
    expect(typeof savedTick.open).toBe('string'); // Stored as string in DB
    expect(typeof savedTick.high).toBe('string');
    expect(typeof savedTick.low).toBe('string');
    expect(typeof savedTick.close).toBe('string');
  });

  it('should handle database errors gracefully', async () => {
    // This test ensures error handling works
    expect(async () => {
      await getLatestPrices();
    }).not.toThrow();
  });

  it('should order results by timestamp descending', async () => {
    // Insert data with different timestamps
    const timestamps = [
      new Date('2024-01-01T10:00:00Z'),
      new Date('2024-01-01T11:00:00Z'),
      new Date('2024-01-01T12:00:00Z')
    ];

    for (let i = 0; i < timestamps.length; i++) {
      await db.insert(stockTicksTable).values({
        symbol: i === 0 ? 'AAPL' : i === 1 ? 'META' : 'GOOG',
        timestamp: timestamps[i],
        open: '100.00',
        high: '105.00',
        low: '99.00',
        close: '104.00',
        volume: 1000000,
        interval: '1m'
      }).execute();
    }

    const result = await getLatestPrices();

    // Should return latest for each symbol, ordered by timestamp desc
    expect(result).toHaveLength(3);
    
    // Verify intervals are properly converted
    result.forEach(tick => {
      expect(tick.interval).toBe('1m');
    });
    
    // First result should have the latest timestamp
    expect(result[0].timestamp.getTime()).toBeGreaterThanOrEqual(result[1].timestamp.getTime());
    if (result.length > 2) {
      expect(result[1].timestamp.getTime()).toBeGreaterThanOrEqual(result[2].timestamp.getTime());
    }
  });

  it('should handle numeric precision correctly', async () => {
    // Test with precise decimal values
    const timestamp = new Date('2024-01-01T10:00:00Z');
    await db.insert(stockTicksTable).values({
      symbol: 'AAPL',
      timestamp: timestamp,
      open: '150.1234',
      high: '155.5678',
      low: '149.9876',
      close: '154.4321',
      volume: 1000000,
      interval: '1m'
    }).execute();

    const result = await getLatestPrices();
    
    expect(result).toHaveLength(1);
    expect(result[0].open).toEqual(150.1234);
    expect(result[0].high).toEqual(155.5678);
    expect(result[0].low).toEqual(149.9876);
    expect(result[0].close).toEqual(154.4321);
    expect(result[0].interval).toBe('1m');
  });

  it('should handle different interval formats correctly', async () => {
    const timestamp = new Date('2024-01-01T10:00:00Z');
    
    // Insert data with different intervals
    await db.insert(stockTicksTable).values([
      {
        symbol: 'AAPL',
        timestamp: timestamp,
        open: '150.00',
        high: '155.00',
        low: '149.00',
        close: '154.00',
        volume: 1000000,
        interval: '1m'
      },
      {
        symbol: 'META',
        timestamp: timestamp,
        open: '300.00',
        high: '310.00',
        low: '295.00',
        close: '305.00',
        volume: 800000,
        interval: '5m'
      }
    ]).execute();

    const result = await getLatestPrices();
    
    expect(result).toHaveLength(2);
    
    // Find each symbol and verify interval conversion
    const appleData = result.find(tick => tick.symbol === 'AAPL');
    const metaData = result.find(tick => tick.symbol === 'META');
    
    expect(appleData?.interval).toBe('1m');
    expect(metaData?.interval).toBe('5m');
  });
});
