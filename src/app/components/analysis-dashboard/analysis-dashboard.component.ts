import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { PgnInputComponent } from '../pgn-input/pgn-input.component';
import { ChessBoardComponent } from '../chess-board/chess-board.component';
import { EvalBarComponent } from '../eval-bar/eval-bar.component';
import { MoveListComponent } from '../move-list/move-list.component';
import { RepertoireViewerComponent } from '../repertoire-viewer/repertoire-viewer.component';

import { PgnParserService, ParsedGame } from '../../services/pgn-parser.service';
import { StockfishService } from '../../services/stockfish.service';
import { MoveClassifierService } from '../../services/move-classifier.service';
import { RepertoireService } from '../../services/repertoire.service';
import { AnalyzedMove, Evaluation, MOVE_QUALITY_INFO, MoveQuality, RepertoireStatus } from '../../models/analysis.model';

@Component({
  selector: 'app-analysis-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    PgnInputComponent,
    ChessBoardComponent,
    EvalBarComponent,
    MoveListComponent,
    RepertoireViewerComponent,
  ],
  templateUrl: './analysis-dashboard.component.html',
  styleUrl: './analysis-dashboard.component.scss',
})
export class AnalysisDashboardComponent {
  // State
  showInput = true;
  showRepertoire = false;
  isAnalyzing = false;
  analysisProgress = 0;

  // Game data
  moves: AnalyzedMove[] = [];
  fens: string[] = [];
  headers: Record<string, string | null> = {};
  currentMoveIndex = -1;
  repertoireStatuses: (RepertoireStatus | null)[] = [];

  constructor(
    private pgnParser: PgnParserService,
    private stockfish: StockfishService,
    private moveClassifier: MoveClassifierService,
    private repertoireService: RepertoireService,
    private snackBar: MatSnackBar
  ) {}

