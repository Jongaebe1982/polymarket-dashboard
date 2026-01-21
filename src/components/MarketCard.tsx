'use client';

import { useState } from 'react';
import { ParsedMarket } from '@/types/market';
import { formatProbability, formatVolume, hasSignificantMovement, getConsensus } from '@/lib/polymarket';
import { format } from 'date-fns';
import { PriceChart } from './PriceChart';

interface MarketCardProps {
  market: ParsedMarket;
  showPriceChange?: boolean;
  compact?: boolean;
}

export function MarketCard({ market, showPriceChange = true, compact = false }: MarketCardProps) {
  const [showModal, setShowModal] = useState(false);
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
      <>
        <div
          onClick={() => setShowModal(true)}
          className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${significantMove ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
        >
          <p className="text-sm font-medium text-gray-900 line-clamp-2">{market.question}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-blue-600">{formatProbability(market.yesPrice)}</span>
            {showPriceChange && market.priceChange24h !== 0 && (
              <span className={`text-sm font-medium ${priceChangeColor}`}>
                {priceChangeArrow} {Math.abs(market.priceChange24h * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-blue-500 mt-2">Click for probability history</p>
        </div>
        {showModal && (
          <MarketModal market={market} onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${significantMove ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-white' : 'border-gray-200 bg-white hover:border-blue-300'}`}
      >
        {significantMove && (
          <div className="mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Significant Movement
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

        <p className="mt-3 text-center text-xs text-blue-500">
          Click to view probability history
        </p>
      </div>
      {showModal && (
        <MarketModal market={market} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// Modal component for showing price history
function MarketModal({ market, onClose }: { market: ParsedMarket; onClose: () => void }) {
  const consensus = getConsensus(market.yesPrice);
  const priceChangeColor = market.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600';
  const priceChangeArrow = market.priceChange24h >= 0 ? '↑' : '↓';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-bold text-gray-900">{market.question}</h2>
            {market.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{market.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Current Probabilities */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
              <p className="text-sm text-green-700 uppercase font-medium">Yes</p>
              <p className="text-3xl font-bold text-green-600">{formatProbability(market.yesPrice)}</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-700 uppercase font-medium">No</p>
              <p className="text-3xl font-bold text-red-600">{formatProbability(market.noPrice)}</p>
            </div>
          </div>

          {/* Probability History Chart */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Probability History</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <PriceChart market={market} height={250} />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Volume</p>
              <p className="text-lg font-bold text-gray-900">{formatVolume(market.volume)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Liquidity</p>
              <p className="text-lg font-bold text-gray-900">{formatVolume(market.liquidity)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">24h Change</p>
              <p className={`text-lg font-bold ${priceChangeColor}`}>
                {priceChangeArrow} {Math.abs(market.priceChange24h * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Consensus</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{consensus}</p>
            </div>
          </div>

          {/* End Date */}
          {market.endDate && (
            <p className="text-sm text-gray-500 mb-4">
              Market ends: {format(new Date(market.endDate), 'MMMM d, yyyy')}
            </p>
          )}

          {/* Action Button */}
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
