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
  Scatter,
} from 'recharts';

interface NewsArticle {
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  description?: string;
}

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
  const earningsMarkets = markets.filter(isEarningsMarket);

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

  if (earningsMarkets.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div className="text-6xl mb-4">📅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          No Active Walmart Earnings Markets
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          There are no active Walmart earnings markets currently. Earnings markets typically
          open up 18-20 days prior to an earnings release.
        </p>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg inline-block">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Tip:</span> Check back closer to Walmart&apos;s next
            quarterly earnings announcement date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🏪</span> Walmart Earnings Markets
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {earningsMarkets.length} active earnings market{earningsMarkets.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Full-screen dashlets for each earnings market */}
      {earningsMarkets.map(market => (
        <EarningsDashlet key={market.id} market={market} />
      ))}
    </div>
  );
}

// Full-screen earnings dashlet with chart and news
function EarningsDashlet({ market }: { market: ParsedMarket }) {
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [stockHistory, setStockHistory] = useState<{ timestamp: number; price: number }[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStock, setShowStock] = useState(true);

  const consensus = getConsensus(market.yesPrice);
  const priceChangeColor = market.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeArrow = market.priceChange24h >= 0 ? '↑' : '↓';

  // Fetch probability history
  useEffect(() => {
    const fetchData = async () => {
      if (!market.clobTokenIds?.[0]) {
        setLoading(false);
        return;
      }

      try {
        // Fetch probability history
        const historyRes = await fetch(`/api/markets?type=history&tokenId=${market.clobTokenIds[0]}`);
        const historyData = await historyRes.json();
        if (historyData.history) {
          setHistory(historyData.history);
        }

        // Fetch stock history
        if (historyData.history?.length > 0) {
          const startTs = Math.min(...historyData.history.map((h: PriceHistoryPoint) => h.timestamp));
          const endTs = Math.max(...historyData.history.map((h: PriceHistoryPoint) => h.timestamp));
          const stockRes = await fetch(`/api/stocks/history?retailer=walmart&startTs=${startTs}&endTs=${endTs}`);
          const stockData = await stockRes.json();
          if (stockData.history) {
            setStockHistory(stockData.history);
          }
        }

        // Fetch news
        const newsRes = await fetch('/api/news?company=walmart&type=earnings');
        const newsData = await newsRes.json();
        if (newsData.articles) {
          setNews(newsData.articles);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [market.clobTokenIds]);

  // Merge data for chart
  const stockMap = new Map(stockHistory.map(s => [s.timestamp, s.price]));
  const stockPrices = stockHistory.map(s => s.price);
  const minStock = stockPrices.length > 0 ? Math.min(...stockPrices) : 0;
  const maxStock = stockPrices.length > 0 ? Math.max(...stockPrices) : 1;

  // Get time range for news filtering
  const historyStartTs = history.length > 0 ? Math.min(...history.map(h => h.timestamp)) : 0;
  const historyEndTs = history.length > 0 ? Math.max(...history.map(h => h.timestamp)) : Date.now() / 1000;

  // Filter news to chart timeframe
  const relevantNews = news.filter(
    article => article.publishedAt >= historyStartTs && article.publishedAt <= historyEndTs
  );

  const chartData = history.map(point => {
    // Find closest stock price
    let closestStockPrice: number | null = null;
    let minDiff = Infinity;
    for (const [ts, price] of stockMap) {
      const diff = Math.abs(ts - point.timestamp);
      if (diff < minDiff && diff < 259200) {
        minDiff = diff;
        closestStockPrice = price;
      }
    }

    // Find news articles near this timestamp (within 6 hours)
    const nearbyNews = relevantNews.filter(
      article => Math.abs(article.publishedAt - point.timestamp) < 21600
    );

    return {
      time: point.timestamp * 1000,
      timestamp: point.timestamp,
      price: point.price * 100,
      stockPrice: closestStockPrice,
      formattedTime: format(new Date(point.timestamp * 1000), 'MMM d'),
      newsCount: nearbyNews.length,
      newsArticles: nearbyNews,
    };
  });

  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 100;
  const priceRange = maxPrice - minPrice || 1;

  const hasStockData = showStock && stockHistory.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{market.question}</h3>
        {market.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{market.description}</p>
        )}

        {/* Stats Row */}
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

      {/* Full Chart */}
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
                <XAxis
                  dataKey="formattedTime"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
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
                        <p className="text-xs text-gray-500 mb-2">
                          {format(new Date(data.time), 'MMM d, yyyy HH:mm')}
                        </p>
                        <p className="text-sm font-bold text-gray-700">
                          Probability: {data.price.toFixed(1)}%
                        </p>
                        {data.stockPrice !== null && showStock && (
                          <p className="text-sm font-bold" style={{ color: RETAILER_COLORS.walmart }}>
                            WMT Stock: ${data.stockPrice.toFixed(2)}
                          </p>
                        )}
                        {data.newsCount > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-orange-600 font-medium">
                              📰 {data.newsCount} news article{data.newsCount > 1 ? 's' : ''} nearby
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <ReferenceLine yAxisId="probability" y={50} stroke="#9ca3af" strokeDasharray="5 5" />

                {/* Probability area */}
                <Area
                  yAxisId="probability"
                  type="monotone"
                  dataKey="price"
                  stroke="#4b5563"
                  strokeWidth={2}
                  fill="url(#earningsPriceGradient)"
                />

                {/* Stock price line */}
                {hasStockData && (
                  <Line
                    yAxisId="stock"
                    type="monotone"
                    dataKey="stockPrice"
                    stroke={RETAILER_COLORS.walmart}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                )}

                {/* News markers - orange dots where news occurred */}
                <Scatter
                  yAxisId="probability"
                  data={chartData.filter(d => d.newsCount > 0)}
                  dataKey="price"
                  fill="#f97316"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* News Timeline */}
      <div className="p-6 border-t border-gray-100 bg-gray-50">
        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <span>📰</span> Related News Headlines
        </h4>
        {news.length === 0 ? (
          <p className="text-sm text-gray-500">No recent news articles found.</p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {news.slice(0, 10).map((article, index) => (
              <a
                key={index}
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 hover:text-blue-600">
                      {article.title}
                    </p>
                    {article.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{article.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>{article.source}</span>
                      <span>•</span>
                      <span>{format(new Date(article.publishedAt * 1000), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
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
