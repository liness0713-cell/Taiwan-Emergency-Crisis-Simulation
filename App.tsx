import { useState, useEffect, useRef } from 'react';
import { FactionId, GameState } from './types';
import * as GeminiService from './services/geminiService';
import TrilingualText from './components/TrilingualText';
import StatBar from './components/StatBar';

// Icons
const IconTension = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const IconEconomy = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>;
const IconSupport = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>;

const FACTION_DATA = {
  [FactionId.TW]: { name: "Taiwan (ROC)", color: "emerald", flag: "🇹🇼" },
  [FactionId.JP]: { name: "Japan", color: "rose", flag: "🇯🇵" },
  [FactionId.CN]: { name: "China (PRC)", color: "red", flag: "🇨🇳" },
  [FactionId.US]: { name: "United States", color: "blue", flag: "🇺🇸" },
};

// Background Image Mapping (Using abstract high-quality visuals)
const VISUAL_THEMES = {
  WAR_ROOM: "bg-[url('https://images.unsplash.com/photo-1555447405-05842c3756aa?q=80&w=2000&auto=format&fit=crop')]",
  OCEAN: "bg-[url('https://images.unsplash.com/photo-1518115509205-c1f964a27376?q=80&w=2000&auto=format&fit=crop')]",
  CYBER: "bg-[url('https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2000&auto=format&fit=crop')]",
  DIPLOMACY: "bg-[url('https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=2000&auto=format&fit=crop')]",
  CHAOS: "bg-[url('https://images.unsplash.com/photo-1509653087866-91f6c2ab59f2?q=80&w=2000&auto=format&fit=crop')]",
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    turn: 1,
    tension: 30,
    economy: 80,
    support: 70,
    history: [],
    currentScenario: null,
    selectedFaction: null,
    isGameOver: false,
    gameStatus: 'IDLE', // IDLE -> SELECT_FACTION -> LOADING -> PLAYING -> RESOLVING
    sources: []
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [gameState.history, gameState.currentScenario]);

  const startGame = async (faction: FactionId) => {
    setGameState(prev => ({ ...prev, selectedFaction: faction, gameStatus: 'LOADING' }));
    
    // 1. Fetch Real Context
    const { summary, sources } = await GeminiService.fetchLiveContext();
    
    // 2. Generate First Scenario
    const scenario = await GeminiService.generateScenario(summary, faction, 1, 30);
    
    setGameState(prev => ({
      ...prev,
      sources,
      currentScenario: scenario,
      gameStatus: 'PLAYING'
    }));
  };

  const handleChoice = async (choiceId: string) => {
    if (!gameState.currentScenario) return;
    
    setGameState(prev => ({ ...prev, gameStatus: 'RESOLVING' }));
    
    const result = await GeminiService.resolveTurnAction(
      gameState.currentScenario,
      choiceId,
      {
        tension: gameState.tension,
        economy: gameState.economy,
        support: gameState.support
      }
    );

    // Apply stats
    const newTension = Math.max(0, Math.min(100, gameState.tension + (result.statsEffect.tension || 0)));
    const newEconomy = Math.max(0, Math.min(100, gameState.economy + (result.statsEffect.economy || 0)));
    const newSupport = Math.max(0, Math.min(100, gameState.support + (result.statsEffect.support || 0)));

    // Check Game Over
    let isOver = false;
    if (newTension >= 100) isOver = true; // Total War / Nuclear
    if (newSupport <= 0) isOver = true; // Coup/Collapse
    if (newEconomy <= 0) isOver = true; // Collapse
    if (gameState.turn >= 6) isOver = true; // Survival

    if (isOver) {
        setGameState(prev => ({
            ...prev,
            tension: newTension,
            economy: newEconomy,
            support: newSupport,
            history: [...prev.history, result],
            isGameOver: true,
            gameStatus: 'GAME_OVER'
        }));
        return;
    }

    // Next Turn
    const nextSummary = `Previous outcome: ${result.outcomeDescription.en}. Tension is now ${newTension}.`;
    const nextScenario = await GeminiService.generateScenario(nextSummary, gameState.selectedFaction!, gameState.turn + 1, newTension);

    setGameState(prev => ({
      ...prev,
      turn: prev.turn + 1,
      tension: newTension,
      economy: newEconomy,
      support: newSupport,
      history: [...prev.history, result],
      currentScenario: nextScenario,
      gameStatus: 'PLAYING'
    }));
  };

  // --- Render Helpers ---

  const getBackgroundClass = () => {
    if (gameState.gameStatus === 'GAME_OVER') return 'bg-black';
    if (!gameState.currentScenario) return 'bg-slate-950';
    return VISUAL_THEMES[gameState.currentScenario.visualTheme] || VISUAL_THEMES.CYBER;
  };

  // Ambient alert effect based on tension
  const getAlertOverlay = () => {
    if (gameState.tension >= 90) return "animate-pulse bg-red-900/30";
    if (gameState.tension >= 70) return "bg-red-900/10";
    return "";
  };

  const renderFactionSelection = () => (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in overflow-hidden">
      {/* Background with overlay */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-transparent to-slate-900"></div>

      <div className="z-10 text-center">
        <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-600 via-white to-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          TAIWAN EMERGENCY
        </h1>
        <h2 className="text-xl md:text-3xl mb-12 text-slate-300 font-serif flex items-center justify-center gap-4">
           <span className="h-px w-12 bg-slate-600"></span>
           <ruby className="text-red-500">台湾<rt>たいわん</rt></ruby><ruby className="text-red-500">有事<rt>ゆうじ</rt></ruby> 
           <span className="text-slate-500 text-lg">SIMULATION</span>
           <span className="h-px w-12 bg-slate-600"></span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
          {Object.keys(FACTION_DATA).map((key) => {
            const fid = key as FactionId;
            const data = FACTION_DATA[fid];
            return (
              <button
                key={fid}
                onClick={() => startGame(fid)}
                className={`
                  group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80 backdrop-blur-sm p-6 
                  hover:bg-slate-800/90 transition-all duration-300 hover:scale-[1.02] hover:border-${data.color}-500
                  flex items-center gap-4 shadow-xl
                `}
              >
                <span className="text-5xl drop-shadow-md">{data.flag}</span>
                <div className="text-left">
                  <p className="text-xs text-slate-500 font-mono tracking-widest mb-1">SELECT FACTION</p>
                  <h3 className={`text-2xl font-bold text-${data.color}-400 group-hover:text-white transition-colors`}>
                    {data.name}
                  </h3>
                </div>
                <div className={`absolute inset-0 bg-${data.color}-500/10 opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="absolute bottom-0 right-0 p-2 opacity-50 group-hover:opacity-100 transition-opacity">
                   <svg className="w-6 h-6 text-slate-400 transform -rotate-45 group-hover:rotate-0 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                   </svg>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-16 flex flex-col items-center space-y-2 z-20 relative">
          <div className="text-xs text-slate-500 font-mono tracking-widest">
            POWERED BY GEMINI 2.5 FLASH & LIVE INTELLIGENCE
          </div>
          <a 
            href="https://my-portfolio-beige-five-56.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-slate-400 font-mono hover:text-white transition-colors border-b border-transparent hover:border-slate-500"
          >
            千葉２狗 🐶
          </a>
        </div>
      </div>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in relative z-10 bg-black/80 backdrop-blur-md h-screen">
      <h2 className={`text-6xl font-black mb-6 ${gameState.tension >= 95 ? 'text-red-600 animate-pulse' : 'text-white'}`}>
        {gameState.tension >= 95 ? "NUCLEAR WINTER" : gameState.support <= 0 ? "REGIME FALLEN" : gameState.economy <= 0 ? "ECONOMIC COLLAPSE" : "CEASEFIRE ACHIEVED"}
      </h2>
      <p className="text-xl text-slate-300 mb-8 max-w-2xl font-serif italic">
        {gameState.tension >= 95 
          ? "The threshold was crossed. There are no winners in modern warfare." 
          : gameState.support <= 0 
          ? "The people have risen up. Your cabinet has been dissolved."
          : gameState.economy <= 0
          ? "Markets have flatlined. The nation is bankrupt."
          : "You navigated the storm. Peace remains fragile, but intact."}
      </p>
      
      <div className="w-full max-w-md bg-slate-900/90 p-6 rounded-lg border border-slate-700 mb-8 shadow-2xl">
        <h3 className="text-slate-400 mb-4 font-mono uppercase tracking-widest border-b border-slate-700 pb-2">Final Report</h3>
        <StatBar label="Tension" value={gameState.tension} color="red" icon={<IconTension />} />
        <div className="h-4" />
        <StatBar label="Economy" value={gameState.economy} color="emerald" icon={<IconEconomy />} />
        <div className="h-4" />
        <StatBar label="Support" value={gameState.support} color="blue" icon={<IconSupport />} />
      </div>

      <button 
        onClick={() => window.location.reload()}
        className="px-10 py-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-sm tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(220,38,38,0.5)]"
      >
        REBOOT SYSTEM
      </button>
    </div>
  );

  // --- Main Render ---

  if (gameState.gameStatus === 'IDLE') return renderFactionSelection();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Dynamic Background Layer */}
      <div className={`fixed inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out opacity-20 ${getBackgroundClass()}`} />
      
      {/* Tension Alert Overlay */}
      <div className={`fixed inset-0 pointer-events-none z-0 transition-colors duration-1000 ${getAlertOverlay()}`}></div>

      <div className="fixed inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-900/80 pointer-events-none z-0" />

      {/* LEFT: STATUS & INTEL */}
      <aside className="w-full md:w-80 bg-slate-900/90 backdrop-blur-md border-r border-slate-800 flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-black/40">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl filter drop-shadow-lg">{gameState.selectedFaction && FACTION_DATA[gameState.selectedFaction].flag}</span>
            <div className="flex flex-col">
              <span className={`font-mono tracking-widest font-bold ${gameState.tension > 80 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                DEFCON {Math.max(1, 5 - Math.floor(gameState.tension / 25))}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">COMMAND TERMINAL</span>
            </div>
          </h2>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
              National Status
            </h3>
            <div className="space-y-5">
              <StatBar label="Tension" value={gameState.tension} color="red" icon={<IconTension />} />
              <StatBar label="Economy" value={gameState.economy} color="emerald" icon={<IconEconomy />} />
              <StatBar label="Support" value={gameState.support} color="blue" icon={<IconSupport />} />
            </div>
          </div>

          <div>
             <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
               <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
               Live Intelligence
             </h3>
             {gameState.sources.length > 0 ? (
               <ul className="space-y-3">
                 {gameState.sources.map((src, idx) => (
                   <li key={idx} className="text-xs group">
                     <a href={src.uri} target="_blank" rel="noopener noreferrer" className="block p-2 rounded bg-slate-800/50 border border-slate-700 hover:border-blue-500 transition-colors">
                       <div className="text-sky-400 font-bold mb-1 truncate">◆ {src.title}</div>
                       <div className="text-[10px] text-slate-500 font-mono truncate">{new URL(src.uri).hostname}</div>
                     </a>
                   </li>
                 ))}
               </ul>
             ) : (
               <div className="p-4 rounded border border-dashed border-slate-700 text-center">
                 <p className="text-xs text-slate-600 italic">Scanning global frequencies...</p>
               </div>
             )}
          </div>
        </div>

        {/* REQUIRED FRIENDLY LINK */}
        <div className="p-4 border-t border-slate-800 text-center bg-black/20">
            <a 
              href="https://my-portfolio-beige-five-56.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-slate-600 hover:text-white transition-colors"
            >
              千葉２狗 🐶
            </a>
        </div>
      </aside>

      {/* RIGHT: MAIN TERMINAL */}
      <main className="flex-1 flex flex-col relative h-[100vh] z-10">
        
        {/* Header Scanline Effect */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-30 z-30"></div>
        
        {gameState.gameStatus === 'GAME_OVER' ? (
          renderGameOver()
        ) : (
          <>
            {/* Scrollable Content Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 md:pb-36 space-y-8 scroll-smooth">
              
              {/* Turn Counter / Date */}
              <div className="flex justify-center mb-8">
                 <div className="bg-slate-900/80 border border-slate-700 rounded-full px-6 py-1 text-xs font-mono text-slate-400 shadow-lg">
                    TURN_SEQUENCE: {gameState.turn.toString().padStart(3, '0')} // DATE: {new Date().getFullYear()} + {gameState.turn}M
                 </div>
              </div>

              {/* History Log */}
              {gameState.history.map((turn, i) => (
                <div key={i} className="opacity-50 hover:opacity-100 transition-opacity duration-300 pl-4 border-l-2 border-slate-800 hover:border-slate-600">
                  <div className="text-[10px] font-mono text-slate-600 mb-1">ARCHIVED_LOG_0{i + 1}</div>
                  <h4 className="text-slate-300 font-bold text-sm mb-1">{turn.outcomeTitle.en}</h4>
                  <p className="text-slate-500 text-sm font-mono line-clamp-2">{turn.outcomeDescription.en}</p>
                </div>
              ))}

              {/* Loading State */}
              {(gameState.gameStatus === 'LOADING' || gameState.gameStatus === 'RESOLVING') && (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="mt-6 font-mono text-red-500 tracking-widest blink">
                    {gameState.gameStatus === 'LOADING' ? 'DECRYPTING INTEL STREAM...' : 'SIMULATING OUTCOMES...'}
                  </span>
                </div>
              )}

              {/* Current Scenario (The Active Item) */}
              {gameState.currentScenario && gameState.gameStatus === 'PLAYING' && (
                <div className="animate-fade-in-up">
                  
                  {/* Breaking News Section with Ticker */}
                  <div className="mb-6 bg-red-950/40 border-y border-red-900/50 backdrop-blur-sm overflow-hidden relative shadow-[0_0_15px_rgba(255,0,0,0.1)]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600 animate-pulse"></div>
                    <div className="p-4 pl-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                        <span className="text-red-500 font-mono text-xs tracking-[0.2em] font-bold uppercase">Breaking News</span>
                        <div className="h-px bg-red-900 flex-1"></div>
                      </div>
                      
                      {/* Main Headline */}
                      <div className="space-y-2 mb-6">
                        <p className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none drop-shadow-md">
                            {gameState.currentScenario.newsHeadline.zh}
                        </p>
                         <p 
                            className="text-lg md:text-xl text-yellow-100/90 font-serif leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: gameState.currentScenario.newsHeadline.ja }}
                         />
                        <p className="text-sm md:text-base text-red-200/80 font-mono uppercase tracking-wide">
                            {gameState.currentScenario.newsHeadline.en}
                        </p>
                      </div>

                      {/* Live Ticker Feed */}
                      {gameState.currentScenario.newsTicker && gameState.currentScenario.newsTicker.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-red-900/30">
                          <div className="text-[10px] text-red-400 font-mono mb-2 uppercase tracking-widest">Live Updates</div>
                          <div className="space-y-3">
                            {gameState.currentScenario.newsTicker.map((item, idx) => (
                              <div key={idx} className="flex gap-3 text-sm opacity-90 hover:opacity-100 transition-opacity">
                                <span className="font-mono text-red-500 text-xs mt-1">
                                  {new Date().getHours()}:{String(new Date().getMinutes() - idx * 12).padStart(2, '0')}
                                </span>
                                <div className="space-y-0.5">
                                  <div className="text-slate-200 font-medium">{item.zh}</div>
                                  <div className="text-yellow-100/70 text-xs font-serif" dangerouslySetInnerHTML={{ __html: item.ja }}></div>
                                  <div className="text-slate-500 text-[10px] font-mono uppercase">{item.en}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Main Scenario Card */}
                  <div className="bg-slate-900/80 p-6 md:p-10 rounded-xl border border-slate-700/50 shadow-2xl backdrop-blur-md">
                    <div className="mb-2 text-xs font-mono text-blue-400 tracking-widest">SITUATION REPORT</div>
                    <TrilingualText text={gameState.currentScenario.title} className="mb-8" />
                    
                    <div className="p-6 bg-black/40 rounded border-l-4 border-slate-600 font-serif text-lg leading-relaxed text-slate-300 shadow-inner">
                      <TrilingualText text={gameState.currentScenario.description} />
                    </div>
                  </div>
                </div>
              )}

              {/* Padding for fixed bottom controls */}
              <div className="h-48 md:hidden"></div> 
            </div>

            {/* Sticky Action Panel */}
            {gameState.gameStatus === 'PLAYING' && gameState.currentScenario && (
              <div className="sticky bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent border-t border-slate-800/50 p-4 md:p-6 z-20 backdrop-blur-sm">
                 <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gameState.currentScenario.choices.map((choice) => {
                      // Special style for Nuclear/Clandestine
                      const isExtreme = choice.type === 'NUCLEAR' || choice.type === 'CLANDESTINE';
                      
                      return (
                        <button
                          key={choice.id}
                          onClick={() => handleChoice(choice.id)}
                          className={`
                            relative group overflow-hidden p-4 rounded-lg text-left transition-all duration-200 active:scale-95
                            ${isExtreme 
                              ? 'bg-red-900/20 border-2 border-red-600 hover:bg-red-900/40 hover:border-red-500 animate-pulse' 
                              : 'bg-slate-900/90 border border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                            }
                          `}
                        >
                           {isExtreme && (
                             <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,0,0,0.1)_10px,rgba(255,0,0,0.1)_20px)] pointer-events-none"></div>
                           )}
                           
                           <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${isExtreme ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                {choice.type}
                              </span>
                              <span className="text-slate-600 font-mono text-xs">OPT-{choice.id}</span>
                           </div>

                           <div className={`text-sm md:text-base font-bold mb-1 ${isExtreme ? 'text-red-100' : 'text-slate-200 group-hover:text-white'}`}>
                             {choice.text.zh}
                           </div>
                           <div 
                              className={`text-xs md:text-sm font-serif mb-1 leading-relaxed ${isExtreme ? 'text-red-200/70' : 'text-yellow-100/60'}`}
                              dangerouslySetInnerHTML={{ __html: choice.text.ja }} 
                           />
                           <div className={`text-xs font-mono ${isExtreme ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                             {choice.text.en}
                           </div>
                        </button>
                      );
                    })}
                 </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}