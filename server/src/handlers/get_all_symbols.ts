
import { type StockSymbol } from '../schema';

export const getAllSymbols = async (): Promise<StockSymbol[]> => {
  // Return all available stock symbols from the enum
  return ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
};
