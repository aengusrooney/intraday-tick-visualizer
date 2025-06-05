
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { StockSymbol, Interval, StockTick, FetchStockDataInput, BatchFetchInput } from '../../server/src/schema';
import { StockChart } from '@/components/StockChart';
import { StockTable } from '@/components/StockTable';
import { PriceOverview } from '@/components/PriceOverview';

const STOCK_SYMBOLS: StockSymbol[] = ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
const INTERVALS: Interval[] = ['1m', '5m', '15m', '30m', '1h', '1d'];
const PERIODS = ['1d', '5d', '1mo', '3mo', '6mo', '1y'];

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<StockSymbol>('AAPL');
  const [selectedInterval, setSelectedInterval] = useState<Interval>('1m');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1d');
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockTick[]>([]);
  const [latestPrices, setLatestPrices] = useState<StockTick[]>([]);

  // Load latest prices on component mount
  const loadLatestPrices = useCallback(async () => {
    try {
      const prices = await trpc.getLatestPrices.query();
      setLatestPrices(prices);
    } catch (error) {
      console.error('Failed to load latest prices:', error);
    }
  }, []);

  useEffect(() => {
    loadLatestPrices();
  }, [loadLatestPrices]);

  // Load historical data for selected symbol
  const loadHistoricalData = useCallback(async () => {
    try {
      const data = await trpc.getHistoricalData.query({
        symbol: selectedSymbol,
        interval: selectedInterval,
        limit: 100,
      });
      setStockData(data);
    } catch (error) {
      console.error('Failed to load historical data:', error);
      setStockData([]);
    }
  }, [selectedSymbol, selectedInterval]);

  useEffect(() => {
    loadHistoricalData();
  }, [loadHistoricalData]);

  const handleFetchStockData = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const input: FetchStockDataInput = {
        symbol: selectedSymbol,
        interval: selectedInterval,
        period: selectedPeriod,
      };

      const result = await trpc.fetchStockData.mutate(input);
      setSuccess(`✅ Successfully fetched ${result.length} data points for ${selectedSymbol}`);
      
      // Reload historical data to show the new data
      await loadHistoricalData();
      await loadLatestPrices();
    } catch (err) {
      setError(`❌ Failed to fetch data for ${selectedSymbol}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchFetch = async () => {
    setIsBatchLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const input: BatchFetchInput = {
        symbols: STOCK_SYMBOLS,
        interval: selectedInterval,
        period: selectedPeriod,
      };

      const result = await trpc.batchFetchStocks.mutate(input);
      setSuccess(`🚀 Successfully batch fetched ${result.length} total data points for all symbols`);
      
      // Reload data to show the new data
      await loadHistoricalData();
      await loadLatestPrices();
    } catch (err) {
      setError(`❌ Batch fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsBatchLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📈 Stock Market Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Real-time stock data from Yahoo Finance API
          </p>
        </div>

        {/* Alert Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Price Overview */}
        <PriceOverview latestPrices={latestPrices} />

        {/* Main Content */}
        <Tabs defaultValue="fetch" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fetch">📊 Fetch Data</TabsTrigger>
            <TabsTrigger value="chart">📈 Chart View</TabsTrigger>
            <TabsTrigger value="table">📋 Data Table</TabsTrigger>
          </TabsList>

          {/* Data Fetching Tab */}
          <TabsContent value="fetch" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Single Stock Fetch */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🎯 Fetch Single Stock
                  </CardTitle>
                  <CardDescription>
                    Fetch historical data for a specific stock symbol
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Stock Symbol</label>
                      <Select value={selectedSymbol} onValueChange={(value: StockSymbol) => setSelectedSymbol(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STOCK_SYMBOLS.map((symbol: StockSymbol) => (
                            <SelectItem key={symbol} value={symbol}>
                              {symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Interval</label>
                      <Select value={selectedInterval} onValueChange={(value: Interval) => setSelectedInterval(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INTERVALS.map((interval: Interval) => (
                            <SelectItem key={interval} value={interval}>
                              {interval}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Period</label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODS.map((period: string) => (
                          <SelectItem key={period} value={period}>
                            {period}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleFetchStockData} 
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? '⏳ Fetching...' : `🚀 Fetch ${selectedSymbol} Data`}
                  </Button>
                </CardContent>
              </Card>

              {/* Batch Fetch */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🌟 Batch Fetch All Stocks
                  </CardTitle>
                  <CardDescription>
                    Fetch data for all available stock symbols at once
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {STOCK_SYMBOLS.map((symbol: StockSymbol) => (
                      <Badge key={symbol} variant="secondary">
                        {symbol}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Interval</label>
                      <Select value={selectedInterval} onValueChange={(value: Interval) => setSelectedInterval(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INTERVALS.map((interval: Interval) => (
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
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIODS.map((period: string) => (
                            <SelectItem key={period} value={period}>
                              {period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={handleBatchFetch} 
                    disabled={isBatchLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {isBatchLoading ? '⏳ Batch Fetching...' : '🚀 Batch Fetch All Stocks'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Chart View Tab */}
          <TabsContent value="chart">
            <StockChart 
              data={stockData} 
              symbol={selectedSymbol}
              interval={selectedInterval}
              onSymbolChange={setSelectedSymbol}
              onIntervalChange={setSelectedInterval}
            />
          </TabsContent>

          {/* Data Table Tab */}
          <TabsContent value="table">
            <StockTable 
              data={stockData} 
              symbol={selectedSymbol}
              interval={selectedInterval}
              onSymbolChange={setSelectedSymbol}
              onIntervalChange={setSelectedInterval}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
