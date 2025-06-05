
import { type BatchFetchInput, type StockTick } from '../schema';

export declare function batchFetchStocks(input: BatchFetchInput): Promise<StockTick[]>;
