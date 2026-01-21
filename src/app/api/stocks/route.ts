import { NextResponse } from 'next/server';

// Stock symbols for our retail companies
const RETAIL_STOCKS = {
  walmart: 'WMT',
  amazon: 'AMZN',
  costco: 'COST',
  target: 'TGT',
};

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
}

async function fetchYahooFinanceData(symbol: string): Promise<StockData | null> {
  try {
    // Use Yahoo Finance API v8 endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return null;
    }

    const meta = result.meta;
    const price = meta.regularMarketPrice || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    // Get company name mapping
    const names: Record<string, string> = {
      WMT: 'Walmart',
      AMZN: 'Amazon',
      COST: 'Costco',
      TGT: 'Target',
    };

    return {
      symbol,
      name: names[symbol] || symbol,
      price,
      change,
      changePercent,
      marketCap: meta.marketCap || 0,
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    // Fetch all stocks in parallel
    const stockPromises = Object.values(RETAIL_STOCKS).map(symbol =>
      fetchYahooFinanceData(symbol)
    );

    const results = await Promise.all(stockPromises);

    // Filter out null results and create a map by symbol
    const stocks: Record<string, StockData> = {};
    results.forEach(stock => {
      if (stock) {
        stocks[stock.symbol.toLowerCase()] = stock;
      }
    });

    return NextResponse.json({
      stocks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}
