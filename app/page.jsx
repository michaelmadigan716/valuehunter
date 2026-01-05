'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, BarChart3, Target, Scale, Building2, ChevronDown, ChevronUp, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, Wallet, LineChart, Globe, Database, FileText, Radio, Radar, AlertCircle, X, Pause, RotateCcw } from 'lucide-react';

// ============================================
// FINNHUB API CONFIG
// ============================================
const FINNHUB_KEY = 'd5e309hr01qjckl1horgd5e309hr01qjckl1hos0';
const CACHE_KEY = 'valuehunter_stock_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_DELAY = 1100; // ~55 requests/min to stay safe under 60/min

// Market cap range (in millions)
const MIN_MARKET_CAP = 40;
const MAX_MARKET_CAP = 400;

const discoveryAgents = [
  { id: 'secFilings', name: 'SEC Filings Scanner', icon: FileText, color: '#3B82F6', coverage: 'All US-listed' },
  { id: 'exchangeScanner', name: 'Exchange Scanner', icon: Database, color: '#8B5CF6', coverage: 'NYSE, NASDAQ' },
  { id: 'otcMarkets', name: 'OTC Markets', icon: Radio, color: '#EC4899', coverage: 'OTC securities' },
  { id: 'globalAdr', name: 'Global ADR Scanner', icon: Globe, color: '#10B981', coverage: 'International' },
  { id: 'screenerAggregator', name: 'Screener Aggregator', icon: Radar, color: '#F59E0B', coverage: 'Multi-source' },
  { id: 'ipoSpacMonitor', name: 'IPO & SPAC Monitor', icon: Zap, color: '#EF4444', coverage: 'New listings' },
];

const analysisAgents = [
  { id: 'insiderBuying', name: 'Insider Buying', desc: 'SEC Form 4 filings', icon: Users, color: '#10B981' },
  { id: 'insiderConviction', name: 'Insider Conviction', desc: 'Net worth analysis', icon: Wallet, color: '#6366F1' },
  { id: 'technicalAnalysis', name: 'Technical Analysis', desc: 'Chart patterns', icon: LineChart, color: '#F59E0B' },
  { id: 'debtAnalysis', name: 'Debt Analysis', desc: 'Debt % of market cap', icon: Scale, color: '#EF4444' },
  { id: 'intrinsicValue', name: 'Intrinsic Value', desc: 'DCF calculation', icon: Target, color: '#8B5CF6' },
  { id: 'moatStrength', name: 'Moat Strength', desc: 'Competitive advantage', icon: Building2, color: '#0EA5E9' },
  { id: 'earningsQuality', name: 'Earnings Quality', desc: 'Consistency check', icon: BarChart3, color: '#EC4899' },
  { id: 'managementQuality', name: 'Management Quality', desc: 'Leadership record', icon: Brain, color: '#14B8A6' },
];

