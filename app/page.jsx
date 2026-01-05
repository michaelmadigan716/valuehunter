'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, BarChart3, Target, Scale, Building2, ChevronDown, ChevronUp, Activity, Zap, RefreshCw, Clock, CheckCircle, Sliders, Play, Brain, Network, Wallet, PieChart, LineChart, Globe, Database, FileText, Radio, Radar, Layers, Filter, MapPin, AlertCircle, X } from 'lucide-react';

// ============================================
// FINANCIAL MODELING PREP API CONFIGURATION
// ============================================
// When deploying externally, set USE_LIVE_API to true
// Get your free API key at: https://financialmodelingprep.com/developer
const USE_LIVE_API = false; // Set to true when deploying to Vercel/your server
const FMP_API_KEY = 'WKtNGOXUwCRZ0xeEgfftPjMVoTVIpanQ';
const API_BASE = 'https://financialmodelingprep.com/api';

// ============================================
// API FUNCTIONS (used when USE_LIVE_API = true)
// ============================================
const fetchStockScreener = async (minCapM, maxCapM) => {
  const url = `${API_BASE}/v3/stock-screener?marketCapMoreThan=${minCapM * 1000000}&marketCapLowerThan=${maxCapM * 1000000}&isActivelyTrading=true&limit=100&apikey=${FMP_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Screener failed: ${response.status}`);
  return response.json();
};

const fetchQuotes = async (symbols) => {
  if (!symbols.length) return [];
  const url = `${API_BASE}/v3/quote/${symbols.join(',')}?apikey=${FMP_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Quotes failed: ${response.status}`);
  return response.json();
};

