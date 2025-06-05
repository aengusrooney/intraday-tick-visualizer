
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type GetHistoricalDataInput, type ChartDataResponse, type YahooFinanceData } from '../schema';
import { eq, gte, lte, desc, and, type SQL } from 'drizzle-orm';

// Simulated Yahoo Finance API call
// In a real implementation, this would use a library like axios or node-fetch
const fetchFromYahooFinance = async (symbol: string, interval: string, period: string): Promise<YahooFinanceData[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate Yahoo Finance API response
  // In real implementation, this would be:
  // const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&period=${period}`);
  // const data = await response.json();
  
  const now = Date.now();
  const intervalMs = interval === '1m' ? 60000 : interval === '5m' ? 300000 : 3600000; // 1min, 5min, or 1hour
  
  // Use deterministic data for consistent testing
  const basePrice = symbol === 'AAPL' ? 150 : symbol === 'META' ? 300 : 100;
  
  // Generate simulated OHLCV data with deterministic values
  const mockData: YahooFinanceData[] = [];
  for (let i = 0; i < 10; i++) {
    const timestamp = now - (i * intervalMs);
    // Use deterministic price movements based on index
    const priceOffset = (i % 3) - 1; // -1, 0, 1 pattern
    const open = basePrice + priceOffset;
    const close = open + (i % 2 === 0 ? 0.5 : -0.5);
    const high = Math.max(open, close) + 0.25;
    const low = Math.min(open, close) - 0.25;
    const volume = 100000 + (i * 10000); // Deterministic volume
    
    mockData.push({
      timestamp: Math.floor(timestamp / 1000), // Yahoo Finance uses seconds
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    });
  }
  
  return mockData.reverse(); // Return in chronological order
};

// Transform Yahoo Finance data to our StockTick format
const transformYahooData = (yahooData: YahooFinanceData[], symbol: string, interval: string) => {
  return yahooData.map(tick => ({
    symbol: symbol as any, // Type assertion for enum
    timestamp: new Date(tick.timestamp * 1000), // Convert seconds to milliseconds
    open: tick.open.toString(), // Convert to string for numeric column
    high: tick.high.toString(),
    low: tick.low.toString(),
    close: tick.close.toString(),
    volume: tick.volume,
    interval: interval as any // Type assertion for enum
  }));
};

// Upsert stock ticks into database
const upsertStockTicks = async (ticks: any[]) => {
  if (ticks.length === 0) return;
  
  try {
    // In a real implementation, we would use ON CONFLICT for upsert
    // For now, we'll use insert and handle duplicates
    for (const tick of ticks) {
      try {
        await db.insert(stockTicksTable)
          .values(tick)
          .execute();
      } catch (error) {
        // Ignore duplicate key errors, log others
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('duplicate') && !errorMessage.includes('unique')) {
          console.error('Error inserting tick:', error);
        }
      }
    }
  } catch (error) {
    console.error('Batch upsert failed:', error);
    throw error;
  }
};

export const getChartData = async (input: GetHistoricalDataInput): Promise<ChartDataResponse> => {
  try {
    // Collect conditions for filtering
    const conditions: SQL<unknown>[] = [];

    // Filter by symbol if provided
    if (input.symbol) {
      conditions.push(eq(stockTicksTable.symbol, input.symbol));
    }

    // Filter by interval
    conditions.push(eq(stockTicksTable.interval, input.interval));

    // Filter by date range if provided
    if (input.startDate) {
      conditions.push(gte(stockTicksTable.timestamp, input.startDate));
    }

    if (input.endDate) {
      conditions.push(lte(stockTicksTable.timestamp, input.endDate));
    }

    // Build and execute query
    const results = await db.select()
      .from(stockTicksTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(stockTicksTable.timestamp))
      .limit(input.limit)
      .execute();

    // If no data found and symbol is specified, try to fetch from Yahoo Finance
    if (results.length === 0 && input.symbol) {
      try {
        console.log(`No local data found for ${input.symbol}, fetching from Yahoo Finance...`);
        
        // Fetch data from Yahoo Finance
        const yahooData = await fetchFromYahooFinance(input.symbol, input.interval, '1d');
        
        // Transform and upsert the data
        const transformedTicks = transformYahooData(yahooData, input.symbol, input.interval);
        await upsertStockTicks(transformedTicks);
        
        // Re-query the database to get the inserted data
        const newResults = await db.select()
          .from(stockTicksTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(stockTicksTable.timestamp))
          .limit(input.limit)
          .execute();
        
        // Convert and return the new data
        const chartData = newResults.map(tick => ({
          timestamp: tick.timestamp,
          open: parseFloat(tick.open),
          high: parseFloat(tick.high),
          low: parseFloat(tick.low),
          close: parseFloat(tick.close),
          volume: tick.volume
        }));

        return {
          symbol: input.symbol,
          interval: input.interval,
          data: chartData
        };
      } catch (fetchError) {
        console.error('Failed to fetch from Yahoo Finance:', fetchError);
        // Fall through to return empty response
      }
    }

    // If no data found, return empty response
    if (results.length === 0) {
      return {
        symbol: input.symbol || 'AAPL', // Default to AAPL if no symbol specified
        interval: input.interval,
        data: []
      };
    }

    // Convert numeric fields back to numbers and format data
    const chartData = results.map(tick => ({
      timestamp: tick.timestamp,
      open: parseFloat(tick.open),
      high: parseFloat(tick.high),
      low: parseFloat(tick.low),
      close: parseFloat(tick.close),
      volume: tick.volume
    }));

    // Use the symbol from the first result or the input symbol
    const responseSymbol = input.symbol || results[0].symbol;

    return {
      symbol: responseSymbol,
      interval: input.interval,
      data: chartData
    };
  } catch (error) {
    console.error('Chart data retrieval failed:', error);
    throw error;
  }
};
