'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, BarChart3, Target, ChevronDown, ChevronUp, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, LineChart, Globe, Database, FileText, Radio, Radar, AlertCircle, X, RotateCcw, DollarSign, Activity, TrendingDown, Beaker, Sparkles, Banknote, Calendar } from 'lucide-react';

// ============================================
// API CONFIGURATION
// ============================================
const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_KEY || '';
const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY || '';
const GROK_KEY = process.env.NEXT_PUBLIC_GROK_KEY || '';

const SESSIONS_KEY = 'valuehunter_sessions';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const MIN_MARKET_CAP = 40_000_000;
const MAX_MARKET_CAP = 400_000_000;

// Stock limit options
const STOCK_LIMITS = {
  100: '100 stocks',
  500: '500 stocks',
  1000: '1000 stocks',
  0: 'All stocks'
};

// Simple category filters
const STOCK_CATEGORIES = {
  all: { name: 'All Stocks', keywords: [] },
  tech: { name: 'Tech', keywords: ['software', 'computer', 'semiconductor', 'electronic', 'technology', 'data processing', 'internet', 'cloud', 'cyber', 'digital'] },
  social: { name: 'Social Media', keywords: ['social', 'media', 'advertising', 'digital media', 'internet', 'platform', 'network', 'communication'] },
  familiar: { name: 'Consumer/Familiar', keywords: ['retail', 'restaurant', 'food', 'beverage', 'apparel', 'consumer', 'entertainment', 'hotel', 'leisure', 'gaming'] },
  biotech: { name: 'Biotech/Health', keywords: ['biotech', 'pharmaceutical', 'medical', 'drug', 'health', 'therapeutic', 'diagnostic', 'surgical'] },
  finance: { name: 'Finance', keywords: ['bank', 'financial', 'insurance', 'investment', 'loan', 'credit', 'capital'] },
  energy: { name: 'Energy', keywords: ['oil', 'gas', 'energy', 'solar', 'wind', 'petroleum', 'mining', 'utilities'] },
  solar: { name: 'Solar Supply Chain', keywords: [], aiTagged: true },
  batteries: { name: 'Batteries Supply Chain', keywords: [], aiTagged: true },
  robotics: { name: 'Robotics Supply Chain', keywords: [], aiTagged: true },
};

const discoveryAgents = [
  { id: 'polygonScreener', name: 'Polygon Screener', icon: Database, color: '#8B5CF6', coverage: 'All US stocks' },
  { id: 'marketCapFilter', name: 'Market Cap Filter', icon: DollarSign, color: '#3B82F6', coverage: '$40M - $400M' },
  { id: 'technicalScanner', name: 'Technical Scanner', icon: Activity, color: '#F59E0B', coverage: '52-week analysis' },
  { id: 'insiderScanner', name: 'Insider Scanner', icon: Users, color: '#10B981', coverage: 'SEC Form 4' },
  { id: 'financialScanner', name: 'Financial Scanner', icon: Banknote, color: '#EC4899', coverage: 'Cash & Debt' },
];

const analysisAgents = [
  { id: 'pricePosition', name: 'Price Position', desc: '52-week range position', icon: Target, color: '#3B82F6' },
  { id: 'insiderActivity', name: 'Insider Activity', desc: 'Recent insider purchases', icon: Users, color: '#10B981' },
  { id: 'netCash', name: 'Net Cash', desc: 'Cash minus debt', icon: Banknote, color: '#8B5CF6' },
];

// ============================================
// API FUNCTIONS
// ============================================

async function getFilteredTickers(stockLimit = 0) {
  const tickers = [];
  let nextUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${POLYGON_KEY}`;
  let pageCount = 0;
  const maxPages = stockLimit > 0 && stockLimit <= 500 ? 5 : stockLimit <= 1000 ? 10 : 100;
  
  while (nextUrl && pageCount < maxPages) {
    const res = await fetch(nextUrl);
    if (!res.ok) throw new Error(`Polygon API error: ${res.status}`);
    const data = await res.json();
    
    if (data.results) {
      const filtered = data.results.filter(t => 
        t.market === 'stocks' &&
        t.type === 'CS' &&
        (t.primary_exchange === 'XNYS' || t.primary_exchange === 'XNAS') &&
        !t.ticker.includes('.') &&
        !t.ticker.includes('-')
      );
      tickers.push(...filtered);
      
      if (stockLimit > 0 && tickers.length >= stockLimit) {
        return tickers.slice(0, stockLimit);
      }
    }
    
    nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLYGON_KEY}` : null;
    pageCount++;
    await new Promise(r => setTimeout(r, 250));
  }
  
  return stockLimit > 0 ? tickers.slice(0, stockLimit) : tickers;
}

async function getTickerDetails(ticker) {
  try {
    const res = await fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results || null;
  } catch (e) { return null; }
}

async function getPrevDay(ticker) {
  try {
    const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  } catch (e) { return null; }
}

async function get52WeekData(ticker) {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=desc&limit=260&apiKey=${POLYGON_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (e) { return []; }
}

// Enhanced financials - try multiple sources
async function getFinancials(ticker) {
  // Try Polygon financials first
  try {
    const res = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&limit=4&sort=filing_date&order=desc&apiKey=${POLYGON_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      
      // Try each quarterly report
      for (const results of (data.results || [])) {
        if (results?.financials) {
          const bs = results.financials.balance_sheet || {};
          
          // Try many different field names
          const cash = 
            bs.cash_and_cash_equivalents?.value ||
            bs.cash_and_short_term_investments?.value ||
            bs.cash?.value ||
            bs.current_assets?.value * 0.3 || // Estimate 30% of current assets
            0;
          
          const debt = 
            bs.long_term_debt?.value ||
            bs.total_debt?.value ||
            bs.short_long_term_debt_total?.value ||
            bs.noncurrent_liabilities?.value ||
            bs.total_liabilities?.value * 0.5 || // Estimate 50% of liabilities
            0;
          
          if (cash > 0 || debt > 0) {
            return { cash, debt, netCash: cash - debt, source: 'polygon' };
          }
        }
      }
    }
  } catch (e) { 
    console.warn(`Polygon financials failed for ${ticker}:`, e);
  }
  
  // Try Finnhub basic financials
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      const m = data.metric || {};
      
      // Calculate from available metrics
      const sharesOut = m.shareOutstanding || 0; // in millions
      const cashPerShare = m.cashPerShareAnnual || m.cashPerShareQuarterly || 0;
      const bookValue = m.bookValuePerShareAnnual || m.bookValuePerShareQuarterly || 0;
      const debtEquity = m.totalDebtToEquityAnnual || m.totalDebtToEquityQuarterly || 0;
      
      if (sharesOut > 0 && (cashPerShare > 0 || debtEquity > 0)) {
        const cash = cashPerShare * sharesOut * 1000000;
        const equity = bookValue * sharesOut * 1000000;
        const debt = equity * (debtEquity / 100);
        
        return { cash, debt, netCash: cash - debt, source: 'finnhub' };
      }
      
      // Alternative: use current ratio
      const currentRatio = m.currentRatioAnnual || m.currentRatioQuarterly;
      const quickRatio = m.quickRatioAnnual || m.quickRatioQuarterly;
      
      if (currentRatio && sharesOut > 0) {
        // Rough estimate based on ratios
        const marketCap = m.marketCapitalization || 0; // in millions
        const estCash = marketCap * 0.1 * 1000000; // Assume 10% of market cap
        const estDebt = marketCap * (1 / currentRatio) * 0.3 * 1000000;
        
        if (estCash > 0) {
          return { cash: estCash, debt: estDebt, netCash: estCash - estDebt, source: 'finnhub-est' };
        }
      }
    }
  } catch (e) {
    console.warn(`Finnhub metrics failed for ${ticker}:`, e);
  }
  
  return null;
}

// Insider transactions
async function getInsiderTransactions(ticker) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    
    if (!data.data || data.data.length === 0) return null;
    
    // Filter for open market purchases only
    const purchases = data.data.filter(t => {
      const isPurchase = t.transactionCode === 'P';
      return isPurchase && t.share > 0 && t.transactionDate;
    });
    
    if (purchases.length === 0) return null;
    
    purchases.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
    
    const latest = purchases[0];
    const pricePerShare = latest.transactionPrice || 0;
    const shares = latest.share || 0;
    const totalValue = shares * pricePerShare;
    
    return {
      date: latest.transactionDate,
      amount: totalValue,
      shares: shares,
      price: pricePerShare,
      name: latest.name || 'Insider',
    };
  } catch (e) { 
    return null; 
  }
}

