
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { StockTick, StockSymbol, Interval } from '../../../server/src/schema';

interface StockTableProps {
  data: StockTick[];
  symbol: StockSymbol;
  interval: Interval;
  onSymbolChange: (symbol: StockSymbol) => void;
  onIntervalChange: (interval: Interval) => void;
}

const STOCK_SYMBOLS: StockSymbol[] = ['META', 'AAPL', 'AMZN', 'GOOG', 'MSFT', 'NVDA'];
const INTERVALS: Interval[] = ['1m', '5m', '15m', '30m', '1h', '1d'];

export function StockTable({ data, symbol, interval, onSymbolChange, onIntervalChange }: StockTableProps) {
  const sortedData = [...data].sort((a: StockTick, b: StockTick) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📋 Stock Data Table - {symbol}
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
        {sortedData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-lg mb-2">No data available for {symbol}</p>
            <p className="text-sm">Fetch some data first to see the detailed table!</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Open ($)</TableHead>
                  <TableHead className="text-right">High ($)</TableHead>
                  <TableHead className="text-right">Low ($)</TableHead>
                  <TableHead className="text-right">Close ($)</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Interval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.slice(0, 50).map((tick: StockTick) => {
                  const change = tick.close - tick.open;
                  const changePercent = (change / tick.open * 100);
                  const isPositive = change >= 0;
                  
                  return (
                    <TableRow key={tick.id}>
                      <TableCell className="font-mono text-sm">
                        <div>{tick.timestamp.toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">
                          {tick.timestamp.toLocaleTimeString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tick.symbol}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tick.open.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {tick.high.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {tick.low.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {tick.close.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {tick.volume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(2)}
                        </div>
                        <div className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          ({changePercent.toFixed(2)}%)
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {tick.interval}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {sortedData.length > 50 && (
              <div className="p-4 text-center text-sm text-gray-500 border-t">
                Showing latest 50 of {sortedData.length} records
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
