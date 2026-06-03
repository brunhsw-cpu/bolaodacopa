import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Users, Settings, LogIn, ChevronRight, Check, Activity, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from './lib/utils';
import type { AppState, User, Match, Prediction } from './types';

// --- MOCK API CALLS ---
const fetchState = async (): Promise<AppState> => (await fetch('/api/state')).json();

const loginUser = async (name: string): Promise<{user: User}> => {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.json();
};

const sendPrediction = async (userId: string, matchId: string, homeScore: number, awayScore: number) => {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, matchId, homeScore, awayScore })
  });
  return res.json();
};

const sendMatchResult = async (matchId: string, homeScore: number, awayScore: number) => {
  const res = await fetch('/api/admin/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId, homeScore, awayScore })
  });
  return res.json();
};

const syncAPI = async () => {
  const res = await fetch('/api/admin/sync', { method: 'POST' });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
};

const verifyRoomAPI = async (password: string) => {
  const res = await fetch('/api/verify-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
};


export default function App() {
  const [isRoomAuthenticated, setIsRoomAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [state, setState] = useState<AppState>({ users: [], matches: [], predictions: [] });
  const [activeTab, setActiveTab] = useState<'matches' | 'ranking' | 'livescore' | 'admin'>('matches');
  const [isLoading, setIsLoading] = useState(true);

  // Load Data
  const refreshState = async () => {
    const data = await fetchState();
    setState(data);
    
    // Update current user score if necessary
    if (currentUser) {
      const updatedUser = data.users.find(u => u.id === currentUser.id);
      if (updatedUser) setCurrentUser(updatedUser);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => {
    refreshState().then(() => setIsLoading(false));
    // Poll every 10s for real-time vibe
    const interval = setInterval(refreshState, 10000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const handleShare = () => {
    const rankingUsers = state.users.filter(u => !u.isAdmin);
    const text = `🏆 *BOLÃO TOTAL CORINTHIANS* 🏆\n\n*Ranking Atualizado:*\n${rankingUsers.map((u, i) => `${i + 1}º - *${u.name}* (${u.score} pts)`).join('\n')}\n\nAcesse e faça seus palpites!`;
    navigator.clipboard.writeText(text).then(() => {
      alert('Ranking copiado para a área de transferência! Cole no seu WhatsApp.');
    }).catch(() => {
      alert('Não foi possível copiar. Tente novamente.');
    });
  };


  // ROOM AUTH VIEW
  if (!isRoomAuthenticated) {
    return <RoomAuthView onAuthenticated={() => setIsRoomAuthenticated(true)} />;
  }

  // LOGIN VIEW
  if (!currentUser) {
    return <LoginView onLogin={(u) => setCurrentUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20 font-sans flex flex-col overflow-x-hidden w-full">
      {/* Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-zinc-500 font-mono text-xs tracking-widest uppercase flex items-center gap-2 mb-1"> <Trophy className="w-3 h-3 text-yellow-400" /> Copa 2026</span>
            <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter leading-none flex items-center gap-3">
              <img src="https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png" alt="Corinthians" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
              <div className="flex flex-col">
                <span>BOLÃO TOTAL</span>
                <span className="text-lg sm:text-xl text-yellow-400">CORINTHIANS</span>
              </div>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{currentUser.name}</span>
              <span className="text-sm font-mono font-bold text-yellow-400">{currentUser.score} PTS</span>
            </div>
            <div className="w-10 h-10 bg-yellow-400 rounded-none border-2 border-white flex items-center justify-center font-black text-black text-lg">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4 pt-4">
            <div className="h-32 bg-zinc-900 rounded-none" />
            <div className="h-32 bg-zinc-900 rounded-none" />
            <div className="h-32 bg-zinc-900 rounded-none" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'matches' && (
              <motion.div key="matches" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: -10}}>
                <div className="mb-6">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Fase de Grupos</h2>
                  <h3 className="text-3xl font-black uppercase tracking-tight">Partidas</h3>
                </div>
                <div className="space-y-4">
                  {state.matches.map(match => (
                    <MatchCard 
                      key={match.id} 
                      match={match} 
                      prediction={state.predictions.find(p => p.matchId === match.id && p.userId === currentUser.id)}
                      onSavePrediction={async (hScore, aScore) => {
                        await sendPrediction(currentUser.id, match.id, hScore, aScore);
                        await refreshState();
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'ranking' && (
              <motion.div key="ranking" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: -10}}>
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-black italic uppercase leading-none tracking-tight">Leader<br/>Board</h2>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="bg-yellow-400 text-black px-3 py-1 rounded-none text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 self-start sm:self-end">
                      Ao Vivo <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    </div>
                    {currentUser.isAdmin && (
                      <button onClick={handleShare} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors">
                        <Share2 className="w-3.5 h-3.5" /> Compartilhar Ranking
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-yellow-400 text-black p-4 sm:p-6 rounded-none flex flex-col gap-6">
                  {state.users.filter(u => !u.isAdmin).map((u, i) => (
                    <div key={u.id} className="flex items-center gap-4 group">
                      <span className={cn("text-4xl sm:text-5xl font-black", i < 3 ? "opacity-100" : "opacity-30")}>
                        {(i + 1).toString().padStart(2, '0')}
                      </span>
                      <div className="flex flex-col border-l-4 border-black pl-4 flex-grow">
                        <span className="text-lg sm:text-xl font-black uppercase flex items-center justify-between">
                          <span>{u.name} {u.id === currentUser.id && <span className="text-[10px] ml-2 px-1.5 py-0.5 bg-black text-yellow-400 align-middle shrink-0">VOCÊ</span>}</span>
                        </span>
                        <span className="text-sm sm:text-base font-mono font-bold tracking-tighter">{u.score} PTS</span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-4 pt-6 border-t border-black/10 pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-4">Regras de Pontuação</p>
                    <div className="grid grid-cols-3 gap-2 opacity-80">
                      <div className="text-center">
                        <p className="text-xl sm:text-2xl font-black">100</p>
                        <p className="text-[8px] uppercase font-bold leading-tight">Placar Exato</p>
                      </div>
                      <div className="text-center border-l border-r border-black/10">
                        <p className="text-xl sm:text-2xl font-black">80</p>
                        <p className="text-[8px] uppercase font-bold leading-tight">Vencedor<br/>+ Saldo</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl sm:text-2xl font-black">50</p>
                        <p className="text-[8px] uppercase font-bold leading-tight">Apenas<br/>Vencedor</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'livescore' && (
              <motion.div key="livescore" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: -10}}>
                <div className="mb-6">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Acompanhe</h2>
                  <h3 className="text-3xl font-black uppercase tracking-tight">Tempo Real</h3>
                </div>
                <div className="space-y-4">
                  {state.matches.map(match => (
                    <div key={match.id} className="bg-zinc-900 border border-zinc-800 p-4 flex flex-col">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mb-4">
                        <span className="text-zinc-500">{format(new Date(match.date), "dd/MMM - HH:mm", { locale: ptBR })}</span>
                        <span className={cn(match.status === 'pending' ? 'text-yellow-400' : 'text-zinc-500')}>
                          {match.status === 'pending' ? 'Agendado/Ao Vivo' : 'Encerrado'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 sm:gap-4">
                         <div className="flex-1 flex flex-col gap-1 sm:gap-2 items-center text-[10px] sm:text-sm font-black uppercase min-w-0">
                           <span className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
                             {match.homeFlag.startsWith('http') ? <img src={match.homeFlag} className="w-full h-full object-contain" /> : <span className="text-2xl sm:text-3xl">{match.homeFlag}</span>}
                           </span> 
                           <span className="truncate w-full text-center">{match.homeTeam}</span>
                         </div>
                         <div className="flex items-center gap-1 sm:gap-2 font-mono text-xl sm:text-2xl font-bold bg-zinc-950 px-2 sm:px-4 py-2 sm:py-3 border border-zinc-800 shrink-0">
                           <span>{match.homeScore ?? '-'}</span>
                           <span className="text-zinc-600 text-base sm:text-lg mx-0.5 sm:mx-1">X</span>
                           <span>{match.awayScore ?? '-'}</span>
                         </div>
                         <div className="flex-1 flex flex-col gap-1 sm:gap-2 items-center text-[10px] sm:text-sm font-black uppercase min-w-0">
                           <span className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
                             {match.awayFlag.startsWith('http') ? <img src={match.awayFlag} className="w-full h-full object-contain" /> : <span className="text-2xl sm:text-3xl">{match.awayFlag}</span>}
                           </span> 
                           <span className="truncate w-full text-center">{match.awayTeam}</span>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

             {activeTab === 'admin' && currentUser.isAdmin && (
              <motion.div key="admin" initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} exit={{opacity:0, y: -10}}>
                 <div className="mb-6">
                  <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mb-1">Gerenciamento</h2>
                  <h3 className="text-3xl font-black uppercase tracking-tight">Painel Admin</h3>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 flex flex-col gap-4 mb-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Integração Externa</h4>
                    <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-1", state.apiConfigured ? "bg-yellow-400 text-black" : "bg-red-500/20 text-red-400")}>
                      {state.apiConfigured ? 'API Ativa' : 'API Ausente'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        placeholder="Cole sua API Key aqui"
                        className="flex-1 bg-zinc-950 border border-zinc-800 px-4 py-3 font-mono text-sm focus:outline-none focus:border-yellow-400 placeholder:text-zinc-600"
                      />
                      <button 
                        onClick={async () => {
                          if (!newApiKey.trim()) return;
                          try {
                            await fetch('/api/admin/change-apikey', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ newApiKey: newApiKey.trim() })
                            });
                            alert("API Key configurada com sucesso!");
                            setNewApiKey('');
                            await refreshState();
                          } catch(e:any) {
                            alert("Erro: " + e.message);
                          }
                        }}
                        className="bg-yellow-400 hover:bg-white text-black font-black uppercase tracking-wider text-xs px-4 transition-colors"
                      >
                        Salvar
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider text-left">
                      Acesse o menu <b>Account/Profile</b> (geralmente no canto superior direito) no seu painel da API-Football para copiar sua <b>API Key</b>.
                    </p>
                  </div>

                  <button 
                    disabled={isSyncing}
                    onClick={async () => {
                      setIsSyncing(true);
                      try {
                        const res = await syncAPI();
                        await refreshState();
                        alert(res.message);
                      } catch(e:any) {
                        alert("Erro: " + e.message);
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-wider text-sm py-4 transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? "Sincronizando..." : "Sincronizar Jogos Agora"}
                  </button>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 flex flex-col gap-4 mb-6">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Alterar Senha do App</h4>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newRoomPassword}
                      onChange={(e) => setNewRoomPassword(e.target.value)}
                      placeholder="Nova senha de acesso"
                      className="flex-1 bg-zinc-950 border border-zinc-800 px-4 py-3 font-mono text-sm focus:outline-none focus:border-yellow-400 placeholder:text-zinc-600"
                    />
                    <button 
                      onClick={async () => {
                        if (!newRoomPassword.trim()) return;
                        try {
                          await fetch('/api/admin/change-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newPassword: newRoomPassword })
                          });
                          alert("Senha alterada com sucesso!");
                          setNewRoomPassword('');
                        } catch(e:any) {
                          alert("Erro: " + e.message);
                        }
                      }}
                      className="bg-yellow-400 text-black px-4 py-3 font-bold uppercase tracking-wider text-xs"
                    >
                      Salvar
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {state.matches.filter(m => m.status === 'pending').map(match => (
                    <AdminMatchCard 
                      key={match.id} 
                      match={match} 
                      onSendResult={async (hScore, aScore) => {
                        await sendMatchResult(match.id, hScore, aScore);
                        await refreshState();
                      }}
                    />
                  ))}
                  {state.matches.filter(m => m.status === 'pending').length === 0 && (
                    <div className="text-center p-8 bg-zinc-900 text-zinc-500 font-bold uppercase tracking-widest text-sm rounded-none">
                      Nenhuma partida pendente
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Bottom Nav Mobile/Desktop */}
      <nav className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-800 pb-safe z-40">
        <div className="max-w-3xl mx-auto flex">
           <button 
            onClick={() => setActiveTab('matches')} 
            className={cn("flex-1 py-4 flex flex-col items-center gap-1 transition-colors relative", activeTab === 'matches' ? "text-yellow-400" : "text-zinc-500 hover:text-white")}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase border-0">Partidas</span>
            {activeTab === 'matches' && <motion.div layoutId="nav-pill" className="absolute top-0 left-0 right-0 h-1 bg-yellow-400" />}
          </button>
          <button 
            onClick={() => setActiveTab('ranking')} 
            className={cn("flex-1 py-4 flex flex-col items-center gap-1 transition-colors relative", activeTab === 'ranking' ? "text-yellow-400" : "text-zinc-500 hover:text-white")}
          >
            <Trophy className="w-5 h-5" />
             <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Ranking</span>
             {activeTab === 'ranking' && <motion.div layoutId="nav-pill" className="absolute top-0 left-0 right-0 h-1 bg-yellow-400" />}
          </button>
          
          <button 
            onClick={() => setActiveTab('livescore')} 
            className={cn("flex-1 py-4 flex flex-col items-center gap-1 transition-colors relative", activeTab === 'livescore' ? "text-yellow-400" : "text-zinc-500 hover:text-white")}
          >
            <Activity className="w-5 h-5" />
             <span className="text-[10px] font-bold tracking-[0.2em] uppercase max-w-[60px] text-center leading-tight truncate">Ao Vivo</span>
             {activeTab === 'livescore' && <motion.div layoutId="nav-pill" className="absolute top-0 left-0 right-0 h-1 bg-yellow-400" />}
          </button>

          {currentUser.isAdmin && (
            <button 
              onClick={() => setActiveTab('admin')} 
              className={cn("flex-1 py-4 flex flex-col items-center gap-1 transition-colors relative", activeTab === 'admin' ? "text-yellow-400" : "text-zinc-500 hover:text-white")}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Admin</span>
              {activeTab === 'admin' && <motion.div layoutId="nav-pill" className="absolute top-0 left-0 right-0 h-1 bg-yellow-400" />}
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

// --- COMPONENTS ---

function RoomAuthView({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      await verifyRoomAPI(password);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || 'Senha incorreta.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
           <img src="https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png" alt="Corinthians" className="w-16 h-16 mx-auto mb-4 object-contain" />
           <h1 className="text-3xl font-black italic text-white tracking-tighter mb-2 flex flex-col items-center">
             <span>BOLÃO TOTAL</span>
             <span className="text-yellow-400 text-2xl">CORINTHIANS</span>
           </h1>
           <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Acesso Restrito</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 p-6 flex flex-col gap-4">
           {error && <div className="text-red-400 text-sm font-bold uppercase tracking-widest text-center">{error}</div>}
           <div className="flex flex-col gap-2">
             <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Senha do Grupo</label>
             <input 
               type="password" 
               value={password}
               onChange={e => setPassword(e.target.value)}
               placeholder="Digite a senha..."
               className="bg-zinc-950 border border-zinc-800 text-white p-4 font-bold outline-none focus:border-yellow-400 w-full transition-colors"
             />
           </div>
           
           <button 
             type="submit" 
             disabled={!password.trim() || loading}
             className="w-full mt-2 bg-yellow-400 hover:bg-white text-black font-black uppercase tracking-widest py-4 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
           >
             {loading ? 'Verificando...' : 'Entrar na Sala'} <LogIn className="w-4 h-4"/>
           </button>
        </form>
      </div>
    </div>
  )
}

function LoginView({ onLogin }: { onLogin: (user: User) => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!name.trim()) return;
    setLoading(true);
    const data = await loginUser(name.trim());
    onLogin(data.user);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-yellow-400" />
        
        <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-6 text-black p-2">
           <img src="https://upload.wikimedia.org/wikipedia/pt/b/b4/Corinthians_simbolo.png" alt="Corinthians" className="w-full h-full object-contain" />
        </div>
        
        <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Entrar no Bolão</h2>
        <p className="text-zinc-400 text-sm mb-8 font-medium">Digite seu nome ou apelido para participar.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">Seu Nome</label>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Neymar Jr"
              className="w-full px-4 py-3 bg-zinc-950 border-2 border-zinc-800 text-white focus:outline-none focus:border-yellow-400 transition-all outline-none font-bold placeholder-zinc-700"
            />
          </div>
          <button 
            disabled={loading || !name.trim()}
            type="submit" 
            className="w-full bg-yellow-400 hover:bg-white text-black font-black uppercase text-sm py-4 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : (
              <>
               Entrar na Disputa <LogIn className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
        <p className="text-center mt-6 text-xs text-zinc-500 font-bold uppercase tracking-wider">100 pts: Exato • 80 pts: Saldo • 50 pts: Vencedor</p>
      </div>
    </div>
  )
}

const MatchCard: React.FC<{ match: Match, prediction?: Prediction, onSavePrediction: (h: number, a: number) => void }> = ({ match, prediction, onSavePrediction }) => {
  const isPending = match.status === 'pending';
  const matchDate = new Date(match.date);
  const matchTime = matchDate.getTime();
  const isLocked = Date.now() > matchTime - 20 * 60 * 1000;
  const canPredict = isPending && !isLocked;

  const [hScore, setHScore] = useState<string>(prediction ? prediction.homeScore.toString() : '0');
  const [aScore, setAScore] = useState<string>(prediction ? prediction.awayScore.toString() : '0');
  const [isEditing, setIsEditing] = useState(!prediction && canPredict);

  return (
    <div className={cn("bg-zinc-900 border-l-8 flex flex-col relative mb-4", canPredict ? "border-yellow-400" : "border-zinc-700")}>
      
      {/* Header Info */}
      <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
           <Calendar className="w-3.5 h-3.5" />
           {format(matchDate, "dd 'de' MMM • HH:mm", { locale: ptBR })}
        </div>
        <div className={cn("text-[10px] uppercase font-bold tracking-widest px-2 py-0.5", 
           canPredict ? "bg-yellow-400/20 text-yellow-400" : (isPending ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-400"))}>
          {canPredict ? 'Aberto' : (isPending ? 'Bloqueado' : 'Finalizado')}
        </div>
      </div>

      <div className="p-4 sm:p-6 flex flex-col items-center">
        {/* Teams and Inputs */}
        <div className="flex w-full items-center justify-between gap-2 sm:gap-6 mb-6">
           {/* Home Team */}
           <div className="flex-1 flex flex-col items-center min-w-[70px] gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 p-1 sm:p-2 flex items-center justify-center bg-zinc-800 text-3xl sm:text-4xl shrink-0">
                {match.homeFlag.startsWith('http') ? <img src={match.homeFlag} alt={match.homeTeam} className="w-full h-full object-contain" /> : match.homeFlag}
              </div>
              <span className="font-black text-[10px] sm:text-sm uppercase text-center tracking-tight line-clamp-2 sm:line-clamp-1 break-words">{match.homeTeam}</span>
           </div>

           {/* Score Board */}
           <div className="flex items-center gap-1 sm:gap-4 shrink-0">
             {canPredict ? (
               isEditing ? (
                 <>
                   <input type="number" min="0" max="20" value={hScore} onChange={e=>setHScore(e.target.value)} className="w-[40px] h-[50px] sm:w-[50px] sm:h-[60px] text-center text-2xl sm:text-3xl font-black bg-zinc-800 border-2 border-zinc-700 outline-none focus:border-yellow-400 placeholder-zinc-700 font-mono" placeholder="-" />
                   <span className="text-zinc-600 font-black text-xl">X</span>
                   <input type="number" min="0" max="20" value={aScore} onChange={e=>setAScore(e.target.value)} className="w-[40px] h-[50px] sm:w-[50px] sm:h-[60px] text-center text-2xl sm:text-3xl font-black bg-zinc-800 border-2 border-zinc-700 outline-none focus:border-yellow-400 placeholder-zinc-700 font-mono" placeholder="-" />
                 </>
               ) : (
                 <>
                  <div className="w-[40px] h-[50px] sm:w-[50px] sm:h-[60px] flex items-center justify-center text-2xl sm:text-3xl font-black bg-yellow-400 text-black font-mono">{prediction?.homeScore}</div>
                  <span className="text-zinc-600 font-black text-xl">X</span>
                  <div className="w-[40px] h-[50px] sm:w-[50px] sm:h-[60px] flex items-center justify-center text-2xl sm:text-3xl font-black bg-yellow-400 text-black font-mono">{prediction?.awayScore}</div>
                 </>
               )
             ) : (
               <>
                <div className="w-[40px] h-[50px] sm:w-[50px] sm:h-[60px] flex items-center justify-center text-2xl sm:text-3xl font-black bg-zinc-800 text-zinc-300 font-mono">{prediction?.homeScore ?? match.homeScore ?? '-'}</div>
                <span className="text-zinc-600 font-black text-xl">X</span>
                <div className="w-[40px] h-[50px] sm:w-[50px] sm:h-[60px] flex items-center justify-center text-2xl sm:text-3xl font-black bg-zinc-800 text-zinc-300 font-mono">{prediction?.awayScore ?? match.awayScore ?? '-'}</div>
               </>
             )}
           </div>

           {/* Away Team */}
           <div className="flex-1 flex flex-col items-center min-w-[70px] gap-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 p-1 sm:p-2 flex items-center justify-center bg-zinc-800 text-3xl sm:text-4xl shrink-0">
                {match.awayFlag.startsWith('http') ? <img src={match.awayFlag} alt={match.awayTeam} className="w-full h-full object-contain" /> : match.awayFlag}
              </div>
              <span className="font-black text-[10px] sm:text-sm uppercase text-center tracking-tight line-clamp-2 sm:line-clamp-1 break-words">{match.awayTeam}</span>
           </div>
        </div>

        {/* Action Button */}
        {canPredict && (
          <div className="w-full">
            {isEditing ? (
              <button 
                onClick={async () => {
                  if(hScore !== '' && aScore !== '') {
                    try {
                      await onSavePrediction(parseInt(hScore), parseInt(aScore));
                      setIsEditing(false);
                    } catch(e:any) { alert("Erro: " + e.message); }
                  }
                }}
                disabled={hScore === '' || aScore === ''}
                className="w-full bg-yellow-400 hover:bg-white text-black font-black uppercase tracking-wider text-sm py-4 transition-colors disabled:opacity-50"
              >
                Salvar Palpite
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-wider text-sm py-4 transition-colors">
                Editar Palpite
              </button>
            )}
          </div>
        )}

        {/* Finished State Feedback */}
        {!isPending && prediction && (
          <div className={cn("w-full py-4 px-4 mt-4 flex items-center justify-between text-sm font-bold uppercase tracking-wide", 
            prediction.points === 100 ? "bg-yellow-400 text-black" : 
            prediction.points && prediction.points > 0 ? "bg-zinc-800 text-white border border-zinc-700" : 
            "bg-zinc-900 border border-zinc-800 text-zinc-500"
          )}>
            <div className="flex items-center gap-2">
              Seu palpite: {prediction.homeScore} x {prediction.awayScore}
            </div>
            <div className="flex items-center gap-1 text-lg font-black">
              +{prediction.points} PTS
            </div>
          </div>
        )}
        {!isPending && !prediction && (
          <div className="w-full py-4 px-4 mt-4 bg-zinc-900 border border-zinc-800 text-zinc-500 text-sm font-bold uppercase text-center tracking-widest">
            Sem Palpite
          </div>
        )}
      </div>
    </div>
  )
}

const AdminMatchCard: React.FC<{ match: Match, onSendResult: (h: number, a: number) => void }> = ({ match, onSendResult }) => {
  const [hScore, setHScore] = useState<string>('0');
  const [aScore, setAScore] = useState<string>('0');

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        <span>Definir Resultado</span>
        <span>{format(new Date(match.date), "dd/MMM - HH:mm", { locale: ptBR })}</span>
      </div>

       <div className="flex w-full items-center justify-between gap-1 sm:gap-6 py-2">
         {/* Home Team */}
         <div className="flex-1 flex flex-col items-center min-w-[60px] gap-2">
           <div className="w-8 h-8 sm:w-12 sm:h-12 p-1 sm:p-2 flex items-center justify-center bg-zinc-800 text-2xl sm:text-4xl shrink-0">
             {match.homeFlag.startsWith('http') ? <img src={match.homeFlag} className="w-full h-full object-contain" alt={match.homeTeam} /> : match.homeFlag}
           </div> 
           <span className="font-black text-[10px] sm:text-sm uppercase text-center tracking-tight line-clamp-2 sm:line-clamp-1 break-words leading-tight">{match.homeTeam}</span>
         </div>
         {/* Inputs */}
          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
             <input type="number" min="0" value={hScore} onChange={e=>setHScore(e.target.value)} className="w-[35px] h-[45px] sm:w-[50px] sm:h-[60px] font-mono text-center text-xl sm:text-3xl font-black bg-zinc-950 border-2 border-zinc-700 outline-none focus:border-yellow-400 placeholder-zinc-700" placeholder="-" />
             <span className="text-zinc-600 font-black text-lg sm:text-xl">X</span>
             <input type="number" min="0" value={aScore} onChange={e=>setAScore(e.target.value)} className="w-[35px] h-[45px] sm:w-[50px] sm:h-[60px] font-mono text-center text-xl sm:text-3xl font-black bg-zinc-950 border-2 border-zinc-700 outline-none focus:border-yellow-400 placeholder-zinc-700" placeholder="-" />
          </div>
          {/* Away Team */}
         <div className="flex-1 flex flex-col items-center min-w-[60px] gap-2">
           <div className="w-8 h-8 sm:w-12 sm:h-12 p-1 sm:p-2 flex items-center justify-center bg-zinc-800 text-2xl sm:text-4xl shrink-0">
             {match.awayFlag.startsWith('http') ? <img src={match.awayFlag} className="w-full h-full object-contain" alt={match.awayTeam} /> : match.awayFlag}
           </div> 
           <span className="font-black text-[10px] sm:text-sm uppercase text-center tracking-tight line-clamp-2 sm:line-clamp-1 break-words leading-tight">{match.awayTeam}</span>
         </div>
       </div>

      <button 
        onClick={() => { if(hScore !== '' && aScore !== '') onSendResult(parseInt(hScore), parseInt(aScore)); }}
        disabled={hScore === '' || aScore === ''}
        className="w-full mt-2 bg-yellow-400 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-black uppercase tracking-wider text-sm py-4 transition-colors flex items-center justify-center gap-2"
      >
        Encerrar Partida <ChevronRight className="w-4 h-4"/>
      </button>

    </div>
  )
}
