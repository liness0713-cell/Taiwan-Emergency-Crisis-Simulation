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
    if (newTension >= 95) isOver = true; // War
    if (newSupport <= 10) isOver = true; // Coup/Collapse
    if (gameState.turn >= 5) isOver = true; // Survival

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
    // Fetch scenario for next turn based on outcome context
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

  const renderFactionSelection = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      <h1 className="text-4xl md:text-6xl font-bold mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-white to-red-500">
        TAIWAN EMERGENCY
      </h1>
      <h2 className="text-xl md:text-2xl mb-12 text-slate-400 font-serif">
        <ruby>台湾<rt>たいわん</rt></ruby><ruby>有事<rt>ゆうじ</rt></ruby> · Crisis Simulation
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {Object.keys(FACTION_DATA).map((key) => {
          const fid = key as FactionId;
          const data = FACTION_DATA[fid];
          return (
            <button
              key={fid}
              onClick={() => startGame(fid)}
              className={`
                group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50 p-6 
                hover:bg-slate-700/80 transition-all duration-300 hover:scale-[1.02] hover:border-${data.color}-500
                flex items-center gap-4
              `}
            >
              <span className="text-5xl">{data.flag}</span>
              <div className="text-left">
                <p className="text-sm text-slate-400 font-mono">COMMAND</p>
                <h3 className={`text-2xl font-bold text-${data.color}-400 group-hover:text-white`}>
                  {data.name}
                </h3>
              </div>
              <div className={`absolute inset-0 bg-${data.color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity`} />
            </button>
          );
        })}
      </div>

      <div className="mt-16 flex flex-col items-center space-y-2">
        <div className="text-xs text-slate-600 font-mono">
          POWERED BY GEMINI 2.5 FLASH & GOOGLE SEARCH
        </div>
        <a 
          href="https://my-portfolio-beige-five-56.vercel.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-slate-600 font-mono hover:text-white transition-colors"
        >
          千葉２狗 🐶
        </a>
      </div>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
      <h2 className="text-5xl font-bold mb-6 text-white">
        {gameState.tension >= 95 ? "GLOBAL CONFLICT ERUPTED" : gameState.support <= 10 ? "GOVERNMENT COLLAPSED" : "CRISIS AVERTED"}
      </h2>
      <p className="text-xl text-slate-300 mb-8 max-w-2xl">
        {gameState.tension >= 95 
          ? "Diplomacy failed. The region has plunged into chaos." 
          : gameState.support <= 10 
          ? "Internal strife has dissolved your authority."
          : "You navigated the crisis successfully. Peace remains fragile, but intact."}
      </p>
      
      <div className="w-full max-w-md bg-slate-900 p-6 rounded-lg border border-slate-700 mb-8">
        <h3 className="text-slate-400 mb-4 font-mono">FINAL STATISTICS</h3>
        <StatBar label="Tension" value={gameState.tension} color="red" icon={<IconTension />} />
        <div className="h-4" />
        <StatBar label="Economy" value={gameState.economy} color="emerald" icon={<IconEconomy />} />
        <div className="h-4" />
        <StatBar label="Support" value={gameState.support} color="blue" icon={<IconSupport />} />
      </div>

      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-colors"
      >
        REBOOT SIMULATION
      </button>
    </div>
  );

  // --- Main Render ---

  if (gameState.gameStatus === 'IDLE') return renderFactionSelection();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden">
      
      {/* LEFT: STATUS & INTEL */}
      <aside className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>{gameState.selectedFaction && FACTION_DATA[gameState.selectedFaction].flag}</span>
            <span className="font-mono tracking-widest">DEFCON {Math.floor((100 - gameState.tension) / 20) + 1}</span>
          </h2>
          <div className="mt-1 text-xs text-slate-500 font-mono">TURN {gameState.turn} // {gameState.selectedFaction} HIGH COMMAND</div>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Strategic Indicators</h3>
            <div className="space-y-4">
              <StatBar label="Tension" value={gameState.tension} color="red" icon={<IconTension />} />
              <StatBar label="Economy" value={gameState.economy} color="emerald" icon={<IconEconomy />} />
              <StatBar label="Support" value={gameState.support} color="blue" icon={<IconSupport />} />
            </div>
          </div>

          <div>
             <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Intelligence Sources</h3>
             {gameState.sources.length > 0 ? (
               <ul className="space-y-2">
                 {gameState.sources.map((src, idx) => (
                   <li key={idx} className="text-xs truncate">
                     <a href={src.uri} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline hover:text-sky-300 block truncate">
                       ◆ {src.title}
                     </a>
                   </li>
                 ))}
               </ul>
             ) : (
               <p className="text-xs text-slate-600 italic">No live signals detected.</p>
             )}
          </div>
        </div>

        {/* REQUIRED FRIENDLY LINK */}
        <div className="p-4 border-t border-slate-800 text-center">
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
      <main className="flex-1 flex flex-col relative h-[100vh]">
        {/* Header decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>

        {gameState.gameStatus === 'GAME_OVER' ? (
          renderGameOver()
        ) : (
          <>
            {/* Scrollable Content Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 md:pb-32 space-y-12 scroll-smooth">
              
              {/* History Log */}
              {gameState.history.map((turn, i) => (
                <div key={i} className="opacity-60 border-l-2 border-slate-700 pl-6 py-2 grayscale transition-all hover:grayscale-0 hover:opacity-100">
                  <div className="text-xs font-mono text-slate-500 mb-2">ARCHIVED // TURN {i + 1}</div>
                  <TrilingualText text={turn.outcomeTitle} className="mb-2 !text-lg" />
                  <div className="text-sm text-slate-400 font-mono pl-3">{turn.outcomeDescription.en}</div>
                </div>
              ))}

              {/* Current Scenario (The Active Item) */}
              {gameState.gameStatus === 'LOADING' || gameState.gameStatus === 'RESOLVING' ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="font-mono text-red-400 blink">
                    {gameState.gameStatus === 'LOADING' ? 'ESTABLISHING SECURE UPLINK...' : 'CALCULATING STRATEGIC OUTCOMES...'}
                  </span>
                </div>
              ) : gameState.currentScenario ? (
                <div className="bg-slate-900/50 p-6 md:p-10 rounded-xl border border-slate-700 shadow-2xl animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="animate-pulse w-3 h-3 bg-red-500 rounded-full"></span>
                    <span className="text-red-500 font-mono text-sm tracking-widest uppercase">Live Crisis Feed</span>
                  </div>
                  
                  {gameState.currentScenario.newsSummary && (
                    <div className="mb-6 p-3 bg-red-900/20 border border-red-900/50 rounded text-xs md:text-sm text-red-300 font-mono shadow-inner">
                      <span className="font-bold text-red-500 mr-2">[BREAKING]</span>
                      {gameState.currentScenario.newsSummary}
                    </div>
                  )}
                  
                  <TrilingualText text={gameState.currentScenario.title} className="mb-8" />
                  
                  <div className="p-4 bg-black/30 rounded border-l-2 border-slate-600">
                    <TrilingualText text={gameState.currentScenario.description} />
                  </div>
                </div>
              ) : null}

              {/* Padding for fixed bottom controls */}
              <div className="h-48 md:hidden"></div> 
            </div>

            {/* Sticky Action Panel */}
            {gameState.gameStatus === 'PLAYING' && gameState.currentScenario && (
              <div className="sticky bottom-0 bg-slate-950/90 backdrop-blur border-t border-slate-800 p-4 md:p-8 z-20">
                 <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gameState.currentScenario.choices.map((choice) => (
                      <button
                        key={choice.id}
                        onClick={() => handleChoice(choice.id)}
                        className={`
                          relative group overflow-hidden p-4 rounded bg-slate-900 border border-slate-700 text-left
                          hover:border-${choice.type === 'MILITARY' ? 'red' : choice.type === 'DIPLOMATIC' ? 'blue' : 'emerald'}-500 
                          transition-all duration-200 active:scale-95
                        `}
                      >
                         <div className="absolute top-0 right-0 p-1">
                            <span className="text-[10px] font-mono uppercase bg-slate-800 px-1 rounded text-slate-400">
                              {choice.type}
                            </span>
                         </div>
                         <div className="text-sm md:text-base font-bold text-slate-200 mb-1 group-hover:text-white">
                           <span className="mr-2 text-slate-500 font-mono">[{choice.id}]</span>
                           {choice.text.zh}
                         </div>
                         <div className="text-xs text-slate-400 font-mono group-hover:text-slate-300">
                           {choice.text.en}
                         </div>
                      </button>
                    ))}
                 </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}