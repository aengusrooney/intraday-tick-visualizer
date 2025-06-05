
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type BatchFetchInput, type StockTick, type YahooFinanceData } from '../schema';
import { eq, and, inArray } from 'drizzle-orm';

// SIMULATION: Yahoo Finance API response structure
// In a real implementation, this would be replaced with actual API calls using axios/fetch
const simulateYahooFinanceAPI = async (symbol: string, interval: string, period: string): Promise<YahooFinanceData[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Generate realistic sample data
  const basePrice = {
    'META': 300,
    'AAPL': 180,
    'AMZN': 150,
    'GOOG': 140,
    'MSFT': 350,
    'NVDA': 450
  }[symbol] || 100;

  const now = Date.now();
  const dataPoints: YahooFinanceData[] = [];
  
  // Generate 10-20 data points for simulation
  const numPoints = 10 + Math.floor(Math.random() * 10);
  
  for (let i = 0; i < numPoints; i++) {
    const timestamp = now - (numPoints - i) * 60000; // 1 minute intervals
    const variation = (Math.random() - 0.5) * 10; // ±$5 variation
    const open = basePrice + variation;
    const high = open + Math.random() * 5;
    const low = open - Math.random() * 5;
    const close = low + Math.random() * (high - low);
    const volume = Math.floor(Math.random() * 1000000) + 100000;

    dataPoints.push({
      timestamp: Math.floor(timestamp / 1000), // Unix timestamp in seconds
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume
    });
  }

  return dataPoints;
};

// Convert PostgreSQL interval format back to original format
const normalizeInterval = (dbInterval: string): string => {
  const intervalMap: Record<string, string> = {
    '00:01:00': '1m',
    '00:02:00': '2m',
    '00:05:00': '5m',
    '00:15:00': '15m',
    '00:30:00': '30m',
    '01:00:00': '60m',
    '01:30:00': '90m',
    '1 day': '1d',
    '5 days': '5d',
    '7 days': '1wk',
    '1 mon': '1mo',
    '3 mons': '3mo'
  };
  
  return intervalMap[dbInterval] || dbInterval;
};

const fetchStockDataForSymbol = async (symbol: string, interval: string, period: string): Promise<StockTick[]> => {
  // SIMULATION: Call Yahoo Finance API
  // In production, this would use axios/fetch to call real API:
  // const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
  //   params: { interval, range: period }
  // });
  // const yahooData = parseYahooResponse(response.data);
  
  console.log(`Fetching stock data for ${symbol} (${interval}, ${period})`);
  const yahooData = await simulateYahooFinanceAPI(symbol, interval, period);

  if (!yahooData || yahooData.length === 0) {
    console.log(`No data received for ${symbol}`);
    return [];
  }

  // Transform Yahoo Finance data to StockTick format
  const stockTicks = yahooData.map(data => ({
    symbol: symbol as any, // Cast to satisfy enum type
    timestamp: new Date(data.timestamp * 1000), // Convert from Unix timestamp
    open: data.open.toString(), // Convert to string for numeric column
    high: data.high.toString(),
    low: data.low.toString(),
    close: data.close.toString(),
    volume: data.volume,
    interval: interval as any // Cast to satisfy enum type
  }));

  // Upsert data into database
  const upsertedTicks: StockTick[] = [];
  
  for (const tick of stockTicks) {
    try {
      // Check if record already exists
      const existing = await db.select()
        .from(stockTicksTable)
        .where(
          and(
            eq(stockTicksTable.symbol, tick.symbol),
            eq(stockTicksTable.timestamp, tick.timestamp),
            eq(stockTicksTable.interval, tick.interval)
          )
        )
        .execute();

      let result;
      if (existing.length > 0) {
        // Update existing record
        const updated = await db.update(stockTicksTable)
          .set({
            open: tick.open,
            high: tick.high,
            low: tick.low,
            close: tick.close,
            volume: tick.volume
          })
          .where(
            and(
              eq(stockTicksTable.symbol, tick.symbol),
              eq(stockTicksTable.timestamp, tick.timestamp),
              eq(stockTicksTable.interval, tick.interval)
            )
          )
          .returning()
          .execute();
        result = updated[0];
      } else {
        // Insert new record
        const inserted = await db.insert(stockTicksTable)
          .values(tick)
          .returning()
          .execute();
        result = inserted[0];
      }

      // Convert numeric fields back to numbers and normalize interval
      upsertedTicks.push({
        ...result,
        open: parseFloat(result.open),
        high: parseFloat(result.high),
        low: parseFloat(result.low),
        close: parseFloat(result.close),
        interval: normalizeInterval(result.interval) as any
      });
    } catch (tickError) {
      console.error(`Failed to upsert tick for ${tick.symbol} at ${tick.timestamp}:`, tickError);
      // Continue with other ticks
    }
  }

  console.log(`Successfully upserted ${upsertedTicks.length} ticks for ${symbol}`);
  return upsertedTicks;
};

export const batchFetchStocks = async (input: BatchFetchInput): Promise<StockTick[]> => {
  try {
    console.log(`Starting batch fetch for symbols: ${input.symbols.join(', ')}`);
    
    const allStockTicks: StockTick[] = [];
    const errors: Array<{ symbol: string; error: string }> = [];

    // Process each symbol sequentially to avoid API rate limiting
    for (const symbol of input.symbols) {
      try {
        console.log(`Fetching data for ${symbol}...`);
        const stockTicks = await fetchStockDataForSymbol(symbol, input.interval, input.period);
        allStockTicks.push(...stockTicks);
        console.log(`Successfully fetched ${stockTicks.length} ticks for ${symbol}`);
        
        // Add small delay between requests to be API-friendly
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
        errors.push({
          symbol,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Continue with other symbols
      }
    }

    // Log summary
    const successfulSymbols = input.symbols.length - errors.length;
    console.log(`Batch fetch completed: ${successfulSymbols}/${input.symbols.length} symbols successful`);
    
    if (errors.length > 0) {
      console.log('Errors encountered:', errors);
    }

    console.log(`Total ticks fetched: ${allStockTicks.length}`);
    return allStockTicks;
    
  } catch (error) {
    console.error('Batch fetch stocks failed:', error);
    throw error;
  }
};
