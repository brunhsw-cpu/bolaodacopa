import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

// --- IN-MEMORY/FILE DATABASE FOR PROTOTYPE ---
const STATE_FILE = path.join(process.cwd(), 'data.json');

interface User {
  id: string;
  name: string;
  score: number;
  isAdmin: boolean;
}

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  date: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'pending' | 'finished';
}

interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  points: number | null;
}

let state = {
  customRoomPassword: '',
  footballApiKey: '',
  users: [] as User[],
  matches: [
    { id: 'm1', homeTeam: 'Brasil', awayTeam: 'Sérvia', homeFlag: '🇧🇷', awayFlag: '🇷🇸', date: new Date(Date.now() + 86400000).toISOString(), homeScore: null, awayScore: null, status: 'pending' },
    { id: 'm2', homeTeam: 'Argentina', awayTeam: 'França', homeFlag: '🇦🇷', awayFlag: '🇫🇷', date: new Date(Date.now() + 172800000).toISOString(), homeScore: null, awayScore: null, status: 'pending' },
    { id: 'm3', homeTeam: 'Espanha', awayTeam: 'Alemanha', homeFlag: '🇪🇸', awayFlag: '🇩🇪', date: new Date(Date.now() + 259200000).toISOString(), homeScore: null, awayScore: null, status: 'pending' },
  ] as Match[],
  predictions: [] as Prediction[]
};

try {
  if (fs.existsSync(STATE_FILE)) {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(data);
    state = { ...state, ...parsed };
    console.log("State loaded from data.json");
  }
} catch (e) {
  console.error("Failed to load state", e);
}

const saveState = () => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error("Failed to save state", e);
  }
};


// --- SCORING LOGIC ---
const calculatePoints = (predHome: number, predAway: number, matchHome: number, matchAway: number) => {
  // 100 pontos para quem acertar o vitorioso e o placar
  if (predHome === matchHome && predAway === matchAway) return 100;
  
  const predDiff = predHome - predAway;
  const matchDiff = matchHome - matchAway;
  
  const predWinner = predDiff > 0 ? 'home' : (predDiff < 0 ? 'away' : 'tie');
  const matchWinner = matchDiff > 0 ? 'home' : (matchDiff < 0 ? 'away' : 'tie');
  
  if (predWinner === matchWinner) {
    // 80 pontos para quem acertar o vitorioso sem acertar o placar exato mas acertando o saldo (ex: aposta 2x0 mas deu 3x1)
    if (predDiff === matchDiff) return 80;
    
    // 50 pontos para quem acertar somente o vitorioso ou um empate sem acertar os gols exatos ou o saldo
    return 50;
  }
  
  return 0;
};

const updateRanking = () => {
  // Reset all scores
  state.users.forEach(u => u.score = 0);
  
  state.predictions.forEach(p => {
    if (p.points !== null) {
      const user = state.users.find(u => u.id === p.userId);
      if (user) user.score += p.points;
    }
  });

  // Sort by score
  state.users.sort((a, b) => b.score - a.score);
};

// --- API ROUTES ---

app.get('/api/state', (req, res) => {
  res.json({
    ...state,
    apiConfigured: !!(state.footballApiKey || process.env.FOOTBALL_API_KEY)
  });
});

app.post('/api/verify-room', (req, res) => {
  const { password } = req.body;
  // A senha padrão caso não seja configurada nas Secrets é "hexa2026"
  const envPass = state.customRoomPassword || process.env.ROOM_PASSWORD || 'hexa2026';
  if (password === envPass) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Senha incorreta para entrar na sala.' });
  }
});

app.post('/api/admin/change-password', (req, res) => {
  const { newPassword } = req.body;
  state.customRoomPassword = newPassword;
  saveState();
  res.json({ success: true });
});

app.post('/api/admin/change-apikey', (req, res) => {
  const { newApiKey } = req.body;
  state.footballApiKey = newApiKey;
  saveState();
  res.json({ success: true });
});

