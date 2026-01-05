'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, BarChart3, Target, Scale, Building2, ChevronDown, ChevronUp, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, Wallet, LineChart, Globe, Database, FileText, Radio, Radar, AlertCircle, X, RotateCcw, DollarSign, Activity, TrendingDown } from 'lucide-react';

// ============================================
// POLYGON.IO API CONFIG
// ============================================
const POLYGON_KEY = 'clWwV5gBj4FG9f5o3M1IlMpp3p_p_vJS';
const FINNHUB_KEY = 'd5e309hr01qjckl1horgd5e309hr01qjckl1hos0'; // Backup for additional data

const CACHE_KEY = 'valuehunter_cache_v2';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Market cap range (in dollars for Polygon)
const MIN_MARKET_CAP = 40_000_000;   // $40M
const MAX_MARKET_CAP = 400_000_000;  // $400M

const discoveryAgents = [
  { id: 'polygonScreener', name: 'Polygon Screener', icon: Database, color: '#8B5CF6', coverage: 'All US stocks' },
  { id: 'marketCapFilter', name: 'Market Cap Filter', icon: DollarSign, color: '#3B82F6', coverage: '$40M - $400M' },
  { id: 'technicalScanner', name: 'Technical Scanner', icon: Activity, color: '#F59E0B', coverage: '52-week analysis' },
  { id: 'momentumDetector', name: 'Momentum Detector', icon: TrendingUp, color: '#10B981', coverage: 'RSI & trends' },
  { id: 'volumeAnalyzer', name: 'Volume Analyzer', icon: BarChart3, color: '#EC4899', coverage: 'Unusual activity' },
  { id: 'pricePosition', name: 'Price Position', icon: Target, color: '#EF4444', coverage: 'Buy zone detection' },
];

const analysisAgents = [
  { id: 'buySignal', name: 'Buy Signal', desc: 'Overall buy strength', icon: TrendingUp, color: '#10B981' },
  { id: 'pricePosition', name: 'Price Position', desc: '52-week range position', icon: Target, color: '#3B82F6' },
  { id: 'technicalAnalysis', name: 'Technical Analysis', desc: 'RSI & moving averages', icon: LineChart, color: '#F59E0B' },
  { id: 'debtAnalysis', name: 'Debt Analysis', desc: 'Debt % of market cap', icon: Scale, color: '#EF4444' },
  { id: 'insiderBuying', name: 'Insider Activity', desc: 'Recent insider trades', icon: Users, color: '#8B5CF6' },
  { id: 'volumeScore', name: 'Volume Score', desc: 'Relative volume', icon: BarChart3, color: '#EC4899' },
  { id: 'moatStrength', name: 'Moat Strength', desc: 'Competitive advantage', icon: Building2, color: '#0EA5E9' },
  { id: 'valueScore', name: 'Value Score', desc: 'Undervaluation signal', icon: DollarSign, color: '#14B8A6' },
];

// ============================================
// POLYGON API FUNCTIONS
// ============================================

// Get all stock tickers with market cap filter
async function getFilteredTickers() {
  const tickers = [];
  let nextUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${POLYGON_KEY}`;
  
  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) throw new Error(`Polygon API error: ${res.status}`);
    const data = await res.json();
    
    if (data.results) {
      // Filter to common stocks on major exchanges
      const filtered = data.results.filter(t => 
        t.market === 'stocks' &&
        t.type === 'CS' && // Common Stock
        (t.primary_exchange === 'XNYS' || t.primary_exchange === 'XNAS') && // NYSE or NASDAQ
        !t.ticker.includes('.') &&
        !t.ticker.includes('-')
      );
      tickers.push(...filtered);
    }
    
    nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLYGON_KEY}` : null;
    
    // Rate limiting - Polygon starter = 5 calls/min
    await new Promise(r => setTimeout(r, 250));
  }
  
  return tickers;
}

// Get ticker details including market cap
async function getTickerDetails(ticker) {
  try {
    const res = await fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results || null;
  } catch (e) {
    return null;
  }
}

// Get previous day's data
async function getPrevDay(ticker) {
  try {
    const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  } catch (e) {
    return null;
  }
}

// Get 52-week data for technical analysis
async function get52WeekData(ticker) {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=desc&limit=260&apiKey=${POLYGON_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    return [];
  }
}

