'use client';

import { useState, useEffect } from 'react';
import { ParsedMarket, PriceHistoryPoint, RETAILER_COLORS } from '@/types/market';
import { formatProbability, formatVolume, getConsensus } from '@/lib/polymarket';
import { format } from 'date-fns';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface WalmartEarningsProps {
  markets: ParsedMarket[];
  loading?: boolean;
}

// Filter for earnings-related markets
function isEarningsMarket(market: ParsedMarket): boolean {
  const question = market.question.toLowerCase();
  return (
    question.includes('earnings') ||
    question.includes('revenue') ||
    question.includes('eps') ||
    question.includes('quarterly') ||
    question.includes('q1') ||
    question.includes('q2') ||
    question.includes('q3') ||
    question.includes('q4') ||
    question.includes('fiscal') ||
    question.includes('beat') ||
    question.includes('guidance')
  );
}

export function WalmartEarnings({ markets, loading }: WalmartEarningsProps) {
  const [resolvedMarket, setResolvedMarket] = useState<ParsedMarket | null>(null);
  const [resolvedLoading, setResolvedLoading] = useState(true);

  const earningsMarkets = markets.filter(isEarningsMarket);

  // Always fetch the most recent resolved market
  useEffect(() => {
    const fetchResolved = async () => {
      try {
        const res = await fetch('/api/markets?type=resolved-walmart-earnings');
        const data = await res.json();
        if (data.markets && data.markets.length > 0) {
          setResolvedMarket(data.markets[0]);
        }
      } catch (err) {
        console.error('Failed to fetch resolved market:', err);
      } finally {
        setResolvedLoading(false);
      }
    };

    fetchResolved();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-[500px] bg-gray-100 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Earnings Markets Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span>🏪</span> Active Walmart Earnings Markets
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {earningsMarkets.length > 0
                ? `${earningsMarkets.length} active earnings market${earningsMarkets.length !== 1 ? 's' : ''}`
                : 'No active earnings markets'}
            </p>
          </div>
        </div>

        {earningsMarkets.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-gray-600">
              There are no active Walmart earnings markets currently. Earnings markets typically
              open up 18-20 days prior to an earnings release.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {earningsMarkets.map(market => (
              <EarningsDashlet key={market.id} market={market} />
            ))}
          </div>
        )}
      </section>

      {/* Recently Resolved Market Section - Always shown */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>📊</span> Most Recently Resolved
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Last completed Walmart earnings market
          </p>
        </div>

        {resolvedLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="animate-pulse flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-500">Loading resolved market...</span>
            </div>
          </div>
        ) : resolvedMarket ? (
          <ResolvedMarketCard market={resolvedMarket} />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-gray-500">No resolved Walmart earnings markets found.</p>
          </div>
        )}
      </section>

      {/* Walmart Stock Price Chart - Show when no active markets */}
      {earningsMarkets.length === 0 && (
        <WalmartStockChart />
      )}
    </div>
  );
}

