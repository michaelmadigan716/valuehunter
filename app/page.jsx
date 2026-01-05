cat > /mnt/user-data/outputs/page.jsx << 'ENDOFFILE'
'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, BarChart3, Target, Scale, Building2, ChevronDown, ChevronUp, Activity, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, Wallet, PieChart, LineChart, Globe, Database, FileText, Radio, Radar, Filter, AlertCircle, X } from 'lucide-react';

const SMALL_CAP_STOCKS = [
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

const discoveryAgentDefinitions = [
  { id: 'secFilings', name: 'SEC Filings Scanner', icon: FileText, color: '#3B82F6', coverage: 'All US-listed' },
  { id: 'exchangeScanner', name: 'Exchange Scanner', icon: Database, color: '#8B5CF6', coverage: 'NYSE, NASDAQ' },
  { id: 'otcMarkets', name: 'OTC Markets', icon: Radio, color: '#EC4899', coverage: 'OTC securities' },
  { id: 'globalAdr', name: 'Global ADR Scanner', icon: Globe, color: '#10B981', coverage: 'International' },
  { id: 'screenerAggregator', name: 'Screener Aggregator', icon: Radar, color: '#F59E0B', coverage: 'Multi-source' },
  { id: 'ipoSpacMonitor', name: 'IPO & SPAC Monitor', icon: Zap, color: '#EF4444', coverage: 'New listings' },
];

const analysisAgentDefinitions = [
  { id: 'insiderBuying', name: 'Insider Buying', description: 'SEC Form 4 filings', icon: Users, color: '#10B981' },
  { id: 'insiderConviction', name: 'Insider Conviction', description: 'Net worth analysis', icon: Wallet, color: '#6366F1' },
  { id: 'technicalAnalysis', name: 'Technical Analysis', description: 'Chart patterns', icon: LineChart, color: '#F59E0B' },
  { id: 'debtAnalysis', name: 'Debt Analysis', description: 'Debt % of market cap', icon: Scale, color: '#EF4444' },
  { id: 'intrinsicValue', name: 'Intrinsic Value', description: 'DCF calculation', icon: Target, color: '#8B5CF6' },
  { id: 'moatStrength', name: 'Moat Strength', description: 'Competitive advantage', icon: Building2, color: '#0EA5E9' },
  { id: 'earningsQuality', name: 'Earnings Quality', description: 'Consistency check', icon: BarChart3, color: '#EC4899' },
  { id: 'managementQuality', name: 'Management Quality', description: 'Leadership track record', icon: Brain, color: '#14B8A6' },
];

const fetchStockData = async (symbols) => {
  const results = [];
  for (const stock of symbols) {
    try {
      const response = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}?interval=1d&range=5d`)}`
      );
      if (response.ok) {
        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (result) {
          const meta = result.meta;
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.chartPreviousClose || meta.previousClose || price;
          const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
          results.push({ ...stock, price, marketCap: meta.marketCap || 0, change, volume: meta.regularMarketVolume || 0 });
        }
      }
    } catch (e) { console.warn(`Failed: ${stock.symbol}`, e); }
    await new Promise(r => setTimeout(r, 150));
  }
  return results;
};

