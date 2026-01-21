'use client';

import { ParsedMarket } from '@/types/market';
import { formatProbability, formatVolume, hasSignificantMovement, getConsensus } from '@/lib/polymarket';
import { format } from 'date-fns';

interface MarketCardProps {
  market: ParsedMarket;
  showPriceChange?: boolean;
  compact?: boolean;
}

export function MarketCard({ market, showPriceChange = true, compact = false }: MarketCardProps) {
  const significantMove = hasSignificantMovement(market);
  const consensus = getConsensus(market.yesPrice);

  const consensusColors = {
    likely: 'text-green-600 bg-green-50 border-green-200',
    unlikely: 'text-red-600 bg-red-50 border-red-200',
    uncertain: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  };

  const priceChangeColor = market.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeArrow = market.priceChange24h >= 0 ? '↑' : '↓';

  if (compact) {
    return (
      <div className={`p-3 rounded-lg border ${significantMove ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white'}`}>
        <p className="text-sm font-medium text-gray-900 line-clamp-2">{market.question}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-blue-600">{formatProbability(market.yesPrice)}</span>
          {showPriceChange && market.priceChange24h !== 0 && (
            <span className={`text-sm font-medium ${priceChangeColor}`}>
              {priceChangeArrow} {Math.abs(market.priceChange24h * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${significantMove ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-white' : 'border-gray-200 bg-white'}`}>
      {significantMove && (
        <div className="mb-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            ⚡ Significant Movement
          </span>
        </div>
      )}

      <h3 className="text-base font-semibold text-gray-900 mb-3 line-clamp-2">
        {market.question}
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-xs text-green-700 uppercase font-medium">Yes</p>
          <p className="text-2xl font-bold text-green-600">{formatProbability(market.yesPrice)}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-700 uppercase font-medium">No</p>
          <p className="text-2xl font-bold text-red-600">{formatProbability(market.noPrice)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
        <span>Volume: {formatVolume(market.volume)}</span>
        <span>Liquidity: {formatVolume(market.liquidity)}</span>
      </div>

      {showPriceChange && (
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-gray-500">24h Change:</span>
          <span className={`font-medium ${priceChangeColor}`}>
            {priceChangeArrow} {Math.abs(market.priceChange24h * 100).toFixed(2)}%
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className={`px-2 py-1 rounded text-xs font-medium border ${consensusColors[consensus]}`}>
          {consensus === 'likely' && 'Likely YES'}
          {consensus === 'unlikely' && 'Likely NO'}
          {consensus === 'uncertain' && 'Uncertain'}
        </span>
        {market.endDate && (
          <span className="text-xs text-gray-500">
            Ends: {format(new Date(market.endDate), 'MMM d, yyyy')}
          </span>
        )}
      </div>

      <a
        href={`https://polymarket.com/event/${market.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        View on Polymarket →
      </a>
    </div>
  );
}

export function MarketCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="h-16 bg-gray-100 rounded-lg"></div>
        <div className="h-16 bg-gray-100 rounded-lg"></div>
      </div>
      <div className="h-4 bg-gray-100 rounded w-full"></div>
    </div>
  );
}