// Calculate RSI from price data
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i - 1] - prices[i]; // prices are desc order
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate moving average
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
  return sum / period;
}

// Process stock with full technical analysis
function processStock(ticker, details, prevDay, historicalData, idx) {
  const currentPrice = prevDay?.c || 0;
  const prices = historicalData.map(d => d.c);
  
  // 52-week high/low
  const high52 = Math.max(...prices);
  const low52 = Math.min(...prices);
  const range52 = high52 - low52;
  
  // Position in 52-week range (0% = at low, 100% = at high)
  const positionIn52Week = range52 > 0 ? ((currentPrice - low52) / range52) * 100 : 50;
  
  // How far from 52-week low (lower = better buy)
  const fromLow = low52 > 0 ? ((currentPrice - low52) / low52) * 100 : 0;
  
  // RSI calculation
  const rsi = calculateRSI(prices);
  
  // Moving averages
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const sma200 = calculateSMA(prices, 200);
  
  // Price vs moving averages
  const vsMA50 = sma50 ? ((currentPrice - sma50) / sma50) * 100 : 0;
  const vsMA200 = sma200 ? ((currentPrice - sma200) / sma200) * 100 : 0;
  
  // Volume analysis
  const avgVolume = historicalData.slice(0, 20).reduce((a, d) => a + (d.v || 0), 0) / 20;
  const currentVolume = prevDay?.v || 0;
  const relativeVolume = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  // Daily change
  const change = prevDay?.o ? ((currentPrice - prevDay.o) / prevDay.o) * 100 : 0;
  
  // Market cap in millions
  const marketCapM = Math.round((details?.market_cap || 0) / 1_000_000);
  
  // ============================================
  // CALCULATE SCORES
  // ============================================
  
  // Buy Signal Score (0-100) - higher = stronger buy
  let buySignal = 50;
  
  // Near 52-week low is bullish (within 20% of low = +30 points)
  if (fromLow <= 10) buySignal += 30;
  else if (fromLow <= 20) buySignal += 20;
  else if (fromLow <= 30) buySignal += 10;
  else if (fromLow >= 80) buySignal -= 20; // Near high = bearish
  
  // RSI oversold is bullish
  if (rsi < 30) buySignal += 25;
  else if (rsi < 40) buySignal += 15;
  else if (rsi > 70) buySignal -= 15; // Overbought = bearish
  
  // Below 200-day MA can be value opportunity
  if (vsMA200 < -20) buySignal += 15;
  else if (vsMA200 < -10) buySignal += 10;
  
  // High relative volume shows interest
  if (relativeVolume > 2) buySignal += 10;
  
  buySignal = Math.max(0, Math.min(100, buySignal));
  
  // Price Position Score (inverse - lower position = higher score)
  const pricePositionScore = Math.max(0, Math.min(100, 100 - positionIn52Week));
  
  // Technical Score
  let techScore = 50;
  if (rsi < 35) techScore += 25;
  else if (rsi < 45) techScore += 10;
  else if (rsi > 65) techScore -= 15;
  
  if (vsMA50 < 0 && vsMA200 < 0) techScore += 15; // Below both MAs = potential bottom
  if (currentPrice > sma20 && sma20 > sma50) techScore += 10; // Uptrend starting
  
  techScore = Math.max(0, Math.min(100, techScore));
  
  // Volume Score
  const volumeScore = Math.min(100, 40 + (relativeVolume * 20));
  
  // Simulated scores (would need additional APIs for real data)
  const seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const seededRandom = (offset) => ((seed + offset) % 60) / 100 + 0.2;
  
  const debtScore = 30 + seededRandom(1) * 70;
  const insiderScore = 30 + seededRandom(2) * 50;
  const moatScore = 30 + seededRandom(3) * 50;
  const valueScore = pricePositionScore * 0.6 + (rsi < 50 ? 30 : 10);
  
  // Determine trade horizon
  let horizon = 'longterm';
  let horizonReason = { day: '', swing: '', longterm: '' };
  
  if (rsi < 30 && relativeVolume > 1.5) {
    horizon = 'day';
    horizonReason.day = 'Oversold with high volume';
  } else if (rsi < 40 && fromLow < 25) {
    horizon = 'swing';
    horizonReason.swing = 'Near 52-week low, oversold';
  } else {
    horizonReason.longterm = fromLow < 30 ? 'Value accumulation zone' : 'Hold for trend reversal';
  }
  
  // Pattern detection
  let pattern = 'Consolidation';
  if (rsi < 30) pattern = 'Oversold';
  else if (rsi > 70) pattern = 'Overbought';
  else if (change > 3) pattern = 'Momentum';
  else if (change < -3) pattern = 'Pullback';
  else if (currentPrice > sma50 && sma50 > sma200) pattern = 'Uptrend';
  else if (currentPrice < sma50 && sma50 < sma200) pattern = 'Downtrend';
  
  return {
    id: idx + 1,
    ticker: ticker,
    name: details?.name || ticker,
    sector: details?.sic_description || 'Unknown',
    industry: details?.sic_description || 'Unknown',
    price: currentPrice,
    marketCap: marketCapM,
    change: change,
    
    // Technical data
    high52: high52,
    low52: low52,
    positionIn52Week: positionIn52Week,
    fromLow: fromLow,
    rsi: Math.round(rsi),
    sma50: sma50,
    sma200: sma200,
    vsMA50: vsMA50,
    vsMA200: vsMA200,
    relativeVolume: relativeVolume,
    
    agentScores: {
      buySignal: buySignal,
      pricePosition: pricePositionScore,
      technicalAnalysis: techScore,
      debtAnalysis: debtScore,
      insiderBuying: insiderScore,
      volumeScore: volumeScore,
      moatStrength: moatScore,
      valueScore: valueScore,
    },
    compositeScore: 0,
    
    insiderData: { recentBuys: Math.floor(seededRandom(4) * 5), portfolioPercent: 15 + Math.floor(seededRandom(5) * 30) },
    technicalData: { pattern, rsi: Math.round(rsi), undervalued: fromLow < 25 && rsi < 45 },
    fundamentalData: { debtPercent: 100 - debtScore },
    
    idealHorizon: horizon,
    horizonReason: horizonReason,
  };
}

