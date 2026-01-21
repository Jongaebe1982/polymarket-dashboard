import { Market, Event, ParsedMarket, PriceHistoryPoint, RETAILER_KEYWORDS, RetailerName, EXCLUSION_PATTERNS } from '@/types/market';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

// Parse market data from API response
export function parseMarket(market: Market): ParsedMarket {
  // Parse outcome prices (comes as JSON string array)
  let prices: number[] = [];
  try {
    if (typeof market.outcomePrices === 'string') {
      prices = JSON.parse(market.outcomePrices);
    } else if (Array.isArray(market.outcomePrices)) {
      prices = market.outcomePrices.map(p =>
        typeof p === 'string' ? parseFloat(p) : p
      );
    }
  } catch {
    prices = [0, 0];
  }

  return {
    id: market.id,
    question: market.question,
    slug: market.slug,
    description: market.description || '',
    category: market.category || '',
    endDate: market.endDate,
    outcomes: market.outcomes || ['Yes', 'No'],
    prices,
    volume: market.volumeNum || parseFloat(market.volume) || 0,
    volume24hr: market.volume24hr || 0,
    liquidity: market.liquidityNum || parseFloat(market.liquidity) || 0,
    priceChange24h: market.oneDayPriceChange || 0,
    priceChange1h: market.oneHourPriceChange || 0,
    priceChange1w: market.oneWeekPriceChange || 0,
    active: market.active,
    closed: market.closed,
    yesPrice: prices[0] || 0,
    noPrice: prices[1] || 0,
    clobTokenIds: market.clobTokenIds || [],
  };
}

