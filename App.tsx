
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Bet, GameHistory, User } from './types';
import { AviatorCanvas } from './components/AviatorCanvas';
import { getAICommentary } from './services/geminiService';
import { TopUpModal } from './components/TopUpModal';
import { Auth } from './components/Auth';

const INITIAL_BALANCE = 1000.00;
const TICK_RATE = 50; 

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [status, setStatus] = useState<GameStatus>(GameStatus.WAITING);
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [betAmount, setBetAmount] = useState(10);
  const [currentBet, setCurrentBet] = useState<Bet | null>(null);
  const [aiMessage, setAiMessage] = useState("Engine warm-up initiated. Prepare for takeoff.");
  const [otherBets, setOtherBets] = useState<Bet[]>([]);
  const [lastWin, setLastWin] = useState<{amount: number, mult: number} | null>(null);
  const [showLoss, setShowLoss] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const crashPointRef = useRef(1.0);
  const gameIntervalRef = useRef<number | null>(null);

  const generateSimulatedBets = useCallback(() => {
    const players = ["JetSetter", "CloudRider", "AeroKing", "SkyHigh", "LuckyPilot", "CryptoHawk", "Velocity", "MachOne"];
    const bets: Bet[] = players.map(name => ({
      id: Math.random().toString(),
      playerName: name,
      amount: Math.floor(Math.random() * 200) + 5,
      cashedOut: false
    }));
    setOtherBets(bets);
  }, []);

  const updateAICommentary = async (currStatus: GameStatus, currMult: number, lastC: number | undefined) => {
    const msg = await getAICommentary(currStatus, currMult, lastC);
    setAiMessage(msg);
  };

  const startNewGame = useCallback(() => {
    const random = Math.random();
    let crash;
    if (random < 0.12) crash = 1.0; 
    else if (random < 0.6) crash = 1.1 + Math.random() * 1.5; 
    else if (random < 0.85) crash = 2.5 + Math.random() * 4.0;
    else crash = 6.5 + Math.random() * 15.0;

    crashPointRef.current = crash;
    setMultiplier(1.0);
    setStatus(GameStatus.FLYING);
    setShowLoss(false);
    setLastWin(null);
    generateSimulatedBets();
    updateAICommentary(GameStatus.FLYING, 1.0, undefined);
  }, [generateSimulatedBets]);

  useEffect(() => {
    if (status === GameStatus.FLYING) {
      gameIntervalRef.current = window.setInterval(() => {
        setMultiplier(prev => {
          const speed = prev < 2 ? 0.012 : (prev < 5 ? 0.02 : 0.04);
          const next = prev + (prev * speed);
          
          if (next >= crashPointRef.current) {
            clearInterval(gameIntervalRef.current!);
            setStatus(GameStatus.CRASHED);
            setHistory(h => [{ id: Date.now().toString(), multiplier: crashPointRef.current, timestamp: Date.now() }, ...h].slice(0, 15));
            
            if (currentBet && !currentBet.cashedOut) {
              setShowLoss(true);
            }
            
            updateAICommentary(GameStatus.CRASHED, crashPointRef.current, crashPointRef.current);
            
            setTimeout(() => {
              setStatus(GameStatus.WAITING);
              setCurrentBet(null);
              setShowLoss(false);
            }, 4000);
            return crashPointRef.current;
          }
          
          setOtherBets(prevBets => prevBets.map(b => {
            if (!b.cashedOut && Math.random() < 0.02 && prev > 1.3) {
              return { ...b, cashedOut: true, multiplier: prev };
            }
            return b;
          }));

          return next;
        });
      }, TICK_RATE);
    } else if (status === GameStatus.WAITING && user) {
       const timer = setTimeout(() => {
          startNewGame();
       }, 5000);
       return () => clearTimeout(timer);
    }

    return () => {
      if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
    };
  }, [status, startNewGame, currentBet, user]);

  const placeBet = () => {
    if (status !== GameStatus.WAITING || balance < betAmount || currentBet) return;
    setBalance(prev => prev - betAmount);
    setCurrentBet({
      id: 'player-bet',
      playerName: user?.username || 'You',
      amount: betAmount,
      cashedOut: false
    });
  };

  const cashOut = () => {
    if (status !== GameStatus.FLYING || !currentBet || currentBet.cashedOut) return;
    const winnings = currentBet.amount * multiplier;
    setBalance(prev => prev + winnings);
    setCurrentBet(prev => prev ? { ...prev, cashedOut: true, multiplier: multiplier } : null);
    setLastWin({ amount: winnings, mult: multiplier });
  };

  const handleTopUpSuccess = (amount: number) => {
    setBalance(prev => prev + amount);
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    setBalance(userData.balance);
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-2 sm:p-4 selection:bg-red-600/30 overflow-x-hidden">
      <TopUpModal 
        isOpen={isTopUpOpen} 
        onClose={() => setIsTopUpOpen(false)} 
        onSuccess={handleTopUpSuccess}
        username={user.username}
      />

      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center py-2 sm:py-4 px-1">
        <div className="flex items-center gap-2 sm:gap-3 group">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20 active:scale-95 transition-transform">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-white" viewBox="0 0 24 24"><path d="M21 16l-4-3V4a1 1 0 00-1-1h-2a1 1 0 00-1 1v9l-4 3H9l2-3-1-1-2 2H7l1-2-1-1-2 1V7l3 2V7l-3-2V3l5 3 2-2 2 2 5-3v2l-3 2v2l3-2v1l-2-1-1 1 1 2h1l2-2-1 1 2 3h1z" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-xl font-black italic tracking-tighter leading-none">SKYBOUND <span className="text-red-600">AVIATOR</span></span>
            <span className="text-[7px] sm:text-[9px] font-black text-white/30 uppercase tracking-widest mt-0.5">Pilot: {user.username}</span>
          </div>
        </div>

        <div className="bg-neutral-900/80 backdrop-blur-md px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-white/5 flex items-center gap-2 sm:gap-4 shadow-xl">
           <div className="text-right">
              <div className="text-[7px] sm:text-[9px] font-black text-white/30 uppercase tracking-widest">Balance</div>
              <div className="text-sm sm:text-lg font-black text-green-400 tabular-nums">৳{balance.toFixed(2)}</div>
           </div>
           <button 
             onClick={() => setIsTopUpOpen(true)}
             className="bg-green-600 hover:bg-green-500 text-white font-black px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs transition-all active:scale-95 flex items-center gap-1"
           >
             <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
             <span className="hidden sm:inline">TOP UP</span>
             <span className="sm:hidden">ADD</span>
           </button>
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 mt-2 sm:mt-4 relative">
        {/* Win/Loss Overlays */}
        {lastWin && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] animate-bounce pointer-events-none">
            <div className="bg-green-600 border-2 sm:border-4 border-white text-white px-6 py-3 sm:px-10 sm:py-5 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(22,163,74,0.5)] text-center transform -rotate-2">
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80">You Won!</p>
              <p className="text-2xl sm:text-4xl font-black italic">৳{lastWin.amount.toFixed(2)}</p>
              <p className="text-[10px] sm:text-sm font-bold opacity-70">at {lastWin.mult.toFixed(2)}x</p>
            </div>
          </div>
        )}

        {showLoss && status === GameStatus.CRASHED && (
           <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none">
            <div className="bg-neutral-800 border-2 sm:border-4 border-red-600 text-red-500 px-6 py-3 sm:px-10 sm:py-5 rounded-2xl sm:rounded-3xl shadow-2xl text-center transform rotate-2">
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Flew Away!</p>
              <p className="text-2xl sm:text-4xl font-black italic">BUSTED</p>
            </div>
          </div>
        )}

        {/* Center: Main Game */}
        <div className="lg:col-span-9 flex flex-col gap-3 sm:gap-5 order-1">
           <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar touch-pan-x">
              {history.map(h => (
                <div key={h.id} className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[9px] sm:text-xs font-black italic border transition-all ${h.multiplier >= 2 ? 'bg-purple-900/40 text-purple-400 border-purple-500/30' : 'bg-blue-900/40 text-blue-400 border-blue-500/30'}`}>
                   {h.multiplier.toFixed(2)}x
                </div>
              ))}
              {history.length === 0 && <span className="text-[9px] text-white/20 uppercase font-black tracking-widest py-1">Recent Multipliers</span>}
           </div>

           <AviatorCanvas multiplier={multiplier} status={status} />

           <div className="flex flex-col gap-3">
              <div className="bg-neutral-900 p-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-white/10 flex flex-col gap-3">
                 <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="flex-1 flex flex-col gap-1.5">
                       <div className="flex justify-between px-1">
                          <span className="text-[8px] sm:text-[10px] font-black text-white/30 uppercase">Bet Amount</span>
                          <span className="text-[8px] sm:text-[10px] font-black text-white/30">BAL: ৳{balance.toFixed(2)}</span>
                       </div>
                       <div className="bg-black/40 border border-white/5 rounded-xl sm:rounded-2xl flex items-center px-3 py-2 sm:py-3">
                          <input 
                            type="number" 
                            inputMode="decimal"
                            value={betAmount} 
                            onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
                            className="bg-transparent text-lg sm:text-xl font-black w-full focus:outline-none tabular-nums"
                          />
                          <div className="flex gap-2">
                             <button onClick={() => setBetAmount(prev => Math.max(1, prev - 10))} className="p-1 hover:text-red-500 active:scale-75 transition-all">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
                             </button>
                             <button onClick={() => setBetAmount(prev => prev + 10)} className="p-1 hover:text-green-500 active:scale-75 transition-all">
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                             </button>
                          </div>
                       </div>
                    </div>

                    <div className="flex-1">
                       {status === GameStatus.FLYING && currentBet && !currentBet.cashedOut ? (
                         <button 
                           onClick={cashOut}
                           className="w-full h-14 sm:h-20 bg-orange-500 hover:bg-orange-400 text-white rounded-xl sm:rounded-[2rem] shadow-xl flex flex-col items-center justify-center transition-all active:scale-95 group overflow-hidden relative"
                         >
                           <span className="relative z-10 text-[9px] sm:text-xs font-black uppercase tracking-widest opacity-80 mb-0.5 sm:mb-1">CASH OUT</span>
                           <span className="relative z-10 text-xl sm:text-3xl font-black italic tracking-tighter">
                             ৳{(currentBet.amount * multiplier).toFixed(2)}
                           </span>
                         </button>
                       ) : (
                         <button 
                           onClick={placeBet}
                           disabled={status !== GameStatus.WAITING || !!currentBet}
                           className={`w-full h-14 sm:h-20 rounded-xl sm:rounded-[2rem] shadow-xl flex flex-col items-center justify-center transition-all active:scale-95 uppercase italic ${status === GameStatus.WAITING && !currentBet ? 'bg-green-600 hover:bg-green-500' : 'bg-neutral-800 text-white/10 opacity-50 cursor-not-allowed shadow-none'}`}
                         >
                           <span className="text-lg sm:text-xl font-black tracking-tighter">BET ৳{betAmount}</span>
                           {status !== GameStatus.WAITING && <span className="text-[7px] sm:text-[10px] font-black not-italic opacity-40">Wait for next round</span>}
                         </button>
                       )}
                    </div>
                 </div>
              </div>

              <div className="bg-neutral-900/60 border border-white/5 p-3 rounded-xl flex items-center gap-3">
                 <div className="w-6 h-6 rounded-md bg-red-600/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/></svg>
                 </div>
                 <p className="text-[10px] sm:text-sm font-bold italic text-white/70 line-clamp-1">
                   "{aiMessage}"
                 </p>
              </div>
           </div>
        </div>

        {/* Left Side: Stats & Players */}
        <div className="lg:col-span-3 bg-neutral-900/40 rounded-2xl sm:rounded-3xl border border-white/5 p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 h-[300px] sm:h-[400px] lg:h-[650px] order-2 lg:order-1">
           <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-[8px] sm:text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Live Lobby</h3>
              <div className="flex items-center gap-1">
                 <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                 <span className="text-[8px] sm:text-[10px] font-bold text-green-500">{otherBets.length + 124}</span>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar touch-pan-y">
              {currentBet && (
                <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all ${currentBet.cashedOut ? 'bg-green-600/20 border-green-500/30' : 'bg-red-600/10 border-red-500/30 animate-pulse'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase">YOU</span>
                    <span className="text-[10px] sm:text-xs font-bold text-white/60">৳{currentBet.amount}</span>
                  </div>
                  {currentBet.cashedOut && (
                    <div className="mt-1 flex justify-between items-end border-t border-green-500/20 pt-1">
                      <span className="text-[8px] sm:text-[10px] font-black text-green-400 uppercase">WIN</span>
                      <span className="text-xs sm:text-sm font-black text-green-400">{currentBet.multiplier?.toFixed(2)}x</span>
                    </div>
                  )}
                </div>
              )}
              {otherBets.map(bet => (
                <div key={bet.id} className={`p-2 rounded-xl border bg-white/5 border-transparent transition-all ${bet.cashedOut ? 'bg-green-600/5 border-green-500/10' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-white/70">{bet.playerName}</span>
                    <span className="text-[9px] font-mono text-white/20">৳{bet.amount}</span>
                  </div>
                  {bet.cashedOut && (
                    <div className="mt-0.5 text-right">
                       <span className="text-[9px] font-black text-green-500/60 italic">{bet.multiplier?.toFixed(2)}x</span>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>
      </div>

      <footer className="w-full max-w-6xl mt-8 mb-4 py-4 border-t border-white/5 flex flex-col items-center gap-4 opacity-10">
         <div className="text-[7px] sm:text-[10px] font-black tracking-[0.2em] text-center uppercase">
            ENGINE STATUS: OPTIMAL | PROVABLY SAFE
         </div>
      </footer>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