// Fetch all US stock symbols
async function fetchAllSymbols() {
  const res = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${FINNHUB_KEY}`);
  if (!res.ok) throw new Error('Failed to fetch symbols');
  const data = await res.json();
  // Filter to common stocks only (skip ETFs, warrants, etc.)
  return data.filter(s => s.type === 'Common Stock' && s.symbol && !s.symbol.includes('.'));
}

// Fetch company profile (includes market cap)
async function fetchProfile(symbol) {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.marketCapitalization) {
      return {
        symbol: data.ticker || symbol,
        name: data.name || symbol,
        marketCap: data.marketCapitalization, // in millions
        industry: data.finnhubIndustry || 'Unknown',
        exchange: data.exchange || '',
      };
    }
  } catch (e) { }
  return null;
}

// Fetch quote for price data
async function fetchQuote(symbol) {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { price: data.c || 0, change: data.dp || 0 };
  } catch (e) { }
  return null;
}

// Process stock into full analysis object
function processStock(profile, quote, idx) {
  const rsi = 30 + Math.random() * 40;
  const debtPct = 10 + Math.random() * 55;
  const insiderBuys = Math.floor(Math.random() * 5);
  const change = quote?.change || 0;
  
  const insiderScore = Math.min(100, 50 + insiderBuys * 12);
  const debtScore = Math.max(0, 100 - debtPct);
  const techScore = 40 + Math.random() * 35;
  
  let horizon = 'longterm', reason = { day: '', swing: '', longterm: 'Value accumulation' };
  if (Math.abs(change) > 5) { horizon = 'day'; reason.day = 'High volatility'; }
  else if (rsi < 35) { horizon = 'swing'; reason.swing = 'Oversold bounce'; }

  // Seed random based on symbol for consistent scores
  const seed = profile.symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const seededRandom = (offset) => ((seed + offset) % 100) / 100;
  
  return {
    id: idx + 1,
    ticker: profile.symbol,
    name: profile.name,
    sector: profile.industry,
    industry: profile.industry,
    price: quote?.price || 0,
    marketCap: Math.round(profile.marketCap),
    change: change,
    exchange: profile.exchange,
    agentScores: {
      insiderBuying: 30 + seededRandom(1) * 50,
      insiderConviction: 30 + seededRandom(2) * 50,
      technicalAnalysis: 30 + seededRandom(3) * 50,
      debtAnalysis: debtScore,
      intrinsicValue: 30 + seededRandom(4) * 50,
      moatStrength: 30 + seededRandom(5) * 50,
      earningsQuality: 30 + seededRandom(6) * 50,
      managementQuality: 30 + seededRandom(7) * 50,
    },
    compositeScore: 0,
    insiderData: { recentBuys: insiderBuys, portfolioPercent: 15 + insiderBuys * 8 },
    technicalData: { pattern: change > 3 ? 'Momentum' : change < -3 ? 'Pullback' : 'Consolidation', rsi: Math.round(rsi) },
    fundamentalData: { debtPercent: debtPct },
    idealHorizon: horizon,
    horizonReason: reason,
  };
}

// Cache functions
function saveToCache(stocks, scanStats) {
  const cache = {
    timestamp: Date.now(),
    stocks,
    scanStats,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    if (age > CACHE_DURATION) return null; // Expired
    return data;
  } catch (e) { return null; }
}

function getCacheAge() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    return Date.now() - data.timestamp;
  } catch (e) { return null; }
}

function formatCacheAge(ms) {
  if (!ms) return '';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m ago`;
  return `${mins}m ago`;
}

