
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { StockTick } from '../../../server/src/schema';

interface StockPriceGridProps {
  prices: StockTick[];
}

export function StockPriceGrid({ prices }: StockPriceGridProps) {
  if (prices.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <div className="text-2xl mb-2">📊</div>
        <p>No price data available</p>
        <p className="text-sm">Fetch some data to see latest prices</p>
      </div>
    );
  }

  // Group by symbol and get latest price for each
  const latestPrices = prices.reduce((acc: { [key: string]: StockTick }, tick: StockTick) => {
    if (!acc[tick.symbol] || new Date(tick.timestamp) > new Date(acc[tick.symbol].timestamp)) {
      acc[tick.symbol] = tick;
    }
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.values(latestPrices).map((stock: StockTick) => {
        const priceChange = stock.close - stock.open;
        const priceChangePercent = ((priceChange / stock.open) * 100);
        const isPositive = priceChange >= 0;

        return (
          <Card key={stock.symbol} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">{stock.symbol}</h3>
                  <p className="text-2xl font-bold text-slate-800">
                    ${stock.close.toFixed(2)}
                  </p>
                </div>
                <Badge 
                  variant={isPositive ? "default" : "destructive"}
                  className={isPositive ? "bg-green-500" : "bg-red-500"}
                >
                  {isPositive ? "📈" : "📉"} {priceChangePercent.toFixed(2)}%
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium">Open:</span> ${stock.open.toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">High:</span> ${stock.high.toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">Low:</span> ${stock.low.toFixed(2)}
                </div>
                <div>
                  <span className="font-medium">Volume:</span> {stock.volume.toLocaleString()}
                </div>
              </div>
              
              <div className="mt-2 pt-2 border-t text-xs text-slate-500">
                Updated: {new Date(stock.timestamp).toLocaleString()}
              </div>
              
              <div className="mt-1 text-xs text-slate-400">
                Interval: {stock.interval}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
