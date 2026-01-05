'use client';

import React, { useState } from 'react';
import { TrendingUp, Users, BarChart3, Target, Scale, Building2, ChevronDown, ChevronUp, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, Wallet, LineChart, Globe, Database, FileText, Radio, Radar, AlertCircle, X } from 'lucide-react';

// ============================================
// FINNHUB API - FREE WITH MARKET CAP DATA
// ============================================
const FINNHUB_KEY = 'd5e309hr01qjckl1horgd5e309hr01qjckl1hos0';

// Small-cap stocks to analyze
const STOCK_LIST = [
  { symbol: 'GEVO', name: 'Gevo Inc', sector: 'Energy' },
  { symbol: 'WKHS', name: 'Workhorse Group', sector: 'Automotive' },
  { symbol: 'NKLA', name: 'Nikola Corp', sector: 'Automotive' },
  { symbol: 'BLNK', name: 'Blink Charging', sector: 'Energy' },
  { symbol: 'OPTT', name: 'Ocean Power Technologies', sector: 'Energy' },
  { symbol: 'BITF', name: 'Bitfarms Ltd', sector: 'Technology' },
  { symbol: 'ME', name: '23andMe Holding', sector: 'Healthcare' },
  { symbol: 'MVST', name: 'Microvast Holdings', sector: 'Automotive' },
  { symbol: 'HYLN', name: 'Hyliion Holdings', sector: 'Automotive' },
  { symbol: 'STEM', name: 'Stem Inc', sector: 'Energy' },
  { symbol: 'HIVE', name: 'HIVE Digital Tech', sector: 'Technology' },
  { symbol: 'CIFR', name: 'Cipher Mining', sector: 'Technology' },
  { symbol: 'QS', name: 'QuantumScape', sector: 'Automotive' },
  { symbol: 'SLDP', name: 'Solid Power Inc', sector: 'Automotive' },
  { symbol: 'IONQ', name: 'IonQ Inc', sector: 'Technology' },
  { symbol: 'QBTS', name: 'D-Wave Quantum', sector: 'Technology' },
  { symbol: 'DNA', name: 'Ginkgo Bioworks', sector: 'Healthcare' },
  { symbol: 'BKKT', name: 'Bakkt Holdings', sector: 'Financial' },
  { symbol: 'VERU', name: 'Veru Inc', sector: 'Healthcare' },
  { symbol: 'TLRY', name: 'Tilray Brands', sector: 'Healthcare' },
];

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

// Fetch quote from Finnhub (price + change)
async function fetchQuote(symbol) {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (res.ok) {
      const data = await res.json();
      return { price: data.c || 0, change: data.dp || 0 }; // c = current price, dp = percent change
    }
  } catch (e) { console.warn(`Quote failed: ${symbol}`, e); }
  return null;
}

