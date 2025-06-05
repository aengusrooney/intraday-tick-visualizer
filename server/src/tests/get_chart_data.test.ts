
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type GetHistoricalDataInput } from '../schema';
import { getChartData } from '../handlers/get_chart_data';
import { eq, and } from 'drizzle-orm';

// Test input data
const testTick = {
  symbol: 'AAPL' as const,
  timestamp: new Date('2024-01-01T10:00:00Z'),
  open: '150.25',
  high: '152.75',
  low: '149.50',
  close: '151.80',
  volume: 1000000,
  interval: '1m' as const
};

const testInput: GetHistoricalDataInput = {
  symbol: 'AAPL',
  interval: '1m',
  limit: 100
};

describe('getChartData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return chart data from database', async () => {
    // Insert test data
    await db.insert(stockTicksTable)
      .values(testTick)
      .execute();

    const result = await getChartData(testInput);

    expect(result.symbol).toEqual('AAPL');
    expect(result.interval).toEqual('1m');
    expect(result.data).toHaveLength(1);
    
    const dataPoint = result.data[0];
    expect(dataPoint.open).toEqual(150.25);
    expect(dataPoint.high).toEqual(152.75);
    expect(dataPoint.low).toEqual(149.50);
    expect(dataPoint.close).toEqual(151.80);
    expect(dataPoint.volume).toEqual(1000000);
    expect(dataPoint.timestamp).toBeInstanceOf(Date);
  });

  it('should fetch from Yahoo Finance when no local data exists', async () => {
    // No data in database, should trigger Yahoo Finance fetch
    const result = await getChartData(testInput);

    expect(result.symbol).toEqual('AAPL');
    expect(result.interval).toEqual('1m');
    expect(result.data.length).toBeGreaterThan(0);
    
    // Verify data structure from Yahoo Finance fetch
    const dataPoint = result.data[0];
    expect(typeof dataPoint.open).toBe('number');
    expect(typeof dataPoint.high).toBe('number');
    expect(typeof dataPoint.low).toBe('number');
    expect(typeof dataPoint.close).toBe('number');
    expect(typeof dataPoint.volume).toBe('number');
    expect(dataPoint.timestamp).toBeInstanceOf(Date);
    
    // Verify data was persisted to database
    const dbTicks = await db.select()
      .from(stockTicksTable)
      .where(and(
        eq(stockTicksTable.symbol, 'AAPL'),
        eq(stockTicksTable.interval, '1m')
      ))
      .execute();
    
    expect(dbTicks.length).toBeGreaterThan(0);
    
    // Verify that data in database matches the response
    // Since the mock data is deterministic, we can check the first tick
    const firstDbTick = dbTicks[0];
    const firstDataPoint = result.data.find(d => 
      d.timestamp.getTime() === firstDbTick.timestamp.getTime()
    );
    
    expect(firstDataPoint).toBeDefined();
    if (firstDataPoint) {
      expect(parseFloat(firstDbTick.open)).toEqual(firstDataPoint.open);
      expect(parseFloat(firstDbTick.high)).toEqual(firstDataPoint.high);
      expect(parseFloat(firstDbTick.low)).toEqual(firstDataPoint.low);
      expect(parseFloat(firstDbTick.close)).toEqual(firstDataPoint.close);
      expect(firstDbTick.volume).toEqual(firstDataPoint.volume);
    }
  });

  it('should filter by date range', async () => {
    const oldTick = {
      ...testTick,
      timestamp: new Date('2023-12-01T10:00:00Z')
    };
    
    const newTick = {
      ...testTick,
      timestamp: new Date('2024-02-01T10:00:00Z')
    };

    // Insert test data
    await db.insert(stockTicksTable)
      .values([oldTick, testTick, newTick])
      .execute();

    const result = await getChartData({
      symbol: 'AAPL',
      interval: '1m',
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-01-31T23:59:59Z'),
      limit: 100
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].timestamp.getTime()).toEqual(testTick.timestamp.getTime());
  });

  it('should apply limit correctly', async () => {
    // Insert multiple ticks
    const ticks = [];
    for (let i = 0; i < 5; i++) {
      ticks.push({
        ...testTick,
        timestamp: new Date(`2024-01-01T${10 + i}:00:00Z`)
      });
    }

    await db.insert(stockTicksTable)
      .values(ticks)
      .execute();

    const result = await getChartData({
      symbol: 'AAPL',
      interval: '1m',
      limit: 3
    });

    expect(result.data).toHaveLength(3);
  });

  it('should filter by symbol', async () => {
    const appleTick = {
      ...testTick,
      symbol: 'AAPL' as const
    };
    
    const metaTick = {
      ...testTick,
      symbol: 'META' as const,
      timestamp: new Date('2024-01-01T11:00:00Z')
    };

    await db.insert(stockTicksTable)
      .values([appleTick, metaTick])
      .execute();

    const result = await getChartData({
      symbol: 'META',
      interval: '1m',
      limit: 100
    });

    expect(result.symbol).toEqual('META');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].timestamp.getTime()).toEqual(metaTick.timestamp.getTime());
  });

  it('should filter by interval', async () => {
    const oneMinTick = {
      ...testTick,
      interval: '1m' as const
    };
    
    const fiveMinTick = {
      ...testTick,
      interval: '5m' as const,
      timestamp: new Date('2024-01-01T11:00:00Z')
    };

    await db.insert(stockTicksTable)
      .values([oneMinTick, fiveMinTick])
      .execute();

    const result = await getChartData({
      symbol: 'AAPL',
      interval: '5m',
      limit: 100
    });

    expect(result.interval).toEqual('5m');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].timestamp.getTime()).toEqual(fiveMinTick.timestamp.getTime());
  });

  it('should return empty data when no symbol specified and no data exists', async () => {
    const result = await getChartData({
      interval: '1m',
      limit: 100
    });

    expect(result.symbol).toEqual('AAPL'); // Default fallback
    expect(result.interval).toEqual('1m');
    expect(result.data).toHaveLength(0);
  });

  it('should handle multiple symbols without symbol filter', async () => {
    const appleTick = {
      ...testTick,
      symbol: 'AAPL' as const
    };
    
    const metaTick = {
      ...testTick,
      symbol: 'META' as const,
      timestamp: new Date('2024-01-01T11:00:00Z')
    };

    await db.insert(stockTicksTable)
      .values([appleTick, metaTick])
      .execute();

    const result = await getChartData({
      interval: '1m',
      limit: 100
    });

    expect(result.data).toHaveLength(2);
    // Should return symbol from first result
    expect(['AAPL', 'META']).toContain(result.symbol);
  });

  it('should convert numeric fields correctly', async () => {
    await db.insert(stockTicksTable)
      .values(testTick)
      .execute();

    const result = await getChartData(testInput);
    const dataPoint = result.data[0];

    // Verify all numeric fields are actual numbers
    expect(typeof dataPoint.open).toBe('number');
    expect(typeof dataPoint.high).toBe('number');
    expect(typeof dataPoint.low).toBe('number');
    expect(typeof dataPoint.close).toBe('number');
    expect(typeof dataPoint.volume).toBe('number');
    
    // Verify precision is maintained
    expect(dataPoint.open).toEqual(150.25);
    expect(dataPoint.high).toEqual(152.75);
    expect(dataPoint.low).toEqual(149.50);
    expect(dataPoint.close).toEqual(151.80);
  });

  it('should generate consistent mock data for testing', async () => {
    // Test that the mock Yahoo Finance data is deterministic
    const result1 = await getChartData({ symbol: 'AAPL', interval: '1m', limit: 5 });
    
    // Clear database and fetch again
    await resetDB();
    await createDB();
    
    const result2 = await getChartData({ symbol: 'AAPL', interval: '1m', limit: 5 });
    
    // Results should be consistent (same number of data points)
    expect(result1.data.length).toEqual(result2.data.length);
    expect(result1.symbol).toEqual(result2.symbol);
    expect(result1.interval).toEqual(result2.interval);
  });
});
