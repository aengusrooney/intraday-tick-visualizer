
import { useEffect, useRef } from 'react';
import type { CandlestickDataPoint, StockSymbol, Interval } from '../../../server/src/schema';

interface CandlestickChartProps {
  data: CandlestickDataPoint[];
  symbol: StockSymbol;
  interval: Interval;
  width?: number;
  height?: number;
}

interface ProcessedDataPoint extends CandlestickDataPoint {
  timestamp: Date;
}

export function CandlestickChart({ 
  data, 
  symbol, 
  interval, 
  width = 800, 
  height = 400 
}: CandlestickChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const svg = svgRef.current;
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Process data
    const processedData: ProcessedDataPoint[] = data
      .map((d: CandlestickDataPoint) => ({
        ...d,
        timestamp: new Date(d.timestamp)
      }))
      .sort((a: ProcessedDataPoint, b: ProcessedDataPoint) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );

    if (processedData.length === 0) return;

    // Calculate scales
    const timeExtent = [
      Math.min(...processedData.map((d: ProcessedDataPoint) => d.timestamp.getTime())),
      Math.max(...processedData.map((d: ProcessedDataPoint) => d.timestamp.getTime()))
    ];

    const priceExtent = [
      Math.min(...processedData.map((d: ProcessedDataPoint) => d.low)),
      Math.max(...processedData.map((d: ProcessedDataPoint) => d.high))
    ];

    const xScale = (timestamp: number) => 
      ((timestamp - timeExtent[0]) / (timeExtent[1] - timeExtent[0])) * innerWidth;

    const yScale = (price: number) => 
      innerHeight - ((price - priceExtent[0]) / (priceExtent[1] - priceExtent[0])) * innerHeight;

    // Create main group
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
    svg.appendChild(g);

    // Calculate candlestick width
    const candleWidth = Math.max(2, Math.min(12, innerWidth / processedData.length * 0.7));

    // Create candlesticks
    processedData.forEach((d: ProcessedDataPoint) => {
      const x = xScale(d.timestamp.getTime());
      const isGreen = d.close >= d.open;

      // High-Low line
      const highLowLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      highLowLine.setAttribute('x1', x.toString());
      highLowLine.setAttribute('x2', x.toString());
      highLowLine.setAttribute('y1', yScale(d.high).toString());
      highLowLine.setAttribute('y2', yScale(d.low).toString());
      highLowLine.setAttribute('stroke', '#666');
      highLowLine.setAttribute('stroke-width', '1');
      g.appendChild(highLowLine);

      // Open-Close rectangle
      const rectHeight = Math.abs(yScale(d.open) - yScale(d.close)) || 1;
      const rectY = Math.min(yScale(d.open), yScale(d.close));

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', (x - candleWidth / 2).toString());
      rect.setAttribute('y', rectY.toString());
      rect.setAttribute('width', candleWidth.toString());
      rect.setAttribute('height', rectHeight.toString());
      rect.setAttribute('fill', isGreen ? '#10b981' : '#ef4444');
      rect.setAttribute('stroke', isGreen ? '#059669' : '#dc2626');
      rect.setAttribute('stroke-width', '1');
      rect.style.cursor = 'pointer';

      // Add hover effects
      const handleMouseEnter = () => {
        rect.style.opacity = '0.8';
        if (tooltipRef.current) {
          tooltipRef.current.style.visibility = 'visible';
          tooltipRef.current.innerHTML = `
            <div class="font-bold">${symbol}</div>
            <div>Time: ${d.timestamp.toLocaleString()}</div>
            <div>Open: $${d.open.toFixed(2)}</div>
            <div>High: $${d.high.toFixed(2)}</div>
            <div>Low: $${d.low.toFixed(2)}</div>
            <div>Close: $${d.close.toFixed(2)}</div>
            <div>Volume: ${d.volume.toLocaleString()}</div>
          `;
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = (e.pageX + 10) + 'px';
          tooltipRef.current.style.top = (e.pageY - 10) + 'px';
        }
      };

      const handleMouseLeave = () => {
        rect.style.opacity = '1';
        if (tooltipRef.current) {
          tooltipRef.current.style.visibility = 'hidden';
        }
      };

      rect.addEventListener('mouseenter', handleMouseEnter);
      rect.addEventListener('mousemove', handleMouseMove);
      rect.addEventListener('mouseleave', handleMouseLeave);

      g.appendChild(rect);
    });

    // Create axes
    const xAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    xAxisGroup.setAttribute('transform', `translate(0,${innerHeight})`);
    
    // X-axis line
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', '0');
    xAxisLine.setAttribute('x2', innerWidth.toString());
    xAxisLine.setAttribute('y1', '0');
    xAxisLine.setAttribute('y2', '0');
    xAxisLine.setAttribute('stroke', '#666');
    xAxisGroup.appendChild(xAxisLine);

    // X-axis labels (show 5 time points)
    for (let i = 0; i < 5; i++) {
      const ratio = i / 4;
      const time = new Date(timeExtent[0] + ratio * (timeExtent[1] - timeExtent[0]));
      const x = ratio * innerWidth;

      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', x.toString());
      tick.setAttribute('x2', x.toString());
      tick.setAttribute('y1', '0');
      tick.setAttribute('y2', '6');
      tick.setAttribute('stroke', '#666');
      xAxisGroup.appendChild(tick);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x.toString());
      label.setAttribute('y', '20');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '12');
      label.setAttribute('fill', '#666');
      label.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      xAxisGroup.appendChild(label);
    }

    g.appendChild(xAxisGroup);

    // Y-axis
    const yAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    
    // Y-axis line
    const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxisLine.setAttribute('x1', '0');
    yAxisLine.setAttribute('x2', '0');
    yAxisLine.setAttribute('y1', '0');
    yAxisLine.setAttribute('y2', innerHeight.toString());
    yAxisLine.setAttribute('stroke', '#666');
    yAxisGroup.appendChild(yAxisLine);

    // Y-axis labels (show 5 price points)
    for (let i = 0; i < 5; i++) {
      const ratio = i / 4;
      const price = priceExtent[0] + ratio * (priceExtent[1] - priceExtent[0]);
      const y = innerHeight - ratio * innerHeight;

      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', '0');
      tick.setAttribute('x2', '-6');
      tick.setAttribute('y1', y.toString());
      tick.setAttribute('y2', y.toString());
      tick.setAttribute('stroke', '#666');
      yAxisGroup.appendChild(tick);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '-10');
      label.setAttribute('y', (y + 4).toString());
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('font-size', '12');
      label.setAttribute('fill', '#666');
      label.textContent = `$${price.toFixed(2)}`;
      yAxisGroup.appendChild(label);

      // Grid line
      if (i > 0 && i < 4) {
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', '0');
        gridLine.setAttribute('x2', innerWidth.toString());
        gridLine.setAttribute('y1', y.toString());
        gridLine.setAttribute('y2', y.toString());
        gridLine.setAttribute('stroke', '#e2e8f0');
        gridLine.setAttribute('stroke-dasharray', '3,3');
        yAxisGroup.appendChild(gridLine);
      }
    }

    g.appendChild(yAxisGroup);

    // Chart title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', (width / 2).toString());
    title.setAttribute('y', '20');
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '16');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#1f2937');
    title.textContent = `${symbol} - ${interval} Candlestick Chart`;
    svg.appendChild(title);

  }, [data, symbol, interval, width, height]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      />
      <div
        ref={tooltipRef}
        className="absolute invisible bg-gray-800 text-white p-2 rounded text-sm pointer-events-none z-10"
        style={{ visibility: 'hidden' }}
      />
    </div>
  );
}
