'use client';

import { ParsedMarket, RETAILER_COLORS, RetailerName } from '@/types/market';
import { MarketCard, MarketCardSkeleton } from './MarketCard';
import { PriceChart } from './PriceChart';

interface RetailerSectionProps {
  name: RetailerName;
  displayName: string;
  markets: ParsedMarket[];
  loading?: boolean;
  showChart?: boolean;
}

const retailerLogos: Record<RetailerName, string> = {
  walmart: '🏪',
  amazon: '📦',
  costco: '🛒',
  target: '🎯',
};

export function RetailerSection({
  name,
  displayName,
  markets,
  loading = false,
  showChart = false,
}: RetailerSectionProps) {
  const color = RETAILER_COLORS[name];
  const logo = retailerLogos[name];

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{logo}</span>
          <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{logo}</span>
          <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
        </div>
        <div
          className="p-8 rounded-xl border-2 border-dashed text-center"
          style={{ borderColor: `${color}40` }}
        >
          <p className="text-gray-500">
            No active prediction markets found for {displayName}.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Markets will appear here when they become available on Polymarket.
          </p>
        </div>
      </div>
    );
  }

  // Sort by volume
  const sortedMarkets = [...markets].sort((a, b) => b.volume - a.volume);
  const primaryMarket = sortedMarkets[0];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{logo}</span>
        <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
        <span
          className="px-2 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {markets.length} market{markets.length !== 1 ? 's' : ''}
        </span>
      </div>

      {showChart && primaryMarket && (
        <div className="mb-4 p-4 bg-white rounded-xl border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2 truncate">
            {primaryMarket.question}
          </h3>
          <PriceChart market={primaryMarket} height={180} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedMarkets.map(market => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>
    </div>
  );
}

// Compact version for competitive analysis
export function RetailerCompact({
  name,
  displayName,
  markets,
}: {
  name: RetailerName;
  displayName: string;
  markets: ParsedMarket[];
}) {
  const color = RETAILER_COLORS[name];
  const logo = retailerLogos[name];

  const topMarket = markets.sort((a, b) => b.volume - a.volume)[0];

  return (
    <div
      className="p-4 rounded-xl border-2 bg-white transition-all hover:shadow-lg"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{logo}</span>
        <h3 className="font-bold text-gray-900">{displayName}</h3>
      </div>

      {topMarket ? (
        <>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{topMarket.question}</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold" style={{ color }}>
              {(topMarket.yesPrice * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">
              Vol: ${(topMarket.volume / 1000).toFixed(0)}K
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 italic">No active markets</p>
      )}
    </div>
  );
}
