'use client';

import { useState, useEffect } from 'react';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
}

interface StockTickerProps {
  onDataLoaded?: () => void;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function StockTicker({ onDataLoaded }: StockTickerProps) {
  const [stocks, setStocks] = useState<Record<string, StockData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/stocks');
        if (!response.ok) throw new Error('Failed to fetch stock data');
        const data = await response.json();
        setStocks(data.stocks || {});
        setError(null);
        onDataLoaded?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stocks');
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStocks, 300000);
    return () => clearInterval(interval);
  }, [onDataLoaded]);

  // Order: Walmart, Amazon, Costco, Target
  const stockOrder = ['wmt', 'amzn', 'cost', 'tgt'];
  const orderedStocks = stockOrder
    .map(symbol => stocks[symbol])
    .filter(Boolean);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Retail Stock Prices</h3>
          <span className="text-slate-400 text-xs">Loading...</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-700/50 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-slate-600 rounded w-16 mb-2"></div>
              <div className="h-6 bg-slate-600 rounded w-20 mb-1"></div>
              <div className="h-3 bg-slate-600 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || orderedStocks.length === 0) {
    return (
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Retail Stock Prices</h3>
          <span className="text-red-400 text-xs">{error || 'Unable to load'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">Retail Stock Prices</h3>
        <span className="text-slate-400 text-xs">Live from Yahoo Finance</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {orderedStocks.map(stock => {
          const isPositive = stock.change >= 0;
          return (
            <div
              key={stock.symbol}
              className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-300 font-medium text-sm">{stock.name}</span>
                <span className="text-slate-500 text-xs">{stock.symbol}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-xl font-bold">
                  {formatPrice(stock.price)}
                </span>
                <span className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? '↑' : '↓'} {Math.abs(stock.changePercent).toFixed(2)}%
                </span>
              </div>
              <div className="mt-1">
                <span className="text-slate-400 text-xs">
                  Mkt Cap: {formatMarketCap(stock.marketCap)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
