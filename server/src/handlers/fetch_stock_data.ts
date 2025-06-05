
import { type FetchStockDataInput, type StockTick } from '../schema';

export declare function fetchStockData(input: FetchStockDataInput): Promise<StockTick[]>;
