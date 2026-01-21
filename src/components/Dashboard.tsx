'use client';

import { useState, useEffect, useCallback } from 'react';
import { ParsedMarket, RetailerName, RETAILER_COLORS } from '@/types/market';
import { RetailerSection, RetailerCompact } from './RetailerSection';
import { MarketCard, MarketCardSkeleton } from './MarketCard';
import { StatCard, MarketCountChart } from './PriceChart';
import { StockTicker } from './StockTicker';
import { formatVolume, hasSignificantMovement } from '@/lib/polymarket';

interface DashboardData {
  retailers: {
    walmart: ParsedMarket[];
    amazon: ParsedMarket[];
    costco: ParsedMarket[];
    target: ParsedMarket[];
    other: ParsedMarket[];
  };
  earnings: ParsedMarket[];
  timestamp: string;
}

// Title info popup component
function TitleInfoPopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <span className="text-2xl">📊</span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-gray-700 leading-relaxed">
          Polymarket Prediction market data aggregates collective beliefs, offering signals that improve forecasting, decision-making, and risk management.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'earnings' | 'competitors'>('overview');
  const [showTitleInfo, setShowTitleInfo] = useState(false);
  const [retailFilter, setRetailFilter] = useState<RetailerName | 'all'>('all');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/markets');
      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter earnings markets by search (data already comes as top 25 from earnings category)
  const filteredEarnings = (data?.earnings || []).filter(market =>
    market.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    market.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get all retail markets (Walmart, Amazon, Costco, Target)
  const allRetailMarkets = data ? [
    ...data.retailers.walmart,
    ...data.retailers.amazon,
    ...data.retailers.costco,
    ...data.retailers.target,
  ] : [];

  // Calculate retail-focused stats
  const totalRetailMarkets = allRetailMarkets.length;
  const totalRetailVolume = allRetailMarkets.reduce((sum, m) => sum + m.volume, 0);
  const retailSignificantMoves = allRetailMarkets.filter(hasSignificantMovement);

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <h1
                onClick={() => setShowTitleInfo(true)}
                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                title="Click to learn more"
              >
                Polymarket Retail Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {[
              { id: 'overview', label: 'Overview', icon: '📈' },
              { id: 'earnings', label: 'All Earnings', icon: '💰' },
              { id: 'competitors', label: 'All Retail Markets', icon: '🏬' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stock Ticker */}
            <StockTicker />

            {/* Stats Row - Retail Focused */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard
                title="Total Active Retail Markets"
                value={totalRetailMarkets.toString()}
                subtitle="Walmart, Amazon, Costco, Target"
                icon="🏪"
                clickable
                onClick={() => {
                  setRetailFilter('all');
                  setActiveTab('competitors');
                }}
              />
              <StatCard
                title="Total Retail Volume"
                value={formatVolume(totalRetailVolume)}
                subtitle="Combined across all retail markets"
                icon="💵"
                clickable
                onClick={() => {
                  setRetailFilter('all');
                  setActiveTab('competitors');
                }}
              />
              <StatCard
                title="Significant Moves"
                value={retailSignificantMoves.length.toString()}
                subtitle=">10% change in 24h (retail only)"
                icon="⚡"
                trend={retailSignificantMoves.length > 0 ? 'up' : 'neutral'}
              />
            </div>

            {/* Walmart Primary Focus */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>🏪</span> Walmart Markets
                <span className="text-sm font-normal text-gray-500">(Primary Focus)</span>
              </h2>
              <RetailerSection
                name="walmart"
                displayName="Walmart (WMT)"
                markets={data?.retailers.walmart || []}
                loading={loading}
                showChart
              />
            </section>

            {/* Quick Competitor Overview */}
            <section className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Competitor Snapshot</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {(['amazon', 'costco', 'target'] as RetailerName[]).map(retailer => (
                  <RetailerCompact
                    key={retailer}
                    name={retailer}
                    displayName={retailer.charAt(0).toUpperCase() + retailer.slice(1)}
                    markets={data?.retailers[retailer] || []}
                    onClick={() => {
                      setRetailFilter(retailer);
                      setActiveTab('competitors');
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Significant Retail Moves */}
            {retailSignificantMoves.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>⚡</span> Significant Retail Price Movements
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    &gt;10% in 24h
                  </span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {retailSignificantMoves.slice(0, 6).map(market => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </section>
            )}

            {/* Market Count Chart */}
            <section className="mb-8">
              <MarketCountChart
                data={[
                  { name: 'Walmart', count: data?.retailers.walmart.length || 0, color: RETAILER_COLORS.walmart },
                  { name: 'Amazon', count: data?.retailers.amazon.length || 0, color: RETAILER_COLORS.amazon },
                  { name: 'Costco', count: data?.retailers.costco.length || 0, color: RETAILER_COLORS.costco },
                  { name: 'Target', count: data?.retailers.target.length || 0, color: RETAILER_COLORS.target },
                ]}
              />
            </section>
          </>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <>
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Earnings Markets</h2>
                <p className="text-sm text-gray-500">Top 25 by volume from Polymarket Earnings</p>
              </div>
              {/* Search */}
              <div className="relative max-w-md">
                <input
                  type="text"
                  placeholder="Search earnings markets..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Earnings Grid */}
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <MarketCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredEarnings.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredEarnings.map((market, index) => (
                  <div key={market.id} className="relative">
                    {/* Rank badge */}
                    <div className="absolute -top-2 -left-2 z-10 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {index + 1}
                    </div>
                    {/* Significant move indicator */}
                    {hasSignificantMovement(market) && (
                      <div className="absolute -top-2 -right-2 z-10 px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">
                        HOT
                      </div>
                    )}
                    <MarketCard market={market} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500">
                  {searchTerm ? `No markets found matching "${searchTerm}"` : 'No earnings markets currently available'}
                </p>
              </div>
            )}
          </>
        )}

        {/* All Retail Markets Tab */}
        {activeTab === 'competitors' && (
          <div className="space-y-6">
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl border border-gray-200 p-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Retail Markets</h2>
                <p className="text-sm text-gray-500">Filter by retailer to view specific markets</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Filter:</label>
                <select
                  value={retailFilter}
                  onChange={e => setRetailFilter(e.target.value as RetailerName | 'all')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value="all">All Retailers</option>
                  <option value="walmart">Walmart</option>
                  <option value="amazon">Amazon</option>
                  <option value="costco">Costco</option>
                  <option value="target">Target</option>
                </select>
              </div>
            </div>

            {/* Filtered Retailer Sections */}
            {(retailFilter === 'all' ? ['walmart', 'amazon', 'costco', 'target'] : [retailFilter]).map(retailer => (
              <RetailerSection
                key={retailer}
                name={retailer as RetailerName}
                displayName={retailer.charAt(0).toUpperCase() + retailer.slice(1)}
                markets={data?.retailers[retailer as RetailerName] || []}
                loading={loading}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Data from{' '}
              <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Polymarket
              </a>
              {' '}• Auto-refreshes every 2 minutes
            </p>
            <p className="text-sm text-gray-400">
              This is not financial advice. Prediction markets involve risk.
            </p>
          </div>
        </div>
      </footer>

      {/* Title Info Popup */}
      <TitleInfoPopup isOpen={showTitleInfo} onClose={() => setShowTitleInfo(false)} />
    </div>
  );
}