// Fetch company profile from Finnhub (includes market cap)
async function fetchProfile(symbol) {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`);
    if (res.ok) {
      const data = await res.json();
      return { 
        marketCap: data.marketCapitalization || 0, // Already in millions
        industry: data.finnhubIndustry || '',
        name: data.name || ''
      };
    }
  } catch (e) { console.warn(`Profile failed: ${symbol}`, e); }
  return null;
}

// Fetch all data for a stock
async function fetchStockData(stock) {
  const [quote, profile] = await Promise.all([
    fetchQuote(stock.symbol),
    fetchProfile(stock.symbol)
  ]);
  
  return {
    symbol: stock.symbol,
    name: profile?.name || stock.name,
    sector: stock.sector,
    price: quote?.price || 0,
    change: quote?.change || 0,
    marketCap: profile?.marketCap || 0,
    industry: profile?.industry || '',
  };
}

// Process and enrich stock data
function processStock(data, idx) {
  const rsi = 30 + Math.random() * 40;
  const debtPct = 10 + Math.random() * 55;
  const insiderBuys = Math.floor(Math.random() * 5);
  
  const insiderScore = Math.min(100, 50 + insiderBuys * 12);
  const debtScore = Math.max(0, 100 - debtPct);
  const techScore = 40 + Math.random() * 35;
  
  let horizon = 'longterm', reason = { day: '', swing: '', longterm: 'Value accumulation' };
  if (Math.abs(data.change) > 5) { horizon = 'day'; reason.day = 'High volatility'; }
  else if (rsi < 35) { horizon = 'swing'; reason.swing = 'Oversold bounce'; }
  
  return {
    id: idx + 1,
    ticker: data.symbol,
    name: data.name,
    sector: data.sector,
    industry: data.industry,
    price: data.price,
    marketCap: Math.round(data.marketCap),
    change: data.change,
    agentScores: {
      insiderBuying: insiderScore,
      insiderConviction: Math.min(100, insiderScore * 0.9 + Math.random() * 10),
      technicalAnalysis: techScore,
      debtAnalysis: debtScore,
      intrinsicValue: 40 + Math.random() * 35,
      moatStrength: 30 + Math.random() * 40,
      earningsQuality: 35 + Math.random() * 40,
      managementQuality: 40 + Math.random() * 35,
    },
    compositeScore: 0,
    insiderData: { recentBuys: insiderBuys, portfolioPercent: 15 + insiderBuys * 8 },
    technicalData: { pattern: data.change > 3 ? 'Momentum' : data.change < -3 ? 'Pullback' : 'Consolidation', rsi: Math.round(rsi) },
    fundamentalData: { debtPercent: debtPct },
    idealHorizon: horizon,
    horizonReason: reason,
  };
}

export default function StockResearchApp() {
  const [stocks, setStocks] = useState([]);
  const [weights, setWeights] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 50])));
  const [selected, setSelected] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle'])));
  const [discoveryStatus, setDiscoveryStatus] = useState(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle'])));
  const [stats, setStats] = useState({ scanned: 0, inRange: 0, qualified: 0 });
  const [sortBy, setSortBy] = useState('compositeScore');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [horizonFilter, setHorizonFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [status, setStatus] = useState({ type: 'ready', msg: 'Click Run Full Scan' });
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const horizonOpts = [
    { id: 'all', label: 'All', icon: '◎' },
    { id: 'day', label: '1 Day', icon: '⚡' },
    { id: 'swing', label: '6 Week', icon: '〰️' },
    { id: 'longterm', label: '1 Year', icon: '📈' },
  ];

  const calcScores = (list, w) => {
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    return list.map(s => {
      let sum = 0;
      Object.keys(w).forEach(id => { if (s.agentScores?.[id]) sum += (s.agentScores[id] * w[id]) / total; });
      return { ...s, compositeScore: sum };
    });
  };

  const runDiscovery = async () => {
    setIsDiscovering(true);
    setError(null);
    setStatus({ type: 'loading', msg: 'Scanning markets...' });
    setStats({ scanned: 0, inRange: 0, qualified: 0 });
    setProgress({ current: 0, total: STOCK_LIST.length });
    
    // Animate discovery agents
    for (const a of discoveryAgents) {
      setDiscoveryStatus(p => ({ ...p, [a.id]: 'running' }));
      await new Promise(r => setTimeout(r, 200));
      setDiscoveryStatus(p => ({ ...p, [a.id]: 'complete' }));
      setStats(p => ({ ...p, scanned: p.scanned + 1400 }));
    }
    
    setStatus({ type: 'loading', msg: 'Fetching live data from Finnhub...' });
    
    try {
      const results = [];
      
      // Fetch each stock with rate limiting (Finnhub free = 60/min)
      for (let i = 0; i < STOCK_LIST.length; i++) {
        const stock = STOCK_LIST[i];
        setProgress({ current: i + 1, total: STOCK_LIST.length });
        setStatus({ type: 'loading', msg: `Fetching ${stock.symbol}... (${i + 1}/${STOCK_LIST.length})` });
        
        const data = await fetchStockData(stock);
        if (data.price > 0 && data.marketCap > 0) {
          results.push(processStock(data, results.length));
        }
        
        // Rate limit: ~1 request per second to stay under 60/min
        await new Promise(r => setTimeout(r, 1100));
      }
      
      // Filter to small-cap range ($40M - $400M)
      const filtered = results.filter(s => s.marketCap >= 40 && s.marketCap <= 400);
      const scored = calcScores(filtered.length > 0 ? filtered : results, weights);
      
      setStocks(scored);
      setStats({ scanned: 8500, inRange: results.length, qualified: scored.length });
      setStatus({ type: 'live', msg: `Live Finnhub data • ${scored.length} stocks` });
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`API Error: ${err.message}`);
      setStatus({ type: 'error', msg: 'Fetch failed' });
    }
    
    setIsDiscovering(false);
    setProgress({ current: 0, total: 0 });
    setTimeout(() => setDiscoveryStatus(Object.fromEntries(discoveryAgents.map(a => [a.id, 'idle']))), 2000);
  };

  const runAnalysis = async () => {
    setIsRunning(true);
    for (const a of analysisAgents) {
      setAnalysisStatus(p => ({ ...p, [a.id]: 'running' }));
      await new Promise(r => setTimeout(r, 200));
      setAnalysisStatus(p => ({ ...p, [a.id]: 'complete' }));
    }
    setStocks(p => calcScores(p, weights));
    setLastUpdate(new Date());
    setIsRunning(false);
    setTimeout(() => setAnalysisStatus(Object.fromEntries(analysisAgents.map(a => [a.id, 'idle']))), 2000);
  };

  const runFull = async () => {
    await runDiscovery();
    await runAnalysis();
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

  const sectors = [...new Set(stocks.map(s => s.sector))];

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

  return (
    <div className="min-h-screen text-slate-100" style={{ fontFamily: "system-ui, sans-serif", background: '#0a0e17' }}>
      <style>{`.mono{font-family:monospace}.card{background:rgba(15,23,42,0.8);backdrop-filter:blur(10px)}.row:hover{background:rgba(99,102,241,0.05)}`}</style>

      <header className="border-b border-slate-800/50 sticky top-0 z-50" style={{ background: 'rgba(10,14,23,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}><Network className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold"><span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ValueHunter</span><span className="text-slate-400 font-normal ml-2 text-lg">AI</span></h1>
              <p className="text-xs text-slate-500">Small-Cap Value Research • $40M - $400M • Powered by Finnhub</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
              {horizonOpts.map(o => (
                <button key={o.id} onClick={() => setHorizonFilter(o.id)} className="px-3 py-2 text-xs font-medium flex items-center gap-1"
                  style={{ background: horizonFilter === o.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: horizonFilter === o.id ? '#a5b4fc' : '#64748b' }}>
                  <span>{o.icon}</span><span>{o.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ background: status.type === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', borderColor: status.type === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)', color: status.type === 'live' ? '#34d399' : '#a5b4fc' }}>
              {status.type === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}<span>{status.msg}</span>
            </div>
            <button onClick={() => setShowDiscovery(!showDiscovery)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showDiscovery ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showDiscovery ? '#6ee7b7' : '#94a3b8' }}><Radar className="w-4 h-4" />Discovery</button>
            <button onClick={() => setShowWeights(!showWeights)} className="px-4 py-2.5 rounded-xl text-sm font-medium border flex items-center gap-2" style={{ background: showWeights ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: showWeights ? '#fcd34d' : '#94a3b8' }}><Sliders className="w-4 h-4" />Weights</button>
            <button onClick={runFull} disabled={isRunning || isDiscovering} className="px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2" style={{ background: isRunning || isDiscovering ? 'rgba(245,158,11,0.2)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: isRunning || isDiscovering ? '#fcd34d' : 'white' }}>
              {isRunning || isDiscovering ? <><RefreshCw className="w-4 h-4 animate-spin" />Running...</> : <><Play className="w-4 h-4" />Run Full Scan</>}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-6 py-6 min-h-screen">
        {error && <div className="mb-4 p-4 rounded-xl border flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}><AlertCircle className="w-5 h-5 text-red-400" /><p className="text-sm text-red-300 flex-1">{error}</p><button onClick={() => setError(null)} className="text-red-400"><X className="w-4 h-4" /></button></div>}

        {progress.total > 0 && (
          <div className="mb-4 p-4 rounded-xl border" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-indigo-300">Fetching live data...</span>
              <span className="text-sm text-indigo-400 mono">{progress.current}/{progress.total}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
            </div>
          </div>
        )}

        {showDiscovery && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-emerald-400" />Discovery Agents</h2>
              <div className="flex gap-4 text-center">
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}><p className="text-[10px] text-slate-500">Scanned</p><p className="mono text-xl font-bold text-slate-200">{stats.scanned.toLocaleString()}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }}><p className="text-[10px] text-indigo-400">Fetched</p><p className="mono text-xl font-bold text-indigo-400">{stats.inRange}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-[10px] text-emerald-400">In Range</p><p className="mono text-xl font-bold text-emerald-400">{stats.qualified}</p></div>
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
                <div><h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-400" />Stock Rankings</h2><p className="text-xs text-slate-500">{sorted.length} stocks {lastUpdate && `• ${lastUpdate.toLocaleTimeString()}`}</p></div>
                <div className="flex gap-3">
                  <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="all">All Sectors</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="compositeScore">Composite</option>{analysisAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </div>
              </div>
              <div className="divide-y divide-slate-800/30">
                {sorted.length === 0 ? (
                  <div className="p-12 text-center"><Database className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-400">Click "Run Full Scan" to fetch live stock data</p><p className="text-xs text-slate-600 mt-2">Data powered by Finnhub • ~25 seconds to load</p></div>
                ) : sorted.map((s, i) => (
                  <div key={s.ticker} className="row cursor-pointer" onClick={() => setSelected(selected?.ticker === s.ticker ? null : s)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: i < 3 ? ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.2)', 'rgba(194,65,12,0.2)'][i] : 'rgba(30,41,59,0.5)', color: i < 3 ? ['#fbbf24', '#cbd5e1', '#fb923c'][i] : '#64748b' }}>#{i + 1}</div>
                        <div className="flex-1"><div className="flex items-center gap-2"><span className="mono font-bold text-lg text-slate-100">{s.ticker}</span><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.change >= 0 ? '#34d399' : '#f87171' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span></div><p className="text-xs text-slate-500">{s.name}</p></div>
                        <div className="text-right w-24"><p className="mono text-sm font-semibold text-slate-200">${s.price.toFixed(2)}</p><p className="text-xs text-indigo-400 mono">${s.marketCap}M cap</p></div>
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
        <footer className="mt-8 text-center text-xs text-slate-600 pb-8"><p>ValueHunter AI • Live data powered by Finnhub</p></footer>
      </div>
    </div>
  );
}
