export enum MoveQuality {
  Brilliant = 'brilliant',
  Great = 'great',
  Best = 'best',
  Good = 'good',
  Book = 'book',
  Inaccuracy = 'inaccuracy',
  Mistake = 'mistake',
  Blunder = 'blunder',
}

export interface MoveQualityInfo {
  label: string;
  symbol: string;
  cssClass: string;
  color: string;
}

export const MOVE_QUALITY_INFO: Record<MoveQuality, MoveQualityInfo> = {
  [MoveQuality.Brilliant]: {
    label: 'Brilliant',
    symbol: '!!',
    cssClass: 'brilliant',
    color: '#1baca6',
  },
  [MoveQuality.Great]: {
    label: 'Great',
    symbol: '!',
    cssClass: 'great',
    color: '#5c8bb0',
  },
  [MoveQuality.Best]: {
    label: 'Best',
    symbol: '✓',
    cssClass: 'best',
    color: '#96bc4b',
  },
  [MoveQuality.Good]: {
    label: 'Good',
    symbol: '',
    cssClass: 'good',
    color: '#96bc4b',
  },
  [MoveQuality.Book]: {
    label: 'Book',
    symbol: '📖',
    cssClass: 'book',
    color: '#a88764',
  },
  [MoveQuality.Inaccuracy]: {
    label: 'Inaccuracy',
    symbol: '?!',
    cssClass: 'inaccuracy',
    color: '#f7c631',
  },
  [MoveQuality.Mistake]: {
    label: 'Mistake',
    symbol: '?',
    cssClass: 'mistake',
    color: '#e58f2a',
  },
  [MoveQuality.Blunder]: {
    label: 'Blunder',
    symbol: '??',
    cssClass: 'blunder',
    color: '#ca3431',
  },
};

export interface Evaluation {
  cp: number | null;
  mate: number | null;
  depth: number;
  bestMove: string | null;
  pv: string[];
  secondBestCp: number | null;
}

export interface AnalyzedMove {
  san: string;
  from: string;
  to: string;
  moveNumber: number;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  evalBefore: Evaluation | null;
  evalAfter: Evaluation | null;
  quality: MoveQuality | null;
  cpLoss: number | null;
}

export interface OpeningDetection {
  eco: string;
  name: string;
  bookMoveCount: number;
}

export interface GameAnalysis {
  moves: AnalyzedMove[];
  headers: Record<string, string>;
  isAnalyzing: boolean;
  progress: number;
}

export enum RepertoireStatus {
  Match = 'repertoire-match',
  Deviation = 'repertoire-deviation',
  Unknown = 'repertoire-unknown',
}
