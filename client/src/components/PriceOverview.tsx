
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StockTick } from '../../../server/src/schema';

interface PriceOverviewProps {
  latestPrices: StockTick[];
}

export function PriceOverview({ latestPrices }: PriceOverviewProps) {
  if (latestPrices.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💰 Latest Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            No price data available. Fetch some data first! 📊
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          💰 Latest Prices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {latestPrices.map((tick: StockTick) => {
            const changePercent = ((tick.close - tick.open) / tick.open * 100);
            const isPositive = changePercent >= 0;
            
            return (
              <div key={`${tick.symbol}-${tick.id}`} className="text-center p-3 rounded-lg bg-gray-50">
                <div className="font-bold text-lg mb-1">{tick.symbol}</div>
                <div className="text-2xl font-bold mb-1">
                  ${tick.close.toFixed(2)}
                </div>
                <Badge 
                  variant={isPositive ? "default" : "destructive"}
                  className={isPositive ? "bg-green-500" : ""}
                >
                  {isPositive ? '📈' : '📉'} {changePercent.toFixed(2)}%
                </Badge>
                <div className="text-xs text-gray-500 mt-1">
                  {tick.timestamp.toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
