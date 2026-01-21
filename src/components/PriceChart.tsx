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
} from 'recharts';
import { format } from 'date-fns';
import { PriceHistoryPoint, ParsedMarket } from '@/types/market';

interface PriceChartProps {
  market: ParsedMarket;
  height?: number;
}

export function PriceChart({ market, height = 200 }: PriceChartProps) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {error || 'No price history available'}
      </div>
    );
  }

  const chartData = history.map(point => ({
    time: point.timestamp * 1000,
    price: point.price * 100,
    formattedTime: format(new Date(point.timestamp * 1000), 'MMM d'),
  }));

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const priceRange = maxPrice - minPrice;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="formattedTime"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            domain={[Math.max(0, minPrice - priceRange * 0.1), Math.min(100, maxPrice + priceRange * 0.1)]}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={45}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const data = payload[0].payload;
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                  <p className="text-xs text-gray-500">{format(new Date(data.time), 'MMM d, yyyy HH:mm')}</p>
                  <p className="text-sm font-bold text-blue-600">{data.price.toFixed(1)}%</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="5 5" />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#priceGradient)"
          />
        </AreaChart>
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

// Summary stat card
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${trend ? trendColors[trend] : 'text-gray-900'}`}>
        {value}
      </p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