// ============================================
// GROK AI ANALYSIS - Deep analysis focused on future potential
// ============================================
async function getAIAnalysis(stock) {
  console.log(`Starting Grok AI analysis for ${stock.ticker}...`);
  
  try {
    // Calculate price position metrics for cup & handle analysis
    const priceRange = stock.high52 - stock.low52;
    const currentPosition = ((stock.price - stock.low52) / priceRange * 100).toFixed(1);
    
    const prompt = `Analyze ${stock.ticker} (${stock.name}) for a value investor seeking 50-200%+ gains.

STOCK DATA:
- Current Price: $${stock.price?.toFixed(2)}
- Market Cap: $${stock.marketCap}M
- 52-Week Low: $${stock.low52?.toFixed(2)}
- 52-Week High: $${stock.high52?.toFixed(2)}
- Current position: ${currentPosition}% of 52-week range (0% = at low, 100% = at high)
- Distance from low: +${stock.fromLow?.toFixed(1)}%
- Net Cash: ${stock.netCash ? '$' + (stock.netCash / 1000000).toFixed(1) + 'M' : 'Unknown'}
- Last Insider Buy: ${stock.lastInsiderPurchase?.date ? stock.lastInsiderPurchase.date + ' ($' + Math.round(stock.lastInsiderPurchase.amount).toLocaleString() + ')' : 'None found'}

ANALYZE THESE 4 AREAS:

1. UPSIDE POTENTIAL: What catalysts could drive major gains? Earnings, contracts, FDA, M&A?

2. INSIDER CONVICTION: What percentage do insiders own? Have they been buying recently?

3. CUP AND HANDLE PATTERN ANALYSIS:
Look at the price data carefully. A perfect cup and handle has:
- A rounded "U" shaped bottom (not V-shaped) forming the cup
- Price recovered 50-100% of the prior decline
- A small pullback forming the handle (10-15% from cup high)
- Handle should be in upper half of the cup
- Current price near the breakout point (top of cup)

Based on the data: The stock is at ${currentPosition}% of its 52-week range, ${stock.fromLow?.toFixed(1)}% above its low.

Rate how well this fits a cup and handle pattern from 0-100:
- 0-20: No cup and handle pattern present
- 21-40: Vague resemblance but missing key elements  
- 41-60: Partial pattern, some elements present
- 61-80: Good cup and handle forming, most elements present
- 81-100: Textbook cup and handle, ready for breakout

4. KEY RISKS: What could go wrong?

Write 4-6 sentences analysis. Plain text only.

END WITH EXACTLY THESE THREE LINES:
UPSIDE_PCT: [number from -50 to 200]
INSIDER_CONVICTION: [number from 0 to 100]
CUP_HANDLE_SCORE: [number from 0 to 100]`;

    const response = await fetch("/api/grok", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt })
    });

    console.log(`Grok API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Grok API error:`, errorData);
      return { analysis: `API Error: ${errorData.error || response.status}`, insiderConviction: null, upsidePct: null, cupHandleScore: null };
    }

    const data = await response.json();
    console.log(`Grok returned - upside: ${data.upsidePct}, conviction: ${data.insiderConviction}, cupHandleScore: ${data.cupHandleScore}`);
    
    if (data.analysis) {
      return { 
        analysis: data.analysis, 
        insiderConviction: data.insiderConviction,
        upsidePct: data.upsidePct,
        cupHandleScore: data.cupHandleScore
      };
    }
    
    return { analysis: data.error || 'No response from AI', insiderConviction: null, upsidePct: null, cupHandleScore: null };
  } catch (e) {
    console.error('Grok AI analysis failed:', e);
    return { analysis: `Error: ${e.message}`, insiderConviction: null, upsidePct: null, cupHandleScore: null };
  }
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = prices[i - 1] - prices[i];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function processStock(ticker, details, prevDay, historicalData, financials, insiderData, idx) {
  const currentPrice = prevDay?.c || 0;
  const prices = historicalData.map(d => d.c);
  
  const high52 = prices.length > 0 ? Math.max(...prices) : currentPrice;
  const low52 = prices.length > 0 ? Math.min(...prices) : currentPrice;
  const range52 = high52 - low52;
  const positionIn52Week = range52 > 0 ? ((currentPrice - low52) / range52) * 100 : 50;
  const fromLow = low52 > 0 ? ((currentPrice - low52) / low52) * 100 : 0;
  
  const rsi = calculateRSI(prices);
  const change = prevDay?.o ? ((currentPrice - prevDay.o) / prevDay.o) * 100 : 0;
  const marketCapM = Math.round((details?.market_cap || 0) / 1_000_000);
  
  const cash = financials?.cash || 0;
  const debt = financials?.debt || 0;
  const netCash = financials?.netCash || 0;
  
  const pricePositionScore = Math.max(0, Math.min(100, 100 - positionIn52Week));
  
  let insiderScore = 20;
  if (insiderData?.date) {
    const daysSincePurchase = Math.floor((Date.now() - new Date(insiderData.date)) / (1000 * 60 * 60 * 24));
    if (daysSincePurchase < 30) insiderScore = 95;
    else if (daysSincePurchase < 60) insiderScore = 85;
    else if (daysSincePurchase < 90) insiderScore = 70;
    else if (daysSincePurchase < 180) insiderScore = 55;
    else if (daysSincePurchase < 365) insiderScore = 40;
  }
  
  let netCashScore = 50;
  if (financials) {
    if (netCash > 0) {
      const cashToMarketCap = (netCash / 1000000) / marketCapM;
      netCashScore = Math.min(100, 50 + cashToMarketCap * 100);
    } else if (netCash < 0) {
      const debtToMarketCap = Math.abs(netCash / 1000000) / marketCapM;
      netCashScore = Math.max(0, 50 - debtToMarketCap * 50);
    }
  }
  
  return {
    id: idx + 1,
    ticker,
    name: details?.name || ticker,
    sector: details?.sic_description || 'Unknown',
    price: currentPrice,
    marketCap: marketCapM,
    change,
    high52, low52, positionIn52Week, fromLow, rsi,
    cash, debt, netCash,
    hasFinancials: financials !== null,
    financialSource: financials?.source || null,
    lastInsiderPurchase: insiderData,
    hasInsiderData: insiderData !== null,
    priceTarget: null, // Will be filled in separately
    agentScores: {
      pricePosition: pricePositionScore,
      insiderActivity: insiderScore,
      netCash: netCashScore,
    },
    compositeScore: 0,
    aiAnalysis: null,
  };
}

// Session management functions
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function saveSession(sessionId, stocks, scanStats, name = null) {
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}');
    sessions[sessionId] = {
      id: sessionId,
      name: name || new Date().toLocaleString(),
      timestamp: Date.now(),
      stocks,
      scanStats,
      stockCount: stocks.length
    };
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    localStorage.setItem('valuehunter_current_session', sessionId);
  } catch (e) { console.warn('Session save failed:', e); }
}

function loadSession(sessionId) {
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}');
    return sessions[sessionId] || null;
  } catch (e) { return null; }
}

function loadCurrentSession() {
  try {
    const currentId = localStorage.getItem('valuehunter_current_session');
    if (!currentId) return null;
    return loadSession(currentId);
  } catch (e) { return null; }
}

function getAllSessions() {
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}');
    return Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) { return []; }
}

function deleteSession(sessionId) {
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '{}');
    delete sessions[sessionId];
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) { console.warn('Session delete failed:', e); }
}