// Standalone Walmart stock price chart (5-day view)
function WalmartStockChart() {
  const [stockHistory, setStockHistory] = useState<{ timestamp: number; price: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        // Use range=5d for reliable 5-day data from Yahoo Finance
        const response = await fetch(`/api/stocks/history?retailer=walmart&range=5d`);
        const data = await response.json();
        if (data.history) {
          setStockHistory(data.history);
        }
      } catch (err) {
        console.error('Failed to fetch stock data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []);

  const chartData = stockHistory.map(point => ({
    time: point.timestamp * 1000,
    price: point.price,
    formattedTime: format(new Date(point.timestamp * 1000), 'MMM d'),
  }));

  const prices = chartData.map(d => d.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 100;
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const startPrice = prices.length > 0 ? prices[0] : 0;
  const priceChange = currentPrice - startPrice;
  const priceChangePercent = startPrice > 0 ? (priceChange / startPrice) * 100 : 0;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span>📈</span> Walmart (WMT) Stock Price
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Last 5 days of trading activity
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-[350px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : stockHistory.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-gray-500">
            Unable to load stock data
          </div>
        ) : (
          <>
            {/* Stock stats header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Current Price</p>
                  <p className="text-3xl font-bold" style={{ color: RETAILER_COLORS.walmart }}>
                    ${currentPrice.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">5-Day Change</p>
                  <p className={`text-xl font-bold ${priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                  </p>
                </div>
              </div>
            </div>

            {/* Stock chart */}
            <div className="p-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={RETAILER_COLORS.walmart} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={RETAILER_COLORS.walmart} stopOpacity={0} />
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
                    domain={[minPrice * 0.995, maxPrice * 1.005]}
                    tick={{ fontSize: 11, fill: RETAILER_COLORS.walmart }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={55}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">{format(new Date(data.time), 'MMM d, yyyy HH:mm')}</p>
                          <p className="text-sm font-bold" style={{ color: RETAILER_COLORS.walmart }}>
                            WMT: ${data.price.toFixed(2)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={RETAILER_COLORS.walmart}
                    strokeWidth={2}
                    fill="url(#stockGradient)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// Active earnings dashlet with full chart
function EarningsDashlet({ market }: { market: ParsedMarket }) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [stockHistory, setStockHistory] = useState<{ timestamp: number; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStock, setShowStock] = useState(true);

  const consensus = getConsensus(market.yesPrice);
  const priceChangeColor = market.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeArrow = market.priceChange24h >= 0 ? '↑' : '↓';

  useEffect(() => {
    const fetchData = async () => {
      if (!market.clobTokenIds?.[0]) {
        setLoading(false);
        return;
      }

      try {
        const historyRes = await fetch(`/api/markets?type=history&tokenId=${market.clobTokenIds[0]}`);
        const historyData = await historyRes.json();
        if (historyData.history) {
          setHistory(historyData.history);
        }

        // Use range=5d for reliable 5-day data from Yahoo Finance
        const stockRes = await fetch(`/api/stocks/history?retailer=walmart&range=5d`);
        const stockData = await stockRes.json();
        if (stockData.history) {
          setStockHistory(stockData.history);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [market.clobTokenIds]);

  const stockMap = new Map(stockHistory.map(s => [s.timestamp, s.price]));
  const stockPrices = stockHistory.map(s => s.price);
  const minStock = stockPrices.length > 0 ? Math.min(...stockPrices) : 0;
  const maxStock = stockPrices.length > 0 ? Math.max(...stockPrices) : 1;

  const chartData = history.map(point => {
    let closestStockPrice: number | null = null;
    let minDiff = Infinity;
    for (const [ts, price] of stockMap) {
      const diff = Math.abs(ts - point.timestamp);
      if (diff < minDiff && diff < 259200) {
        minDiff = diff;
        closestStockPrice = price;
      }
    }

    return {
      time: point.timestamp * 1000,
      price: point.price * 100,
      stockPrice: closestStockPrice,
      formattedTime: format(new Date(point.timestamp * 1000), 'MMM d'),
    };
  });

  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 100;
  const priceRange = maxPrice - minPrice || 1;
  const hasStockData = showStock && stockHistory.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{market.question}</h3>
        {market.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{market.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-green-700 uppercase font-medium">Yes</p>
            <p className="text-xl font-bold text-green-600">{formatProbability(market.yesPrice)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-red-700 uppercase font-medium">No</p>
            <p className="text-xl font-bold text-red-600">{formatProbability(market.noPrice)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase">Volume</p>
            <p className="text-xl font-bold text-gray-900">{formatVolume(market.volume)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase">24h Change</p>
            <p className={`text-xl font-bold ${priceChangeColor}`}>
              {priceChangeArrow} {Math.abs(market.priceChange24h * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase">Consensus</p>
            <p className="text-xl font-bold text-gray-900 capitalize">{consensus}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700">Probability & Stock Price History</h4>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showStock}
              onChange={(e) => setShowStock(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
            />
            <span>Show Walmart (WMT) stock price</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg text-gray-500">
            No probability history available
          </div>
        ) : (
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: hasStockData ? 60 : 20, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="earningsPriceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4b5563" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4b5563" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="formattedTime" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis
                  yAxisId="probability"
                  domain={[Math.max(0, minPrice - priceRange * 0.1), Math.min(100, maxPrice + priceRange * 0.1)]}
                  tick={{ fontSize: 11, fill: '#4b5563' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={45}
                />
                {hasStockData && (
                  <YAxis
                    yAxisId="stock"
                    orientation="right"
                    domain={[minStock * 0.995, maxStock * 1.005]}
                    tick={{ fontSize: 11, fill: RETAILER_COLORS.walmart }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={55}
                  />
                )}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
                        <p className="text-xs text-gray-500 mb-2">{format(new Date(data.time), 'MMM d, yyyy HH:mm')}</p>
                        <p className="text-sm font-bold text-gray-700">Probability: {data.price.toFixed(1)}%</p>
                        {data.stockPrice !== null && showStock && (
                          <p className="text-sm font-bold" style={{ color: RETAILER_COLORS.walmart }}>
                            WMT Stock: ${data.stockPrice.toFixed(2)}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <ReferenceLine yAxisId="probability" y={50} stroke="#9ca3af" strokeDasharray="5 5" />
                <Area yAxisId="probability" type="monotone" dataKey="price" stroke="#4b5563" strokeWidth={2} fill="url(#earningsPriceGradient)" />
                {hasStockData && (
                  <Line yAxisId="stock" type="monotone" dataKey="stockPrice" stroke={RETAILER_COLORS.walmart} strokeWidth={2} dot={false} connectNulls />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100">
        <a
          href={`https://polymarket.com/event/${market.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          View on Polymarket
        </a>
      </div>
    </div>
  );
}

// Clickable resolved market card (compact, similar to other retail dashlets)
function ResolvedMarketCard({ market }: { market: ParsedMarket }) {
  const [showModal, setShowModal] = useState(false);
  const consensus = getConsensus(market.yesPrice);
  const outcome = market.yesPrice >= 0.5 ? 'Yes' : 'No';

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="bg-white rounded-xl border-2 border-gray-300 p-5 cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2">{market.question}</h3>
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full whitespace-nowrap flex-shrink-0">
            Resolved
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Final</p>
            <p className={`text-lg font-bold ${outcome === 'Yes' ? 'text-green-600' : 'text-red-600'}`}>
              {outcome}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Yes</p>
            <p className="text-lg font-bold text-green-600">{formatProbability(market.yesPrice)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">No</p>
            <p className="text-lg font-bold text-red-600">{formatProbability(market.noPrice)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 uppercase">Volume</p>
            <p className="text-lg font-bold text-gray-900">{formatVolume(market.volume)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Ended: {market.endDate ? format(new Date(market.endDate), 'MMM d, yyyy') : 'N/A'}
          </span>
          <span className="text-blue-600 font-medium">Click to view history →</span>
        </div>
      </div>

      {showModal && <ResolvedMarketModal market={market} onClose={() => setShowModal(false)} />}
    </>
  );
}

// Modal for resolved market details
function ResolvedMarketModal({ market, onClose }: { market: ParsedMarket; onClose: () => void }) {
  const outcome = market.yesPrice >= 0.5 ? 'Yes' : 'No';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Resolved</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${outcome === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                Outcome: {outcome}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{market.question}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Market stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 rounded-xl bg-green-50 border border-green-200">
              <p className="text-xs text-green-700 uppercase font-medium">Final Yes</p>
              <p className="text-2xl font-bold text-green-600">{formatProbability(market.yesPrice)}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs text-red-700 uppercase font-medium">Final No</p>
              <p className="text-2xl font-bold text-red-600">{formatProbability(market.noPrice)}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900">{formatVolume(market.volume)}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase">End Date</p>
              <p className="text-lg font-bold text-gray-900">
                {market.endDate ? format(new Date(market.endDate), 'MMM d, yyyy') : 'N/A'}
              </p>
            </div>
          </div>

          {/* Chart preview notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">View Full Price History on Polymarket</h4>
                <p className="text-sm text-blue-700">
                  Historical price charts for resolved markets are available directly on Polymarket.
                  Click the button below to see the complete probability history for this market.
                </p>
              </div>
            </div>
          </div>

          {/* Market description if available */}
          {market.description && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Market Description</h4>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{market.description}</p>
            </div>
          )}

          {/* CTA button */}
          <a
            href={`https://polymarket.com/event/${market.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-4 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Chart & Details on Polymarket
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
