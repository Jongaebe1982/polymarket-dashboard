// Polymarket API Types

export interface Market {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  description: string;
  category: string;
  endDate: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  volumeNum: number;
  liquidity: string;
  liquidityNum: number;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  oneDayPriceChange: number;
  oneHourPriceChange: number;
  oneWeekPriceChange: number;
  active: boolean;
  closed: boolean;
  archived: boolean;
  clobTokenIds: string[];
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  createdAt: string;
  events?: Event[];
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate: string;
  markets: Market[];
}

export interface PriceHistoryPoint {
  timestamp: number;
  price: number;
}

export interface ParsedMarket {
  id: string;
  question: string;
  slug: string;
  eventSlug?: string; // The parent event's slug - use this for Polymarket URLs
  description: string;
  category: string;
  endDate: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  volume24hr: number;
  liquidity: number;
  priceChange24h: number;
  priceChange1h: number;
  priceChange1w: number;
  active: boolean;
  closed: boolean;
  yesPrice: number;
  noPrice: number;
  clobTokenIds: string[];
}

export interface RetailerMarkets {
  walmart: ParsedMarket[];
  amazon: ParsedMarket[];
  costco: ParsedMarket[];
  target: ParsedMarket[];
}

export interface MarketWithHistory extends ParsedMarket {
  priceHistory?: PriceHistoryPoint[];
}

export type RetailerName = 'walmart' | 'amazon' | 'costco' | 'target';

// Primary keywords that strongly indicate the company
export const RETAILER_KEYWORDS: Record<RetailerName, string[]> = {
  walmart: ['walmart', 'wmt'],
  amazon: ['amzn', 'amazon'], // Include "amazon" - we'll filter out false positives with exclusions
  costco: ['costco'], // Removed 'cost' - too many false positives (e.g., "Will X cost $100?")
  target: ['tgt', 'target'], // Include "target" - we'll filter out false positives with exclusions
};

// Additional contextual keywords that must appear with company name
export const RETAILER_CONTEXT_KEYWORDS = [
  'stock', 'earnings', 'revenue', 'eps', 'quarter', 'fiscal',
  'shares', 'price', 'market cap', 'retail', 'acquire', 'merger'
];

// Exclude patterns - if these appear near the keyword, it's likely a false positive
export const EXCLUSION_PATTERNS: Record<RetailerName, RegExp[]> = {
  walmart: [], // Walmart is pretty unambiguous
  amazon: [
    /amazon\s+mgm/i,
    /amazon\s+river/i,
    /amazon\s+rainforest/i,
    /amazon\s+forest/i,
    /amazon\s+prime\s+video/i,
    /amazon\s+studios/i,
  ],
  costco: [],
  target: [
    /target\s+(range|rate|area|zone|strike|military|attack|bombing|price|audience|demographic)/i,
    /federal\s+funds?\s+target/i,
    /inflation\s+target/i,
    /price\s+target/i,
    /\btarget(s|ed|ing)?\s+(of|by|at|for)\b/i, // "targets of", "targeted by", etc.
  ],
};

export const RETAILER_COLORS: Record<RetailerName, string> = {
  walmart: '#0071ce',
  amazon: '#ff9900',
  costco: '#e31837',
  target: '#cc0000',
};