  get currentFen(): string {
    if (this.currentMoveIndex < 0) {
      return this.fens[0] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    return this.fens[this.currentMoveIndex + 1] || this.fens[0];
  }

  get currentEval(): Evaluation | null {
    if (this.currentMoveIndex < 0) {
      return this.moves[0]?.evalBefore || null;
    }
    return this.moves[this.currentMoveIndex]?.evalAfter || null;
  }

  get lastMoveFrom(): string | null {
    if (this.currentMoveIndex < 0) return null;
    return this.moves[this.currentMoveIndex]?.from || null;
  }

  get lastMoveTo(): string | null {
    if (this.currentMoveIndex < 0) return null;
    return this.moves[this.currentMoveIndex]?.to || null;
  }

  get bestMoveUci(): string | null {
    if (this.currentMoveIndex < 0) return null;
    return this.moves[this.currentMoveIndex]?.evalBefore?.bestMove || null;
  }

  get currentMoveQuality(): MoveQuality | null {
    if (this.currentMoveIndex < 0) return null;
    return this.moves[this.currentMoveIndex]?.quality || null;
  }

  get currentMoveQualityInfo() {
    const q = this.currentMoveQuality;
    if (!q) return null;
    return MOVE_QUALITY_INFO[q];
  }

  get gameTitle(): string {
    const white = this.headers['White'] || '?';
    const black = this.headers['Black'] || '?';
    return `${white} vs ${black}`;
  }

  get gameSubtitle(): string {
    const parts: string[] = [];
    if (this.headers['Event']) parts.push(this.headers['Event']!);
    if (this.headers['Date']) parts.push(this.headers['Date']!);
    if (this.headers['Result']) parts.push(this.headers['Result']!);
    return parts.join(' • ');
  }

  private cpToWinPercent(cp: number): number {
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }

  private moveAccuracy(winPercentLoss: number): number {
    const raw = 103.1668 * Math.exp(-0.04354 * winPercentLoss * winPercentLoss) - 3.1669;
    return Math.min(100, Math.max(0, raw));
  }

  private computeAccuracy(color: 'w' | 'b'): number | null {
    const playerMoves = this.moves.filter(m => m.color === color);
    if (playerMoves.length === 0) return null;

    let totalAccuracy = 0;
    let count = 0;

    for (const move of playerMoves) {
      if (!move.evalBefore || !move.evalAfter) continue;

      let wpBefore: number;
      let wpAfter: number;

      if (move.evalBefore.mate !== null) {
        wpBefore = move.evalBefore.mate > 0 ? 100 : 0;
      } else if (move.evalBefore.cp !== null) {
        wpBefore = this.cpToWinPercent(move.evalBefore.cp);
      } else continue;

      if (move.evalAfter.mate !== null) {
        wpAfter = move.evalAfter.mate > 0 ? 100 : 0;
      } else if (move.evalAfter.cp !== null) {
        wpAfter = this.cpToWinPercent(move.evalAfter.cp);
      } else continue;

      // Win% is from White's perspective; for Black, advantage = lower win%
      const loss = color === 'w'
        ? Math.max(0, wpBefore - wpAfter)
        : Math.max(0, wpAfter - wpBefore);

      totalAccuracy += this.moveAccuracy(loss);
      count++;
    }

    return count > 0 ? totalAccuracy / count : null;
  }

  get whiteAccuracy(): number | null {
    if (this.isAnalyzing || this.moves.length === 0) return null;
    return this.computeAccuracy('w');
  }

  get blackAccuracy(): number | null {
    if (this.isAnalyzing || this.moves.length === 0) return null;
    return this.computeAccuracy('b');
  }

  async onPgnSubmitted(pgn: string): Promise<void> {
    try {
      const parsed: ParsedGame = this.pgnParser.parsePgn(pgn);
      this.moves = parsed.moves;
      this.fens = parsed.fens;
      this.headers = parsed.headers;
      this.currentMoveIndex = -1;
      this.showInput = false;
      this.showRepertoire = false;
      this.isAnalyzing = true;
      this.analysisProgress = 0;

      await this.analyzeGame();
    } catch (error) {
      this.snackBar.open('Erreur lors du parsing du PGN', 'Fermer', {
        duration: 5000,
      });
    }
  }

  private async analyzeGame(): Promise<void> {
    const evaluations = await this.stockfish.analyzePositions(
      this.fens,
      (progress) => {
        this.analysisProgress = progress;
      }
    );

    // Attach evaluations to moves
    for (let i = 0; i < this.moves.length; i++) {
      this.moves[i] = {
        ...this.moves[i],
        evalBefore: evaluations[i] || null,
        evalAfter: evaluations[i + 1] || null,
      };
    }

    // Classify moves
    this.moves = this.moveClassifier.classifyMoves(this.moves);
    this.computeRepertoireStatuses();
    this.isAnalyzing = false;

    this.snackBar.open(
      `Analyse terminée : ${this.moves.length} coups évalués (Stockfish local)`,
      'OK',
      { duration: 4000 }
    );
  }

  // Navigation
  goToStart(): void {
    this.currentMoveIndex = -1;
  }

  goToEnd(): void {
    this.currentMoveIndex = this.moves.length - 1;
  }

  previousMove(): void {
    if (this.currentMoveIndex > -1) {
      this.currentMoveIndex--;
    }
  }

  nextMove(): void {
    if (this.currentMoveIndex < this.moves.length - 1) {
      this.currentMoveIndex++;
    }
  }

  onMoveSelected(index: number): void {
    this.currentMoveIndex = index;
  }

  goBackToInput(): void {
    this.showInput = true;
    this.showRepertoire = false;
    this.moves = [];
    this.fens = [];
    this.headers = {};
    this.currentMoveIndex = -1;
    this.repertoireStatuses = [];
  }

  showRepertoireView(): void {
    this.showInput = false;
    this.showRepertoire = true;
  }

  onRepertoireBack(): void {
    this.showRepertoire = false;
    this.showInput = true;
  }

  computeRepertoireStatuses(): void {
    this.repertoireStatuses = this.moves.map((move) => {
      const repertoireMove = this.repertoireService.getMove(move.fenBefore, move.color);
      if (repertoireMove === null) {
        return RepertoireStatus.Unknown;
      }
      return repertoireMove === move.san
        ? RepertoireStatus.Match
        : RepertoireStatus.Deviation;
    });
  }

  onAddToRepertoire(index: number): void {
    const move = this.moves[index];
    if (!move) return;
    this.repertoireService.addMove(move.fenBefore, move.color, move.san);
    this.computeRepertoireStatuses();
    this.snackBar.open(
      `${move.san} ajouté au répertoire des ${move.color === 'w' ? 'Blancs' : 'Noirs'}`,
      'OK',
      { duration: 2000 }
    );
  }

  async generateReport(): Promise<void> {
    const white = this.headers['White'] || '?';
    const black = this.headers['Black'] || '?';
    const result = this.headers['Result'] || '?';
    const date = this.headers['Date'] || '?';
    const whiteElo = this.headers['WhiteElo'] || '?';
    const blackElo = this.headers['BlackElo'] || '?';
    const event = this.headers['Event'] || '?';

    const lines: string[] = [];

    lines.push(`Tu es un coach d'échecs expérimenté. Analyse la partie suivante et fournis un coaching détaillé et pédagogique en français.`);
    lines.push(``);
    lines.push(`Pour chaque phase de la partie (ouverture, milieu de jeu, finale), identifie :`);
    lines.push(`- Les erreurs stratégiques et tactiques commises`);
    lines.push(`- Les moments clés où la partie a basculé`);
    lines.push(`- Ce que le joueur aurait dû faire à la place (en expliquant pourquoi)`);
    lines.push(`- Les patterns ou habitudes problématiques à corriger`);
    lines.push(``);
    lines.push(`Termine par un résumé avec les 3 axes d'amélioration prioritaires pour le joueur.`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Informations de la partie`);
    lines.push(`- **Blanc** : ${white} (${whiteElo})`);
    lines.push(`- **Noir** : ${black} (${blackElo})`);
    lines.push(`- **Résultat** : ${result}`);
    lines.push(`- **Date** : ${date}`);
    lines.push(`- **Événement** : ${event}`);
    lines.push(``);
    lines.push(`## Analyse coup par coup`);
    lines.push(``);
    lines.push(`| # | Coup joué | Qualité | Perte (cp) | Éval après | Meilleur coup |`);
    lines.push(`|---|-----------|---------|------------|------------|---------------|`);

    for (const move of this.moves) {
      const num = move.color === 'w'
        ? `${move.moveNumber}.`
        : `${move.moveNumber}...`;
      const quality = move.quality || '-';
      const cpLoss = move.cpLoss !== null ? (move.cpLoss / 100).toFixed(2) : '-';
      const bestMove = move.evalBefore?.bestMove || '-';

      let evalStr = '-';
      if (move.evalAfter) {
        if (move.evalAfter.mate !== null) {
          evalStr = `M${move.evalAfter.mate}`;
        } else if (move.evalAfter.cp !== null) {
          const cp = move.evalAfter.cp / 100;
          evalStr = `${cp > 0 ? '+' : ''}${cp.toFixed(1)}`;
        }
      }

      lines.push(`| ${num} | ${move.san} | ${quality} | ${cpLoss} | ${evalStr} | ${bestMove} |`);
    }

    // Summary stats
    const stats: Record<string, number> = {};
    for (const m of this.moves) {
      if (m.quality) {
        stats[m.quality] = (stats[m.quality] || 0) + 1;
      }
    }

    lines.push(``);
    lines.push(`## Résumé statistique`);
    const qualityLabels: [string, string][] = [
      ['brilliant', 'Brillant'], ['great', 'Excellent'], ['best', 'Meilleur'],
      ['good', 'Bon'], ['inaccuracy', 'Imprécision'], ['mistake', 'Erreur'], ['blunder', 'Gaffe'],
    ];
    for (const [key, label] of qualityLabels) {
      if (stats[key]) {
        lines.push(`- **${label}** : ${stats[key]}`);
      }
    }

    const report = lines.join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.snackBar.open('Rapport copié dans le presse-papier !', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Erreur lors de la copie', 'Fermer', { duration: 3000 });
    }
  }

  async generatePositionAnalysis(): Promise<void> {
    if (this.currentMoveIndex < 0) return;

    const white = this.headers['White'] || '?';
    const black = this.headers['Black'] || '?';
    const whiteElo = this.headers['WhiteElo'] || '?';
    const blackElo = this.headers['BlackElo'] || '?';
    const result = this.headers['Result'] || '?';

    const currentMove = this.moves[this.currentMoveIndex];
    const playerColor = currentMove.color === 'w' ? 'Blanc' : 'Noir';
    const moveLabel = currentMove.color === 'w'
      ? `${currentMove.moveNumber}. ${currentMove.san}`
      : `${currentMove.moveNumber}... ${currentMove.san}`;

    const lines: string[] = [];

    lines.push(`Tu es un coach d'échecs expérimenté et un analyste tactique. Analyse en profondeur la position suivante et fournis une réponse détaillée en français.`);
    lines.push(``);
    lines.push(`La position est atteinte après le coup ${moveLabel} (${playerColor} vient de jouer).`);
    lines.push(``);
    lines.push(`Fournis une analyse complète incluant :`);
    lines.push(``);
    lines.push(`### 1. Évaluation stratégique`);
    lines.push(`- Qui a l'avantage et pourquoi ?`);
    lines.push(`- Structure de pions : faiblesses, pions passés, îlots`);
    lines.push(`- Activité des pièces : pièces bien/mal placées`);
    lines.push(`- Sécurité du roi : faiblesses exploitables`);
    lines.push(`- Contrôle de l'espace et cases clés`);
    lines.push(``);
    lines.push(`### 2. Tactiques disponibles`);
    lines.push(`- Y a-t-il des tactiques (fourchettes, clouages, enfilades, attaques doubles, sacrifices) ?`);
    lines.push(`- Menaces immédiates à considérer`);
    lines.push(`- Combinaisons possibles dans les prochains coups`);
    lines.push(``);
    lines.push(`### 3. Plans pour les deux camps`);
    lines.push(`- Quel est le meilleur plan pour chaque camp ?`);
    lines.push(`- Quels coups candidats devraient être envisagés ?`);
    lines.push(``);
    lines.push(`### 4. Erreurs commises jusqu'ici`);
    lines.push(`- Quels sont les moments clés où un joueur a perdu l'avantage ?`);
    lines.push(`- Quelles leçons en tirer ?`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Informations de la partie`);
    lines.push(`- **Blanc** : ${white} (${whiteElo})`);
    lines.push(`- **Noir** : ${black} (${blackElo})`);
    lines.push(`- **Résultat** : ${result}`);
    lines.push(``);
    lines.push(`## Position courante (FEN)`);
    lines.push(`\`${this.currentFen}\``);
    lines.push(``);

    // Current eval
    const evalNow = this.currentEval;
    if (evalNow) {
      let evalStr = '';
      if (evalNow.mate !== null) {
        evalStr = `Mat en ${evalNow.mate}`;
      } else if (evalNow.cp !== null) {
        const cp = evalNow.cp / 100;
        evalStr = `${cp > 0 ? '+' : ''}${cp.toFixed(2)}`;
      }
      lines.push(`## Évaluation Stockfish de la position`);
      lines.push(`- **Évaluation** : ${evalStr} (profondeur ${evalNow.depth})`);
      if (evalNow.bestMove) {
        lines.push(`- **Meilleur coup** : ${evalNow.bestMove}`);
      }
      lines.push(``);
    }

    // Moves up to current position
    lines.push(`## Coups joués jusqu'à cette position`);
    lines.push(``);
    lines.push(`| # | Coup | Qualité | Perte (cp) | Éval après | Meilleur coup Stockfish |`);
    lines.push(`|---|------|---------|------------|------------|------------------------|`);

    for (let i = 0; i <= this.currentMoveIndex; i++) {
      const m = this.moves[i];
      const num = m.color === 'w' ? `${m.moveNumber}.` : `${m.moveNumber}...`;
      const quality = m.quality || '-';
      const cpLoss = m.cpLoss !== null ? (m.cpLoss / 100).toFixed(2) : '-';
      const best = m.evalBefore?.bestMove || '-';

      let evalAfterStr = '-';
      if (m.evalAfter) {
        if (m.evalAfter.mate !== null) {
          evalAfterStr = `M${m.evalAfter.mate}`;
        } else if (m.evalAfter.cp !== null) {
          const cp = m.evalAfter.cp / 100;
          evalAfterStr = `${cp > 0 ? '+' : ''}${cp.toFixed(1)}`;
        }
      }

      lines.push(`| ${num} | ${m.san} | ${quality} | ${cpLoss} | ${evalAfterStr} | ${best} |`);
    }

    const report = lines.join('\n');

    try {
      await navigator.clipboard.writeText(report);
      this.snackBar.open('Analyse de position copiée dans le presse-papier !', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open('Erreur lors de la copie', 'Fermer', { duration: 3000 });
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.showInput) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.previousMove();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextMove();
        break;
      case 'Home':
        event.preventDefault();
        this.goToStart();
        break;
      case 'End':
        event.preventDefault();
        this.goToEnd();
        break;
    }
  }
}
