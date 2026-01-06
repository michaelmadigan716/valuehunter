'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, BarChart3, Target, ChevronDown, ChevronUp, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, LineChart, Globe, Database, FileText, Radio, Radar, AlertCircle, X, RotateCcw, DollarSign, Activity, TrendingDown, Beaker, Sparkles, Banknote, Calendar } from 'lucide-react';

// ============================================
// API CONFIGURATION
// ============================================
const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_KEY || '';
const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY || '';
const GROK_KEY = process.env.NEXT_PUBLIC_GROK_KEY || '';

const CACHE_KEY = 'valuehunter_cache_v6';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const MIN_MARKET_CAP = 40_000_000;
const MAX_MARKET_CAP = 400_000_000;

const TEST_MODE_LIMIT = 600;

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

async function getFilteredTickers(testMode = false) {
  const tickers = [];
  let nextUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${POLYGON_KEY}`;
  let pageCount = 0;
  const maxPages = testMode ? 2 : 100;
  
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
      
      if (testMode && tickers.length >= TEST_MODE_LIMIT) {
        return tickers.slice(0, TEST_MODE_LIMIT);
      }
    }
    
    nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLYGON_KEY}` : null;
    pageCount++;
    await new Promise(r => setTimeout(r, 250));
  }
  
  return testMode ? tickers.slice(0, TEST_MODE_LIMIT) : tickers;
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

async function getFinancials(ticker) {
  try {
    const res = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&limit=1&sort=filing_date&order=desc&apiKey=${POLYGON_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      const results = data.results?.[0];
      if (results?.financials) {
        const bs = results.financials.balance_sheet || {};
        
        const cash = 
          bs.cash_and_cash_equivalents?.value ||
          bs.cash_and_short_term_investments?.value ||
          bs.cash?.value ||
          0;
        
        const debt = 
          bs.long_term_debt?.value ||
          bs.total_debt?.value ||
          bs.short_long_term_debt_total?.value ||
          0;
        
        if (cash > 0 || debt > 0) {
          return { cash, debt, netCash: cash - debt };
        }
      }
    }
  } catch (e) { 
    console.warn(`Polygon financials failed for ${ticker}:`, e);
  }
  
  return null;
}

// FIXED: Insider transactions with correct value calculation
async function getInsiderTransactions(ticker) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    
    if (!data.data || data.data.length === 0) return null;
    
    // Filter for purchases only
    const purchases = data.data.filter(t => {
      const isPurchase = 
        t.transactionCode === 'P' || // Open market purchase
        (t.acquisitionOrDisposition === 'A' && t.transactionCode !== 'M' && t.transactionCode !== 'F' && t.transactionCode !== 'G');
      
      return isPurchase && t.share > 0 && t.transactionDate;
    });
    
    if (purchases.length === 0) return null;
    
    // Sort by date descending
    purchases.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
    
    const latest = purchases[0];
    
    // Use transactionPrice if available, otherwise use share price
    const pricePerShare = latest.transactionPrice || latest.price || 0;
    const shares = latest.share || 0;
    const totalValue = shares * pricePerShare;
    
    return {
      date: latest.transactionDate,
      amount: totalValue,
      shares: shares,
      price: pricePerShare,
      name: latest.name || 'Unknown Insider',
      filingDate: latest.filingDate,
      transactionCode: latest.transactionCode,
    };
  } catch (e) { 
    console.warn(`Insider transactions failed for ${ticker}:`, e);
    return null; 
  }
}

