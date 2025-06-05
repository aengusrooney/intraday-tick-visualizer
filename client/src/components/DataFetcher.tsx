
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/utils/trpc';
import type { StockSymbol, Interval, StockTick } from '../../../server/src/schema';

interface DataFetcherProps {
  onDataFetched?: () => void;
}

export function DataFetcher({ onDataFetched }: DataFetcherProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<StockSymbol[]>(['AAPL']);
  const [selectedInterval, setSelectedInterval] = useState<Interval>('1m');
  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stockSymbols: StockSymbol[] = ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
  const intervals: Interval[] = ['1m', '5m', '15m', '30m', '1h', '1d'];
  const periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y'];

  const handleSymbolToggle = (symbol: StockSymbol, checked: boolean) => {
    if (checked) {
      setSelectedSymbols((prev: StockSymbol[]) => [...prev, symbol]);
    } else {
      setSelectedSymbols((prev: StockSymbol[]) => prev.filter((s: StockSymbol) => s !== symbol));
    }
  };

  const handleFetchSingle = async () => {
    if (selectedSymbols.length === 0) {
      setError('Please select at least one symbol');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const symbol = selectedSymbols[0];
      const result: StockTick[] = await trpc.fetchStockData.mutate({
        symbol,
        interval: selectedInterval,
        period: selectedPeriod
      });

      setMessage(`✅ Successfully fetched ${result.length} data points for ${symbol}`);
      onDataFetched?.();
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      setError('Failed to fetch stock data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchFetch = async () => {
    if (selectedSymbols.length === 0) {
      setError('Please select at least one symbol');
      return;
    }

    setIsBatchLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result: StockTick[] = await trpc.batchFetchStocks.mutate({
        symbols: selectedSymbols,
        interval: selectedInterval,
        period: selectedPeriod
      });

      setMessage(`✅ Successfully fetched ${result.length} total data points for ${selectedSymbols.length} symbols`);
      onDataFetched?.();
    } catch (error) {
      console.error('Failed to batch fetch stock data:', error);
      setError('Failed to batch fetch stock data. Please try again.');
    } finally {
      setIsBatchLoading(false);
    }
  };

  const handleFetchAll = async () => {
    setIsBatchLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result: StockTick[] = await trpc.batchFetchStocks.mutate({
        symbols: stockSymbols,
        interval: selectedInterval,
        period: selectedPeriod
      });

      setMessage(`🎉 Successfully fetched ${result.length} total data points for all ${stockSymbols.length} symbols!`);
      onDataFetched?.();
    } catch (error) {
      console.error('Failed to fetch all stock data:', error);
      setError('Failed to fetch all stock data. Please try again.');
    } finally {
      setIsBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Single Stock Fetch */}
      <Card>
        <CardHeader>
          <CardTitle>📥 Fetch Stock Data</CardTitle>
          <CardDescription>
            Fetch intraday tick data from Yahoo Finance and store in database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Interval</label>
              <Select value={selectedInterval} onValueChange={(value: string) => setSelectedInterval(value as Interval)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {intervals.map((interval: Interval) => (
                    <SelectItem key={interval} value={interval}>
                      {interval}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Period</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period: string) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleFetchSingle}
                disabled={isLoading || selectedSymbols.length === 0}
                className="w-full"
              >
                {isLoading ? '🔄 Fetching...' : `📥 Fetch ${selectedSymbols[0] || 'Symbol'}`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Symbol Selection */}
      <Card>
        <CardHeader>
          <CardTitle>🎯 Select Symbols</CardTitle>
          <CardDescription>
            Choose which stock symbols to fetch data for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stockSymbols.map((symbol: StockSymbol) => (
              <div key={symbol} className="flex items-center space-x-2">
                <Checkbox
                  id={symbol}
                  checked={selectedSymbols.includes(symbol)}
                  onCheckedChange={(checked: boolean) => handleSymbolToggle(symbol, checked)}
                />
                <label htmlFor={symbol} className="text-sm font-medium cursor-pointer">
                  {symbol}
                </label>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex gap-2">
            <Badge variant="outline">
              Selected: {selectedSymbols.length}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSymbols(stockSymbols)}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSymbols([])}
            >
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Operations */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ Batch Operations</CardTitle>
          <CardDescription>
            Fetch data for multiple symbols at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleBatchFetch}
              disabled={isBatchLoading || selectedSymbols.length === 0}
              className="flex-1"
            >
              {isBatchLoading ? '🔄 Fetching...' : `📥 Batch Fetch Selected (${selectedSymbols.length})`}
            </Button>
            
            <Button
              onClick={handleFetchAll}
              disabled={isBatchLoading}
              variant="outline"
              className="flex-1"
            >
              {isBatchLoading ? '🔄 Fetching...' : '🌟 Fetch All Symbols'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
