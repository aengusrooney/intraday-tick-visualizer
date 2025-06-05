
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StockTick, StockSymbol, Interval } from '../../../server/src/schema';

interface StockChartProps {
  data: StockTick[];
  symbol: StockSymbol;
  interval: Interval;
  onSymbolChange: (symbol: StockSymbol) => void;
  onIntervalChange: (interval: Interval) => void;
}

const STOCK_SYMBOLS: StockSymbol[] = ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
const INTERVALS: Interval[] = ['1m', '5m', '15m', '30m', '1h', '1d'];

export function StockChart({ data, symbol, interval, onSymbolChange, onIntervalChange }: StockChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📈 Stock Chart - {symbol}
          </CardTitle>
          <div className="flex gap-4">
            <Select value={symbol} onValueChange={onSymbolChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_SYMBOLS.map((sym: StockSymbol) => (
                  <SelectItem key={sym} value={sym}>
                    {sym}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={interval} onValueChange={onIntervalChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVALS.map((int: Interval) => (
                  <SelectItem key={int} value={int}>
                    {int}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-lg mb-2">No chart data available for {symbol}</p>
            <p className="text-sm">Fetch some data first to see the price chart!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Simple ASCII-style chart visualization
  const prices = data.map((tick: StockTick) => tick.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📈 Stock Chart - {symbol}
        </CardTitle>
        <div className="flex gap-4">
          <Select value={symbol} onValueChange={onSymbolChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOCK_SYMBOLS.map((sym: StockSymbol) => (
                <SelectItem key={sym} value={sym}>
                  {sym}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={interval} onValueChange={onIntervalChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((int: Interval) => (
                <SelectItem key={int} value={int}>
                  {int}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Price Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-gray-500">Current</div>
              <div className="text-lg font-bold">${data[data.length - 1]?.close.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">High</div>
              <div className="text-lg font-bold text-green-600">${maxPrice.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Low</div>
              <div className="text-lg font-bold text-red-600">${minPrice.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">Points</div>
              <div className="text-lg font-bold">{data.length}</div>
            </div>
          </div>

          {/* Simple ASCII Chart */}
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto">
            <div className="mb-2 text-center text-white">
              {symbol} - {interval} intervals ({data.length} data points)
            </div>
            {data.slice(-20).map((tick: StockTick) => {
              const normalizedPrice = ((tick.close - minPrice) / priceRange * 50) || 0;
              const bars = '█'.repeat(Math.max(1, Math.floor(normalizedPrice)));
              
              return (
                <div key={tick.id} className="flex items-center">
                  <div className="w-16 text-right mr-2">
                    ${tick.close.toFixed(2)}
                  </div>
                  <div className="flex-1">
                    <span className={tick.close >= tick.open ? 'text-green-400' : 'text-red-400'}>
                      {bars}
                    </span>
                  </div>
                  <div className="w-20 text-xs text-gray-400 ml-2">
                    {tick.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Data Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.slice(-6).reverse().map((tick: StockTick) => {
              const change = tick.close - tick.open;
              const changePercent = (change / tick.open * 100);
              const isPositive = change >= 0;
              
              return (
                <div key={tick.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {tick.timestamp.toLocaleString()}
                    </div>
                    <div className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? '↗️' : '↘️'} {changePercent.toFixed(2)}%
                    </div>
                  </div>
                  <div className="mt-1">
                    <span className="text-lg font-bold">${tick.close.toFixed(2)}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      O: ${tick.open.toFixed(2)} H: ${tick.high.toFixed(2)} L: ${tick.low.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