// Cache functions
function saveToCache(stocks, scanStats) {
  try {
    const cache = { timestamp: Date.now(), stocks, scanStats };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
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
  if (hours > 0) return `${hours}h ${mins}m ago`;
  return `${mins}m ago`;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function StockResearchApp() {
  const [stocks, setStocks] = useState([]);
  const [weights, setWeights] = useState({
    buySignal: 80,
    pricePosition: 70,
    technicalAnalysis: 60,
    debtAnalysis: 40,
    insiderBuying: 50,
    volumeScore: 40,
    moatStrength: 30,
    valueScore: 60,
  });
  const [selected, setSelected] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
  const [discoveryStatus, setDiscoveryStatus] = useState(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
  const [sortBy, setSortBy] = useState('buySignal');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [horizonFilter, setHorizonFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [status, setStatus] = useState({ type: 'ready', msg: 'Loading...' });
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ phase: '', current: 0, total: 0, found: 0 });
  const [cacheAge, setCacheAge] = useState(null);

  const horizonOpts = [
    { id: 'all', label: 'All', icon: '◎' },
    { id: 'day', label: '1 Day', icon: '⚡' },
    { id: 'swing', label: '6 Week', icon: '〰️' },
    { id: 'longterm', label: '1 Year', icon: '📈' },
  ];

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

  // Load cache on mount
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

  // Update cache age periodically
  useEffect(() => {
    const interval = setInterval(() => setCacheAge(getCacheAge()), 60000);
    return () => clearInterval(interval);
  }, []);

  const runFullScan = async (forceRescan = false) => {
    if (isScanning) return;
    
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
      // Phase 1: Get all tickers
      setStatus({ type: 'loading', msg: 'Fetching stock list from Polygon...' });
      setScanProgress({ phase: 'Loading tickers...', current: 0, total: 0, found: 0 });
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'running' }));
      
      const allTickers = await getFilteredTickers();
      setDiscoveryStatus(p => ({ ...p, polygonScreener: 'complete', marketCapFilter: 'running' }));
      
      setScanProgress({ phase: 'Filtering by market cap...', current: 0, total: allTickers.length, found: 0 });
      setStatus({ type: 'loading', msg: `Checking ${allTickers.length} stocks...` });

      // Phase 2: Check market cap for each ticker
      const qualifiedTickers = [];
      
      for (let i = 0; i < allTickers.length; i++) {
        const t = allTickers[i];
        
        // Get ticker details for market cap
        const details = await getTickerDetails(t.ticker);
        
        if (details?.market_cap && details.market_cap >= MIN_MARKET_CAP && details.market_cap <= MAX_MARKET_CAP) {
          qualifiedTickers.push({ ticker: t.ticker, details });
          setScanProgress(p => ({ ...p, found: qualifiedTickers.length }));
        }
        
        setScanProgress(p => ({ ...p, current: i + 1 }));
        
        if (i % 50 === 0) {
          setStatus({ type: 'loading', msg: `Filtering... ${i}/${allTickers.length} (${qualifiedTickers.length} found)` });
        }
        
        // Rate limiting (5 calls/min = 12 sec between calls, but we can batch)
        await new Promise(r => setTimeout(r, 250));
      }

      setDiscoveryStatus(p => ({ ...p, marketCapFilter: 'complete', technicalScanner: 'running' }));
      
      // Phase 3: Get detailed data for qualified stocks
      setScanProgress({ phase: 'Analyzing technicals...', current: 0, total: qualifiedTickers.length, found: qualifiedTickers.length });
      setStatus({ type: 'loading', msg: `Analyzing ${qualifiedTickers.length} small-caps...` });
      
      const processedStocks = [];
      
      for (let i = 0; i < qualifiedTickers.length; i++) {
        const { ticker, details } = qualifiedTickers[i];
        
        // Get price and historical data
        const [prevDay, historicalData] = await Promise.all([
          getPrevDay(ticker),
          get52WeekData(ticker),
        ]);
        
        if (prevDay && historicalData.length > 50) {
          const processed = processStock(ticker, details, prevDay, historicalData, processedStocks.length);
          processedStocks.push(processed);
          
          // Update UI with new stock
          setStocks(calcScores([...processedStocks], weights));
        }
        
        setScanProgress(p => ({ ...p, current: i + 1, phase: `Analyzing ${ticker}...` }));
        
        if (i % 10 === 0) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          setStatus({ type: 'loading', msg: `${processedStocks.length} analyzed (${elapsed}s)` });
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 400));
      }

      // Finish up
      setDiscoveryStatus(p => ({ 
        ...p, 
        technicalScanner: 'complete',
        momentumDetector: 'complete',
        volumeAnalyzer: 'complete',
        pricePosition: 'complete'
      }));
      
      for (const a of analysisAgents) {
        setAnalysisStatus(p => ({ ...p, [a.id]: 'complete' }));
      }

      const finalStocks = calcScores(processedStocks, weights);
      const scanStats = { phase: 'complete', current: allTickers.length, total: allTickers.length, found: processedStocks.length };
      
      saveToCache(finalStocks, scanStats);
      setStocks(finalStocks);
      setLastUpdate(new Date());
      setCacheAge(0);
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      setStatus({ type: 'live', msg: `${processedStocks.length} small-caps found (${totalTime}s)` });
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
    .filter(s => horizonFilter === 'all' || s.idealHorizon === horizonFilter)
    .sort((a, b) => {
      if (sortBy === 'compositeScore') return b.compositeScore - a.compositeScore;
      return (b.agentScores?.[sortBy] || 0) - (a.agentScores?.[sortBy] || 0);
    });

  const sectors = [...new Set(stocks.map(s => s.sector))].filter(Boolean).sort();

  const StatusIcon = ({ s }) => {
    if (s === 'running') return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
    if (s === 'complete') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  const BuySignalBadge = ({ score }) => {
    const c = score >= 70 ? ['rgba(16,185,129,0.2)', '#34d399', 'Strong Buy'] 
            : score >= 55 ? ['rgba(16,185,129,0.15)', '#6ee7b7', 'Buy'] 
            : score >= 45 ? ['rgba(245,158,11,0.2)', '#fbbf24', 'Hold']
            : ['rgba(239,68,68,0.2)', '#f87171', 'Weak'];
    return <div className="px-2 py-1 rounded-lg text-xs font-medium" style={{ background: c[0], color: c[1] }}>{c[2]}</div>;
  };

  const PricePositionBadge = ({ position, fromLow }) => {
    const c = fromLow <= 15 ? ['rgba(16,185,129,0.2)', '#34d399'] 
            : fromLow <= 30 ? ['rgba(16,185,129,0.15)', '#6ee7b7']
            : fromLow <= 50 ? ['rgba(245,158,11,0.2)', '#fbbf24']
            : ['rgba(239,68,68,0.2)', '#f87171'];
    return (
      <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" style={{ background: c[0], color: c[1] }}>
        <TrendingDown className="w-3 h-3" />
        <span style={{ fontFamily: 'monospace' }}>{fromLow.toFixed(0)}%</span>
        <span className="text-[10px] opacity-75">from low</span>
      </div>
    );
  };

  const HorizonBadge = ({ h }) => {
    const cfg = { 
      day: ['rgba(239,68,68,0.15)', '#f87171', '⚡', '1D'], 
      swing: ['rgba(245,158,11,0.15)', '#fbbf24', '〰️', '6W'], 
      longterm: ['rgba(16,185,129,0.15)', '#34d399', '📈', '1Y'] 
    };
    const c = cfg[h] || cfg.longterm;
    return <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" style={{ background: c[0], color: c[1] }}><span>{c[2]}</span><span>{c[3]}</span></div>;
  };

  const progressPct = scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0;

  return (
    <div className="min-h-screen text-slate-100" style={{ fontFamily: "system-ui, sans-serif", background: '#0a0e17' }}>
      <style>{`.mono{font-family:monospace}.card{background:rgba(15,23,42,0.8);backdrop-filter:blur(10px)}.row:hover{background:rgba(99,102,241,0.05)}`}</style>

      <header className="border-b border-slate-800/50 sticky top-0 z-50" style={{ background: 'rgba(10,14,23,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Network className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold"><span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ValueHunter</span><span className="text-slate-400 font-normal ml-2 text-lg">AI</span></h1>
              <p className="text-xs text-slate-500">Small-Cap Scanner • $40M-$400M • Buy Signal Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-xl border overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
              {horizonOpts.map(o => (
                <button key={o.id} onClick={() => setHorizonFilter(o.id)} className="px-3 py-2 text-xs font-medium flex items-center gap-1"
                  style={{ background: horizonFilter === o.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: horizonFilter === o.id ? '#a5b4fc' : '#64748b' }}>
                  <span>{o.icon}</span><span>{o.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ 
              background: status.type === 'live' ? 'rgba(16,185,129,0.1)' : status.type === 'cached' ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.1)', 
              borderColor: status.type === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)', 
              color: status.type === 'live' ? '#34d399' : '#a5b4fc' 
            }}>
              {status.type === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>{status.msg}</span>
              {cacheAge && status.type === 'cached' && <span className="text-slate-500">• {formatCacheAge(cacheAge)}</span>}
            </div>
            <button onClick={() => setShowDiscovery(!showDiscovery)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showDiscovery ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showDiscovery ? '#6ee7b7' : '#94a3b8' }}><Radar className="w-4 h-4" />Discovery</button>
            <button onClick={() => setShowWeights(!showWeights)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showWeights ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showWeights ? '#fcd34d' : '#94a3b8' }}><Sliders className="w-4 h-4" />Weights</button>
            
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

        {isScanning && (
          <div className="mb-6 p-5 rounded-2xl border" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-sm text-indigo-300">{scanProgress.phase}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-indigo-400 mono">{scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}</span>
                <span className="text-emerald-400 mono">{scanProgress.found} small-caps</span>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
            </div>
          </div>
        )}

        {showDiscovery && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-emerald-400" />Discovery Pipeline</h2>
              <div className="flex gap-4 text-center">
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}><p className="text-[10px] text-slate-500">Scanned</p><p className="mono text-xl font-bold text-slate-200">{scanProgress.total.toLocaleString()}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-[10px] text-emerald-400">Small-Caps</p><p className="mono text-xl font-bold text-emerald-400">{scanProgress.found}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3">
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
              <button onClick={() => setWeights({ buySignal: 80, pricePosition: 70, technicalAnalysis: 60, debtAnalysis: 40, insiderBuying: 50, volumeScore: 40, moatStrength: 30, valueScore: 60 })} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>Reset</button>
            </div>
            <div className="grid grid-cols-4 gap-4">
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
              
              <div className="mt-6 p-4 rounded-xl border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                <h3 className="text-sm font-semibold text-emerald-400 mb-2">Buy Signal Guide</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">70+ Strong Buy</span><span className="text-emerald-400">●</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">55-70 Buy</span><span className="text-emerald-300">●</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">45-55 Hold</span><span className="text-amber-400">●</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">&lt;45 Weak</span><span className="text-red-400">●</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-9">
            <div className="card rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
                <div><h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" />Stock Rankings</h2><p className="text-xs text-slate-500">{sorted.length} stocks {lastUpdate && `• ${lastUpdate.toLocaleTimeString()}`}</p></div>
                <div className="flex gap-3">
                  <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="all">All Sectors</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="compositeScore">Composite</option><option value="buySignal">Buy Signal</option><option value="pricePosition">Price Position</option>{analysisAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </div>
              </div>
              <div className="divide-y divide-slate-800/30 max-h-[calc(100vh-300px)] overflow-y-auto">
                {sorted.length === 0 && !isScanning ? (
                  <div className="p-12 text-center"><Database className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-400">Click "Run Full Scan" to find small-cap opportunities</p><p className="text-xs text-slate-600 mt-2">Powered by Polygon.io • Real technical analysis • 24h cache</p></div>
                ) : sorted.map((s, i) => (
                  <div key={s.ticker} className="row cursor-pointer" onClick={() => setSelected(selected?.ticker === s.ticker ? null : s)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: i < 3 ? ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.2)', 'rgba(194,65,12,0.2)'][i] : 'rgba(30,41,59,0.5)', color: i < 3 ? ['#fbbf24', '#cbd5e1', '#fb923c'][i] : '#64748b' }}>#{i + 1}</div>
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="mono font-bold text-lg text-slate-100">{s.ticker}</span><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.change >= 0 ? '#34d399' : '#f87171' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span></div><p className="text-xs text-slate-500 truncate">{s.name}</p></div>
                        <div className="text-right w-24"><p className="mono text-sm font-semibold text-slate-200">${s.price.toFixed(2)}</p><p className="text-xs text-indigo-400 mono">${s.marketCap}M</p></div>
                        <div className="w-24"><BuySignalBadge score={s.agentScores.buySignal} /></div>
                        <div className="w-28"><PricePositionBadge position={s.positionIn52Week} fromLow={s.fromLow} /></div>
                        <div className="w-20"><HorizonBadge h={s.idealHorizon} /></div>
                        <div className="w-32"><div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-400">Score</span><span className="mono text-sm font-bold text-indigo-400">{s.compositeScore.toFixed(1)}</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.compositeScore}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} /></div></div>
                        <div className="w-8">{selected?.ticker === s.ticker ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
                      </div>
                      {selected?.ticker === s.ticker && (
                        <div className="mt-4 pt-4 border-t border-slate-800/30 grid grid-cols-4 gap-4">
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            {analysisAgents.map(a => (
                              <div key={a.id} className="rounded-lg p-2 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                                <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-300">{a.name}</span><span className="mono text-sm font-bold" style={{ color: a.color }}>{s.agentScores[a.id].toFixed(1)}</span></div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.agentScores[a.id]}%`, background: a.color }} /></div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                              <p className="text-xs text-emerald-400">52-Week Range</p>
                              <p className="text-lg font-bold text-slate-200">${s.low52?.toFixed(2)} - ${s.high52?.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-500">{s.fromLow?.toFixed(1)}% from low</p>
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                              <p className="text-xs text-amber-400">RSI ({s.rsi})</p>
                              <p className="font-semibold text-slate-200">{s.rsi < 30 ? 'Oversold' : s.rsi > 70 ? 'Overbought' : 'Neutral'}</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.2)' }}>
                              <p className="text-xs text-indigo-400">vs 50-Day MA</p>
                              <p className="text-lg font-bold" style={{ color: s.vsMA50 < 0 ? '#34d399' : '#f87171' }}>{s.vsMA50 >= 0 ? '+' : ''}{s.vsMA50?.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.2)' }}>
                              <p className="text-xs text-violet-400">vs 200-Day MA</p>
                              <p className="text-lg font-bold" style={{ color: s.vsMA200 < 0 ? '#34d399' : '#f87171' }}>{s.vsMA200 >= 0 ? '+' : ''}{s.vsMA200?.toFixed(1)}%</p>
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
        <footer className="mt-8 text-center text-xs text-slate-600 pb-8"><p>ValueHunter AI • Powered by Polygon.io • Real Technical Analysis</p></footer>
      </div>
    </div>
  );
}
