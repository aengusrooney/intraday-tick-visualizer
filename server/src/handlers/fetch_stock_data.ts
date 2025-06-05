
import { db } from '../db';
import { stockTicksTable } from '../db/schema';
import { type FetchStockDataInput, type StockTick, type YahooFinanceData } from '../schema';
import { eq, and } from 'drizzle-orm';

// Simulated Yahoo Finance API call
// In production, this would be replaced with actual API integration
const fetchFromYahooFinance = async (symbol: string, interval: string, period: string): Promise<YahooFinanceData[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Generate realistic mock data based on symbol and period
  const now = new Date();
  const dataPoints: YahooFinanceData[] = [];
  
  // Determine number of data points based on period and interval
  let pointCount = 100;
  if (period === '1d') pointCount = 60; // 1 minute intervals for 1 hour
  if (period === '5d') pointCount = 300; // 5 days worth
  if (period === '1mo') pointCount = 720; // 1 month worth
  
  // Base price varies by symbol
  const basePrices: Record<string, number> = {
    'AAPL': 150.00,
    'META': 280.00,
    'AMZN': 120.00,
    'GOOG': 140.00,
    'MSFT': 350.00,
    'NVDA': 450.00
  };
  
  const basePrice = basePrices[symbol] || 100.00;
  let currentPrice = basePrice;
  
  // Generate time series data going backwards from now
  for (let i = pointCount - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * getIntervalMinutes(interval) * 60 * 1000));
    
    // Generate realistic OHLCV data with some volatility
    const volatility = 0.02; // 2% volatility
    const change = (Math.random() - 0.5) * volatility * currentPrice;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + (Math.random() * 0.01 * currentPrice);
    const low = Math.min(open, close) - (Math.random() * 0.01 * currentPrice);
    const volume = Math.floor(Math.random() * 1000000) + 100000;
    
    dataPoints.push({
      timestamp: Math.floor(timestamp.getTime() / 1000), // Unix timestamp
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      volume
    });
    
    currentPrice = close;
  }
  
  return dataPoints;
};

// Helper function to convert interval string to minutes
const getIntervalMinutes = (interval: string): number => {
  const intervalMap: Record<string, number> = {
    '1m': 1, '2m': 2, '5m': 5, '15m': 15, '30m': 30,
    '60m': 60, '90m': 90, '1h': 60, '1d': 1440
  };
  return intervalMap[interval] || 1;
};

export const fetchStockData = async (input: FetchStockDataInput): Promise<StockTick[]> => {
  try {
    console.log(`Fetching stock data for ${input.symbol} with interval ${input.interval} and period ${input.period}`);
    
    // Fetch data from Yahoo Finance API (simulated)
    const yahooData = await fetchFromYahooFinance(input.symbol, input.interval, input.period);
    
    if (yahooData.length === 0) {
      return [];
    }
    
    // Transform Yahoo Finance data to our StockTick format and prepare for upsert
    const ticksToUpsert = yahooData.map(data => ({
      symbol: input.symbol,
      timestamp: new Date(data.timestamp * 1000), // Convert Unix timestamp to Date
      open: data.open.toString(), // Convert to string for numeric column
      high: data.high.toString(),
      low: data.low.toString(),
      close: data.close.toString(),
      volume: data.volume,
      interval: input.interval as any // Cast to satisfy enum type
    }));
    
    // Upsert data into database (insert or update on conflict)
    const upsertedTicks: StockTick[] = [];
    
    for (const tick of ticksToUpsert) {
      // Check if tick already exists
      const existingTick = await db.select()
        .from(stockTicksTable)
        .where(
          and(
            eq(stockTicksTable.symbol, tick.symbol as any),
            eq(stockTicksTable.timestamp, tick.timestamp),
            eq(stockTicksTable.interval, tick.interval)
          )
        )
        .limit(1)
        .execute();
      
      let result;
      if (existingTick.length > 0) {
        // Update existing tick
        result = await db.update(stockTicksTable)
          .set({
            open: tick.open,
            high: tick.high,
            low: tick.low,
            close: tick.close,
            volume: tick.volume
          })
          .where(eq(stockTicksTable.id, existingTick[0].id))
          .returning()
          .execute();
      } else {
        // Insert new tick
        result = await db.insert(stockTicksTable)
          .values(tick)
          .returning()
          .execute();
      }
      
      // Convert numeric fields back to numbers and add to results
      const savedTick = result[0];
      upsertedTicks.push({
        ...savedTick,
        open: parseFloat(savedTick.open),
        high: parseFloat(savedTick.high),
        low: parseFloat(savedTick.low),
        close: parseFloat(savedTick.close)
      });
    }
    
    console.log(`Successfully upserted ${upsertedTicks.length} stock ticks for ${input.symbol}`);
    return upsertedTicks;
    
  } catch (error) {
    console.error('Stock data fetch failed:', error);
    throw error;
  }
};
