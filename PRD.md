# Product Requirements Document
## Polymarket Retail Dashboard

---

## 1. Product Overview

The Polymarket Retail Dashboard is a real-time intelligence tool that aggregates prediction market data for major retail companies (Walmart, Amazon, Costco, and Target). It combines prediction market probabilities from Polymarket with live stock price data from Yahoo Finance, giving users a unified view of market sentiment alongside actual stock performance.

**Primary Focus:** Walmart (WMT) earnings and stock predictions
**Secondary Coverage:** Amazon (AMZN), Costco (COST), Target (TGT)

---

## 2. Core Features

### 2.1 Live Stock Ticker
A persistent ticker bar displaying real-time stock data for all four retail companies:
- Current stock price
- Price change (percentage and direction)
- Market capitalization
- Auto-refreshes every 5 minutes

### 2.2 Overview Tab
The default landing view providing a high-level snapshot:
- **Summary Stats:** Total active retail markets, combined retail trading volume, significant 24h price movements (>10%)
- **Walmart Markets Section:** Detailed view of all active Walmart prediction markets with expandable price history charts
- **Competitor Snapshot:** Compact cards for Amazon, Costco, and Target showing market count and top movers -- clickable to navigate to filtered detail views
- **Visual Charts:**
  - Market count comparison (horizontal bar chart by retailer)
  - Trading volume comparison (horizontal bar chart by retailer)

### 2.3 Walmart Earnings Tab
A dedicated section focused on Walmart's quarterly earnings predictions:
- **Active Markets:** Full-screen dashlets for each active earnings market showing:
  - Yes/No probability with confidence level
  - 24-hour price change
  - Trading volume
  - Market consensus indicator
  - Interactive probability chart with Walmart stock price overlay (5-day history)
- **Most Recently Resolved:** Clickable card showing the last completed earnings market with final outcome, volume, and end date -- links to Polymarket for full historical chart
- **Walmart Stock Chart:** Standalone 5-day WMT stock price chart with current price and period change (displayed when no active earnings markets exist)

### 2.4 All Earnings Tab
Top 25 earnings markets across all companies (by trading volume):
- Search functionality to filter by keyword
- Rank badges and "HOT" indicators for markets with significant movement
- Market cards with probability, volume, and price change data

### 2.5 All Retail Markets Tab
Comprehensive view of every active prediction market for all four retailers:
- **Filter by company:** Dropdown to view a single retailer or all
- **Full market detail:** Each market shows probability chart with stock price overlay, trading volume, and direct link to Polymarket

### 2.6 Interactive Price Charts
Each prediction market can display an interactive probability-over-time chart:
- Dual Y-axis: probability percentage (left) and stock price in dollars (right)
- Togglable stock price overlay using the retailer's brand color
- Tooltips showing exact probability and stock price at any point
- 50% reference line for quick visual assessment
- 5-day minimum data window

### 2.7 Clickable Dashboard Title
The "Polymarket Retail Dashboard" title in the header opens an informational popup explaining that prediction market data aggregates collective beliefs for improved forecasting and decision-making.

### 2.8 Auto-Refresh
All market data automatically refreshes every 2 minutes without requiring a page reload. Manual refresh is available via the header button.

---

## 3. Technical Challenges & API Notes

### 3.1 Polymarket Gamma API
**Base URL:** `https://gamma-api.polymarket.com`

This is the primary data source for prediction markets. Key challenges:

- **Finding relevant markets requires tag-based searching.** Markets are nested inside "events." Use `tag_id` parameter to filter by category:
  - `tag_id=604` for Stocks
  - `tag_id=1013` for Earnings
  - `tag_id=102681` for AMZN-specific events
- **Resolved markets are hard to find.** The API returns thousands of closed events. To find resolved Walmart earnings: use `tag_id=1013&order=endDate&ascending=false` and filter results by title pattern (regex for "WMT" or "Walmart"). Generic `closed=true` queries don't reliably surface specific company markets.
- **Market categorization requires regex matching.** The API doesn't tag markets by company. The dashboard uses keyword matching with exclusion patterns to avoid false positives (e.g., "Amazon MGM Studios" isn't Amazon retail, "target rate" isn't Target Corp).
- **Market data arrives as JSON strings.** Fields like `outcomePrices` and `clobTokenIds` come as stringified JSON arrays that need parsing.

### 3.2 Polymarket CLOB API
**Base URL:** `https://clob.polymarket.com`

Used for price history charts:

- **Endpoint:** `/prices-history?market={tokenId}&startTs={start}&endTs={end}&fidelity=60`
- **Critical limitation:** Price history is only available for active/open markets. Once a market resolves and closes, the CLOB API returns empty history. The Polymarket website uses internal data sources not exposed through the public API. For resolved markets, the dashboard links to Polymarket directly.
- **Token IDs are required**, not market IDs. Each market has `clobTokenIds` -- the first token is the "Yes" outcome.

### 3.3 Yahoo Finance API
**Base URL:** `https://query1.finance.yahoo.com/v8/finance/chart`

Used for stock price data and history:

- **Critical detail for intraday data:** The `range` parameter works far more reliably than `period1`/`period2` timestamps. Using `?range=5d&interval=1h` returns 5 trading days of hourly data. Using period timestamps with hourly intervals often returns only 1-2 days of data regardless of the range specified.
- **Market hours only:** Stock data is only available during trading hours. The dashboard uses a 3-day timestamp matching window (259200 seconds) to handle weekends and holidays when aligning stock prices to prediction market data points.
- **Market cap calculation:** Yahoo Finance doesn't directly provide market cap in this endpoint. The dashboard multiplies current price by a stored shares-outstanding value for each company.
- **Rate limiting:** Responses are cached for 5 minutes on the server side to avoid hitting rate limits.

### 3.4 Data Alignment Challenge
Prediction markets trade 24/7 but stock markets only operate during US business hours (weekdays). The dashboard must gracefully handle:
- Weekend gaps in stock data
- Holiday closures
- After-hours prediction market movements with no corresponding stock data

Solution: When overlaying stock prices onto probability charts, find the closest stock data point within a 3-day window for each prediction data point.

---

## 4. User Experience Requirements

| Requirement | Detail |
|---|---|
| Load time | Dashboard should render meaningful content within 3 seconds |
| Responsiveness | Mobile-first design, 2-column grid on tablet, full layout on desktop |
| Data freshness | Market data refreshes every 2 minutes automatically |
| Stock freshness | Stock ticker and charts refresh every 5 minutes |
| Error handling | Graceful fallbacks when APIs are unavailable (skeleton loaders, error messages) |
| Navigation | Tab-based navigation with clickable stat cards for cross-tab linking |
| External links | All "View on Polymarket" buttons open in new tabs |

---

## 5. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| UI | React, Tailwind CSS |
| Charts | Recharts (ComposedChart, dual Y-axis) |
| Data fetching | Server-side API routes with ISR caching |
| Deployment | Vercel |

---

## 6. Future Considerations

- **Price history for resolved markets:** Currently limited by the CLOB API. A caching layer could store price history before markets close.
- **Additional retailers:** The architecture supports adding new retailers by extending the keyword/color/ticker configurations.
- **Alerts/notifications:** Price movement alerts when prediction probabilities cross configurable thresholds.
- **Historical earnings accuracy:** Track how well prediction markets predicted actual earnings outcomes over time.
