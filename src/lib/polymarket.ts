import { Market, Event, ParsedMarket, PriceHistoryPoint, RETAILER_KEYWORDS, RetailerName, EXCLUSION_PATTERNS } from '@/types/market';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

// Parse market data from API response
export function parseMarket(market: Market, eventSlug?: string): ParsedMarket {
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

  // Parse clobTokenIds (also comes as JSON string array)
  let tokenIds: string[] = [];
  try {
    if (typeof market.clobTokenIds === 'string') {
      tokenIds = JSON.parse(market.clobTokenIds);
    } else if (Array.isArray(market.clobTokenIds)) {
      tokenIds = market.clobTokenIds;
    }
  } catch {
    tokenIds = [];
  }

  return {
    id: market.id,
    question: market.question,
    slug: market.slug,
    eventSlug: eventSlug || market.slug, // Use event slug if provided, otherwise fall back to market slug
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
    clobTokenIds: tokenIds,
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
  EARNINGS: '1013',
  // Specific ticker tags (found via API exploration)
  AMZN: '102681',
};

// Tag slugs for retailer-specific markets (more reliable than generic STOCKS tag)
const RETAILER_TAG_SLUGS: Record<RetailerName, string> = {
  walmart: 'wmt',
  amazon: 'amzn',
  costco: 'cost',
  target: 'tgt',
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

// Fetch events by tag slug (e.g., 'wmt', 'amzn', 'earnings')
export async function fetchEventsByTagSlug(tagSlug: string, limit = 100): Promise<Event[]> {
  const params = new URLSearchParams({
    tag_slug: tagSlug,
    active: 'true',
    closed: 'false',
    limit: limit.toString(),
  });

  const response = await fetch(`${GAMMA_API_BASE}/events?${params}`);

  if (!response.ok) {
    console.warn(`Failed to fetch events by tag slug ${tagSlug}: ${response.status}`);
    return [];
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
  // Fetch from multiple sources for comprehensive coverage:
  // 1. Retailer-specific tag slugs (wmt, amzn, cost, tgt) - most reliable for specific retailers
  // 2. Generic STOCKS tag as fallback
  // 3. AMZN tag ID for historical compatibility
  const [
    wmtEvents,
    amznSlugEvents,
    costEvents,
    tgtEvents,
    amznTagEvents,
    stockEvents,
  ] = await Promise.all([
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.walmart, 100),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.amazon, 100),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.costco, 100),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.target, 100),
    fetchEventsByTag(TAG_IDS.AMZN, 50),
    fetchEventsByTag(TAG_IDS.STOCKS, 500),
  ]);

  // Combine and deduplicate
  const eventMap = new Map<string, Event>();
  [...wmtEvents, ...amznSlugEvents, ...costEvents, ...tgtEvents, ...amznTagEvents, ...stockEvents].forEach(e => {
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

// Stock ticker patterns for retailers - used for matching event titles and market questions
const STOCK_TICKERS: Record<RetailerName, RegExp> = {
  walmart: /\bWMT\b|\bWalmart\b/i,
  amazon: /\bAMZN\b|\bAmazon\b/i,
  costco: /\bCOST\b|\bCostco\b/i,
  target: /\bTGT\b|\bTarget\b/i,
};

// Helper to check if text matches a retailer (with exclusion filtering)
function matchesRetailer(text: string, retailer: RetailerName): boolean {
  const pattern = STOCK_TICKERS[retailer];
  if (!pattern.test(text)) return false;

  // Check exclusion patterns
  const exclusions = EXCLUSION_PATTERNS[retailer];
  if (exclusions.some(exclusion => exclusion.test(text))) {
    return false;
  }

  return true;
}

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
    fetchMarkets(500, 0), // Increased limit to capture more markets
    fetchEvents(500, 0),  // Increased limit to capture more events
  ]);

  const result = {
    walmart: [] as ParsedMarket[],
    amazon: [] as ParsedMarket[],
    costco: [] as ParsedMarket[],
    target: [] as ParsedMarket[],
    other: [] as ParsedMarket[],
  };

  const processedMarketIds = new Set<string>();

  // Process stock events - check both event title AND individual market questions
  for (const event of stockEvents) {
    const eventTitle = event.title || '';

    if (event.markets) {
      for (const market of event.markets) {
        if (!market.active || market.closed) continue;

        const marketText = `${eventTitle} ${market.question} ${market.description || ''}`;

        // Check which retailer this market belongs to
        for (const retailer of ['walmart', 'amazon', 'costco', 'target'] as RetailerName[]) {
          if (matchesRetailer(marketText, retailer)) {
            result[retailer].push(parseMarket(market, event.slug));
            processedMarketIds.add(market.id);
            break;
          }
        }
      }
    }
  }

  // Process general events - check event title and market questions
  for (const event of generalEvents as unknown as Event[]) {
    if (!event.markets) continue;

    const eventTitle = event.title || '';

    for (const market of event.markets) {
      if (!market.active || market.closed || processedMarketIds.has(market.id)) continue;

      const marketText = `${eventTitle} ${market.question} ${market.description || ''}`;

      for (const retailer of ['walmart', 'amazon', 'costco', 'target'] as RetailerName[]) {
        if (matchesRetailer(marketText, retailer)) {
          result[retailer].push(parseMarket(market, event.slug));
          processedMarketIds.add(market.id);
          break;
        }
      }
    }
  }

  // Also check general markets (these come without event context)
  for (const market of generalMarkets) {
    if (!market.active || market.closed || processedMarketIds.has(market.id)) continue;

    const marketText = `${market.question} ${market.description || ''}`;

    for (const retailer of ['walmart', 'amazon', 'costco', 'target'] as RetailerName[]) {
      if (matchesRetailer(marketText, retailer)) {
        result[retailer].push(parseMarket(market));
        processedMarketIds.add(market.id);
        break;
      }
    }
  }

  // Sort each retailer's markets by volume and deduplicate
  for (const retailer of Object.keys(result) as (keyof typeof result)[]) {
    // Deduplicate by market ID
    const uniqueMarkets = new Map<string, ParsedMarket>();
    for (const market of result[retailer]) {
      if (!uniqueMarkets.has(market.id)) {
        uniqueMarkets.set(market.id, market);
      }
    }
    result[retailer] = Array.from(uniqueMarkets.values()).sort((a, b) => b.volume - a.volume);
  }

  return result;
}

