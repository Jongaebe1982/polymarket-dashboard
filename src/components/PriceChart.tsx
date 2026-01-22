'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import { PriceHistoryPoint, ParsedMarket, RetailerName, RETAILER_KEYWORDS, RETAILER_COLORS } from '@/types/market';

// ========================================
// FEATURE FLAG: Stock Overlay
// Set to false to disable stock price overlay
// ========================================
const ENABLE_STOCK_OVERLAY = true;

interface StockHistoryPoint {
  timestamp: number;
  price: number;
}

// Detect which retailer a market belongs to based on question text
function detectRetailer(question: string): RetailerName | null {
  const lowerQuestion = question.toLowerCase();
  for (const [retailer, keywords] of Object.entries(RETAILER_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        return retailer as RetailerName;
      }
    }
  }
  return null;
}

interface PriceChartProps {
  market: ParsedMarket;
  height?: number;
  retailer?: RetailerName; // Optional: pass retailer directly if known
}

export function PriceChart({ market, height = 200, retailer: passedRetailer }: PriceChartProps) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStock, setShowStock] = useState(ENABLE_STOCK_OVERLAY);

  // Detect retailer from market question if not passed
  const retailer = passedRetailer || detectRetailer(market.question);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!market.clobTokenIds?.[0]) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/markets?type=history&tokenId=${market.clobTokenIds[0]}`);
        const data = await response.json();

        if (data.history && data.history.length > 0) {
          setHistory(data.history);
        }
      } catch (err) {
        setError('Failed to load price history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [market.clobTokenIds]);

  // Fetch stock history when probability history is loaded and retailer is known
  useEffect(() => {
    const fetchStockHistory = async () => {
      if (!ENABLE_STOCK_OVERLAY || !retailer || history.length === 0 || !showStock) {
        return;
      }

      setStockLoading(true);
      try {
        // Use range=5d for reliable data from Yahoo Finance
        // The chart will match stock prices to probability timestamps
        const response = await fetch(
          `/api/stocks/history?retailer=${retailer}&range=5d`
        );
        const data = await response.json();

        if (data.history && data.history.length > 0) {
          setStockHistory(data.history);
        }
      } catch (err) {
        console.error('Failed to load stock history:', err);
      } finally {
        setStockLoading(false);
      }
    };

    fetchStockHistory();
  }, [retailer, history, showStock]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg`} style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || history.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg text-gray-500 text-sm`} style={{ height }}>
        {error || 'No probability history available'}
      </div>
    );
  }

  // Merge probability and stock data by timestamp
  const stockMap = new Map(stockHistory.map(s => [s.timestamp, s.price]));

  // Normalize stock prices to percentage scale for overlay
  const stockPrices = stockHistory.map(s => s.price);
  const minStock = stockPrices.length > 0 ? Math.min(...stockPrices) : 0;
  const maxStock = stockPrices.length > 0 ? Math.max(...stockPrices) : 1;

  const chartData = history.map(point => {
    // Find closest stock price by timestamp
    // Use 3-day window (259200 seconds) to handle weekends/holidays when market is closed
    let closestStockPrice: number | null = null;
    let minDiff = Infinity;

    for (const [ts, price] of stockMap) {
      const diff = Math.abs(ts - point.timestamp);
      if (diff < minDiff && diff < 259200) { // 3-day window for weekends/holidays
        minDiff = diff;
        closestStockPrice = price;
      }
    }

    return {
      time: point.timestamp * 1000,
      price: point.price * 100,
      stockPrice: closestStockPrice,
      // Normalize stock to 0-100 scale for visual comparison
      stockNormalized: closestStockPrice !== null
        ? ((closestStockPrice - minStock) / (maxStock - minStock || 1)) * 100
        : null,
      formattedTime: format(new Date(point.timestamp * 1000), 'MMM d'),
    };
  });

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const priceRange = maxPrice - minPrice;

  const stockColor = retailer ? RETAILER_COLORS[retailer] : '#22c55e';
  const hasStockData = showStock && stockHistory.length > 0;

  return (
    <div className="w-full" style={{ height: height + (ENABLE_STOCK_OVERLAY && retailer ? 32 : 0) }}>
      {/* Stock overlay toggle - only show if feature is enabled and retailer is detected */}
      {ENABLE_STOCK_OVERLAY && retailer && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showStock}
              onChange={(e) => setShowStock(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              Show {retailer.charAt(0).toUpperCase() + retailer.slice(1)} stock price
              {stockLoading && <span className="ml-1 text-gray-400">(loading...)</span>}
            </span>
          </label>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 10, right: hasStockData ? 50 : 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4b5563" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#4b5563" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="formattedTime"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          {/* Left Y-axis: Probability (dark grey) */}
          <YAxis
            yAxisId="probability"
            domain={[Math.max(0, minPrice - priceRange * 0.1), Math.min(100, maxPrice + priceRange * 0.1)]}
            tick={{ fontSize: 11, fill: '#4b5563' }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={45}
          />
          {/* Right Y-axis: Stock price (only if showing stock) */}
          {hasStockData && (
            <YAxis
              yAxisId="stock"
              orientation="right"
              domain={[minStock * 0.995, maxStock * 1.005]}
              tick={{ fontSize: 11, fill: stockColor }}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              width={50}
            />
          )}
          <Tooltip
            content={({ active, payload }) => {
              // Show tooltip for any active hover on the chart
              if (!active || !payload?.[0]) return null;
              const data = payload[0].payload;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[160px]">
                  <p className="text-xs text-gray-500 mb-1">{format(new Date(data.time), 'MMM d, yyyy HH:mm')}</p>
                  <p className="text-sm font-bold text-gray-700">Probability: {data.price.toFixed(1)}%</p>
                  {data.stockPrice !== null && showStock && (
                    <p className="text-sm font-bold" style={{ color: stockColor }}>
                      {retailer?.charAt(0).toUpperCase()}{retailer?.slice(1)} Stock: ${data.stockPrice.toFixed(2)}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <ReferenceLine yAxisId="probability" y={50} stroke="#9ca3af" strokeDasharray="5 5" />
          {/* Probability area - dark grey for contrast against colored stock lines */}
          <Area
            yAxisId="probability"
            type="monotone"
            dataKey="price"
            stroke="#4b5563"
            strokeWidth={2}
            fill="url(#priceGradient)"
            name="Probability"
          />
          {/* Stock price line - uses retailer brand color */}
          {hasStockData && (
            <Line
              yAxisId="stock"
              type="monotone"
              dataKey="stockPrice"
              stroke={stockColor}
              strokeWidth={2}
              dot={false}
              name="Stock Price"
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Market count chart for retailers
interface MarketCountChartProps {
  data: { name: string; count: number; color: string }[];
  height?: number;
}

export function MarketCountChart({ data, height = 300 }: MarketCountChartProps) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 p-4" style={{ minHeight: height }}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Open Markets</h3>
      <div className="space-y-4">
        {data.map(({ name, count, color }) => (
          <div key={name} className="flex items-center gap-3">
            <div className="w-24 text-sm font-medium text-gray-700">{name}</div>
            <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full transition-all duration-500 rounded-lg flex items-center justify-end pr-3"
                style={{
                  width: `${Math.max((count / maxCount) * 100, 10)}%`,
                  backgroundColor: color,
                }}
              >
                <span className="text-sm font-bold text-white drop-shadow">
                  {count}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">Total active prediction markets per retailer</p>
    </div>
  );
}

// Volume chart for retailers (in dollars)
interface VolumeChartProps {
  data: { name: string; volume: number; color: string }[];
  height?: number;
}

function formatVolumeLabel(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

export function VolumeChart({ data, height = 300 }: VolumeChartProps) {
  const maxVolume = Math.max(...data.map(d => d.volume), 1);

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 p-4" style={{ minHeight: height }}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Retail Volume by Company</h3>
      <div className="space-y-4">
        {data.map(({ name, volume, color }) => (
          <div key={name} className="flex items-center gap-3">
            <div className="w-24 text-sm font-medium text-gray-700">{name}</div>
            <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full transition-all duration-500 rounded-lg flex items-center justify-end pr-3"
                style={{
                  width: `${Math.max((volume / maxVolume) * 100, 10)}%`,
                  backgroundColor: color,
                }}
              >
                <span className="text-sm font-bold text-white drop-shadow">
                  {formatVolumeLabel(volume)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">Combined trading volume across all active markets per retailer</p>
    </div>
  );
}

// Summary stat card
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
  onClick?: () => void;
  clickable?: boolean;
}

export function StatCard({ title, value, subtitle, trend, icon, onClick, clickable }: StatCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow ${
        clickable ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/30' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${trend ? trendColors[trend] : 'text-gray-900'}`}>
        {value}
      </p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      {clickable && <p className="text-xs text-blue-500 mt-2">Click to view all</p>}
    </div>
  );
}