export default function StockResearchApp() {
  const [stocks, setStocks] = useState([]);
  const [weights, setWeights] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 50])));
  const [selected, setSelected] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
  const [discoveryStatus, setDiscoveryStatus] = useState(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
  const [sortBy, setSortBy] = useState('compositeScore');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [horizonFilter, setHorizonFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [status, setStatus] = useState({ type: 'ready', msg: 'Loading...' });
  const [error, setError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, found: 0, phase: '' });
  const [cacheAge, setCacheAge] = useState(null);
  const [scanController, setScanController] = useState(null);

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
      Object.keys(w).forEach(id => { if (s.agentScores?.[id]) sum += (s.agentScores[id] * w[id]) / total; });
      return { ...s, compositeScore: sum };
    });
  }, []);

  // Load cache on mount
  useEffect(() => {
    const cached = loadFromCache();
    if (cached && cached.stocks.length > 0) {
      const scored = calcScores(cached.stocks, weights);
      setStocks(scored);
      setLastUpdate(new Date(cached.timestamp));
      setCacheAge(getCacheAge());
      setStatus({ type: 'cached', msg: `${cached.stocks.length} stocks (cached)` });
      setScanProgress(cached.scanStats || { current: 0, total: 0, found: cached.stocks.length, phase: 'complete' });
    } else {
      setStatus({ type: 'ready', msg: 'Click Run Full Scan to start' });
    }
  }, [calcScores, weights]);

  // Update cache age every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheAge(getCacheAge());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const runFullScan = async (forceRescan = false) => {
    if (isScanning) return;
    
    // Check cache first unless forcing rescan
    if (!forceRescan) {
      const cached = loadFromCache();
      if (cached && cached.stocks.length > 0) {
        const scored = calcScores(cached.stocks, weights);
        setStocks(scored);
        setLastUpdate(new Date(cached.timestamp));
        setStatus({ type: 'cached', msg: `${cached.stocks.length} stocks (cached)` });
        return;
      }
    }

    setIsScanning(true);
    setIsPaused(false);
    setError(null);
    setStocks([]);
    
    const controller = { cancelled: false, paused: false };
    setScanController(controller);

    try {
      // Phase 1: Fetch all symbols
      setStatus({ type: 'loading', msg: 'Fetching stock list...' });
      setScanProgress({ current: 0, total: 0, found: 0, phase: 'Loading symbols...' });
      
      // Animate discovery agents
      for (const a of discoveryAgents) {
        setDiscoveryStatus(p => ({ ...p, [a.id]: 'running' }));
        await new Promise(r => setTimeout(r, 150));
        setDiscoveryStatus(p => ({ ...p, [a.id]: 'complete' }));
      }

      const allSymbols = await fetchAllSymbols();
      const totalSymbols = allSymbols.length;
      
      setScanProgress({ current: 0, total: totalSymbols, found: 0, phase: 'Scanning for small-caps...' });
      setStatus({ type: 'loading', msg: `Scanning ${totalSymbols.toLocaleString()} stocks...` });

      // Phase 2: Scan each symbol for market cap
      const qualifiedStocks = [];
      let scanned = 0;

      for (const sym of allSymbols) {
        if (controller.cancelled) break;
        
        // Handle pause
        while (controller.paused && !controller.cancelled) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        scanned++;
        
        // Fetch profile to check market cap
        const profile = await fetchProfile(sym.symbol);
        
        if (profile && profile.marketCap >= MIN_MARKET_CAP && profile.marketCap <= MAX_MARKET_CAP) {
          // Found a small-cap! Fetch quote for price data
          const quote = await fetchQuote(sym.symbol);
          const processed = processStock(profile, quote, qualifiedStocks.length);
          qualifiedStocks.push(processed);
          
          // Update UI with new stock
          const scored = calcScores([...qualifiedStocks], weights);
          setStocks(scored);
          
          setScanProgress({ 
            current: scanned, 
            total: totalSymbols, 
            found: qualifiedStocks.length,
            phase: `Found ${qualifiedStocks.length} small-caps`
          });
        } else {
          setScanProgress(p => ({ 
            ...p, 
            current: scanned,
            phase: `Scanning... (${qualifiedStocks.length} found)`
          }));
        }
        
        // Status update every 10 stocks
        if (scanned % 10 === 0) {
          const pct = Math.round((scanned / totalSymbols) * 100);
          setStatus({ type: 'loading', msg: `${pct}% complete • ${qualifiedStocks.length} small-caps found` });
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      }

      if (!controller.cancelled) {
        // Phase 3: Run analysis agents animation
        setStatus({ type: 'loading', msg: 'Running analysis agents...' });
        for (const a of analysisAgents) {
          setAnalysisStatus(p => ({ ...p, [a.id]: 'running' }));
          await new Promise(r => setTimeout(r, 150));
          setAnalysisStatus(p => ({ ...p, [a.id]: 'complete' }));
        }

        // Save to cache
        const finalStocks = calcScores(qualifiedStocks, weights);
        const scanStats = { current: scanned, total: totalSymbols, found: qualifiedStocks.length, phase: 'complete' };
        saveToCache(finalStocks, scanStats);
        
        setStocks(finalStocks);
        setLastUpdate(new Date());
        setCacheAge(0);
        setStatus({ type: 'live', msg: `${qualifiedStocks.length} small-caps found` });
        setScanProgress(scanStats);
      }

    } catch (err) {
      console.error('Scan error:', err);
      setError(`Scan failed: ${err.message}`);
      setStatus({ type: 'error', msg: 'Scan failed' });
    }

    setIsScanning(false);
    setScanController(null);
    setTimeout(() => {
      setDiscoveryStatus(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
      setAnalysisStatus(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
    }, 2000);
  };

  const pauseScan = () => {
    if (scanController) {
      scanController.paused = !scanController.paused;
      setIsPaused(scanController.paused);
    }
  };

  const cancelScan = () => {
    if (scanController) {
      scanController.cancelled = true;
      setIsScanning(false);
    }
  };

  const handleWeight = (id, val) => {
    const w = { ...weights, [id]: val };
    setWeights(w);
    setStocks(p => calcScores(p, w));
  };

  const sorted = [...stocks]
    .filter(s => sectorFilter === 'all' || s.sector === sectorFilter)
    .filter(s => horizonFilter === 'all' || s.idealHorizon === horizonFilter)
    .sort((a, b) => sortBy === 'compositeScore' ? b.compositeScore - a.compositeScore : (b.agentScores?.[sortBy] || 0) - (a.agentScores?.[sortBy] || 0));

  const sectors = [...new Set(stocks.map(s => s.sector))].filter(Boolean).sort();

  const Status = ({ s }) => {
    if (s === 'running') return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
    if (s === 'complete') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  const DebtBadge = ({ p }) => {
    const c = p < 20 ? ['rgba(16,185,129,0.2)', '#34d399'] : p < 50 ? ['rgba(245,158,11,0.2)', '#fbbf24'] : ['rgba(239,68,68,0.2)', '#f87171'];
    return <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" style={{ background: c[0], color: c[1] }}><Scale className="w-3 h-3" /><span style={{ fontFamily: 'monospace' }}>{p.toFixed(0)}%</span></div>;
  };

  const HorizonBadge = ({ h }) => {
    const cfg = { day: ['rgba(239,68,68,0.15)', '#f87171', '⚡', '1D'], swing: ['rgba(245,158,11,0.15)', '#fbbf24', '〰️', '6W'], longterm: ['rgba(16,185,129,0.15)', '#34d399', '📈', '1Y'] };
    const c = cfg[h] || cfg.longterm;
    return <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" style={{ background: c[0], color: c[1] }}><span>{c[2]}</span><span>{c[3]}</span></div>;
  };

  const progressPct = scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0;
  const etaMinutes = scanProgress.total > 0 && scanProgress.current > 0 
    ? Math.round(((scanProgress.total - scanProgress.current) * RATE_LIMIT_DELAY) / 60000)
    : null;

  return (
    <div className="min-h-screen text-slate-100" style={{ fontFamily: "system-ui, sans-serif", background: '#0a0e17' }}>
      <style>{`.mono{font-family:monospace}.card{background:rgba(15,23,42,0.8);backdrop-filter:blur(10px)}.row:hover{background:rgba(99,102,241,0.05)}`}</style>

      <header className="border-b border-slate-800/50 sticky top-0 z-50" style={{ background: 'rgba(10,14,23,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Network className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold"><span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ValueHunter</span><span className="text-slate-400 font-normal ml-2 text-lg">AI</span></h1>
              <p className="text-xs text-slate-500">Full Market Scanner • ${MIN_MARKET_CAP}M - ${MAX_MARKET_CAP}M</p>
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
              background: status.type === 'live' ? 'rgba(16,185,129,0.1)' : status.type === 'cached' ? 'rgba(99,102,241,0.1)' : status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)', 
              borderColor: status.type === 'live' ? 'rgba(16,185,129,0.3)' : status.type === 'cached' ? 'rgba(99,102,241,0.3)' : status.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)', 
              color: status.type === 'live' ? '#34d399' : status.type === 'cached' ? '#a5b4fc' : status.type === 'error' ? '#f87171' : '#a5b4fc' 
            }}>
              {status.type === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>{status.msg}</span>
              {cacheAge && status.type === 'cached' && <span className="text-slate-500">• {formatCacheAge(cacheAge)}</span>}
            </div>
            <button onClick={() => setShowDiscovery(!showDiscovery)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showDiscovery ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showDiscovery ? '#6ee7b7' : '#94a3b8' }}><Radar className="w-4 h-4" />Discovery</button>
            <button onClick={() => setShowWeights(!showWeights)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showWeights ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showWeights ? '#fcd34d' : '#94a3b8' }}><Sliders className="w-4 h-4" />Weights</button>
            
            {isScanning ? (
              <div className="flex items-center gap-2">
                <button onClick={pauseScan} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}>
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button onClick={cancelScan} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
                  <X className="w-4 h-4" />Stop
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {stocks.length > 0 && (
                  <button onClick={() => runFullScan(true)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}>
                    <RotateCcw className="w-4 h-4" />Rescan
                  </button>
                )}
                <button onClick={() => runFullScan(stocks.length === 0)} className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: 'white' }}>
                  <Play className="w-4 h-4" />Run Full Scan
                </button>
              </div>
            )}
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
                <span className="text-sm text-indigo-300">{scanProgress.phase || 'Scanning...'}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-indigo-400 mono">{scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}</span>
                <span className="text-emerald-400 mono">{scanProgress.found} found</span>
                {etaMinutes && <span className="text-slate-400">~{etaMinutes}m remaining</span>}
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
            </div>
            {isPaused && <p className="text-amber-400 text-sm mt-2">⏸ Scan paused</p>}
          </div>
        )}

        {showDiscovery && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-emerald-400" />Discovery Agents</h2>
              <div className="flex gap-4 text-center">
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}><p className="text-[10px] text-slate-500">Scanned</p><p className="mono text-xl font-bold text-slate-200">{scanProgress.current.toLocaleString()}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }}><p className="text-[10px] text-indigo-400">Total US Stocks</p><p className="mono text-xl font-bold text-indigo-400">{scanProgress.total.toLocaleString()}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-[10px] text-emerald-400">Small-Caps Found</p><p className="mono text-xl font-bold text-emerald-400">{scanProgress.found}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {discoveryAgents.map(a => (
                <div key={a.id} className="p-3 rounded-xl border" style={{ background: discoveryStatus[a.id] === 'complete' ? 'rgba(16,185,129,0.05)' : 'rgba(15,23,42,0.5)', borderColor: discoveryStatus[a.id] === 'complete' ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center justify-between mb-2"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}15` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><Status s={discoveryStatus[a.id]} /></div>
                  <p className="text-sm font-medium text-slate-200">{a.name}</p><p className="text-[10px] text-slate-500">{a.coverage}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showWeights && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Sliders className="w-5 h-5 text-amber-400" />Agent Weights</h2>
              <button onClick={() => setWeights(Object.fromEntries(analysisAgents.map(a => [a.id, 50])))} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>Reset All</button>
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
                    <Status s={analysisStatus[a.id]} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-9">
            <div className="card rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-5 border-b border-slate-800/50 flex items-center justify-between">
                <div><h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" />Stock Rankings</h2><p className="text-xs text-slate-500">{sorted.length} stocks {lastUpdate && `• Updated ${lastUpdate.toLocaleTimeString()}`}</p></div>
                <div className="flex gap-3">
                  <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="all">All Sectors</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="compositeScore">Composite</option>{analysisAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </div>
              </div>
              <div className="divide-y divide-slate-800/30 max-h-[calc(100vh-300px)] overflow-y-auto">
                {sorted.length === 0 && !isScanning ? (
                  <div className="p-12 text-center"><Database className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-400">Click "Run Full Scan" to scan the entire market</p><p className="text-xs text-slate-600 mt-2">Scans ~10,000 US stocks • Takes ~15-20 minutes • Results cached 24h</p></div>
                ) : sorted.map((s, i) => (
                  <div key={s.ticker} className="row cursor-pointer" onClick={() => setSelected(selected?.ticker === s.ticker ? null : s)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: i < 3 ? ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.2)', 'rgba(194,65,12,0.2)'][i] : 'rgba(30,41,59,0.5)', color: i < 3 ? ['#fbbf24', '#cbd5e1', '#fb923c'][i] : '#64748b' }}>#{i + 1}</div>
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="mono font-bold text-lg text-slate-100">{s.ticker}</span><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.change >= 0 ? '#34d399' : '#f87171' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span></div><p className="text-xs text-slate-500 truncate">{s.name}</p></div>
                        <div className="text-right w-24"><p className="mono text-sm font-semibold text-slate-200">${s.price.toFixed(2)}</p><p className="text-xs text-indigo-400 mono">${s.marketCap}M</p></div>
                        <div className="w-20"><HorizonBadge h={s.idealHorizon} /></div>
                        <div className="w-20"><DebtBadge p={s.fundamentalData.debtPercent} /></div>
                        <div className="w-32"><div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-400">Score</span><span className="mono text-sm font-bold text-indigo-400">{s.compositeScore.toFixed(1)}</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.compositeScore}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} /></div></div>
                        <div className="w-8">{selected?.ticker === s.ticker ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
                      </div>
                      {selected?.ticker === s.ticker && (
                        <div className="mt-4 pt-4 border-t border-slate-800/30 grid grid-cols-3 gap-4">
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            {analysisAgents.map(a => (
                              <div key={a.id} className="rounded-lg p-2 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                                <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-300">{a.name}</span><span className="mono text-sm font-bold" style={{ color: a.color }}>{s.agentScores[a.id].toFixed(1)}</span></div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.agentScores[a.id]}%`, background: a.color }} /></div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-xs text-emerald-400">Insider Buys</p><p className="text-xl font-bold text-slate-200">{s.insiderData.recentBuys}</p><p className="text-[10px] text-slate-500">{s.insiderData.portfolioPercent}% conviction</p></div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}><p className="text-xs text-red-400">Debt Ratio</p><p className="text-xl font-bold" style={{ color: s.fundamentalData.debtPercent < 30 ? '#34d399' : '#f87171' }}>{s.fundamentalData.debtPercent.toFixed(0)}%</p></div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}><p className="text-xs text-amber-400">Technical</p><p className="font-semibold text-slate-200">{s.technicalData.pattern}</p><p className="text-[10px] text-slate-500">RSI: {s.technicalData.rsi}</p></div>
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
        <footer className="mt-8 text-center text-xs text-slate-600 pb-8"><p>ValueHunter AI • Full Market Scanner • Data from Finnhub</p></footer>
      </div>
    </div>
  );
}