function formatCacheAge(ms) {
  if (!ms) return '';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m ago` : `${mins}m ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) return 'N/A';
  if (amount === 0) return '$0';
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (absAmount >= 1000000000) return `${sign}$${(absAmount / 1000000000).toFixed(1)}B`;
  if (absAmount >= 1000000) return `${sign}$${(absAmount / 1000000).toFixed(1)}M`;
  if (absAmount >= 1000) return `${sign}$${(absAmount / 1000).toFixed(0)}K`;
  return `${sign}$${absAmount.toFixed(0)}`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function StockResearchApp() {
  const [stocks, setStocks] = useState([]);
  const [weights, setWeights] = useState({
    pricePosition: 40,
    insiderActivity: 40,
    netCash: 20,
  });
  const [selected, setSelected] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [isScanningSupplyChain, setIsScanningSupplyChain] = useState(false);
  const [isRunningFullSpectrum, setIsRunningFullSpectrum] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showFullSpectrumModal, setShowFullSpectrumModal] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
  const [discoveryStatus, setDiscoveryStatus] = useState(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
  const [sortBy, setSortBy] = useState('compositeScore');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [hideNetCashNegative, setHideNetCashNegative] = useState(false);
  const [supplyChainProgress, setSupplyChainProgress] = useState({ current: 0, total: 0 });
  
  // Session management
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  
  // Scan settings
  const [stockLimit, setStockLimit] = useState(100);
  
  // Full spectrum scan settings
  const [spectrumSettings, setSpectrumSettings] = useState({
    baseStockLimit: 500,
    supplyChainEnabled: true,
    grokEnabled: true,
    grokCount: 25
  });

  // Filter by category keywords or AI tags
  const matchesCategory = (stock, categoryKey) => {
    if (categoryKey === 'all') return true;
    const category = STOCK_CATEGORIES[categoryKey];
    if (!category) return true;
    
    // AI-tagged categories (supply chain)
    if (category.aiTagged) {
      if (categoryKey === 'solar') return stock.supplyChain?.solar === true;
      if (categoryKey === 'batteries') return stock.supplyChain?.batteries === true;
      if (categoryKey === 'robotics') return stock.supplyChain?.robotics === true;
      return false;
    }
    
    // Keyword-based categories
    const sectorLower = (stock.sector || '').toLowerCase();
    const nameLower = (stock.name || '').toLowerCase();
    return category.keywords.some(kw => sectorLower.includes(kw) || nameLower.includes(kw));
  };
  const [lastUpdate, setLastUpdate] = useState(null);
  const [status, setStatus] = useState({ type: 'ready', msg: 'Loading...' });
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ phase: '', current: 0, total: 0, found: 0 });
  const [cacheAge, setCacheAge] = useState(null);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [aiAnalyzeCount, setAiAnalyzeCount] = useState(10);
  const [aiWeights, setAiWeights] = useState({
    conviction: 20,
    upside: 20,
    cupHandle: 20
  });
  const [fullSpectrumPhase, setFullSpectrumPhase] = useState('');

  const calcScores = useCallback((list, w, aiW) => {
    const aw = aiW || { conviction: 20, upside: 20, cupHandle: 20 };
    
    // Calculate total weight (base + AI)
    const baseTotal = Object.values(w).reduce((a, b) => a + b, 0);
    const aiTotal = aw.conviction + aw.upside + aw.cupHandle;
    const grandTotal = baseTotal + aiTotal;
    
    // If all weights are 0, just return unsorted
    if (grandTotal === 0) {
      return list.map(s => ({ ...s, compositeScore: 50 }));
    }
    
    return list.map(s => {
      let score = 0;
      
      // Base scores (pricePosition, insiderActivity, netCash)
      if (baseTotal > 0) {
        Object.keys(w).forEach(id => { 
          if (s.agentScores?.[id] !== undefined && w[id] > 0) {
            // Each component contributes proportionally to its weight
            score += (s.agentScores[id] / 100) * (w[id] / grandTotal) * 100;
          }
        });
      }
      
      // AI scores - Conviction (0-100 scale)
      if (aw.conviction > 0 && s.insiderConviction !== null && s.insiderConviction !== undefined) {
        score += (s.insiderConviction / 100) * (aw.conviction / grandTotal) * 100;
      }
      
      // AI scores - Upside (normalize: 100%+ upside = max score)
      if (aw.upside > 0 && s.upsidePct !== null && s.upsidePct !== undefined) {
        const upsideNormalized = Math.max(0, Math.min(s.upsidePct / 100, 1)); // 0-100% maps to 0-1
        score += upsideNormalized * (aw.upside / grandTotal) * 100;
      }
      
      // AI scores - Cup & Handle (0-100 scale now)
      if (aw.cupHandle > 0 && s.cupHandleScore !== null && s.cupHandleScore !== undefined) {
        score += (s.cupHandleScore / 100) * (aw.cupHandle / grandTotal) * 100;
      }
      
      return { ...s, compositeScore: Math.min(100, Math.max(0, score)) };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, []);

  useEffect(() => {
    // Load sessions list
    setSessions(getAllSessions());
    
    // Try to load current session
    const currentSession = loadCurrentSession();
    if (currentSession && currentSession.stocks?.length > 0) {
      const scored = calcScores(currentSession.stocks, weights, aiWeights);
      setStocks(scored);
      setCurrentSessionId(currentSession.id);
      setLastUpdate(new Date(currentSession.timestamp));
      setCacheAge(Date.now() - currentSession.timestamp);
      setStatus({ type: 'cached', msg: `${currentSession.stocks.length} stocks (${currentSession.name})` });
      setScanProgress(currentSession.scanStats || { phase: 'complete', current: 0, total: 0, found: currentSession.stocks.length });
    } else {
      setStatus({ type: 'ready', msg: 'Click Run Base Scan' });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentSessionId) {
        const session = loadSession(currentSessionId);
        if (session) setCacheAge(Date.now() - session.timestamp);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [currentSessionId]);

  // Separate Grok AI Analysis function - analyzes in current visible order
  const runGrokAnalysis = async (stocksInOrder) => {
    if (isAnalyzingAI || stocks.length === 0) return;
    
    setIsAnalyzingAI(true);
    setError(null);
    
    // Use the passed-in order (from sorted/filtered view), or fall back to stocks
    const orderedStocks = stocksInOrder || stocks;
    
    // Use aiAnalyzeCount, or all stocks if set to 0
    const countToAnalyze = aiAnalyzeCount === 0 ? orderedStocks.length : Math.min(aiAnalyzeCount, orderedStocks.length);
    const stocksToAnalyze = orderedStocks.slice(0, countToAnalyze);
    setAiProgress({ current: 0, total: stocksToAnalyze.length });
    
    let updatedStocks = [...stocks];
    
    for (let i = 0; i < stocksToAnalyze.length; i++) {
      setAiProgress({ current: i + 1, total: stocksToAnalyze.length });
      setStatus({ type: 'loading', msg: `Grok analyzing ${stocksToAnalyze[i].ticker} (${i + 1}/${stocksToAnalyze.length})...` });
      
      const result = await getAIAnalysis(stocksToAnalyze[i]);
      
      updatedStocks = updatedStocks.map(s => 
        s.ticker === stocksToAnalyze[i].ticker ? { 
          ...s, 
          aiAnalysis: result.analysis,
          insiderConviction: result.insiderConviction,
          upsidePct: result.upsidePct,
          cupHandleScore: result.cupHandleScore
        } : s
      );
      setStocks(updatedStocks);
      
      // Rate limit - wait 2 seconds between calls
      if (i < stocksToAnalyze.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    // Recalculate scores with new AI data
    const reScored = calcScores(updatedStocks, weights, aiWeights);
    setStocks(reScored);
    
    // Save to current session
    const scanStats = { phase: 'complete', current: scanProgress.total, total: scanProgress.total, found: reScored.length };
    if (currentSessionId) {
      saveSession(currentSessionId, reScored, scanStats);
      setSessions(getAllSessions());
    }
    
    setIsAnalyzingAI(false);
    setAiProgress({ current: 0, total: 0 });
    setStatus({ type: 'live', msg: `${stocks.length} stocks • AI analysis complete` });
  };

  // Batch scan for supply chain categorization (20 stocks at a time)
  const runSupplyChainScan = async () => {
    if (isScanningSupplyChain || stocks.length === 0) return;
    
    setIsScanningSupplyChain(true);
    setError(null);
    
    const batchSize = 20;
    const totalBatches = Math.ceil(stocks.length / batchSize);
    setSupplyChainProgress({ current: 0, total: stocks.length });
    
    let updatedStocks = [...stocks];
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const startIdx = batch * batchSize;
      const batchStocks = stocks.slice(startIdx, startIdx + batchSize);
      
      setSupplyChainProgress({ current: startIdx, total: stocks.length });
      setStatus({ type: 'loading', msg: `Categorizing supply chains... ${startIdx}/${stocks.length}` });
      
      // Build batch prompt
      const stockList = batchStocks.map(s => `${s.ticker}: ${s.name} (${s.sector || 'Unknown sector'})`).join('\n');
      
      const prompt = `Categorize these ${batchStocks.length} stocks into supply chains. For EACH stock, determine if it belongs to:
- SOLAR: Solar energy, solar panels, inverters, solar installation, photovoltaic, solar materials
- BATTERIES: Batteries, lithium, energy storage, EV batteries, battery materials, battery tech
- ROBOTICS: Robotics, automation, AI hardware, industrial robots, drones, autonomous systems

Stocks:
${stockList}

Respond with ONLY a JSON array, no other text. Each object must have ticker and boolean fields:
[{"ticker":"ABC","solar":false,"batteries":true,"robotics":false},{"ticker":"XYZ","solar":true,"batteries":false,"robotics":false}]`;

      try {
        const response = await fetch("/api/grok", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt })
        });
        
        if (response.ok) {
          const data = await response.json();
          // Try to parse JSON from response
          let categories = [];
          try {
            // Find JSON array in response
            const jsonMatch = data.analysis.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              categories = JSON.parse(jsonMatch[0]);
            }
          } catch (e) {
            console.warn('Failed to parse supply chain response:', e);
          }
          
          // Update stocks with supply chain tags
          categories.forEach(cat => {
            updatedStocks = updatedStocks.map(s => 
              s.ticker === cat.ticker ? {
                ...s,
                supplyChain: {
                  solar: cat.solar || false,
                  batteries: cat.batteries || false,
                  robotics: cat.robotics || false
                }
              } : s
            );
          });
          
          setStocks(updatedStocks);
        }
      } catch (e) {
        console.error('Supply chain batch failed:', e);
      }
      
      // Small delay between batches
      if (batch < totalBatches - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    // Save updated stocks to current session
    const scanStats = { phase: 'complete', current: scanProgress.total, total: scanProgress.total, found: updatedStocks.length };
    if (currentSessionId) {
      saveSession(currentSessionId, updatedStocks, scanStats);
    }
    
    setIsScanningSupplyChain(false);
    setSupplyChainProgress({ current: 0, total: 0 });
    setStatus({ type: 'live', msg: `${stocks.length} stocks • Supply chain scan complete` });
  };

  const runBaseScan = async () => {
    if (isScanning) return;
    
    if (!POLYGON_KEY) {
      setError('Polygon API key not configured. Add NEXT_PUBLIC_POLYGON_KEY to Vercel environment variables.');
      return;
    }

    // Start new session
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    
    setIsScanning(true);
    setError(null);
    setStocks([]);
    const startTime = Date.now();

    try {
      const limitText = stockLimit === 0 ? 'all' : stockLimit;
      setStatus({ type: 'loading', msg: `Fetching ${limitText} stocks...` });
      setScanProgress({ phase: 'Loading tickers...', current: 0, total: 0, found: 0 });
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'running' }));
      
      const allTickers = await getFilteredTickers(stockLimit);
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'complete', marketCapFilter: 'running' }));
      
      setScanProgress({ phase: 'Filtering by market cap...', current: 0, total: allTickers.length, found: 0 });

      const qualifiedTickers = [];
      
      for (let i = 0; i < allTickers.length; i++) {
        const t = allTickers[i];
        const details = await getTickerDetails(t.ticker);
        
        if (details?.market_cap && details.market_cap >= MIN_MARKET_CAP && details.market_cap <= MAX_MARKET_CAP) {
          qualifiedTickers.push({ ticker: t.ticker, details });
          setScanProgress(p => ({ ...p, found: qualifiedTickers.length }));
        }
        
        setScanProgress(p => ({ ...p, current: i + 1 }));
        
        if (i % 20 === 0) {
          setStatus({ type: 'loading', msg: `Market cap filter: ${i}/${allTickers.length} (${qualifiedTickers.length} qualify)` });
        }
        
        await new Promise(r => setTimeout(r, 220));
      }

      setDiscoveryStatus(p => ({ ...p, marketCapFilter: 'complete', technicalScanner: 'running', insiderScanner: 'running', financialScanner: 'running' }));
      
      setScanProgress({ phase: 'Fetching detailed data...', current: 0, total: qualifiedTickers.length, found: qualifiedTickers.length });
      
      const processedStocks = [];
      
      for (let i = 0; i < qualifiedTickers.length; i++) {
        const { ticker, details } = qualifiedTickers[i];
        
        const [prevDay, historicalData, financials, insiderData] = await Promise.all([
          getPrevDay(ticker),
          get52WeekData(ticker),
          getFinancials(ticker),
          getInsiderTransactions(ticker),
        ]);
        
        if (prevDay && historicalData.length > 20) {
          const processed = processStock(ticker, details, prevDay, historicalData, financials, insiderData, processedStocks.length);
          processedStocks.push(processed);
          
          if (processedStocks.length % 5 === 0) {
            setStocks(calcScores([...processedStocks], weights, aiWeights));
          }
        }
        
        setScanProgress(p => ({ ...p, current: i + 1, phase: `Analyzing ${ticker}...` }));
        
        if (i % 5 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          setStatus({ type: 'loading', msg: `${processedStocks.length} stocks analyzed (${elapsed}s)` });
        }
        
        await new Promise(r => setTimeout(r, 450));
      }

      const scoredStocks = calcScores(processedStocks, weights, aiWeights);
      setStocks(scoredStocks);

      setDiscoveryStatus(p => ({ ...p, technicalScanner: 'complete', insiderScanner: 'complete', financialScanner: 'complete' }));
      
      for (const a of analysisAgents) {
        setAnalysisStatus(p => ({ ...p, [a.id]: 'complete' }));
      }

      const scanStats = { phase: 'complete', current: allTickers.length, total: allTickers.length, found: scoredStocks.length };
      
      // Save to session
      const sessionName = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} (${scoredStocks.length} stocks)`;
      saveSession(newSessionId, scoredStocks, scanStats, sessionName);
      setSessions(getAllSessions());
      
      setLastUpdate(new Date());
      setCacheAge(0);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      setStatus({ type: 'live', msg: `${scoredStocks.length} small-caps found (${totalTime}s)` });
      setScanProgress(scanStats);

    } catch (err) {
      console.error('Scan error:', err);
      setError(`Scan failed: ${err.message}`);
      setStatus({ type: 'error', msg: 'Scan failed' });
    }

    setIsScanning(false);
    setTimeout(() => {
      setDiscoveryStatus(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
      setAnalysisStatus(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
    }, 3000);
  };

  // Full Spectrum Scan - runs all scans in sequence
  const runFullSpectrumScan = async () => {
    if (isScanning || isAnalyzingAI || isScanningSupplyChain) return;
    
    setShowFullSpectrumModal(false);
    setIsRunningFullSpectrum(true);
    
    try {
      // Phase 1: Base Scan
      setFullSpectrumPhase('Running Base Scan...');
      const originalStockLimit = stockLimit;
      setStockLimit(spectrumSettings.baseStockLimit);
      
      // Start new session
      const newSessionId = generateSessionId();
      setCurrentSessionId(newSessionId);
      setIsScanning(true);
      setError(null);
      setStocks([]);
      const startTime = Date.now();

      const limitText = spectrumSettings.baseStockLimit === 0 ? 'all' : spectrumSettings.baseStockLimit;
      setStatus({ type: 'loading', msg: `Full Spectrum: Fetching ${limitText} stocks...` });
      setScanProgress({ phase: 'Loading tickers...', current: 0, total: 0, found: 0 });
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'running' }));
      
      const allTickers = await getFilteredTickers(spectrumSettings.baseStockLimit);
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'complete', marketCapFilter: 'running' }));
      
      setScanProgress({ phase: 'Filtering by market cap...', current: 0, total: allTickers.length, found: 0 });

      const qualifiedTickers = [];
      const batchSize = 50;
      for (let i = 0; i < allTickers.length; i += batchSize) {
        const batch = allTickers.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (tickerData) => {
          const ticker = tickerData.ticker;
          const details = await getTickerDetails(ticker);
          if (!details?.market_cap) return null;
          if (details.market_cap < MIN_MARKET_CAP || details.market_cap > MAX_MARKET_CAP) return null;
          return { ticker, details };
        });
        
        const results = await Promise.all(batchPromises);
        const validResults = results.filter(r => r !== null);
        qualifiedTickers.push(...validResults);
        
        setScanProgress(p => ({ ...p, current: Math.min(i + batchSize, allTickers.length), found: qualifiedTickers.length }));
        await new Promise(r => setTimeout(r, 220));
      }

      setDiscoveryStatus(p => ({ ...p, marketCapFilter: 'complete', technicalScanner: 'running' }));
      setScanProgress({ phase: 'Analyzing qualified stocks...', current: 0, total: qualifiedTickers.length, found: qualifiedTickers.length });

      const processedStocks = [];
      for (let i = 0; i < qualifiedTickers.length; i++) {
        const { ticker, details } = qualifiedTickers[i];
        
        const [prevDay, historicalData, financials, insiderData] = await Promise.all([
          getPrevDay(ticker),
          get52WeekData(ticker),
          getFinancials(ticker),
          getInsiderTransactions(ticker),
        ]);

        if (prevDay && historicalData.length > 20) {
          const stock = processStock(ticker, details, prevDay, historicalData, financials, insiderData, processedStocks.length);
          processedStocks.push(stock);
        }

        if (i % 10 === 0) {
          setScanProgress(p => ({ ...p, current: i, found: processedStocks.length }));
          setStocks(calcScores([...processedStocks], weights, aiWeights));
        }
        await new Promise(r => setTimeout(r, 220));
      }

      setDiscoveryStatus(p => ({ ...p, technicalScanner: 'complete', insiderScanner: 'complete', financialScanner: 'complete' }));
      const scoredStocks = calcScores(processedStocks, weights, aiWeights);
      setStocks(scoredStocks);
      
      for (const a of analysisAgents) {
        setAnalysisStatus(p => ({ ...p, [a.id]: 'complete' }));
      }

      let currentStocks = scoredStocks;
      const scanStats = { phase: 'complete', current: allTickers.length, total: allTickers.length, found: scoredStocks.length };
      
      setIsScanning(false);
      
      // Phase 2: Supply Chain Tagging
      if (spectrumSettings.supplyChainEnabled && currentStocks.length > 0) {
        setFullSpectrumPhase('Tagging Supply Chains...');
        setIsScanningSupplyChain(true);
        
        const batchSize = 20;
        const totalBatches = Math.ceil(currentStocks.length / batchSize);
        setSupplyChainProgress({ current: 0, total: currentStocks.length });
        
        let updatedStocks = [...currentStocks];
        
        for (let batch = 0; batch < totalBatches; batch++) {
          const startIdx = batch * batchSize;
          const batchStocks = currentStocks.slice(startIdx, startIdx + batchSize);
          
          setSupplyChainProgress({ current: startIdx, total: currentStocks.length });
          setStatus({ type: 'loading', msg: `Full Spectrum: Tagging supply chains... ${startIdx}/${currentStocks.length}` });
          
          const stockList = batchStocks.map(s => `${s.ticker}: ${s.name} (${s.sector || 'Unknown sector'})`).join('\n');
          
          const prompt = `Categorize these ${batchStocks.length} stocks into supply chains. For EACH stock, determine if it belongs to:
- SOLAR: Solar energy, solar panels, inverters, solar installation, photovoltaic, solar materials
- BATTERIES: Batteries, lithium, energy storage, EV batteries, battery materials, battery tech
- ROBOTICS: Robotics, automation, AI hardware, industrial robots, drones, autonomous systems

Stocks:
${stockList}

Respond with ONLY a JSON array, no other text. Each object must have ticker and boolean fields:
[{"ticker":"ABC","solar":false,"batteries":true,"robotics":false}]`;

          try {
            const response = await fetch("/api/grok", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt })
            });
            
            if (response.ok) {
              const data = await response.json();
              let categories = [];
              try {
                const jsonMatch = data.analysis.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  categories = JSON.parse(jsonMatch[0]);
                }
              } catch (e) {
                console.warn('Failed to parse supply chain response:', e);
              }
              
              categories.forEach(cat => {
                updatedStocks = updatedStocks.map(s => 
                  s.ticker === cat.ticker ? {
                    ...s,
                    supplyChain: {
                      solar: cat.solar || false,
                      batteries: cat.batteries || false,
                      robotics: cat.robotics || false
                    }
                  } : s
                );
              });
              
              setStocks(updatedStocks);
            }
          } catch (e) {
            console.error('Supply chain batch failed:', e);
          }
          
          if (batch < totalBatches - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        
        currentStocks = updatedStocks;
        setIsScanningSupplyChain(false);
        setSupplyChainProgress({ current: 0, total: 0 });
      }
      
      // Phase 3: Grok AI Analysis
      if (spectrumSettings.grokEnabled && currentStocks.length > 0 && spectrumSettings.grokCount > 0) {
        setFullSpectrumPhase('Running Grok AI Analysis...');
        setIsAnalyzingAI(true);
        
        const countToAnalyze = Math.min(spectrumSettings.grokCount, currentStocks.length);
        const stocksToAnalyze = currentStocks.slice(0, countToAnalyze);
        setAiProgress({ current: 0, total: stocksToAnalyze.length });
        
        let updatedStocks = [...currentStocks];
        
        for (let i = 0; i < stocksToAnalyze.length; i++) {
          setAiProgress({ current: i + 1, total: stocksToAnalyze.length });
          setStatus({ type: 'loading', msg: `Full Spectrum: Grok analyzing ${stocksToAnalyze[i].ticker} (${i + 1}/${stocksToAnalyze.length})...` });
          
          const result = await getAIAnalysis(stocksToAnalyze[i]);
          
          updatedStocks = updatedStocks.map(s => 
            s.ticker === stocksToAnalyze[i].ticker ? { 
              ...s, 
              aiAnalysis: result.analysis,
              insiderConviction: result.insiderConviction,
              upsidePct: result.upsidePct,
              cupHandleScore: result.cupHandleScore
            } : s
          );
          setStocks(updatedStocks);
          
          if (i < stocksToAnalyze.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
        
        const reScored = calcScores(updatedStocks, weights, aiWeights);
        setStocks(reScored);
        currentStocks = reScored;
        
        setIsAnalyzingAI(false);
        setAiProgress({ current: 0, total: 0 });
      }
      
      // Save final session
      const finalScanStats = { phase: 'complete', current: allTickers.length, total: allTickers.length, found: currentStocks.length };
      const sessionName = `Full Spectrum ${new Date().toLocaleDateString()} (${currentStocks.length} stocks)`;
      saveSession(newSessionId, currentStocks, finalScanStats, sessionName);
      setSessions(getAllSessions());
      
      setLastUpdate(new Date());
      setCacheAge(0);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      setStatus({ type: 'live', msg: `Full Spectrum complete: ${currentStocks.length} stocks (${totalTime}s)` });
      
    } catch (err) {
      console.error('Full spectrum scan error:', err);
      setError(`Full spectrum scan failed: ${err.message}`);
      setStatus({ type: 'error', msg: 'Scan failed' });
    }
    
    setIsRunningFullSpectrum(false);
    setFullSpectrumPhase('');
    setTimeout(() => {
      setDiscoveryStatus(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
      setAnalysisStatus(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
    }, 3000);
  };
  
  // Load a previous session
  const loadPreviousSession = (sessionId) => {
    const session = loadSession(sessionId);
    if (session && session.stocks?.length > 0) {
      const scored = calcScores(session.stocks, weights, aiWeights);
      setStocks(scored);
      setCurrentSessionId(session.id);
      setLastUpdate(new Date(session.timestamp));
      setCacheAge(Date.now() - session.timestamp);
      setStatus({ type: 'cached', msg: `${session.stocks.length} stocks (${session.name})` });
      setScanProgress(session.scanStats || { phase: 'complete', current: 0, total: 0, found: session.stocks.length });
      setShowSessions(false);
      localStorage.setItem('valuehunter_current_session', sessionId);
    }
  };

  const handleWeight = (id, val) => {
    const w = { ...weights, [id]: val };
    setWeights(w);
    setStocks(p => calcScores(p, w, aiWeights));
  };

  const sorted = [...stocks]
    .filter(s => matchesCategory(s, sectorFilter))
    .filter(s => !hideNetCashNegative || (s.netCash !== null && s.netCash >= 0))
    .sort((a, b) => {
      if (sortBy === 'compositeScore') return b.compositeScore - a.compositeScore;
      if (sortBy === 'netCash') return (b.netCash || 0) - (a.netCash || 0);
      if (sortBy === 'insiderDate') {
        const dateA = a.lastInsiderPurchase?.date ? new Date(a.lastInsiderPurchase.date).getTime() : 0;
        const dateB = b.lastInsiderPurchase?.date ? new Date(b.lastInsiderPurchase.date).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === 'upsidePct') {
        const upsideA = a.upsidePct ?? -999;
        const upsideB = b.upsidePct ?? -999;
        return upsideB - upsideA;
      }
      if (sortBy === 'insiderConviction') {
        const convA = a.insiderConviction ?? -1;
        const convB = b.insiderConviction ?? -1;
        return convB - convA;
      }
      if (sortBy === 'cupHandleScore') {
        const chA = a.cupHandleScore ?? -1;
        const chB = b.cupHandleScore ?? -1;
        return chB - chA;
      }
      return (b.agentScores?.[sortBy] || 0) - (a.agentScores?.[sortBy] || 0);
    });

  // Not needed anymore - using predefined categories
  // const sectors = [...new Set(stocks.map(s => s.sector))].filter(Boolean).sort();

  const StatusIcon = ({ s }) => {
    if (s === 'running') return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
    if (s === 'complete') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  const NetCashBadge = ({ amount, hasData }) => {
    if (!hasData) {
      return <span className="text-xs text-slate-500 italic">—</span>;
    }
    const isPositive = amount >= 0;
    return (
      <span className="text-xs font-mono font-medium" style={{ color: isPositive ? '#34d399' : '#f87171' }}>
        {formatMoney(amount)}
      </span>
    );
  };

  const InsiderBadge = ({ data }) => {
    if (!data?.date) {
      return <span className="text-xs text-slate-500">—</span>;
    }
    const daysSince = Math.floor((Date.now() - new Date(data.date)) / (1000 * 60 * 60 * 24));
    const isRecent = daysSince < 90;
    return (
      <div className="text-xs">
        <div style={{ color: isRecent ? '#34d399' : '#94a3b8' }}>{formatDate(data.date)}</div>
        <div className="text-slate-400 font-mono">{formatMoney(data.amount)}</div>
      </div>
    );
  };

  const progressPct = scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0;
  const stocksWithAI = stocks.filter(s => s.aiAnalysis).length;

  return (
    <div className="min-h-screen text-slate-100" style={{ fontFamily: "system-ui, sans-serif", background: '#0a0e17' }}>
      <style>{`.mono{font-family:monospace}.card{background:rgba(15,23,42,0.8);backdrop-filter:blur(10px)}.row:hover{background:rgba(99,102,241,0.05)}`}</style>

      <header className="border-b border-slate-800/50 sticky top-0 z-50" style={{ background: 'rgba(10,14,23,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Network className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold"><span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ValueHunter</span><span className="text-slate-400 font-normal ml-2 text-lg">AI</span></h1>
              <p className="text-xs text-slate-500">Small-Cap Scanner • $40M-$400M</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ 
              background: status.type === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', 
              borderColor: status.type === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)', 
              color: status.type === 'live' ? '#34d399' : '#a5b4fc' 
            }}>
              {(status.type === 'loading' || isAnalyzingAI || isRunningFullSpectrum) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>{fullSpectrumPhase || status.msg}</span>
              {cacheAge && status.type === 'cached' && <span className="text-slate-500">• {formatCacheAge(cacheAge)}</span>}
            </div>
            
            {/* Sessions Button */}
            <button onClick={() => setShowSessions(!showSessions)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showSessions ? 'rgba(139,92,246,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showSessions ? '#a78bfa' : '#94a3b8' }}><Clock className="w-4 h-4" />Sessions ({sessions.length})</button>
            
            <button onClick={() => setShowDiscovery(!showDiscovery)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showDiscovery ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showDiscovery ? '#6ee7b7' : '#94a3b8' }}><Radar className="w-4 h-4" />Discovery</button>
            <button onClick={() => setShowWeights(!showWeights)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showWeights ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showWeights ? '#fcd34d' : '#94a3b8' }}><Sliders className="w-4 h-4" />Weights</button>
            
            {stocks.length > 0 && (
              <>
                {/* AI Count Selector */}
                <select 
                  value={aiAnalyzeCount} 
                  onChange={e => setAiAnalyzeCount(parseInt(e.target.value))}
                  className="rounded-lg px-2 py-2 text-sm border outline-none"
                  style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', width: '70px' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={0}>All</option>
                </select>
                
                {/* Grok AI Button */}
                <button 
                  onClick={() => {
                    // Get current sorted/filtered view
                    const currentView = [...stocks]
                      .filter(s => matchesCategory(s, sectorFilter))
                      .filter(s => !hideNetCashNegative || (s.netCash !== null && s.netCash >= 0))
                      .sort((a, b) => {
                        if (sortBy === 'compositeScore') return b.compositeScore - a.compositeScore;
                        if (sortBy === 'netCash') return (b.netCash || 0) - (a.netCash || 0);
                        if (sortBy === 'insiderDate') {
                          const dateA = a.lastInsiderPurchase?.date ? new Date(a.lastInsiderPurchase.date).getTime() : 0;
                          const dateB = b.lastInsiderPurchase?.date ? new Date(b.lastInsiderPurchase.date).getTime() : 0;
                          return dateB - dateA;
                        }
                        if (sortBy === 'upsidePct') return (b.upsidePct ?? -999) - (a.upsidePct ?? -999);
                        if (sortBy === 'insiderConviction') return (b.insiderConviction ?? -1) - (a.insiderConviction ?? -1);
                        return (b.agentScores?.[sortBy] || 0) - (a.agentScores?.[sortBy] || 0);
                      });
                    runGrokAnalysis(currentView);
                  }} 
                  disabled={isAnalyzingAI || isScanning || isScanningSupplyChain}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2"
                  style={{ 
                    background: isAnalyzingAI ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.1)', 
                    borderColor: 'rgba(239,68,68,0.3)', 
                    color: '#f87171',
                    opacity: (isAnalyzingAI || isScanning || isScanningSupplyChain) ? 0.7 : 1
                  }}
                >
                  {isAnalyzingAI ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing {aiProgress.current}/{aiProgress.total}...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />Grok AI</>
                  )}
                </button>
                
                {/* Supply Chain Scan Button */}
                <button 
                  onClick={runSupplyChainScan} 
                  disabled={isAnalyzingAI || isScanning || isScanningSupplyChain}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2"
                  style={{ 
                    background: isScanningSupplyChain ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.1)', 
                    borderColor: 'rgba(245,158,11,0.3)', 
                    color: '#fbbf24',
                    opacity: (isAnalyzingAI || isScanning || isScanningSupplyChain) ? 0.7 : 1
                  }}
                >
                  {isScanningSupplyChain ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Tagging {supplyChainProgress.current}/{supplyChainProgress.total}...</>
                  ) : (
                    <><Zap className="w-4 h-4" />Tag Supply Chains</>
                  )}
                </button>
              </>
            )}
            
            {/* Stock Limit Selector */}
            <select 
              value={stockLimit} 
              onChange={e => setStockLimit(parseInt(e.target.value))}
              className="rounded-lg px-2 py-2 text-sm border outline-none"
              style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(99,102,241,0.3)', color: '#a5b4fc', width: '100px' }}
              disabled={isScanning || isAnalyzingAI || isRunningFullSpectrum}
            >
              <option value={100}>100 stocks</option>
              <option value={500}>500 stocks</option>
              <option value={1000}>1000 stocks</option>
              <option value={0}>All stocks</option>
            </select>
            
            {/* Run Base Scan Button */}
            <button 
              onClick={runBaseScan} 
              disabled={isScanning || isAnalyzingAI || isRunningFullSpectrum} 
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2" 
              style={{ background: isScanning ? 'rgba(245,158,11,0.2)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: isScanning ? '#fcd34d' : 'white', opacity: (isAnalyzingAI || isRunningFullSpectrum) ? 0.5 : 1 }}
            >
              {isScanning && !isRunningFullSpectrum ? <><RefreshCw className="w-4 h-4 animate-spin" />Scanning...</> : <><Play className="w-4 h-4" />Run Base Scan</>}
            </button>
            
            {/* Run Full Spectrum Button */}
            <button 
              onClick={() => setShowFullSpectrumModal(true)} 
              disabled={isScanning || isAnalyzingAI || isRunningFullSpectrum} 
              className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2" 
              style={{ background: isRunningFullSpectrum ? 'rgba(245,158,11,0.2)' : 'linear-gradient(90deg, #f59e0b, #f97316)', color: isRunningFullSpectrum ? '#fcd34d' : 'white', opacity: (isScanning || isAnalyzingAI) && !isRunningFullSpectrum ? 0.5 : 1 }}
            >
              {isRunningFullSpectrum ? <><RefreshCw className="w-4 h-4 animate-spin" />Running...</> : <><Zap className="w-4 h-4" />Run Full Spectrum</>}
            </button>
          </div>
        </div>
      </header>

      {/* Full Spectrum Modal */}
      {showFullSpectrumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card rounded-2xl border border-slate-700 p-6 w-full max-w-md mx-4" style={{ background: 'rgba(15,23,42,0.98)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Zap className="w-6 h-6 text-amber-400" />Full Spectrum Scan</h2>
              <button onClick={() => setShowFullSpectrumModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <p className="text-sm text-slate-400 mb-6">This will run all scans in sequence: Base Scan → Supply Chain Tagging → Grok AI Analysis</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm text-slate-300 mb-2 block">Base Scan Stock Limit</label>
                <select 
                  value={spectrumSettings.baseStockLimit} 
                  onChange={e => setSpectrumSettings(p => ({...p, baseStockLimit: parseInt(e.target.value)}))}
                  className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                  style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(99,102,241,0.3)', color: '#cbd5e1' }}
                >
                  <option value={100}>100 stocks</option>
                  <option value={500}>500 stocks</option>
                  <option value={1000}>1000 stocks</option>
                  <option value={0}>All stocks</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-slate-200">Tag Supply Chains</span>
                </div>
                <button 
                  onClick={() => setSpectrumSettings(p => ({...p, supplyChainEnabled: !p.supplyChainEnabled}))}
                  className="w-12 h-6 rounded-full transition-colors"
                  style={{ background: spectrumSettings.supplyChainEnabled ? '#10b981' : 'rgba(51,65,85,0.5)' }}
                >
                  <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: spectrumSettings.supplyChainEnabled ? 'translateX(26px)' : 'translateX(2px)' }} />
                </button>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-slate-200">Grok AI Analysis</span>
                </div>
                <button 
                  onClick={() => setSpectrumSettings(p => ({...p, grokEnabled: !p.grokEnabled}))}
                  className="w-12 h-6 rounded-full transition-colors"
                  style={{ background: spectrumSettings.grokEnabled ? '#10b981' : 'rgba(51,65,85,0.5)' }}
                >
                  <div className="w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: spectrumSettings.grokEnabled ? 'translateX(26px)' : 'translateX(2px)' }} />
                </button>
              </div>
              
              {spectrumSettings.grokEnabled && (
                <div>
                  <label className="text-sm text-slate-300 mb-2 block">Grok AI - Stocks to Analyze</label>
                  <select 
                    value={spectrumSettings.grokCount} 
                    onChange={e => setSpectrumSettings(p => ({...p, grokCount: parseInt(e.target.value)}))}
                    className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
                    style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                  >
                    <option value={10}>Top 10</option>
                    <option value={25}>Top 25</option>
                    <option value={50}>Top 50</option>
                    <option value={100}>Top 100</option>
                    <option value={0}>All stocks</option>
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowFullSpectrumModal(false)} 
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border"
                style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}
              >
                Cancel
              </button>
              <button 
                onClick={runFullSpectrumScan} 
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316)', color: 'white' }}
              >
                <Play className="w-4 h-4" />Start Full Spectrum
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions Panel */}
      {showSessions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card rounded-2xl border border-slate-700 p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col" style={{ background: 'rgba(15,23,42,0.98)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Clock className="w-6 h-6 text-violet-400" />Saved Sessions</h2>
              <button onClick={() => setShowSessions(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2">
              {sessions.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No saved sessions yet. Run a scan to create one.</p>
              ) : sessions.map(session => (
                <div 
                  key={session.id} 
                  className="p-3 rounded-xl border cursor-pointer hover:border-violet-500/50 transition-colors"
                  style={{ 
                    background: currentSessionId === session.id ? 'rgba(139,92,246,0.1)' : 'rgba(30,41,59,0.5)', 
                    borderColor: currentSessionId === session.id ? 'rgba(139,92,246,0.5)' : 'rgba(51,65,85,0.5)' 
                  }}
                  onClick={() => loadPreviousSession(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{session.name}</p>
                      <p className="text-xs text-slate-500">{session.stockCount} stocks • {formatCacheAge(Date.now() - session.timestamp)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentSessionId === session.id && <span className="text-xs text-violet-400">Current</span>}
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteSession(session.id); setSessions(getAllSessions()); }}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700">
              <button 
                onClick={() => setShowSessions(false)} 
                className="w-full px-4 py-2.5 rounded-xl text-sm font-medium border"
                style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto px-6 py-6 min-h-screen">
        {error && <div className="mb-4 p-4 rounded-xl border flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}><AlertCircle className="w-5 h-5 text-red-400" /><p className="text-sm text-red-300 flex-1">{error}</p><button onClick={() => setError(null)} className="text-red-400"><X className="w-4 h-4" /></button></div>}

        {(isScanning || isAnalyzingAI) && (
          <div className="mb-6 p-5 rounded-2xl border" style={{ background: isAnalyzingAI ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', borderColor: isAnalyzingAI ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-5 h-5 animate-spin ${isAnalyzingAI ? 'text-red-400' : 'text-indigo-400'}`} />
                <span className={`text-sm ${isAnalyzingAI ? 'text-red-300' : 'text-indigo-300'}`}>
                  {isAnalyzingAI ? `Grok AI analyzing...` : scanProgress.phase}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {isAnalyzingAI ? (
                  <span className="text-red-400 mono">{aiProgress.current} / {aiProgress.total}</span>
                ) : (
                  <>
                    <span className="text-indigo-400 mono">{scanProgress.current} / {scanProgress.total}</span>
                    <span className="text-emerald-400 mono">{scanProgress.found} qualified</span>
                  </>
                )}
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}>
              <div 
                className="h-full rounded-full transition-all duration-300" 
                style={{ 
                  width: isAnalyzingAI ? `${(aiProgress.current / aiProgress.total) * 100}%` : `${progressPct}%`, 
                  background: isAnalyzingAI ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)' 
                }} 
              />
            </div>
          </div>
        )}

        {showDiscovery && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-emerald-400" />Discovery Pipeline</h2>
              <div className="flex gap-4 text-center">
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}><p className="text-[10px] text-slate-500">Scanned</p><p className="mono text-xl font-bold text-slate-200">{scanProgress.total.toLocaleString()}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-[10px] text-emerald-400">Qualified</p><p className="mono text-xl font-bold text-emerald-400">{scanProgress.found}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}><p className="text-[10px] text-red-400">AI Analyzed</p><p className="mono text-xl font-bold text-red-400">{stocksWithAI}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {discoveryAgents.map(a => (
                <div key={a.id} className="p-3 rounded-xl border" style={{ background: discoveryStatus[a.id] === 'complete' ? 'rgba(16,185,129,0.05)' : discoveryStatus[a.id] === 'running' ? 'rgba(245,158,11,0.05)' : 'rgba(15,23,42,0.5)', borderColor: discoveryStatus[a.id] === 'complete' ? 'rgba(16,185,129,0.3)' : discoveryStatus[a.id] === 'running' ? 'rgba(245,158,11,0.3)' : 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center justify-between mb-2"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}15` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><StatusIcon s={discoveryStatus[a.id]} /></div>
                  <p className="text-sm font-medium text-slate-200">{a.name}</p><p className="text-[10px] text-slate-500">{a.coverage}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showWeights && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Sliders className="w-5 h-5 text-amber-400" />Scoring Weights</h2>
              <button onClick={() => { setWeights({ pricePosition: 40, insiderActivity: 40, netCash: 20 }); setAiWeights({ conviction: 20, upside: 20, cupHandle: 10 }); }} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>Reset All</button>
            </div>
            
            <p className="text-xs text-slate-500 mb-3">Base Scoring (applied to all stocks)</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {analysisAgents.map(a => (
                <div key={a.id} className="rounded-xl p-4 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}20` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><span className="text-sm font-medium text-slate-200">{a.name}</span></div>
                  <div className="flex items-center gap-3"><input type="range" min="0" max="100" value={weights[a.id]} onChange={e => handleWeight(a.id, parseInt(e.target.value))} className="flex-1" style={{ accentColor: a.color }} /><span className="mono text-sm font-semibold w-8 text-right" style={{ color: a.color }}>{weights[a.id]}</span></div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-slate-500 mb-3">AI Bonus Points (added after Grok analysis)</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}><Users className="w-4 h-4 text-red-400" /></div><span className="text-sm font-medium text-slate-200">Conviction</span></div>
                <div className="flex items-center gap-3"><input type="range" min="0" max="50" value={aiWeights.conviction} onChange={e => { const v = parseInt(e.target.value); setAiWeights(p => ({...p, conviction: v})); setStocks(s => calcScores(s, weights, {...aiWeights, conviction: v})); }} className="flex-1" style={{ accentColor: '#f87171' }} /><span className="mono text-sm font-semibold w-8 text-right text-red-400">+{aiWeights.conviction}</span></div>
              </div>
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}><TrendingUp className="w-4 h-4 text-red-400" /></div><span className="text-sm font-medium text-slate-200">Upside %</span></div>
                <div className="flex items-center gap-3"><input type="range" min="0" max="50" value={aiWeights.upside} onChange={e => { const v = parseInt(e.target.value); setAiWeights(p => ({...p, upside: v})); setStocks(s => calcScores(s, weights, {...aiWeights, upside: v})); }} className="flex-1" style={{ accentColor: '#f87171' }} /><span className="mono text-sm font-semibold w-8 text-right text-red-400">+{aiWeights.upside}</span></div>
              </div>
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.2)' }}><BarChart3 className="w-4 h-4 text-red-400" /></div><span className="text-sm font-medium text-slate-200">Cup & Handle</span></div>
                <div className="flex items-center gap-3"><input type="range" min="0" max="50" value={aiWeights.cupHandle} onChange={e => { const v = parseInt(e.target.value); setAiWeights(p => ({...p, cupHandle: v})); setStocks(s => calcScores(s, weights, {...aiWeights, cupHandle: v})); }} className="flex-1" style={{ accentColor: '#f87171' }} /><span className="mono text-sm font-semibold w-8 text-right text-red-400">{aiWeights.cupHandle}</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <div className="card rounded-2xl border border-slate-800/50 p-5 sticky top-28">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-violet-400" />Analysis Agents</h2>
              <div className="space-y-2">
                {analysisAgents.map(a => (
                  <div key={a.id} className="p-3 rounded-xl border flex items-center justify-between" style={{ background: analysisStatus[a.id] === 'complete' ? 'rgba(16,185,129,0.05)' : 'rgba(15,23,42,0.5)', borderColor: analysisStatus[a.id] === 'complete' ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)' }}>
                    <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}15` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><div><p className="text-sm font-medium text-slate-200">{a.name}</p><p className="text-[10px] text-slate-500">{a.desc}</p></div></div>
                    <StatusIcon s={analysisStatus[a.id]} />
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 rounded-xl border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" />Grok AI Deep Analysis</h3>
                <p className="text-xs text-slate-400 mb-2">Analyzes Stocktwits sentiment, insider conviction, future catalysts, and upside potential.</p>
                <p className="text-xs text-slate-500">{stocksWithAI} stocks analyzed</p>
              </div>
            </div>
          </div>

          <div className="col-span-9">
            <div className="card rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
                <div><h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" />Stock Rankings</h2><p className="text-xs text-slate-500">{sorted.length} stocks {lastUpdate && `• ${lastUpdate.toLocaleTimeString()}`}</p></div>
                <div className="flex gap-3 items-center">
                  <button 
                    onClick={() => setHideNetCashNegative(!hideNetCashNegative)}
                    className="px-3 py-2 rounded-lg text-sm border flex items-center gap-2"
                    style={{ 
                      background: hideNetCashNegative ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', 
                      borderColor: hideNetCashNegative ? 'rgba(16,185,129,0.5)' : 'rgba(51,65,85,0.5)', 
                      color: hideNetCashNegative ? '#34d399' : '#94a3b8' 
                    }}
                  >
                    <Banknote className="w-4 h-4" />
                    {hideNetCashNegative ? 'Net Cash+ Only' : 'All Cash'}
                  </button>
                  <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}>
                    {Object.entries(STOCK_CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.name}</option>
                    ))}
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}>
                    <option value="compositeScore">Score</option>
                    <option value="insiderDate">Recent Insider Buys</option>
                    <option value="netCash">Net Cash</option>
                    <option value="upsidePct">Upside %</option>
                    <option value="insiderConviction">Conviction</option>
                  </select>
                </div>
              </div>
              
              {/* Column Headers - Clickable for sorting */}
              {sorted.length > 0 && (
                <div className="px-4 py-2 border-b border-slate-800/50 flex items-center gap-4 text-xs text-slate-500 font-medium" style={{ background: 'rgba(15,23,42,0.5)' }}>
                  <div className="w-10 text-center">Rank</div>
                  <div className="flex-1">Ticker / Name</div>
                  <div className="w-24 text-right">Price / MCap</div>
                  <div className="w-24 text-center">Net Cash</div>
                  <div 
                    className="w-28 text-center cursor-pointer hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    onClick={() => setSortBy(sortBy === 'insiderDate' ? 'compositeScore' : 'insiderDate')}
                  >
                    Insider Buy
                    {sortBy === 'insiderDate' && <span className="text-emerald-400">↓</span>}
                  </div>
                  <div 
                    className="w-14 text-center cursor-pointer hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    onClick={() => setSortBy(sortBy === 'upsidePct' ? 'compositeScore' : 'upsidePct')}
                  >
                    Upside
                    {sortBy === 'upsidePct' && <span className="text-emerald-400">↓</span>}
                  </div>
                  <div 
                    className="w-14 text-center cursor-pointer hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    onClick={() => setSortBy(sortBy === 'insiderConviction' ? 'compositeScore' : 'insiderConviction')}
                  >
                    Convic
                    {sortBy === 'insiderConviction' && <span className="text-emerald-400">↓</span>}
                  </div>
                  <div 
                    className="w-12 text-center cursor-pointer hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    onClick={() => setSortBy(sortBy === 'cupHandleScore' ? 'compositeScore' : 'cupHandleScore')}
                  >
                    C&H
                    {sortBy === 'cupHandleScore' && <span className="text-emerald-400">↓</span>}
                  </div>
                  <div className="w-16 text-center">52wL</div>
                  <div 
                    className="w-20 text-center cursor-pointer hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                    onClick={() => setSortBy('compositeScore')}
                  >
                    Score
                    {sortBy === 'compositeScore' && <span className="text-indigo-400">↓</span>}
                  </div>
                  <div className="w-6"></div>
                </div>
              )}
              
              <div className="divide-y divide-slate-800/30 max-h-[calc(100vh-350px)] overflow-y-auto">
                {sorted.length === 0 && !isScanning ? (
                  <div className="p-12 text-center"><Database className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-400">Click "Run Full Scan" to find small-cap opportunities</p></div>
                ) : sorted.map((s, i) => (
                  <div key={s.ticker} className="row cursor-pointer" onClick={() => setSelected(selected?.ticker === s.ticker ? null : s)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: i < 3 ? ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.2)', 'rgba(194,65,12,0.2)'][i] : 'rgba(30,41,59,0.5)', color: i < 3 ? ['#fbbf24', '#cbd5e1', '#fb923c'][i] : '#64748b' }}>#{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="mono font-bold text-lg text-slate-100">{s.ticker}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.change >= 0 ? '#34d399' : '#f87171' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span>
                            {s.aiAnalysis && <Sparkles className="w-4 h-4 text-red-400" title="AI Analysis" />}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{s.name}</p>
                        </div>
                        <div className="text-right w-24"><p className="mono text-sm font-semibold text-slate-200">${s.price?.toFixed(2)}</p><p className="text-xs text-indigo-400 mono">${s.marketCap}M</p></div>
                        <div className="w-24 text-center"><NetCashBadge amount={s.netCash} hasData={s.hasFinancials} /></div>
                        <div className="w-28 text-center"><InsiderBadge data={s.lastInsiderPurchase} /></div>
                        <div className="w-14 text-center">
                          {s.upsidePct !== null && s.upsidePct !== undefined ? (
                            <span 
                              className="text-xs font-bold mono px-1 py-0.5 rounded"
                              style={{ 
                                background: s.upsidePct >= 50 ? 'rgba(16,185,129,0.2)' : s.upsidePct >= 0 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                color: s.upsidePct >= 50 ? '#34d399' : s.upsidePct >= 0 ? '#fbbf24' : '#f87171'
                              }}
                            >
                              {s.upsidePct > 0 ? '+' : ''}{s.upsidePct}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                        <div className="w-14 text-center">
                          {s.insiderConviction !== null && s.insiderConviction !== undefined ? (
                            <span 
                              className="text-xs font-bold mono px-1 py-0.5 rounded"
                              style={{ 
                                background: s.insiderConviction >= 70 ? 'rgba(16,185,129,0.2)' : s.insiderConviction >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                                color: s.insiderConviction >= 70 ? '#34d399' : s.insiderConviction >= 40 ? '#fbbf24' : '#f87171'
                              }}
                            >
                              {s.insiderConviction}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                        <div className="w-12 text-center">
                          {s.cupHandleScore !== null && s.cupHandleScore !== undefined ? (
                            <span 
                              className="text-xs font-bold mono px-1 py-0.5 rounded"
                              style={{ 
                                background: s.cupHandleScore >= 70 ? 'rgba(16,185,129,0.2)' : s.cupHandleScore >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.2)',
                                color: s.cupHandleScore >= 70 ? '#34d399' : s.cupHandleScore >= 40 ? '#fbbf24' : '#64748b'
                              }}
                            >
                              {s.cupHandleScore}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                        <div className="w-16 text-center">
                          <div className="mono text-xs font-semibold" style={{ color: s.fromLow < 20 ? '#34d399' : s.fromLow < 50 ? '#fbbf24' : '#f87171' }}>{s.fromLow?.toFixed(1)}%</div>
                        </div>
                        <div className="w-20"><div className="flex items-center justify-between mb-1"><span className="mono text-sm font-bold text-indigo-400">{s.compositeScore.toFixed(1)}</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.compositeScore}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} /></div></div>
                        <div className="w-6">{selected?.ticker === s.ticker ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</div>
                      </div>
                      
                      {selected?.ticker === s.ticker && (
                        <div className="mt-4 pt-4 border-t border-slate-800/30">
                          {s.aiAnalysis && (
                            <div className="mb-4 p-4 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
                              <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" />Grok AI Analysis</h4>
                              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{s.aiAnalysis}</p>
                            </div>
                          )}
                          
                          {!s.aiAnalysis && i < 10 && (
                            <div className="mb-4 p-3 rounded-xl border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                              <p className="text-sm text-slate-400 flex items-center gap-2"><Sparkles className="w-4 h-4 text-red-400" />Click "Grok AI (Top 10)" to analyze</p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-4 gap-4">
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                              <p className="text-xs text-emerald-400 mb-1">52-Week Range</p>
                              <p className="text-lg font-bold text-slate-200">${s.low52?.toFixed(2)} - ${s.high52?.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-500">{s.positionIn52Week?.toFixed(0)}% of range</p>
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)' }}>
                              <p className="text-xs text-violet-400 mb-1">Net Cash Position</p>
                              {s.hasFinancials ? (
                                <>
                                  <p className="text-lg font-bold" style={{ color: s.netCash >= 0 ? '#34d399' : '#f87171' }}>{formatMoney(s.netCash)}</p>
                                  <p className="text-[10px] text-slate-500">Cash: {formatMoney(s.cash)} | Debt: {formatMoney(s.debt)}</p>
                                </>
                              ) : (
                                <p className="text-slate-500 italic">No data available</p>
                              )}
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                              <p className="text-xs text-emerald-400 mb-1">Last Insider Purchase</p>
                              {s.lastInsiderPurchase ? (
                                <>
                                  <p className="text-lg font-bold text-slate-200">{formatMoney(s.lastInsiderPurchase.amount)}</p>
                                  <p className="text-[10px] text-slate-500">{formatDate(s.lastInsiderPurchase.date)} • {s.lastInsiderPurchase.shares?.toLocaleString()} shares</p>
                                  {s.lastInsiderPurchase.name && <p className="text-[10px] text-slate-400 truncate">by {s.lastInsiderPurchase.name}</p>}
                                </>
                              ) : (
                                <p className="text-slate-500 italic">None found</p>
                              )}
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                              <p className="text-xs text-amber-400 mb-1">RSI (14-day)</p>
                              <p className="text-lg font-bold text-slate-200">{Math.round(s.rsi)}</p>
                              <p className="text-[10px] text-slate-500">{s.rsi < 30 ? 'Oversold' : s.rsi > 70 ? 'Overbought' : 'Neutral'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <footer className="mt-8 pb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-xs text-slate-600">ValueHunter AI • Polygon.io + Finnhub + xAI Grok</p>
            <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-500 mono">v1.9</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Stock Limit: {stockLimit === 0 ? 'All' : stockLimit}</span>
            {currentSessionId && <span>• Session Active</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}
