import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ChesscomGame {
  url: string;
  pgn: string;
  timeControl: string;
  timeClass: string;
  rated: boolean;
  endTime: number;
  whiteUsername: string;
  whiteRating: number;
  whiteResult: string;
  blackUsername: string;
  blackRating: number;
  blackResult: string;
}

interface ChesscomApiResponse {
  games: {
    url: string;
    pgn: string;
    time_control: string;
    time_class: string;
    rated: boolean;
    end_time: number;
    white: { username: string; rating: number; result: string };
    black: { username: string; rating: number; result: string };
  }[];
}

@Injectable({ providedIn: 'root' })
export class ChesscomService {
  private readonly baseUrl = 'https://api.chess.com/pub/player';

  constructor(private http: HttpClient) {}

  async getRecentGames(username: string, count = 10): Promise<ChesscomGame[]> {
    const now = new Date();
    let games: ChesscomGame[] = [];

    // Fetch current month
    const currentMonthGames = await this.fetchMonthGames(username, now.getFullYear(), now.getMonth() + 1);
    games = games.concat(currentMonthGames);

    // If not enough, fetch previous month
    if (games.length < count) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevGames = await this.fetchMonthGames(username, prev.getFullYear(), prev.getMonth() + 1);
      games = prevGames.concat(games);
    }

    // Sort by end_time descending and take the last N
    games.sort((a, b) => b.endTime - a.endTime);
    return games.slice(0, count);
  }

  private async fetchMonthGames(username: string, year: number, month: number): Promise<ChesscomGame[]> {
    const mm = month.toString().padStart(2, '0');
    const url = `${this.baseUrl}/${username.toLowerCase()}/games/${year}/${mm}`;

    try {
      const response = await firstValueFrom(
        this.http.get<ChesscomApiResponse>(url)
      );
      return (response.games || []).map(g => this.mapGame(g));
    } catch {
      return [];
    }
  }

  private mapGame(raw: ChesscomApiResponse['games'][0]): ChesscomGame {
    return {
      url: raw.url,
      pgn: raw.pgn,
      timeControl: raw.time_control,
      timeClass: raw.time_class,
      rated: raw.rated,
      endTime: raw.end_time,
      whiteUsername: raw.white.username,
      whiteRating: raw.white.rating,
      whiteResult: raw.white.result,
      blackUsername: raw.black.username,
      blackRating: raw.black.rating,
      blackResult: raw.black.result,
    };
  }

  getResultLabel(game: ChesscomGame, username: string): string {
    const isWhite = game.whiteUsername.toLowerCase() === username.toLowerCase();
    const result = isWhite ? game.whiteResult : game.blackResult;

    switch (result) {
      case 'win': return 'Victoire';
      case 'resigned': return 'Abandon';
      case 'timeout': return 'Temps écoulé';
      case 'checkmated': return 'Mat';
      case 'stalemate': return 'Pat';
      case 'agreed': return 'Nulle';
      case 'repetition': return 'Répétition';
      case 'insufficient': return 'Matériel insuffisant';
      case 'timevsinsufficient': return 'Temps vs matériel';
      default: return result;
    }
  }

  isWin(game: ChesscomGame, username: string): boolean {
    const isWhite = game.whiteUsername.toLowerCase() === username.toLowerCase();
    return (isWhite ? game.whiteResult : game.blackResult) === 'win';
  }

  isDraw(game: ChesscomGame): boolean {
    return ['stalemate', 'agreed', 'repetition', 'insufficient', 'timevsinsufficient', '50move']
      .includes(game.whiteResult);
  }

  getOpponent(game: ChesscomGame, username: string): { name: string; rating: number } {
    const isWhite = game.whiteUsername.toLowerCase() === username.toLowerCase();
    return isWhite
      ? { name: game.blackUsername, rating: game.blackRating }
      : { name: game.whiteUsername, rating: game.whiteRating };
  }

  getTimeClassLabel(timeClass: string): string {
    switch (timeClass) {
      case 'bullet': return '🔴 Bullet';
      case 'blitz': return '⚡ Blitz';
      case 'rapid': return '🟢 Rapide';
      case 'daily': return '📅 Quotidien';
      default: return timeClass;
    }
  }
}
