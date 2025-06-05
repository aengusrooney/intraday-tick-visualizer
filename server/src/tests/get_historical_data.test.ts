
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type GetHistoricalDataInput } from '../schema';
import { getHistoricalData } from '../handlers/get_historical_data';

const createTestData = async () => {
  const now = new Date();
  const testTicks = [
    {
      symbol: 'AAPL' as const,
      timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
      open: '175.50',
      high: '176.00',
      low: '175.00',
      close: '175.75',
      volume: 1000000,
      interval: '5m' as const
    },
    {
      symbol: 'AAPL' as const,
      timestamp: new Date(now.getTime() - 25 * 60 * 1000), // 25 minutes ago
      open: '175.75',
      high: '176.25',
      low: '175.25',
      close: '176.00',
      volume: 1200000,
      interval: '5m' as const
    },
    {
      symbol: 'META' as const,
      timestamp: new Date(now.getTime() - 20 * 60 * 1000), // 20 minutes ago
      open: '300.00',
      high: '301.00',
      low: '299.50',
      close: '300.50',
      volume: 800000,
      interval: '5m' as const
    },
    {
      symbol: 'AAPL' as const,
      timestamp: new Date(now.getTime() - 15 * 60 * 1000), // 15 minutes ago
      open: '176.00',
      high: '176.50',
      low: '175.50',
      close: '176.25',
      volume: 900000,
      interval: '1m' as const // Different interval
    }
  ];

  for (const tick of testTicks) {
    await db.insert(stockTicksTable).values(tick).execute();
  }
};

describe('getHistoricalData', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should retrieve all data with default parameters', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      interval: '5m',
      limit: 100
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(3); // 3 records with 5m interval
    expect(result[0].symbol).toBeDefined();
    expect(result[0].interval).toEqual('5m');
    expect(typeof result[0].open).toBe('number');
    expect(typeof result[0].high).toBe('number');
    expect(typeof result[0].low).toBe('number');
    expect(typeof result[0].close).toBe('number');
  });

  it('should filter by symbol', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      symbol: 'AAPL',
      interval: '5m',
      limit: 100
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(2); // 2 AAPL records with 5m interval
    expect(result.every(tick => tick.symbol === 'AAPL')).toBe(true);
    expect(result.every(tick => tick.interval === '5m')).toBe(true);
  });

  it('should filter by interval', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      interval: '1m',
      limit: 100
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(1); // 1 record with 1m interval
    expect(result[0].symbol).toEqual('AAPL');
    expect(result[0].interval).toEqual('1m');
  });

  it('should filter by date range', async () => {
    await createTestData();

    const now = new Date();
    const startDate = new Date(now.getTime() - 32 * 60 * 1000); // 32 minutes ago
    const endDate = new Date(now.getTime() - 22 * 60 * 1000); // 22 minutes ago

    const input: GetHistoricalDataInput = {
      interval: '5m',
      startDate,
      endDate,
      limit: 100
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(2); // Records between 32 and 22 minutes ago (30min and 25min records)
    result.forEach(tick => {
      expect(tick.timestamp >= startDate).toBe(true);
      expect(tick.timestamp <= endDate).toBe(true);
    });
  });

  it('should limit results', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      interval: '5m',
      limit: 1
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(1);
  });

  it('should order by timestamp descending', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      symbol: 'AAPL',
      interval: '5m',
      limit: 100
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(2);
    // First result should be more recent (higher timestamp)
    expect(result[0].timestamp.getTime()).toBeGreaterThan(result[1].timestamp.getTime());
  });

  it('should handle no results', async () => {
    const input: GetHistoricalDataInput = {
      symbol: 'NVDA', // No NVDA data in test set
      interval: '5m',
      limit: 100
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(0);
  });

  it('should validate numeric conversions', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      symbol: 'AAPL',
      interval: '5m',
      limit: 1
    };

    const result = await getHistoricalData(input);

    expect(result.length).toEqual(1);
    const tick = result[0];
    
    expect(typeof tick.open).toBe('number');
    expect(typeof tick.high).toBe('number');
    expect(typeof tick.low).toBe('number');
    expect(typeof tick.close).toBe('number');
    expect(tick.open).toEqual(175.75);
    expect(tick.high).toEqual(176.25);
    expect(tick.low).toEqual(175.25);
    expect(tick.close).toEqual(176.00);
  });

  it('should validate OHLCV data relationships', async () => {
    await createTestData();

    const input: GetHistoricalDataInput = {
      interval: '5m',
      limit: 100
    };

    const result = await getHistoricalData(input);

    result.forEach(tick => {
      // High should be >= Open, Low, Close
      expect(tick.high).toBeGreaterThanOrEqual(tick.open);
      expect(tick.high).toBeGreaterThanOrEqual(tick.low);
      expect(tick.high).toBeGreaterThanOrEqual(tick.close);
      
      // Low should be <= Open, High, Close
      expect(tick.low).toBeLessThanOrEqual(tick.open);
      expect(tick.low).toBeLessThanOrEqual(tick.high);
      expect(tick.low).toBeLessThanOrEqual(tick.close);
      
      // Volume should be positive
      expect(tick.volume).toBeGreaterThan(0);
    });
  });
});