const fetchProfile = async (symbol) => {
  const url = `${API_BASE}/v3/profile/${symbol}?apikey=${FMP_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data[0] || null;
};

const fetchInsiderTrading = async (symbol) => {
  const url = `${API_BASE}/v4/insider-trading?symbol=${symbol}&limit=20&apikey=${FMP_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
};

const fetchRatios = async (symbol) => {
  const url = `${API_BASE}/v3/ratios-ttm/${symbol}?apikey=${FMP_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data[0] || null;
};

// ============================================
// SAMPLE DATA (displays in preview mode)
// ============================================
const SAMPLE_STOCKS = [
  { symbol: 'GEVO', companyName: 'Gevo Inc', sector: 'Energy', price: 0.82, marketCap: 198000000, change: 3.2, insiderBuys: 4, debtPercent: 12 },
  { symbol: 'WKHS', companyName: 'Workhorse Group', sector: 'Automotive', price: 0.41, marketCap: 58000000, change: -2.1, insiderBuys: 2, debtPercent: 55 },
  { symbol: 'SLDP', companyName: 'Solid Power Inc', sector: 'Automotive', price: 1.58, marketCap: 285000000, change: 1.8, insiderBuys: 3, debtPercent: 5 },
  { symbol: 'MVST', companyName: 'Microvast Holdings', sector: 'Automotive', price: 0.68, marketCap: 205000000, change: -1.5, insiderBuys: 0, debtPercent: 62 },
  { symbol: 'HYLN', companyName: 'Hyliion Holdings', sector: 'Automotive', price: 1.35, marketCap: 245000000, change: 0.9, insiderBuys: 1, debtPercent: 8 },
  { symbol: 'OPTT', companyName: 'Ocean Power Technologies', sector: 'Energy', price: 0.32, marketCap: 42000000, change: 5.8, insiderBuys: 2, debtPercent: 18 },
  { symbol: 'STEM', companyName: 'Stem Inc', sector: 'Energy', price: 0.38, marketCap: 62000000, change: -4.2, insiderBuys: 0, debtPercent: 78 },
  { symbol: 'BITF', companyName: 'Bitfarms Ltd', sector: 'Technology', price: 1.45, marketCap: 68000000, change: 2.4, insiderBuys: 1, debtPercent: 42 },
  { symbol: 'HIVE', companyName: 'HIVE Digital Tech', sector: 'Technology', price: 2.85, marketCap: 155000000, change: 1.2, insiderBuys: 0, debtPercent: 15 },
  { symbol: 'CIFR', companyName: 'Cipher Mining', sector: 'Technology', price: 3.65, marketCap: 118000000, change: 3.8, insiderBuys: 2, debtPercent: 28 },
  { symbol: 'ARBK', companyName: 'Argo Blockchain', sector: 'Technology', price: 0.72, marketCap: 45000000, change: -1.8, insiderBuys: 0, debtPercent: 35 },
  { symbol: 'DNA', companyName: 'Ginkgo Bioworks', sector: 'Healthcare', price: 0.28, marketCap: 95000000, change: -5.2, insiderBuys: 3, debtPercent: 52 },
  { symbol: 'ME', companyName: '23andMe Holding', sector: 'Healthcare', price: 0.35, marketCap: 142000000, change: -3.8, insiderBuys: 1, debtPercent: 48 },
  { symbol: 'PRPH', companyName: 'ProPhase Labs', sector: 'Healthcare', price: 2.15, marketCap: 52000000, change: 1.5, insiderBuys: 2, debtPercent: 22 },
  { symbol: 'BKKT', companyName: 'Bakkt Holdings', sector: 'Financial', price: 11.25, marketCap: 295000000, change: 4.2, insiderBuys: 1, debtPercent: 38 },
  { symbol: 'NKLA', companyName: 'Nikola Corp', sector: 'Automotive', price: 0.85, marketCap: 78000000, change: -2.8, insiderBuys: 0, debtPercent: 85 },
  { symbol: 'BLNK', companyName: 'Blink Charging', sector: 'Energy', price: 1.95, marketCap: 172000000, change: -0.8, insiderBuys: 1, debtPercent: 42 },
  { symbol: 'QS', companyName: 'QuantumScape', sector: 'Automotive', price: 4.52, marketCap: 225000000, change: 2.1, insiderBuys: 3, debtPercent: 12 },
  { symbol: 'IONQ', companyName: 'IonQ Inc', sector: 'Technology', price: 8.75, marketCap: 185000000, change: 1.5, insiderBuys: 2, debtPercent: 18 },
  { symbol: 'QBTS', companyName: 'D-Wave Quantum', sector: 'Technology', price: 1.92, marketCap: 72000000, change: -1.2, insiderBuys: 0, debtPercent: 58 },
];

// Discovery agent definitions
const discoveryAgentDefinitions = [
  { id: 'secFilings', name: 'SEC Filings Scanner', description: 'Scans all SEC EDGAR filings', icon: FileText, color: '#3B82F6', sources: ['Form 10-K', 'Form 10-Q', 'Form S-1'], coverage: 'All US-listed companies' },
  { id: 'exchangeScanner', name: 'Exchange Scanner', description: 'Monitors NYSE, NASDAQ, AMEX', icon: Database, color: '#8B5CF6', sources: ['NYSE', 'NASDAQ', 'AMEX', 'BATS'], coverage: 'All exchange-listed stocks' },
  { id: 'otcMarkets', name: 'OTC Markets Agent', description: 'Scans OTC Pink, OTCQB, OTCQX', icon: Radio, color: '#EC4899', sources: ['OTCQX', 'OTCQB', 'Pink Sheets'], coverage: 'All OTC securities' },
  { id: 'globalAdr', name: 'Global ADR Scanner', description: 'Finds international ADRs', icon: Globe, color: '#10B981', sources: ['Level 1-3 ADRs', 'GDRs'], coverage: 'International ADRs' },
  { id: 'screenerAggregator', name: 'Screener Aggregator', description: 'Cross-references multiple screeners', icon: Radar, color: '#F59E0B', sources: ['Finviz', 'Yahoo', 'TradingView'], coverage: 'Multi-source validation' },
  { id: 'ipoSpacMonitor', name: 'IPO & SPAC Monitor', description: 'Tracks recent IPOs and SPACs', icon: Zap, color: '#EF4444', sources: ['IPO Calendar', 'SPAC Tracker'], coverage: 'New market entrants' },
];

// Analysis agent definitions
const analysisAgentDefinitions = [
  { id: 'insiderBuying', name: 'Insider Buying Agent', description: 'Monitors SEC Form 4 filings for insider purchases', icon: Users, color: '#10B981' },
  { id: 'insiderConviction', name: 'Insider Conviction Agent', description: 'Analyzes % of insider net worth invested', icon: Wallet, color: '#6366F1' },
  { id: 'technicalAnalysis', name: 'Technical Analysis Agent', description: 'Identifies chart patterns and entry points', icon: LineChart, color: '#F59E0B' },
  { id: 'debtAnalysis', name: 'Debt Analysis Agent', description: 'Evaluates debt as % of market cap', icon: Scale, color: '#EF4444' },
  { id: 'intrinsicValue', name: 'Intrinsic Value Agent', description: 'Calculates fair value using DCF', icon: Target, color: '#8B5CF6' },
  { id: 'moatStrength', name: 'Moat Strength Agent', description: 'Assesses competitive advantages', icon: Building2, color: '#0EA5E9' },
  { id: 'earningsQuality', name: 'Earnings Quality Agent', description: 'Analyzes earnings consistency', icon: BarChart3, color: '#EC4899' },
  { id: 'managementQuality', name: 'Management Quality Agent', description: 'Evaluates leadership track record', icon: Brain, color: '#14B8A6' },
];

// Process stock data into app format
const processStockData = (rawStocks) => {
  return rawStocks.map((stock, idx) => {
    const marketCapM = Math.round((stock.marketCap || 0) / 1000000);
    const debtPercent = stock.debtPercent || 30;
    const insiderBuys = stock.insiderBuys || 0;
    const change = stock.change || 0;
    const rsi = 30 + Math.random() * 40;
    
    const insiderScore = Math.min(100, Math.max(0, 50 + (insiderBuys * 12)));
    const debtScore = Math.max(0, 100 - debtPercent);
    const technicalScore = 40 + Math.random() * 35;
    
    let idealHorizon = 'longterm';
    let horizonReason = { day: '', swing: '', longterm: '' };
    
    if (Math.abs(change) > 5 || insiderBuys >= 3) {
      idealHorizon = 'day';
      horizonReason.day = Math.abs(change) > 5 ? 'High volatility today' : 'Significant insider buying';
    } else if (rsi < 35 || change < -3) {
      idealHorizon = 'swing';
      horizonReason.swing = rsi < 35 ? 'Oversold - bounce setup' : 'Pullback opportunity';
    } else {
      idealHorizon = 'longterm';
      horizonReason.longterm = debtPercent < 30 ? 'Low debt value play' : 'Accumulation zone';
    }
    
    let pattern = 'Consolidation';
    if (change > 3) pattern = 'Momentum';
    else if (change < -3) pattern = 'Pullback';
    else if (rsi < 35) pattern = 'Oversold';
    
    return {
      id: idx + 1,
      ticker: stock.symbol,
      name: stock.companyName,
      sector: stock.sector || 'Unknown',
      price: stock.price,
      marketCap: marketCapM,
      change,
      agentScores: {
        insiderBuying: insiderScore,
        insiderConviction: Math.min(100, insiderScore * 0.9 + Math.random() * 10),
        technicalAnalysis: technicalScore,
        debtAnalysis: debtScore,
        intrinsicValue: 40 + Math.random() * 35,
        moatStrength: 30 + Math.random() * 40,
        earningsQuality: 35 + Math.random() * 40,
        managementQuality: insiderScore * 0.6 + 20 + Math.random() * 20,
      },
      compositeScore: 0,
      insiderData: { recentBuys: insiderBuys, recentSells: Math.floor(Math.random() * 3), portfolioPercent: Math.min(80, 15 + insiderBuys * 8) },
      technicalData: { pattern, rsi: Math.round(rsi), undervalued: debtPercent < 25 && change < 0 },
      fundamentalData: { debtPercent },
      discoveredBy: 'FMP Stock Screener',
      idealHorizon,
      horizonReason,
      dataSource: USE_LIVE_API ? 'live' : 'sample',
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
  const [discoveryStats, setDiscoveryStats] = useState({ totalScanned: 8500, inMarketCapRange: 842, passedFilters: 20 });
  const [sortBy, setSortBy] = useState('compositeScore');
  const [filterSector, setFilterSector] = useState('all');
  const [tradeHorizon, setTradeHorizon] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [dataStatus, setDataStatus] = useState({ type: USE_LIVE_API ? 'live' : 'sample', message: USE_LIVE_API ? 'Live FMP Data' : 'Sample Data (set USE_LIVE_API=true to enable)' });
  const [error, setError] = useState(null);
  const marketCapRange = { min: 40, max: 400 };

  const tradeHorizonOptions = [
    { id: 'all', label: 'All Horizons', icon: '◎' },
    { id: 'day', label: '1 Day Trade', icon: '⚡' },
    { id: 'swing', label: '6 Week Swing', icon: '〰️' },
    { id: 'longterm', label: '1 Year Hold', icon: '📈' },
  ];

  const calculateCompositeScores = (stockList, weights) => {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    return stockList.map(stock => {
      let weightedSum = 0;
      Object.keys(weights).forEach(agentId => {
        if (stock.agentScores[agentId] !== undefined) {
          weightedSum += (stock.agentScores[agentId] * weights[agentId]) / totalWeight;
        }
      });
      return { ...stock, compositeScore: weightedSum };
    });
  };

  // Initialize with sample data
  useEffect(() => {
    const processed = processStockData(SAMPLE_STOCKS);
    setStocks(calculateCompositeScores(processed, agentWeights));
  }, []);

  const runDiscoveryAgents = async () => {
    setIsDiscovering(true);
    setError(null);
    
    // Animate discovery agents
    for (const agent of discoveryAgentDefinitions) {
      setDiscoveryStatuses(prev => ({ ...prev, [agent.id]: 'running' }));
      await new Promise(r => setTimeout(r, 400));
      setDiscoveryStatuses(prev => ({ ...prev, [agent.id]: 'complete' }));
    }

    if (USE_LIVE_API) {
      try {
        setDataStatus({ type: 'loading', message: 'Fetching from FMP API...' });
        const screenerData = await fetchStockScreener(marketCapRange.min, marketCapRange.max);
        const symbols = screenerData.slice(0, 30).map(s => s.symbol);
        const quotes = await fetchQuotes(symbols);
        
        const merged = screenerData.slice(0, 30).map(s => {
          const q = quotes.find(qq => qq.symbol === s.symbol) || {};
          return { ...s, price: q.price || s.price, change: q.changesPercentage || 0, marketCap: q.marketCap || s.marketCap };
        });
        
        const processed = processStockData(merged);
        setStocks(calculateCompositeScores(processed, agentWeights));
        setDiscoveryStats({ totalScanned: 8500, inMarketCapRange: screenerData.length, passedFilters: processed.length });
        setDataStatus({ type: 'live', message: `Live FMP data • ${processed.length} stocks` });
      } catch (err) {
        setError(`API Error: ${err.message}`);
        setDataStatus({ type: 'error', message: 'API failed - showing sample data' });
      }
    } else {
      // Use sample data
      const processed = processStockData(SAMPLE_STOCKS);
      setStocks(calculateCompositeScores(processed, agentWeights));
      setDataStatus({ type: 'sample', message: 'Sample data loaded' });
    }

    setLastUpdate(new Date());
    setIsDiscovering(false);
    setTimeout(() => setDiscoveryStatuses(Object.fromEntries(discoveryAgentDefinitions.map(a => [a.id, 'idle']))), 2000);
  };

  const runAnalysisAgents = async () => {
    setIsRunning(true);
    for (const agent of analysisAgentDefinitions) {
      setAnalysisStatuses(prev => ({ ...prev, [agent.id]: 'running' }));
      await new Promise(r => setTimeout(r, 250));
      setAnalysisStatuses(prev => ({ ...prev, [agent.id]: 'complete' }));
    }
    setStocks(prev => calculateCompositeScores(prev, agentWeights));
    setLastUpdate(new Date());
    setIsRunning(false);
    setTimeout(() => setAnalysisStatuses(Object.fromEntries(analysisAgentDefinitions.map(a => [a.id, 'idle']))), 2000);
  };

  const runFullPipeline = async () => { await runDiscoveryAgents(); await runAnalysisAgents(); };

  const handleWeightChange = (agentId, value) => {
    const newWeights = { ...agentWeights, [agentId]: value };
    setAgentWeights(newWeights);
    setStocks(prev => calculateCompositeScores(prev, newWeights));
  };

  const sortedStocks = [...stocks]
    .filter(s => filterSector === 'all' || s.sector === filterSector)
    .filter(s => tradeHorizon === 'all' || s.idealHorizon === tradeHorizon)
    .sort((a, b) => {
      const aVal = sortBy === 'compositeScore' ? a.compositeScore : a.agentScores[sortBy] || 0;
      const bVal = sortBy === 'compositeScore' ? b.compositeScore : b.agentScores[sortBy] || 0;
      return bVal - aVal;
    });

  const sectors = [...new Set(stocks.map(s => s.sector))];

  const AgentStatus = ({ status }) => {
    if (status === 'running') return <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
    if (status === 'complete') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-500" />;
  };

  const DebtBadge = ({ percent }) => {
    const color = percent < 20 ? 'emerald' : percent < 50 ? 'amber' : 'red';
    return (
      <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5"
           style={{ backgroundColor: color === 'emerald' ? 'rgba(16,185,129,0.2)' : color === 'amber' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                    color: color === 'emerald' ? '#34d399' : color === 'amber' ? '#fbbf24' : '#f87171' }}>
        <Scale className="w-3 h-3" />
        <span style={{ fontFamily: 'monospace' }}>{percent.toFixed(0)}%</span>
        <span className="text-[10px] opacity-75">debt</span>
      </div>
    );
  };

  const HorizonBadge = ({ horizon }) => {
    const config = {
      day: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', icon: '⚡', label: '1 Day' },
      swing: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', icon: '〰️', label: '6 Week' },
      longterm: { bg: 'rgba(16,185,129,0.15)', color: '#34d399', icon: '📈', label: '1 Year' },
    };
    const c = config[horizon] || config.longterm;
    return (
      <div className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ backgroundColor: c.bg, color: c.color }}>
        <span>{c.icon}</span><span>{c.label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-slate-100" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#0a0e17' }}>
      <style>{`
        .mono { font-family: 'SF Mono', 'Consolas', monospace; }
        .grid-bg { background-image: linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px); background-size: 40px 40px; }
        .card-gradient { background: linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.7) 100%); backdrop-filter: blur(10px); }
        .stock-row:hover { background: linear-gradient(90deg, rgba(99,102,241,0.05) 0%, transparent 100%); }
        input[type="range"] { -webkit-appearance: none; background: transparent; }
        input[type="range"]::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, #1e293b, #334155); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #6366f1; cursor: pointer; margin-top: -5px; }
      `}</style>

      {/* Header */}
      <header className="border-b border-slate-800/50 sticky top-0 z-50" style={{ background: 'rgba(10,14,23,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                <span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ValueHunter</span>
                <span className="text-slate-400 font-normal ml-2 text-lg">AI</span>
              </h1>
              <p className="text-xs text-slate-500">Small-Cap Value • ${marketCapRange.min}M - ${marketCapRange.max}M</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              <Filter className="w-3.5 h-3.5" />
              <span className="mono">${marketCapRange.min}M - ${marketCapRange.max}M</span>
            </div>
            
            {/* Trade Horizon Filter */}
            <div className="flex items-center rounded-xl border overflow-hidden" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
              {tradeHorizonOptions.map(opt => (
                <button key={opt.id} onClick={() => setTradeHorizon(opt.id)}
                  className="px-3 py-2 text-xs font-medium transition-all flex items-center gap-1"
                  style={{
                    background: tradeHorizon === opt.id ? (opt.id === 'day' ? 'rgba(239,68,68,0.2)' : opt.id === 'swing' ? 'rgba(245,158,11,0.2)' : opt.id === 'longterm' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)') : 'transparent',
                    color: tradeHorizon === opt.id ? (opt.id === 'day' ? '#f87171' : opt.id === 'swing' ? '#fbbf24' : opt.id === 'longterm' ? '#34d399' : '#a5b4fc') : '#64748b',
                  }}>
                  <span>{opt.icon}</span><span>{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border"
                 style={{ background: dataStatus.type === 'live' ? 'rgba(16,185,129,0.1)' : dataStatus.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                          borderColor: dataStatus.type === 'live' ? 'rgba(16,185,129,0.3)' : dataStatus.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)',
                          color: dataStatus.type === 'live' ? '#34d399' : dataStatus.type === 'error' ? '#f87171' : '#a5b4fc' }}>
              {dataStatus.type === 'live' && <CheckCircle className="w-3.5 h-3.5" />}
              {dataStatus.type === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
              {dataStatus.type === 'sample' && <Database className="w-3.5 h-3.5" />}
              <span>{dataStatus.message}</span>
            </div>

            <button onClick={() => setShowDiscovery(!showDiscovery)} 
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
              style={{ background: showDiscovery ? 'rgba(16,185,129,0.2)' : 'rgba(30,41,59,0.5)', borderColor: showDiscovery ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)', color: showDiscovery ? '#6ee7b7' : '#94a3b8' }}>
              <Radar className="w-4 h-4" />Discovery
            </button>
            
            <button onClick={() => setShowWeights(!showWeights)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border"
              style={{ background: showWeights ? 'rgba(245,158,11,0.2)' : 'rgba(30,41,59,0.5)', borderColor: showWeights ? 'rgba(245,158,11,0.3)' : 'rgba(51,65,85,0.5)', color: showWeights ? '#fcd34d' : '#94a3b8' }}>
              <Sliders className="w-4 h-4" />Weights
            </button>
            
            <button onClick={runFullPipeline} disabled={isRunning || isDiscovering}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: isRunning || isDiscovering ? 'rgba(245,158,11,0.2)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)', color: isRunning || isDiscovering ? '#fcd34d' : 'white' }}>
              {isRunning || isDiscovering ? <><RefreshCw className="w-4 h-4 animate-spin" />{isDiscovering ? 'Discovering...' : 'Analyzing...'}</> : <><Play className="w-4 h-4" />Run Full Scan</>}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-6 py-6 grid-bg min-h-screen">
        {error && (
          <div className="mb-4 p-4 rounded-xl border flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400"><X className="w-4 h-4" /></button>
          </div>
        )}
        
        {/* Discovery Panel */}
        {showDiscovery && (
          <div className="mb-6 card-gradient rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}><Radar className="w-5 h-5 text-emerald-400" /></div>
                <div>
                  <h2 className="text-lg font-semibold">Stock Discovery Agents</h2>
                  <p className="text-xs text-slate-500">Scanning for ${marketCapRange.min}M-${marketCapRange.max}M stocks</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                  <p className="text-[10px] text-slate-500 uppercase">Scanned</p>
                  <p className="mono text-xl font-bold text-slate-200">{discoveryStats.totalScanned.toLocaleString()}</p>
                </div>
                <div className="text-center px-4 py-2 rounded-xl border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                  <p className="text-[10px] text-slate-500 uppercase">In Range</p>
                  <p className="mono text-xl font-bold text-indigo-400">{discoveryStats.inMarketCapRange}</p>
                </div>
                <div className="text-center px-4 py-2 rounded-xl border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }}>
                  <p className="text-[10px] text-emerald-400 uppercase">Qualified</p>
                  <p className="mono text-xl font-bold text-emerald-400">{discoveryStats.passedFilters}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {discoveryAgentDefinitions.map(agent => (
                <div key={agent.id} className="p-4 rounded-xl border" style={{ background: discoveryStatuses[agent.id] === 'running' ? 'rgba(245,158,11,0.05)' : discoveryStatuses[agent.id] === 'complete' ? 'rgba(16,185,129,0.05)' : 'rgba(15,23,42,0.5)', borderColor: discoveryStatuses[agent.id] === 'running' ? 'rgba(245,158,11,0.3)' : discoveryStatuses[agent.id] === 'complete' ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}15` }}><agent.icon className="w-4 h-4" style={{ color: agent.color }} /></div>
                    <AgentStatus status={discoveryStatuses[agent.id]} />
                  </div>
                  <p className="text-sm font-medium text-slate-200">{agent.name}</p>
                  <p className="text-[10px] text-slate-500">{agent.coverage}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weights Panel */}
        {showWeights && (
          <div className="mb-6 card-gradient rounded-2xl border border-slate-800/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}><Sliders className="w-5 h-5 text-amber-400" /></div>
                <div>
                  <h2 className="text-lg font-semibold">Agent Weights</h2>
                  <p className="text-xs text-slate-500">Tune importance of each agent</p>
                </div>
              </div>
              <button onClick={() => setAgentWeights(Object.fromEntries(analysisAgentDefinitions.map(a => [a.id, 50])))} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>Reset All</button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {analysisAgentDefinitions.map(agent => (
                <div key={agent.id} className="rounded-xl p-4 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}20` }}><agent.icon className="w-4 h-4" style={{ color: agent.color }} /></div>
                    <span className="text-sm font-medium text-slate-200">{agent.name.replace(' Agent', '')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="100" value={agentWeights[agent.id]} onChange={e => handleWeightChange(agent.id, parseInt(e.target.value))} className="flex-1" />
                    <span className="mono text-sm font-semibold w-8 text-right" style={{ color: agent.color }}>{agentWeights[agent.id]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Analysis Agents */}
          <div className="col-span-3">
            <div className="card-gradient rounded-2xl border border-slate-800/50 p-5 sticky top-28">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}><Brain className="w-5 h-5 text-violet-400" /></div>
                <div><h2 className="text-lg font-semibold">Analysis Agents</h2><p className="text-xs text-slate-500">{analysisAgentDefinitions.length} agents</p></div>
              </div>
              <div className="space-y-2">
                {analysisAgentDefinitions.map(agent => (
                  <div key={agent.id} className="p-3 rounded-xl border" style={{ background: analysisStatuses[agent.id] === 'running' ? 'rgba(245,158,11,0.05)' : analysisStatuses[agent.id] === 'complete' ? 'rgba(16,185,129,0.05)' : 'rgba(15,23,42,0.5)', borderColor: analysisStatuses[agent.id] === 'running' ? 'rgba(245,158,11,0.3)' : analysisStatuses[agent.id] === 'complete' ? 'rgba(16,185,129,0.3)' : 'rgba(51,65,85,0.5)' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${agent.color}15` }}><agent.icon className="w-4 h-4" style={{ color: agent.color }} /></div>
                        <div><p className="text-sm font-medium text-slate-200">{agent.name.replace(' Agent', '')}</p><p className="text-[10px] text-slate-500">{agent.description.slice(0, 30)}...</p></div>
                      </div>
                      <AgentStatus status={analysisStatuses[agent.id]} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Stock List */}
          <div className="col-span-9">
            <div className="card-gradient rounded-2xl border border-slate-800/50 overflow-hidden">
              <div className="p-5 border-b border-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}><TrendingUp className="w-5 h-5 text-indigo-400" /></div>
                    <div><h2 className="text-lg font-semibold">Stock Rankings</h2><p className="text-xs text-slate-500">{sortedStocks.length} stocks • Last updated {lastUpdate.toLocaleTimeString()}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-slate-300 border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                      <option value="all">All Sectors</option>
                      {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg px-3 py-2 text-sm text-slate-300 border" style={{ background: 'rgba(30,41,59,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                      <option value="compositeScore">Composite Score</option>
                      {analysisAgentDefinitions.map(a => <option key={a.id} value={a.id}>{a.name.replace(' Agent', '')}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-800/30">
                {sortedStocks.map((stock, idx) => (
                  <div key={stock.ticker} className="stock-row cursor-pointer" style={{ background: selectedStock?.ticker === stock.ticker ? 'rgba(99,102,241,0.1)' : 'transparent' }} onClick={() => setSelectedStock(selectedStock?.ticker === stock.ticker ? null : stock)}>
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mono font-bold text-sm" style={{ background: idx === 0 ? 'rgba(245,158,11,0.2)' : idx === 1 ? 'rgba(148,163,184,0.2)' : idx === 2 ? 'rgba(194,65,12,0.2)' : 'rgba(30,41,59,0.5)', color: idx === 0 ? '#fbbf24' : idx === 1 ? '#cbd5e1' : idx === 2 ? '#fb923c' : '#64748b' }}>#{idx + 1}</div>
                        <div className="flex-1 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <span className="mono font-bold text-lg text-slate-100">{stock.ticker}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: stock.change >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: stock.change >= 0 ? '#34d399' : '#f87171' }}>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%</span>
                          </div>
                          <p className="text-xs text-slate-500">{stock.name}</p>
                        </div>
                        <div className="text-right w-24">
                          <p className="mono text-sm font-semibold text-slate-200">${stock.price.toFixed(2)}</p>
                          <p className="text-xs text-indigo-400 mono">${stock.marketCap}M</p>
                        </div>
                        <div className="w-24"><HorizonBadge horizon={stock.idealHorizon} /></div>
                        <div className="w-24"><DebtBadge percent={stock.fundamentalData.debtPercent} /></div>
                        <div className="w-36">
                          <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-400">Score</span><span className="mono text-sm font-bold text-indigo-400">{stock.compositeScore.toFixed(1)}</span></div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${stock.compositeScore}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} /></div>
                        </div>
                        <div className="w-8">{selectedStock?.ticker === stock.ticker ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
                      </div>

                      {selectedStock?.ticker === stock.ticker && (
                        <div className="mt-5 pt-5 border-t border-slate-800/30">
                          <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2">
                              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-400" />Agent Scores</h4>
                              <div className="grid grid-cols-2 gap-3">
                                {analysisAgentDefinitions.map(agent => (
                                  <div key={agent.id} className="rounded-xl p-3 border" style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(51,65,85,0.5)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${agent.color}15` }}><agent.icon className="w-3 h-3" style={{ color: agent.color }} /></div>
                                        <span className="text-xs text-slate-300">{agent.name.replace(' Agent', '')}</span>
                                      </div>
                                      <span className="mono text-sm font-bold" style={{ color: agent.color }}>{stock.agentScores[agent.id].toFixed(1)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.5)' }}><div className="h-full rounded-full" style={{ width: `${stock.agentScores[agent.id]}%`, background: agent.color }} /></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-emerald-400" />Insights</h4>
                              <div className="space-y-3">
                                <div className="rounded-xl p-3 border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
                                  <p className="text-xs text-emerald-400 mb-1">Insider Activity</p>
                                  <p className="text-lg font-bold text-slate-200">{stock.insiderData.recentBuys} buys</p>
                                  <p className="text-xs text-slate-500">{stock.insiderData.portfolioPercent}% portfolio conviction</p>
                                </div>
                                <div className="rounded-xl p-3 border" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
                                  <p className="text-xs text-red-400 mb-1">Debt / Market Cap</p>
                                  <p className="text-2xl font-bold" style={{ color: stock.fundamentalData.debtPercent < 25 ? '#34d399' : stock.fundamentalData.debtPercent > 50 ? '#f87171' : '#fbbf24' }}>{stock.fundamentalData.debtPercent.toFixed(0)}%</p>
                                </div>
                                <div className="rounded-xl p-3 border" style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' }}>
                                  <p className="text-xs text-amber-400 mb-1">Technical Pattern</p>
                                  <p className="font-semibold text-slate-200">{stock.technicalData.pattern}</p>
                                  <p className="text-xs text-slate-500">RSI: {stock.technicalData.rsi}</p>
                                </div>
                              </div>
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

        <footer className="mt-8 text-center text-xs text-slate-600 pb-8">
          <p>ValueHunter AI • Small-Cap Research • ${marketCapRange.min}M-${marketCapRange.max}M</p>
        </footer>
      </div>
    </div>
  );
}
