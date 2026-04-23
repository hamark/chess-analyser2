import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { PgnParserService } from '../../services/pgn-parser.service';
import { ChesscomService, ChesscomGame } from '../../services/chesscom.service';

@Component({
  selector: 'app-pgn-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './pgn-input.component.html',
  styleUrl: './pgn-input.component.scss',
})
export class PgnInputComponent {
  @Output() pgnSubmitted = new EventEmitter<string>();
  @Output() openRepertoire = new EventEmitter<void>();

  pgnText = '';
  errorMessage = '';

  // Chess.com search
  chesscomUsername = 'Hamarkis';
  chesscomGames: ChesscomGame[] = [];
  isLoadingGames = false;
  chesscomError = '';

  readonly examplePgn = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.04.21"]
[Round "?"]
[White "Hamarkis"]
[Black "mrsdk"]
[Result "1-0"]
[TimeControl "600"]
[WhiteElo "1327"]
[BlackElo "1290"]
[Termination "Hamarkis a gagné par abandon"]
[ECO "C45"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5 5. Be3 Nf6 6. Nxc6 bxc6 7. Bxc5 Nxe4 8. Qd4 Nxc5 9. Qxc5 d6 10. Qxc6+ Bd7 11. Qc3 O-O 12. Be2 Rb8 13. O-O Re8 14. Re1 Qe7 15. Qd3 Bb5 16. Qd2 Bxe2 17. Nc3 Rxb2 18. Rxe2 Qd7 19. Rxe8+ Qxe8 20. Re1 Qd7 21. Qe3 h6 22. Qe2 Qc6 23. Qd3 d5 24. Rb1 Rxb1+ 25. Nxb1 Qb6 26. Qd1 c6 27. h3 Qb2 28. Nd2 Qxa2 29. Nf3 f6 30. Nd4 c5 31. Ne6 c4 32. Qxd5 Qxc2 33. Nd4+ 1-0`;

  constructor(
    private pgnParser: PgnParserService,
    public chesscom: ChesscomService
  ) {}

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.pgnText.trim()) {
      this.errorMessage = 'Veuillez coller un PGN';
      return;
    }

    if (!this.pgnParser.validatePgn(this.pgnText)) {
      this.errorMessage = 'PGN invalide. Vérifiez le format.';
      return;
    }

    this.pgnSubmitted.emit(this.pgnText);
  }

  loadExample(): void {
    this.pgnText = this.examplePgn;
    this.errorMessage = '';
  }

  async searchGames(): Promise<void> {
    if (!this.chesscomUsername.trim()) {
      this.chesscomError = 'Entrez un pseudo Chess.com';
      return;
    }

    this.isLoadingGames = true;
    this.chesscomError = '';
    this.chesscomGames = [];

    try {
      this.chesscomGames = await this.chesscom.getRecentGames(this.chesscomUsername.trim());
      if (this.chesscomGames.length === 0) {
        this.chesscomError = 'Aucune partie trouvée pour ce joueur';
      }
    } catch {
      this.chesscomError = 'Joueur introuvable ou erreur de connexion';
    } finally {
      this.isLoadingGames = false;
    }
  }

  selectGame(game: ChesscomGame): void {
    this.pgnSubmitted.emit(game.pgn);
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