app.post('/api/admin/sync', async (req, res) => {
  const apiKey = state.footballApiKey || process.env.FOOTBALL_API_KEY;
  
  let data;
  let isDemo = false;

  try {
    if (!apiKey) {
      // Se não tem chave, usar dados simulados em vez de dar erro
      isDemo = true;
      data = {
        response: [
          { fixture: { id: 1001, date: new Date(Date.now() + 86400000).toISOString(), status: { short: 'NS' } }, teams: { home: { name: 'Brasil', logo: '🇧🇷' }, away: { name: 'Espanha', logo: '🇪🇸' } }, goals: { home: null, away: null } },
          { fixture: { id: 1002, date: new Date(Date.now() + 172800000).toISOString(), status: { short: 'NS' } }, teams: { home: { name: 'Argentina', logo: '🇦🇷' }, away: { name: 'Alemanha', logo: '🇩🇪' } }, goals: { home: null, away: null } },
          { fixture: { id: 1003, date: new Date(Date.now() + 259200000).toISOString(), status: { short: 'NS' } }, teams: { home: { name: 'França', logo: '🇫🇷' }, away: { name: 'Inglaterra', logo: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' } }, goals: { home: null, away: null } }
        ]
      };
    } else {
      // Integração real com a API-Football usando a chave
      let response = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey
        }
      });
      data = await response.json();

      // Se 2026 ainda não tiver jogos registrados na API, busca 2022 para você testar
      if (data.response && data.response.length === 0) {
        response = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2022', {
          method: 'GET',
          headers: { 'x-apisports-key': apiKey }
        });
        data = await response.json();
      }

      if (data.errors && Object.keys(data.errors).length > 0) {
         return res.status(400).json({ error: 'Erro na API-Football: ' + Object.values(data.errors)[0] });
      }
    }

    const is2022Fallback = data.parameters?.season === '2022';
    
    // Atualiza os jogos no sistema com a resposta da API 
    // (Pegando os 10 primeiros para não poluir muito a tela no teste)
    if (data.response && data.response.length > 0) {
      const parsedMatches = data.response.slice(0, 10).map((r: any) => ({
        id: r.fixture.id.toString(),
        homeTeam: r.teams.home.name,
        awayTeam: r.teams.away.name,
        homeFlag: r.teams.home.logo || '⚽',
        awayFlag: r.teams.away.logo || '⚽',
        date: r.fixture.date,
        homeScore: (is2022Fallback || isDemo) ? null : (r.goals?.home ?? null),
        awayScore: (is2022Fallback || isDemo) ? null : (r.goals?.away ?? null),
        status: (is2022Fallback || isDemo) ? 'pending' : (['FT', 'AET', 'PEN'].includes(r.fixture.status.short) ? 'finished' : 'pending')
      }));

      // Substitui os jogos mockados pelos jogos reais ou demo
      state.matches = parsedMatches;
      
      // Recalcula pontos caso algum jogo agora esteja como finalizado
      updateRanking();
      saveState();
    }

    res.json({ 
      success: true, 
      message: isDemo ? 'Jogos de demonstração carregados (Nenhuma API Key detectada).' : 
               `Conexão bem-sucedida! Foram carregados ${data.response?.length > 10 ? 10 : data.response?.length || 0} jogos.` +
               (is2022Fallback ? ' (Mostrando Copa 2022 pois 2026 não iniciou).' : '')
    });

  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao processar: ' + error.message });
  }
});

// Mock login (since we don't have true OAuth keys configured yet)
app.post('/api/login', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  
  let user = state.users.find(u => u.name.toLowerCase() === name.toLowerCase());
  if (!user) {
    const isFirstUser = state.users.length === 0;
    user = { id: Date.now().toString(), name, score: 0, isAdmin: isFirstUser };
    state.users.push(user);
    saveState();
  }
  res.json({ user });
});

app.post('/api/predict', (req, res) => {
  const { userId, matchId, homeScore, awayScore } = req.body;
  const match = state.matches.find(m => m.id === matchId);
  
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status !== 'pending') return res.status(400).json({ error: 'Match already finished' });

  if (Date.now() > new Date(match.date).getTime() - 20 * 60 * 1000) {
    return res.status(400).json({ error: 'Tempo esgotado! Palpites fechados 20 min antes do jogo.' });
  }

  let pred = state.predictions.find(p => p.userId === userId && p.matchId === matchId);
  
  if (pred) {
    pred.homeScore = homeScore;
    pred.awayScore = awayScore;
  } else {
    pred = { id: Date.now().toString(), userId, matchId, homeScore, awayScore, points: null };
    state.predictions.push(pred);
  }
  saveState();
  res.json({ success: true, prediction: pred });
});

app.post('/api/admin/match', (req, res) => {
  const { matchId, homeScore, awayScore } = req.body;
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });

  // Update match
  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.status = 'finished';

  // Calculate points for all predictions for this match
  state.predictions.forEach(p => {
    if (p.matchId === matchId) {
      p.points = calculatePoints(p.homeScore, p.awayScore, homeScore, awayScore);
    }
  });

  // Update global leaderboard
  updateRanking();
  saveState();

  res.json({ success: true, match });
});


// --- VITE MIDDLEWARE ---
async function startServer() {
  const isProd = process.env.NODE_ENV === "production" || process.argv[1].endsWith('server.cjs') || __filename.endsWith('server.cjs');
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
