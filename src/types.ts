export interface User {
  id: string;
  name: string;
  score: number;
  isAdmin: boolean;
}

export interface Match {
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

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  points: number | null;
}

export interface AppState {
  users: User[];
  matches: Match[];
  predictions: Prediction[];
  apiConfigured?: boolean;
}
