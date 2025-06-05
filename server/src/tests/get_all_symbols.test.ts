
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { getAllSymbols } from '../handlers/get_all_symbols';
import { type StockSymbol } from '../schema';

describe('getAllSymbols', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all available stock symbols', async () => {
    const result = await getAllSymbols();

    // Verify all expected symbols are returned
    const expectedSymbols: StockSymbol[] = ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
    expect(result).toEqual(expectedSymbols);
    expect(result).toHaveLength(6);
  });

  it('should return symbols in expected order', async () => {
    const result = await getAllSymbols();

    // Verify specific symbols exist
    expect(result).toContain('META');
    expect(result).toContain('AAPL');
    expect(result).toContain('AMZN');
    expect(result).toContain('GOOG');
    expect(result).toContain('MSFT');
    expect(result).toContain('NVDA');
  });

  it('should return consistent results on multiple calls', async () => {
    const result1 = await getAllSymbols();
    const result2 = await getAllSymbols();

    expect(result1).toEqual(result2);
  });
});
