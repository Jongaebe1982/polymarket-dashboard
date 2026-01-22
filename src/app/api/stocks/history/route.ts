import { NextResponse } from 'next/server';

// Stock symbols for our retail companies
const RETAIL_STOCKS: Record<string, string> = {
  walmart: 'WMT',
  amazon: 'AMZN',
  costco: 'COST',
  target: 'TGT',
};

export interface StockHistoryPoint {
  timestamp: number;
  price: number;
}

async function fetchYahooFinanceHistory(
  symbol: string,
  range: string = '5d'
): Promise<StockHistoryPoint[]> {
  try {
    // Yahoo Finance chart API with range parameter (more reliable than period1/period2 for intraday data)
    // Using range=5d with 1h interval gives us good coverage for 5 trading days
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1h`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.warn(`Failed to fetch history for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
      return [];
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    const history: StockHistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        history.push({
          timestamp: timestamps[i],
          price: closes[i],
        });
      }
    }

    return history;
  } catch (error) {
    console.error(`Error fetching history for ${symbol}:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const retailer = searchParams.get('retailer');
  const range = searchParams.get('range') || '5d'; // Default to 5 days

  if (!retailer || !RETAIL_STOCKS[retailer]) {
    return NextResponse.json(
      { error: 'Invalid or missing retailer parameter' },
      { status: 400 }
    );
  }

  const symbol = RETAIL_STOCKS[retailer];
  const history = await fetchYahooFinanceHistory(symbol, range);

  return NextResponse.json({
    symbol,
    retailer,
    history,
    range,
    timestamp: new Date().toISOString(),
  });
}
