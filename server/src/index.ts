
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

import { 
  fetchStockDataInputSchema, 
  batchFetchInputSchema,
  getHistoricalDataInputSchema,
  stockSymbolSchema 
} from './schema';

import { fetchStockData } from './handlers/fetch_stock_data';
import { batchFetchStocks } from './handlers/batch_fetch_stocks';
import { getHistoricalData } from './handlers/get_historical_data';
import { getChartData } from './handlers/get_chart_data';
import { getAllSymbols } from './handlers/get_all_symbols';
import { getLatestPrices } from './handlers/get_latest_prices';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
  
  // Fetch stock data from Yahoo Finance and store in database
  fetchStockData: publicProcedure
    .input(fetchStockDataInputSchema)
    .mutation(({ input }) => fetchStockData(input)),
  
  // Batch fetch multiple stocks at once
  batchFetchStocks: publicProcedure
    .input(batchFetchInputSchema)
    .mutation(({ input }) => batchFetchStocks(input)),
  
  // Get historical data from database
  getHistoricalData: publicProcedure
    .input(getHistoricalDataInputSchema)
    .query(({ input }) => getHistoricalData(input)),
  
  // Get chart data formatted for D3.js candlestick visualization
  getChartData: publicProcedure
    .input(getHistoricalDataInputSchema)
    .query(({ input }) => getChartData(input)),
  
  // Get all available stock symbols
  getAllSymbols: publicProcedure
    .query(() => getAllSymbols()),
  
  // Get latest prices for all symbols
  getLatestPrices: publicProcedure
    .query(() => getLatestPrices()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
  console.log(`Stock data API ready for symbols: META, AAPL, AMZN, GOOG, MSFT, NVDA`);
}

start();
