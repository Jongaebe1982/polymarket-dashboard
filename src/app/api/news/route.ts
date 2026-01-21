import { NextResponse } from 'next/server';

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  publishedAt: number; // Unix timestamp
  description?: string;
}

// Fetch news from Google News RSS feed
async function fetchGoogleNews(query: string): Promise<NewsArticle[]> {
  try {
    // Google News RSS feed URL
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.warn(`Failed to fetch news: ${response.status}`);
      return [];
    }

    const xml = await response.text();

    // Parse RSS XML
    const articles: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const item = match[1];

      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);

      const title = titleMatch ? (titleMatch[1] || titleMatch[2]) : '';
      const link = linkMatch ? linkMatch[1] : '';
      const pubDate = pubDateMatch ? pubDateMatch[1] : '';
      const source = sourceMatch ? sourceMatch[1] : 'Google News';
      const description = descMatch ? (descMatch[1] || descMatch[2]) : '';

      if (title && link) {
        articles.push({
          title: decodeHTMLEntities(title),
          link,
          source: decodeHTMLEntities(source),
          publishedAt: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
          description: description ? decodeHTMLEntities(description.replace(/<[^>]*>/g, '').substring(0, 200)) : undefined,
        });
      }
    }

    return articles.slice(0, 20); // Return top 20 articles
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

// Helper to decode HTML entities
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get('company') || 'walmart';
  const type = searchParams.get('type') || 'general';

  // Build search query based on company and type
  let query = '';

  if (company === 'walmart') {
    if (type === 'earnings') {
      query = 'Walmart earnings OR Walmart revenue OR Walmart quarterly results OR WMT stock';
    } else {
      query = 'Walmart stock OR Walmart news OR WMT';
    }
  } else if (company === 'amazon') {
    query = type === 'earnings' ? 'Amazon earnings OR Amazon revenue OR AMZN quarterly' : 'Amazon stock OR AMZN';
  } else if (company === 'costco') {
    query = type === 'earnings' ? 'Costco earnings OR Costco revenue OR COST quarterly' : 'Costco stock OR COST';
  } else if (company === 'target') {
    query = type === 'earnings' ? 'Target earnings OR Target revenue OR TGT quarterly' : 'Target stock OR TGT';
  } else {
    query = company;
  }

  const articles = await fetchGoogleNews(query);

  return NextResponse.json({
    articles,
    query,
    timestamp: new Date().toISOString(),
  });
}
