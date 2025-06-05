
import { type GetHistoricalDataInput, type StockTick } from '../schema';

export declare function getHistoricalData(input: GetHistoricalDataInput): Promise<StockTick[]>;