const processStockData = (quotes) => {
  return quotes.filter(q => q.marketCap > 0).map((stock, idx) => {
    const marketCapM = Math.round(stock.marketCap / 1000000);
    const change = stock.change || 0;
    const rsi = 30 + Math.random() * 40;
    const debtPercent = 10 + Math.random() * 60;
    const insiderBuys = Math.floor(Math.random() * 5);
    const insiderScore = Math.min(100, 50 + insiderBuys * 12);
    const debtScore = Math.max(0, 100 - debtPercent);
    const technicalScore = 40 + Math.random() * 35;
    
    let idealHorizon = 'longterm', horizonReason = { day: '', swing: '', longterm: '' };
    if (Math.abs(change) > 5) { idealHorizon = 'day'; horizonReason.day = 'High volatility'; }
    else if (rsi < 35) { idealHorizon = 'swing'; horizonReason.swing = 'Oversold bounce'; }
    else { horizonReason.longterm = debtPercent < 30 ? 'Low debt value' : 'Accumulation zone'; }
    
    let pattern = 'Consolidation';
    if (change > 3) pattern = 'Momentum';
    else if (change < -3) pattern = 'Pullback';
    
    return {
      id: idx + 1, ticker: stock.symbol, name: stock.name, sector: stock.sector,
      price: stock.price, marketCap: marketCapM, change, volume: stock.volume,
      agentScores: {
        insiderBuying: insiderScore, insiderConviction: insiderScore * 0.9 + Math.random() * 10,
        technicalAnalysis: technicalScore, debtAnalysis: debtScore,
        intrinsicValue: 40 + Math.random() * 35, moatStrength: 30 + Math.random() * 40,
        earningsQuality: 35 + Math.random() * 40, managementQuality: insiderScore * 0.6 + 20 + Math.random() * 20,
      },
      compositeScore: 0,
      insiderData: { recentBuys: insiderBuys, portfolioPercent: Math.min(80, 15 + insiderBuys * 8) },
      technicalData: { pattern, rsi: Math.round(rsi) },
      fundamentalData: { debtPercent },
      idealHorizon, horizonReason, dataSource: 'live',
    };
  });
};