// Fetch all active markets
export async function fetchMarkets(limit = 100, offset = 0): Promise<Market[]> {
  const params = new URLSearchParams({
    active: 'true',
    closed: 'false',
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${GAMMA_API_BASE}/markets?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status}`);
  }

  return response.json();
}

// Fetch events (markets are often nested in events)
export async function fetchEvents(limit = 100, offset = 0): Promise<Market[]> {
  const params = new URLSearchParams({
    active: 'true',
    closed: 'false',
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${GAMMA_API_BASE}/events?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  const events = await response.json();

  // Flatten markets from events
  const markets: Market[] = [];
  for (const event of events) {
    if (event.markets) {
      markets.push(...event.markets);
    }
  }

  return markets;
}

// Tag IDs for Polymarket categories and specific tickers
const TAG_IDS = {
  STOCKS: '604',
  FINANCE: '120',
  EQUITIES: '102676',
  // Specific ticker tags (found via API exploration)
  AMZN: '102681',
};

// Fetch events by tag ID (e.g., for stocks)
export async function fetchEventsByTag(tagId: string, limit = 200): Promise<Event[]> {
  const params = new URLSearchParams({
    tag_id: tagId,
    active: 'true',
    closed: 'false',
    limit: limit.toString(),
  });

  const response = await fetch(`${GAMMA_API_BASE}/events?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch events by tag: ${response.status}`);
  }

  return response.json();
}

// Fetch events for a specific ticker by slug
export async function fetchEventsBySlugPattern(pattern: string): Promise<Event[]> {
  // Fetch events and filter by slug pattern
  const response = await fetch(`${GAMMA_API_BASE}/events?slug=${pattern}&active=true`);

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

// Fetch all stock market events including specific tickers
export async function fetchStockEvents(): Promise<Event[]> {
  // Fetch from specific ticker tags for more accurate results
  const [amznEvents, stockEvents] = await Promise.all([
    fetchEventsByTag(TAG_IDS.AMZN, 50),
    fetchEventsByTag(TAG_IDS.STOCKS, 500),
  ]);

  // Combine and deduplicate
  const eventMap = new Map<string, Event>();
  [...amznEvents, ...stockEvents].forEach(e => {
    eventMap.set(e.id, e);
  });

  return Array.from(eventMap.values());
}

// Search markets for a specific keyword (word boundary matching)
export function filterMarketsByKeyword(
  markets: Market[],
  keywords: string[],
  retailerName?: RetailerName
): Market[] {
  // Create regex patterns for whole word matching
  const patterns = keywords.map(k => new RegExp(`\\b${k}\\b`, 'i'));
  const exclusions = retailerName ? EXCLUSION_PATTERNS[retailerName] : [];

  return markets.filter(market => {
    const searchText = `${market.question} ${market.description || ''}`;

    // Check if any keyword matches
    const hasMatch = patterns.some(pattern => pattern.test(searchText));
    if (!hasMatch) return false;

    // Check exclusion patterns
    if (exclusions.some(exclusion => exclusion.test(searchText))) {
      return false;
    }

    return true;
  });
}

// Stock ticker patterns for retailers
const STOCK_TICKERS: Record<RetailerName, RegExp> = {
  walmart: /\bWMT\b|\bWalmart\b/i,
  amazon: /\bAMZN\b|\bAmazon\s*\(AMZN\)/i,
  costco: /\bCOST\b|\bCostco\b/i,
  target: /\bTGT\b|\bTarget\s*\(TGT\)/i,
};

// Get markets for all retailers
export async function fetchRetailerMarkets(): Promise<{
  walmart: ParsedMarket[];
  amazon: ParsedMarket[];
  costco: ParsedMarket[];
  target: ParsedMarket[];
  other: ParsedMarket[];
}> {
  // Fetch stock events using the Stocks tag (more reliable than general search)
  const [stockEvents, generalMarkets, generalEvents] = await Promise.all([
    fetchStockEvents(),
    fetchMarkets(200, 0),
    fetchEvents(200, 0),
  ]);

  const result = {
    walmart: [] as ParsedMarket[],
    amazon: [] as ParsedMarket[],
    costco: [] as ParsedMarket[],
    target: [] as ParsedMarket[],
    other: [] as ParsedMarket[],
  };

  // Process stock events - these contain the actual stock market predictions
  const processedEventIds = new Set<string>();
  for (const event of stockEvents) {
    const eventTitle = event.title || '';

    // Check which retailer this event belongs to
    for (const [retailer, pattern] of Object.entries(STOCK_TICKERS)) {
      if (pattern.test(eventTitle)) {
        // Add all markets from this event
        if (event.markets) {
          for (const market of event.markets) {
            if (market.active && !market.closed) {
              result[retailer as RetailerName].push(parseMarket(market));
              processedEventIds.add(market.id);
            }
          }
        }
        break;
      }
    }
  }

  // Also check general markets for non-stock retail mentions (e.g., "Will Walmart acquire TikTok")
  const allMarketsMap = new Map<string, Market>();
  [...generalMarkets, ...generalEvents].forEach(m => {
    if (!processedEventIds.has(m.id)) {
      allMarketsMap.set(m.id, m);
    }
  });
  const allMarkets = Array.from(allMarketsMap.values());

  for (const market of allMarkets) {
    const parsed = parseMarket(market);
    let categorized = false;

    for (const [retailer, keywords] of Object.entries(RETAILER_KEYWORDS)) {
      const matchedMarkets = filterMarketsByKeyword([market], keywords, retailer as RetailerName);
      if (matchedMarkets.length > 0) {
        result[retailer as RetailerName].push(parsed);
        categorized = true;
        break;
      }
    }

    // Add to "other" ONLY for actual company earnings markets (strict filtering)
    if (!categorized) {
      const question = market.question.toLowerCase();
      const category = (market.category || '').toLowerCase();
      // Must be in a financial category AND contain earnings-specific keywords
      const isFinancialCategory = category.includes('finance') ||
                                  category.includes('stocks') ||
                                  category.includes('equities') ||
                                  category.includes('economics');
      // Must contain explicit earnings language with company context
      const hasEarningsContext = (
        (question.includes('earnings') && (question.includes('beat') || question.includes('q1') || question.includes('q2') || question.includes('q3') || question.includes('q4') || question.includes('quarter'))) ||
        (question.includes('eps') && /\$?\d/.test(question)) ||
        (question.includes('revenue') && /\$?\d|billion|million/.test(question)) ||
        /\b(AAPL|GOOGL|GOOG|MSFT|AMZN|META|NVDA|TSLA|NFLX|AMD|INTC|JPM|BAC|GS|V|MA)\b/.test(market.question)
      );
      if (isFinancialCategory && hasEarningsContext) {
        result.other.push(parsed);
      }
    }
  }

  // Sort each retailer's markets by volume
  for (const retailer of Object.keys(result) as (keyof typeof result)[]) {
    result[retailer].sort((a, b) => b.volume - a.volume);
  }

  return result;
}

// Fetch earnings markets directly from Polymarket's earnings category
export async function fetchEarningsMarkets(): Promise<ParsedMarket[]> {
  // Use tag_slug=earnings to get markets from the official earnings category
  const response = await fetch(`${GAMMA_API_BASE}/events?tag_slug=earnings&active=true&closed=false&limit=50`);

  if (!response.ok) {
    console.warn(`Failed to fetch earnings events: ${response.status}`);
    return [];
  }

  const events: Event[] = await response.json();

  // Extract active markets from events
  const markets: ParsedMarket[] = [];
  for (const event of events) {
    if (event.markets) {
      for (const market of event.markets) {
        if (market.active && !market.closed) {
          markets.push(parseMarket(market));
        }
      }
    }
  }

  // Sort by volume and return top 25
  return markets
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 25);
}

// Fetch price history for a market token
export async function fetchPriceHistory(tokenId: string): Promise<PriceHistoryPoint[]> {
  try {
    const response = await fetch(`${CLOB_API_BASE}/prices-history?market=${tokenId}&interval=1d&fidelity=60`);

    if (!response.ok) {
      console.warn(`Failed to fetch price history for ${tokenId}: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data?.history) {
      return [];
    }

    return data.history.map((point: { t: number; p: number }) => ({
      timestamp: point.t,
      price: point.p,
    }));
  } catch (error) {
    console.warn(`Error fetching price history for ${tokenId}:`, error);
    return [];
  }
}

// Check if market has significant price movement
export function hasSignificantMovement(market: ParsedMarket, threshold = 0.1): boolean {
  return Math.abs(market.priceChange24h) >= threshold;
}

// Format price as percentage
export function formatProbability(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

// Format volume
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

// Get market consensus
export function getConsensus(price: number): 'likely' | 'unlikely' | 'uncertain' {
  if (price >= 0.7) return 'likely';
  if (price <= 0.3) return 'unlikely';
  return 'uncertain';
}