// Fetch earnings markets directly from Polymarket's earnings category
export async function fetchEarningsMarkets(): Promise<ParsedMarket[]> {
  // Fetch from multiple sources to ensure comprehensive coverage:
  // 1. Official earnings tag_slug
  // 2. Earnings tag_id (1013)
  // 3. Retailer-specific tag slugs (many earnings markets are tagged by ticker)
  const [earningsSlugResponse, earningsTagResponse, wmtEvents, amznEvents, costEvents, tgtEvents] = await Promise.all([
    fetch(`${GAMMA_API_BASE}/events?tag_slug=earnings&active=true&closed=false&limit=100`),
    fetch(`${GAMMA_API_BASE}/events?tag_id=${TAG_IDS.EARNINGS}&active=true&closed=false&limit=100`),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.walmart, 50),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.amazon, 50),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.costco, 50),
    fetchEventsByTagSlug(RETAILER_TAG_SLUGS.target, 50),
  ]);

  const allEvents: Event[] = [];

  if (earningsSlugResponse.ok) {
    const events: Event[] = await earningsSlugResponse.json();
    allEvents.push(...events);
  }

  if (earningsTagResponse.ok) {
    const events: Event[] = await earningsTagResponse.json();
    allEvents.push(...events);
  }

  // Add retailer events (filter for earnings-related ones below)
  allEvents.push(...wmtEvents, ...amznEvents, ...costEvents, ...tgtEvents);

  // Deduplicate events by ID
  const eventMap = new Map<string, Event>();
  allEvents.forEach(e => eventMap.set(e.id, e));

  // Pattern to identify earnings markets
  const earningsPattern = /\b(earnings|eps|quarterly|revenue|beat|guidance|q[1-4]|fiscal)\b/i;

  // Extract active earnings markets from events
  const marketMap = new Map<string, ParsedMarket>();
  for (const event of eventMap.values()) {
    if (event.markets) {
      for (const market of event.markets) {
        if (market.active && !market.closed && !marketMap.has(market.id)) {
          // Check if it's an earnings-related market
          const searchText = `${event.title || ''} ${market.question}`;
          if (earningsPattern.test(searchText)) {
            marketMap.set(market.id, parseMarket(market, event.slug));
          }
        }
      }
    }
  }

  // Sort by volume and return top 25
  return Array.from(marketMap.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 25);
}

// Fetch resolved Walmart earnings markets
export async function fetchResolvedWalmartEarnings(): Promise<ParsedMarket[]> {
  try {
    const walmartPattern = /\bWMT\b|\bWalmart\b/i;
    const markets: ParsedMarket[] = [];

    // Use Earnings tag (id=1013) with order by endDate descending to find recent resolved markets
    // This is the most reliable way to find Walmart earnings markets
    // Include closed=true to fetch resolved (closed) markets
    const earningsResponse = await fetch(
      `${GAMMA_API_BASE}/events?tag_id=1013&order=endDate&ascending=false&limit=200&closed=true`
    );

    if (earningsResponse.ok) {
      const events: Event[] = await earningsResponse.json();
      for (const event of events) {
        const eventTitle = event.title || '';

        // Check if this is a Walmart event
        if (walmartPattern.test(eventTitle) && event.markets) {
          for (const market of event.markets) {
            // Only include closed markets
            if (market.closed) {
              markets.push(parseMarket(market, event.slug));
            }
          }
        }
      }
    }

    // Also try with Stocks tag as fallback
    if (markets.length === 0) {
      const stocksResponse = await fetch(
        `${GAMMA_API_BASE}/events?tag_id=604&order=endDate&ascending=false&limit=200&closed=true`
      );

      if (stocksResponse.ok) {
        const events: Event[] = await stocksResponse.json();
        for (const event of events) {
          const eventTitle = event.title || '';
          const question = event.markets?.[0]?.question?.toLowerCase() || '';

          // Check if this is a Walmart earnings event
          if (walmartPattern.test(eventTitle) && event.markets) {
            const isEarnings = question.includes('earnings') ||
                              question.includes('beat') ||
                              question.includes('eps');

            if (isEarnings) {
              for (const market of event.markets) {
                if (market.closed && !markets.find(m => m.id === market.id)) {
                  markets.push(parseMarket(market, event.slug));
                }
              }
            }
          }
        }
      }
    }

    // Sort by end date (most recent first) and return
    return markets.sort((a, b) => {
      const dateA = new Date(a.endDate).getTime();
      const dateB = new Date(b.endDate).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.warn('Error fetching resolved Walmart earnings:', error);
    return [];
  }
}

// Fetch price history for a market token (minimum 5 days)
export async function fetchPriceHistory(tokenId: string): Promise<PriceHistoryPoint[]> {
  try {
    // Calculate timestamp for 7 days ago to ensure we get at least 5 days of data
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const now = Math.floor(Date.now() / 1000);

    // Use startTs and endTs for a specific time range, with hourly fidelity for good resolution
    const response = await fetch(
      `${CLOB_API_BASE}/prices-history?market=${tokenId}&startTs=${sevenDaysAgo}&endTs=${now}&fidelity=60`
    );

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