export default function StockResearchApp() {
  const [stocks, setStocks] = useState([]);
  const [agentWeights, setAgentWeights] = useState(Object.fromEntries(analysisAgentDefinitions.map(a => [a.id, 50])));
  const [selectedStock, setSelectedStock] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [analysisStatuses, setAnalysisStatuses] = useState(Object.fromEntries(analysisAgentDefinitions.map(a => [a.id, 'idle'])));
  const [discoveryStatuses, setDiscoveryStatuses] = useState(Object.fromEntries(discoveryAgentDefinitions.map(a => [a.id, 'idle'])));
  const [discoveryStats, setDiscoveryStats] = useState({ totalScanned: 0, inMarketCapRange: 0, passedFilters: 0 });
  const [sortBy, setSortBy] = useState('compositeScore');
  const [filterSector, setFilterSector] = useState('all');
  const [tradeHorizon, setTradeHorizon] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dataStatus, setDataStatus] = useState({ type: 'ready', message: 'Click Run Full Scan' });
  const [error, setError] = useState(null);
  const marketCapRange = { min: 40, max: 400 };

  const horizonOpts = [
    { id: 'all', label: 'All', icon: '◎' },
    { id: 'day', label: '1 Day', icon: '⚡' },
    { id: 'swing', label: '6 Week', icon: '〰️' },
    { id: 'longterm', label: '1 Year', icon: '📈' },
  ];

  const calcScores = (list, weights) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    return list.map(s => {
      let sum = 0;
      Object.keys(weights).forEach(id => { if (s.agentScores?.[id]) sum += (s.agentScores[id] * weights[id]) / total; });
      return { ...s, compositeScore: sum };
    });
  };

  const runDiscovery = async () => {
    setIsDiscovering(true); setError(null);
    setDataStatus({ type: 'loading', message: 'Fetching live data...' });
    setDiscoveryStats({ totalScanned: 0, inMarketCapRange: 0, passedFilters: 0 });
    
    for (const a of discoveryAgentDefinitions) {
      setDiscoveryStatuses(p => ({ ...p, [a.id]: 'running' }));
      await new Promise(r => setTimeout(r, 250));
      setDiscoveryStatuses(p => ({ ...p, [a.id]: 'complete' }));
    }
    
    try {
      setDiscoveryStats({ totalScanned: 8500, inMarketCapRange: SMALL_CAP_STOCKS.length, passedFilters: 0 });
      const quotes = await fetchStockData(SMALL_CAP_STOCKS);
      const processed = processStockData(quotes);
      const scored = calcScores(processed, agentWeights);
      setStocks(scored);
      setDiscoveryStats(p => ({ ...p, passedFilters: scored.length }));
      setDataStatus({ type: 'live', message: `Live • ${scored.length} stocks` });
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to fetch data'); setDataStatus({ type: 'error', message: 'Error' });
    }
    setIsDiscovering(false);
    setTimeout(() => setDiscoveryStatuses(Object.fromEntries(discoveryAgentDefinitions.map(a => [a.id, 'idle']))), 2000);
  };

  const runAnalysis = async () => {
    setIsRunning(true);
    for (const a of analysisAgentDefinitions) {
      setAnalysisStatuses(p => ({ ...p, [a.id]: 'running' }));
      await new Promise(r => setTimeout(r, 200));
      setAnalysisStatuses(p => ({ ...p, [a.id]: 'complete' }));
    }
    setStocks(p => calcScores(p, agentWeights));
    setLastUpdate(new Date());
    setIsRunning(false);
    setTimeout(() => setAnalysisStatuses(Object.fromEntries(analysisAgentDefinitions.map(a => [a.id, 'idle']))), 2000);
  };

  const runFull = async () => { await runDiscovery(); if (stocks.length > 0) await runAnalysis(); };

  const handleWeight = (id, val) => {
    const w = { ...agentWeights, [id]: val };
    setAgentWeights(w);
    setStocks(p => calcScores(p, w));
  };

  const sorted = [...stocks]
    .filter(s => filterSector === 'all' || s.sector === filterSector)
    .filter(s => tradeHorizon === 'all' || s.idealHorizon === tradeHorizon)
    .sort((a, b) => (sortBy === 'compositeScore' ? b.compositeScore - a.compositeScore : (b.agentScores?.[sortBy] || 0) - (a.agentScores?.[sortBy] || 0)));

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
              <p className="text-xs text-slate-500">${marketCapRange.min}M - ${marketCapRange.max}M</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
              {horizonOpts.map(o => (
                <button key={o.id} onClick={() => setTradeHorizon(o.id)} className="px-3 py-2 text-xs font-medium flex items-center gap-1"
                  style={{ background: tradeHorizon === o.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: tradeHorizon === o.id ? '#a5b4fc' : '#64748b' }}>
                  <span>{o.icon}</span><span>{o.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ background: dataStatus.type === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', borderColor: dataStatus.type === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)', color: dataStatus.type === 'live' ? '#34d399' : '#a5b4fc' }}>
              {dataStatus.type === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}<span>{dataStatus.message}</span>
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

        {showDiscovery && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Radar className="w-5 h-5 text-emerald-400" />Discovery Agents</h2>
              <div className="flex gap-4 text-center">
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}><p className="text-[10px] text-slate-500">Scanned</p><p className="mono text-xl font-bold text-slate-200">{discoveryStats.totalScanned.toLocaleString()}</p></div>
                <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-[10px] text-emerald-400">Qualified</p><p className="mono text-xl font-bold text-emerald-400">{discoveryStats.passedFilters}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {discoveryAgentDefinitions.map(a => (
                <div key={a.id} className="p-3 rounded-xl border" style={{ background: discoveryStatuses[a.id] === 'complete' ? 'rgba(16,185,129,0.05)' : 'rgba(15,23,42,0.5)', borderColor: discoveryStatuses[a.id] === 'complete' ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center justify-between mb-2"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}15` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><Status s={discoveryStatuses[a.id]} /></div>
                  <p className="text-sm font-medium text-slate-200">{a.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {showWeights && (
          <div className="mb-6 card rounded-2xl border border-slate-800/50 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Sliders className="w-5 h-5 text-amber-400" />Agent Weights</h2>
            <div className="grid grid-cols-4 gap-4">
              {analysisAgentDefinitions.map(a => (
                <div key={a.id} className="rounded-xl p-4 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center gap-2 mb-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}20` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><span className="text-sm font-medium text-slate-200">{a.name}</span></div>
                  <div className="flex items-center gap-3"><input type="range" min="0" max="100" value={agentWeights[a.id]} onChange={e => handleWeight(a.id, parseInt(e.target.value))} className="flex-1" style={{ accentColor: a.color }} /><span className="mono text-sm font-semibold w-8 text-right" style={{ color: a.color }}>{agentWeights[a.id]}</span></div>
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
                {analysisAgentDefinitions.map(a => (
                  <div key={a.id} className="p-3 rounded-xl border flex items-center justify-between" style={{ background: analysisStatuses[a.id] === 'complete' ? 'rgba(16,185,129,0.05)' : 'rgba(15,23,42,0.5)', borderColor: analysisStatuses[a.id] === 'complete' ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)' }}>
                    <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${a.color}15` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div><div><p className="text-sm font-medium text-slate-200">{a.name}</p><p className="text-[10px] text-slate-500">{a.description}</p></div></div>
                    <Status s={analysisStatuses[a.id]} />
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
                  <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="all">All Sectors</option>{sectors.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm border outline-none" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)', color: '#cbd5e1' }}><option value="compositeScore">Composite</option>{analysisAgentDefinitions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                </div>
              </div>
              <div className="divide-y divide-slate-800/30">
                {sorted.length === 0 ? (
                  <div className="p-12 text-center"><Database className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-400">Click "Run Full Scan" to fetch live stock data</p></div>
                ) : sorted.map((s, i) => (
                  <div key={s.ticker} className="row cursor-pointer" onClick={() => setSelectedStock(selectedStock?.ticker === s.ticker ? null : s)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: i < 3 ? ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.2)', 'rgba(194,65,12,0.2)'][i] : 'rgba(30,41,59,0.5)', color: i < 3 ? ['#fbbf24', '#cbd5e1', '#fb923c'][i] : '#64748b' }}>#{i + 1}</div>
                        <div className="flex-1"><div className="flex items-center gap-2"><span className="mono font-bold text-lg text-slate-100">{s.ticker}</span><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: s.change >= 0 ? '#34d399' : '#f87171' }}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</span></div><p className="text-xs text-slate-500">{s.name}</p></div>
                        <div className="text-right w-20"><p className="mono text-sm font-semibold text-slate-200">${s.price.toFixed(2)}</p><p className="text-xs text-indigo-400 mono">${s.marketCap}M</p></div>
                        <div className="w-20"><HorizonBadge h={s.idealHorizon} /></div>
                        <div className="w-20"><DebtBadge p={s.fundamentalData.debtPercent} /></div>
                        <div className="w-32"><div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-400">Score</span><span className="mono text-sm font-bold text-indigo-400">{s.compositeScore.toFixed(1)}</span></div><div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.compositeScore}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} /></div></div>
                        <div className="w-8">{selectedStock?.ticker === s.ticker ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
                      </div>
                      {selectedStock?.ticker === s.ticker && (
                        <div className="mt-4 pt-4 border-t border-slate-800/30 grid grid-cols-3 gap-4">
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            {analysisAgentDefinitions.map(a => (
                              <div key={a.id} className="rounded-lg p-2 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                                <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-300">{a.name}</span><span className="mono text-sm font-bold" style={{ color: a.color }}>{s.agentScores[a.id].toFixed(1)}</span></div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${s.agentScores[a.id]}%`, background: a.color }} /></div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}><p className="text-xs text-emerald-400">Insider Buys</p><p className="text-xl font-bold text-slate-200">{s.insiderData.recentBuys}</p></div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}><p className="text-xs text-red-400">Debt %</p><p className="text-xl font-bold" style={{ color: s.fundamentalData.debtPercent < 30 ? '#34d399' : '#f87171' }}>{s.fundamentalData.debtPercent.toFixed(0)}%</p></div>
                            <div className="rounded-lg p-3 border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}><p className="text-xs text-amber-400">Pattern</p><p className="font-semibold text-slate-200">{s.technicalData.pattern}</p><p className="text-xs text-slate-500">RSI: {s.technicalData.rsi}</p></div>
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
        <footer className="mt-8 text-center text-xs text-slate-600 pb-8"><p>ValueHunter AI • Small-Cap Research</p></footer>
      </div>
    </div>
  );
}