// ============================================
// GROK AI ANALYSIS (Separate function)
// ============================================
async function getAIAnalysis(stock) {
  if (!GROK_KEY) {
    console.warn('Grok API key not configured');
    return null;
  }
  
  try {
    const prompt = `You are a value investing analyst. Analyze this small-cap stock in 3-4 concise sentences.

Stock: ${stock.ticker} (${stock.name})
Price: $${stock.price?.toFixed(2)}
Market Cap: $${stock.marketCap}M
52-Week: Low $${stock.low52?.toFixed(2)} | High $${stock.high52?.toFixed(2)}
Position: ${stock.fromLow?.toFixed(1)}% above 52-week low
Net Cash: ${stock.netCash ? '$' + (stock.netCash / 1000000).toFixed(1) + 'M' : 'Data unavailable'}
Last Insider Buy: ${stock.lastInsiderPurchase?.date ? stock.lastInsiderPurchase.date + ' for $' + Math.round(stock.lastInsiderPurchase.amount).toLocaleString() + ' (' + stock.lastInsiderPurchase.shares?.toLocaleString() + ' shares)' : 'None in past year'}

Provide: 1) Quick investment thesis 2) Key risk 3) Is this worth researching further?`;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROK_KEY}`
      },
      body: JSON.stringify({
        model: "grok-beta",
        messages: [
          { role: "system", content: "You are a concise value investing analyst. Keep responses brief and actionable." },
          { role: "user", content: prompt }
        ],
        max_tokens: 350,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Grok API error: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('Grok AI analysis failed:', e);
    return null;
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
  const netCash = financials?.netCash || (cash - debt);
  
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
  if (netCash > 0) {
    const cashToMarketCap = (netCash / 1000000) / marketCapM;
    netCashScore = Math.min(100, 50 + cashToMarketCap * 100);
  } else if (netCash < 0) {
    const debtToMarketCap = Math.abs(netCash / 1000000) / marketCapM;
    netCashScore = Math.max(0, 50 - debtToMarketCap * 50);
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
    lastInsiderPurchase: insiderData,
    hasInsiderData: insiderData !== null,
    agentScores: {
      pricePosition: pricePositionScore,
      insiderActivity: insiderScore,
      netCash: netCashScore,
    },
    compositeScore: 0,
    aiAnalysis: null,
  };
}

function saveToCache(stocks, scanStats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), stocks, scanStats }));
  } catch (e) { console.warn('Cache save failed:', e); }
}

function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_DURATION) return null;
    return data;
  } catch (e) { return null; }
}

function getCacheAge() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return Date.now() - JSON.parse(cached).timestamp;
  } catch (e) { return null; }
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
  const [showWeights, setShowWeights] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
  const [discoveryStatus, setDiscoveryStatus] = useState(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
  const [sortBy, setSortBy] = useState('compositeScore');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [status, setStatus] = useState({ type: 'ready', msg: 'Loading...' });
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ phase: '', current: 0, total: 0, found: 0 });
  const [cacheAge, setCacheAge] = useState(null);
  const [testMode, setTestMode] = useState(true);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });

  const calcScores = useCallback((list, w) => {
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    return list.map(s => {
      let sum = 0;
      Object.keys(w).forEach(id => { 
        if (s.agentScores?.[id] !== undefined) {
          sum += (s.agentScores[id] * w[id]) / total; 
        }
      });
      return { ...s, compositeScore: sum };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, []);

  useEffect(() => {
    const cached = loadFromCache();
    if (cached && cached.stocks?.length > 0) {
      const scored = calcScores(cached.stocks, weights);
      setStocks(scored);
      setLastUpdate(new Date(cached.timestamp));
      setCacheAge(getCacheAge());
      setStatus({ type: 'cached', msg: `${cached.stocks.length} stocks (cached)` });
      setScanProgress(cached.scanStats || { phase: 'complete', current: 0, total: 0, found: cached.stocks.length });
    } else {
      setStatus({ type: 'ready', msg: 'Click Run Full Scan' });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCacheAge(getCacheAge()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Separate Grok AI Analysis function
  const runGrokAnalysis = async () => {
    if (isAnalyzingAI || stocks.length === 0) return;
    
    if (!GROK_KEY) {
      setError('Grok API key not configured. Add NEXT_PUBLIC_GROK_KEY to environment variables.');
      return;
    }
    
    setIsAnalyzingAI(true);
    setError(null);
    
    const top10 = stocks.slice(0, 10);
    setAiProgress({ current: 0, total: top10.length });
    
    let updatedStocks = [...stocks];
    
    for (let i = 0; i < top10.length; i++) {
      setAiProgress({ current: i + 1, total: top10.length });
      setStatus({ type: 'loading', msg: `Grok analyzing ${top10[i].ticker} (${i + 1}/${top10.length})...` });
      
      const analysis = await getAIAnalysis(top10[i]);
      
      if (analysis) {
        updatedStocks = updatedStocks.map(s => 
          s.ticker === top10[i].ticker ? { ...s, aiAnalysis: analysis } : s
        );
        setStocks(updatedStocks);
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Save to cache with AI analysis
    const scanStats = { phase: 'complete', current: scanProgress.total, total: scanProgress.total, found: updatedStocks.length };
    saveToCache(updatedStocks, scanStats);
    
    setIsAnalyzingAI(false);
    setAiProgress({ current: 0, total: 0 });
    setStatus({ type: 'live', msg: `${stocks.length} stocks • AI analysis complete` });
  };

  const runFullScan = async (forceRescan = false) => {
    if (isScanning) return;
    
    if (!POLYGON_KEY) {
      setError('Polygon API key not configured. Add NEXT_PUBLIC_POLYGON_KEY to environment variables.');
      return;
    }
    
    if (!forceRescan) {
      const cached = loadFromCache();
      if (cached && cached.stocks?.length > 0) {
        const scored = calcScores(cached.stocks, weights);
        setStocks(scored);
        setLastUpdate(new Date(cached.timestamp));
        setStatus({ type: 'cached', msg: `${cached.stocks.length} stocks (cached)` });
        return;
      }
    }

    setIsScanning(true);
    setError(null);
    setStocks([]);
    const startTime = Date.now();

    try {
      setStatus({ type: 'loading', msg: testMode ? `Test Mode: Fetching up to ${TEST_MODE_LIMIT} stocks...` : 'Fetching stock list...' });
      setScanProgress({ phase: 'Loading tickers...', current: 0, total: 0, found: 0 });
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'running' }));
      
      const allTickers = await getFilteredTickers(testMode);
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'complete', marketCapFilter: 'running' }));
      
      setScanProgress({ phase: 'Filtering by market cap...', current: 0, total: allTickers.length, found: 0 });
      setStatus({ type: 'loading', msg: `Checking ${allTickers.length} stocks for $40M-$400M market cap...` });

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
          setStatus({ type: 'loading', msg: `Market cap filter: ${i}/${allTickers.length} checked (${qualifiedTickers.length} qualify)` });
        }
        
        await new Promise(r => setTimeout(r, 220));
      }

      setDiscoveryStatus(p => ({ ...p, marketCapFilter: 'complete', technicalScanner: 'running', insiderScanner: 'running', financialScanner: 'running' }));
      
      setScanProgress({ phase: 'Fetching detailed data...', current: 0, total: qualifiedTickers.length, found: qualifiedTickers.length });
      setStatus({ type: 'loading', msg: `Analyzing ${qualifiedTickers.length} small-caps...` });
      
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
            setStocks(calcScores([...processedStocks], weights));
          }
        }
        
        setScanProgress(p => ({ ...p, current: i + 1, phase: `Analyzing ${ticker}...` }));
        
        if (i % 5 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          setStatus({ type: 'loading', msg: `${processedStocks.length} stocks analyzed (${elapsed}s elapsed)` });
        }
        
        await new Promise(r => setTimeout(r, 450));
      }

      const scoredStocks = calcScores(processedStocks, weights);
      setStocks(scoredStocks);

      setDiscoveryStatus(p => ({ ...p, technicalScanner: 'complete', insiderScanner: 'complete', financialScanner: 'complete' }));
      
      for (const a of analysisAgents) {
        setAnalysisStatus(p => ({ ...p, [a.id]: 'complete' }));
      }

      const scanStats = { phase: 'complete', current: allTickers.length, total: allTickers.length, found: scoredStocks.length };
      
      saveToCache(scoredStocks, scanStats);
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

  const handleWeight = (id, val) => {
    const w = { ...weights, [id]: val };
    setWeights(w);
    setStocks(p => calcScores(p, w));
  };

  const sorted = [...stocks]
    .filter(s => sectorFilter === 'all' || s.sector === sectorFilter)
    .sort((a, b) => {
      if (sortBy === 'compositeScore') return b.compositeScore - a.compositeScore;
      if (sortBy === 'netCash') return (b.netCash || 0) - (a.netCash || 0);
      return (b.agentScores?.[sortBy] || 0) - (a.agentScores?.[sortBy] || 0);
    });

  const sectors = [...new Set(stocks.map(s => s.sector))].filter(Boolean).sort();

  const StatusIcon = ({ s }) => {
    if (s === 'running') return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
    if (s === 'complete') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  const NetCashBadge = ({ amount, hasData }) => {
    if (!hasData) {
      return <span className="text-xs text-slate-500 italic">No data</span>;
    }
    const isPositive = amount >= 0;
    return (
      <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" 
           style={{ background: isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: isPositive ? '#34d399' : '#f87171' }}>
        <Banknote className="w-3 h-3" />
        <span style={{ fontFamily: 'monospace' }}>{formatMoney(amount)}</span>
      </div>
    );
  };

  const InsiderBadge = ({ data }) => {
    if (!data?.date) {
      return <span className="text-xs text-slate-500 italic">None found</span>;
    }
    const daysSince = Math.floor((Date.now() - new Date(data.date)) / (1000 * 60 * 60 * 24));
    const isRecent = daysSince < 90;
    return (
      <div className="text-xs">
        <div className="flex items-center gap-1" style={{ color: isRecent ? '#34d399' : '#94a3b8' }}>
          <Calendar className="w-3 h-3" />
          <span>{formatDate(data.date)}</span>
        </div>
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
              <p className="text-xs text-slate-500">Small-Cap Scanner • $40M-$400M {testMode && <span className="text-amber-400">• TEST MODE ({TEST_MODE_LIMIT} stocks)</span>}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ 
              background: status.type === 'live' ? 'rgba(16,185,129,0.1)' : status.type === 'cached' ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.1)', 
              borderColor: status.type === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)', 
              color: status.type === 'live' ? '#34d399' : '#a5b4fc' 
            }}>
              {(status.type === 'loading' || isAnalyzingAI) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>{status.msg}</span>
              {cacheAge && status.type === 'cached' && <span className="text-slate-500">• {formatCacheAge(cacheAge)}</span>}
            </div>
            <button onClick={() => setShowDiscovery(!showDiscovery)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showDiscovery ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showDiscovery ? '#6ee7b7' : '#94a3b8' }}><Radar className="w-4 h-4" />Discovery</button>
            <button onClick={() => setShowWeights(!showWeights)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showWeights ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showWeights ? '#fcd34d' : '#94a3b8' }}><Sliders className="w-4 h-4" />Weights</button>
            
            {/* Grok AI Analysis Button */}
            {stocks.length > 0 && (
              <button 
                onClick={runGrokAnalysis} 
                disabled={isAnalyzingAI || isScanning}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2"
                style={{ 
                  background: isAnalyzingAI ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.1)', 
                  borderColor: 'rgba(239,68,68,0.3)', 
                  color: '#f87171',
                  opacity: (isAnalyzingAI || isScanning) ? 0.7 : 1
                }}
              >
                {isAnalyzingAI ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing {aiProgress.current}/{aiProgress.total}...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />Grok AI (Top 10)</>
                )}
              </button>
            )}
            
            {!isScanning && stocks.length > 0 && (
              <button onClick={() => runFullScan(true)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}>
                <RotateCcw className="w-4 h-4" />Rescan
              </button>
            )}
            <button onClick={() => runFullScan(stocks.length === 0)} disabled={isScanning} className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2" style={{ background: isScanning ? 'rgba(245,158,11,0.2)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: isScanning ? '#fcd34d' : 'white' }}>
              {isScanning ? <><RefreshCw className="w-4 h-4 animate-spin" />Scanning...</> : <><Play className="w-4 h-4" />Run Full Scan</>}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-6 py-6 min-h-screen">
        {error && <div className="mb-4 p-4 rounded-xl border flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}><AlertCircle className="w-5 h-5 text-red-400" /><p className="text-sm text-red-300 flex-1">{error}</p><button onClick={() => setError(null)} className="text-red-400"><X className="w-4 h-4" /></button></div>}

        {(isScanning || isAnalyzingAI) && (
          <div className="mb-6 p-5 rounded-2xl border" style={{ background: isAnalyzingAI ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', borderColor: isAnalyzingAI ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-5 h-5 animate-spin ${isAnalyzingAI ? 'text-red-400' : 'text-indigo-400'}`} />
                <span className={`text-sm ${isAnalyzingAI ? 'text-red-300' : 'text-indigo-300'}`}>
                  {isAnalyzingAI ? `Grok AI analyzing top 10...` : scanProgress.phase}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {isAnalyzingAI ? (
                  <span className="text-red-400 mono">{aiProgress.current} / {aiProgress.total}</span>
                ) : (
                  <>
                    <span className="text-indigo-400 mono">{scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}</span>
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
              <button onClick={() => setWeights({ pricePosition: 40, insiderActivity: 40, netCash: 20 })} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>Reset</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {analysisAgents.map(a => (
                <div key={a.id} className="rounded-xl p-4 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}20` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><span className="text-sm font-medium text-slate-200">{a.name}</span></div>
                  <div className="flex items-center gap-3"><input type="range" min="0" max="100" value={weights[a.id]} onChange={e => handleWeight(a.id, parseInt(e.target.value))} className="flex-1" style={{ accentColor: a.color }} /><span className="mono text-sm font-semibold w-8 text-right" style={{ color: a.color }}>{weights[a.id]}</span></div>
                </div>
              ))}
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
                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" />Grok AI Analysis</h3>
                <p className="text-xs text-slate-400 mb-2">Click the "Grok AI (Top 10)" button to get AI investment analysis for the top 10 ranked stocks.</p>
                <p className="text-xs text-slate-500">{stocksWithAI} of {stocks.length} stocks analyzed</p>
              </div>
              
              <div className="mt-4 p-4 rounded-xl border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2"><Users className="w-4 h-4" />Insider Data</h3>
                <p className="text-xs text-slate-400">SEC Form 4 filings via Finnhub. Shows most recent open market purchase with date, shares, and total value.</p>
              </div>
            </div>
          </div>

          <div className="col-span-9">
            <div className="card rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
                <div><h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" />Stock Rankings</h2><p className="text-xs text-slate-500">{sorted.length} stocks {lastUpdate && `• ${lastUpdate.toLocaleTimeString()}`}</p></div>
                <div className="flex gap-3">
                  <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="all">All Sectors</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}>
                    <option value="compositeScore">Composite Score</option>
                    <option value="pricePosition">Price Position</option>
                    <option value="insiderActivity">Insider Activity</option>
                    <option value="netCash">Net Cash</option>
                  </select>
                </div>
              </div>
              <div className="divide-y divide-slate-800/30 max-h-[calc(100vh-300px)] overflow-y-auto">
                {sorted.length === 0 && !isScanning ? (
                  <div className="p-12 text-center"><Database className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-400">Click "Run Full Scan" to find small-cap opportunities</p><p className="text-xs text-slate-600 mt-2">{testMode ? `Test Mode: Scanning ${TEST_MODE_LIMIT} stocks` : 'Full scan mode'}</p></div>
                ) : sorted.map((s, i) => (
                  <div key={s.ticker} className="row cursor-pointer" onClick={() => setSelected(selected?.ticker === s.ticker ? null : s)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: i < 3 ? ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.2)', 'rgba(194,65,12,0.2)'][i] : 'rgba(30,41,59,0.5)', color: i < 3 ? ['#fbbf24', '#cbd5e1', '#fb923c'][i] : '#64748b' }}>#{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="mono font-bold text-lg text-slate-100">{s.ticker}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.change >= 0 ? '#34d399' : '#f87171' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span>
                            {s.aiAnalysis && <Sparkles className="w-4 h-4 text-red-400" title="Grok AI Analysis Available" />}
                          </div>
                          <p className="text-xs text-slate-500 truncate">{s.name}</p>
                        </div>
                        <div className="text-right w-24"><p className="mono text-sm font-semibold text-slate-200">${s.price?.toFixed(2)}</p><p className="text-xs text-indigo-400 mono">${s.marketCap}M</p></div>
                        <div className="w-28"><NetCashBadge amount={s.netCash} hasData={s.hasFinancials} /></div>
                        <div className="w-36"><InsiderBadge data={s.lastInsiderPurchase} /></div>
                        <div className="w-24">
                          <div className="text-xs text-slate-400">From 52w Low</div>
                          <div className="mono text-sm font-semibold" style={{ color: s.fromLow < 20 ? '#34d399' : s.fromLow < 50 ? '#fbbf24' : '#f87171' }}>{s.fromLow?.toFixed(1)}%</div>
                        </div>
                        <div className="w-28"><div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-400">Score</span><span className="mono text-sm font-bold text-indigo-400">{s.compositeScore.toFixed(1)}</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.compositeScore}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} /></div></div>
                        <div className="w-8">{selected?.ticker === s.ticker ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
                      </div>
                      
                      {selected?.ticker === s.ticker && (
                        <div className="mt-4 pt-4 border-t border-slate-800/30">
                          {s.aiAnalysis && (
                            <div className="mb-4 p-4 rounded-xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}>
                              <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" />Grok AI Investment Analysis</h4>
                              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{s.aiAnalysis}</p>
                            </div>
                          )}
                          
                          {!s.aiAnalysis && i < 10 && (
                            <div className="mb-4 p-4 rounded-xl border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                              <p className="text-sm text-slate-400 flex items-center gap-2"><Sparkles className="w-4 h-4 text-red-400" />Click "Grok AI (Top 10)" button above to generate AI analysis</p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-4 gap-4">
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                              <p className="text-xs text-emerald-400">52-Week Range</p>
                              <p className="text-lg font-bold text-slate-200">${s.low52?.toFixed(2)} - ${s.high52?.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-500">{s.fromLow?.toFixed(1)}% above low • {s.positionIn52Week?.toFixed(0)}% of range</p>
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)' }}>
                              <p className="text-xs text-violet-400">Net Cash Position</p>
                              {s.hasFinancials ? (
                                <>
                                  <p className="text-lg font-bold" style={{ color: s.netCash >= 0 ? '#34d399' : '#f87171' }}>{formatMoney(s.netCash)}</p>
                                  <p className="text-[10px] text-slate-500">Cash: {formatMoney(s.cash)} | Debt: {formatMoney(s.debt)}</p>
                                </>
                              ) : (
                                <p className="text-slate-500 italic">Financial data unavailable</p>
                              )}
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                              <p className="text-xs text-emerald-400">Last Insider Purchase</p>
                              {s.lastInsiderPurchase ? (
                                <>
                                  <p className="text-lg font-bold text-slate-200">{formatMoney(s.lastInsiderPurchase.amount)}</p>
                                  <p className="text-[10px] text-slate-500">{formatDate(s.lastInsiderPurchase.date)}</p>
                                  <p className="text-[10px] text-slate-500">{s.lastInsiderPurchase.shares?.toLocaleString()} shares @ ${s.lastInsiderPurchase.price?.toFixed(2)}</p>
                                  {s.lastInsiderPurchase.name && <p className="text-[10px] text-slate-400 truncate">by {s.lastInsiderPurchase.name}</p>}
                                </>
                              ) : (
                                <p className="text-slate-500 italic">No purchases in past year</p>
                              )}
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                              <p className="text-xs text-amber-400">RSI ({s.rsi})</p>
                              <p className="font-semibold text-slate-200">{s.rsi < 30 ? 'Oversold 🟢' : s.rsi > 70 ? 'Overbought 🔴' : 'Neutral'}</p>
                              <p className="text-[10px] text-slate-500">14-day relative strength</p>
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
          <p className="text-xs text-slate-600">ValueHunter AI • Powered by Polygon.io, Finnhub & xAI Grok</p>
          <button 
            onClick={() => {
              setTestMode(!testMode);
              localStorage.removeItem(CACHE_KEY);
              setStocks([]);
              setScanProgress({ phase: '', current: 0, total: 0, found: 0 });
              setStatus({ type: 'ready', msg: 'Click Run Full Scan' });
            }} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            style={{ 
              background: testMode ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', 
              borderColor: testMode ? 'rgba(245,158,11,0.3)' : 'rgba(51,65,85,0.5)', 
              color: testMode ? '#fcd34d' : '#64748b' 
            }}
          >
            <Beaker className="w-4 h-4" />
            {testMode ? `Test Mode ON (${TEST_MODE_LIMIT} stocks)` : 'Test Mode OFF (Full Scan)'}
          </button>
        </footer>
      </div>
    </div>
  );
}
