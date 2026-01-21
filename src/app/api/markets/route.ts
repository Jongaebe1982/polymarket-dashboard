import { NextResponse } from 'next/server';
import { fetchRetailerMarkets, fetchEarningsMarkets, fetchPriceHistory } from '@/lib/polymarket';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const tokenId = searchParams.get('tokenId');

  try {
    if (type === 'history' && tokenId) {
      const history = await fetchPriceHistory(tokenId);
      return NextResponse.json({ history });
    }

    if (type === 'earnings') {
      const earnings = await fetchEarningsMarkets();
      return NextResponse.json({ earnings });
    }

    // Default: fetch retailer markets
    const retailerMarkets = await fetchRetailerMarkets();
    const earningsMarkets = await fetchEarningsMarkets();

    return NextResponse.json({
      retailers: retailerMarkets,
      earnings: earningsMarkets,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
