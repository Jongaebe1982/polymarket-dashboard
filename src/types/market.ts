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
  amazon: ['amzn'], // Only stock ticker to avoid "Amazon MGM Studios" etc.
  costco: ['costco', 'cost'],
  target: ['tgt'], // Only stock ticker to avoid "target" in other contexts
};

// Additional contextual keywords that must appear with company name
export const RETAILER_CONTEXT_KEYWORDS = [
  'stock', 'earnings', 'revenue', 'eps', 'quarter', 'fiscal',
  'shares', 'price', 'market cap', 'retail', 'acquire', 'merger'
];

// Exclude patterns - if these appear near the keyword, it's likely a false positive
export const EXCLUSION_PATTERNS: Record<RetailerName, RegExp[]> = {
  walmart: [], // Walmart is pretty unambiguous
  amazon: [/amazon\s+mgm/i, /amazon\s+river/i, /amazon\s+rainforest/i, /amazon\s+forest/i],
  costco: [],
  target: [/target\s+(range|rate|area|zone|strike|military|attack|bombing)/i, /federal\s+funds?\s+target/i],
};

export const RETAILER_COLORS: Record<RetailerName, string> = {
  walmart: '#0071ce',
  amazon: '#ff9900',
  costco: '#e31837',
  target: '#cc0000',
};
