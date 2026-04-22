import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnalyzedMove,
  MoveQuality,
  MOVE_QUALITY_INFO,
  RepertoireStatus,
} from '../../models/analysis.model';

@Component({
  selector: 'app-move-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './move-list.component.html',
  styleUrl: './move-list.component.scss',
})
export class MoveListComponent {
  @Input() moves: AnalyzedMove[] = [];
  @Input() currentMoveIndex = -1;
  @Input() repertoireStatuses: (RepertoireStatus | null)[] = [];
  @Output() moveSelected = new EventEmitter<number>();
  @Output() addToRepertoire = new EventEmitter<number>();

  get movePairs(): { number: number; white: AnalyzedMove | null; black: AnalyzedMove | null; whiteIdx: number; blackIdx: number }[] {
    const pairs = [];
    for (let i = 0; i < this.moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: this.moves[i] || null,
        black: this.moves[i + 1] || null,
        whiteIdx: i,
        blackIdx: i + 1,
      });
    }
    return pairs;
  }

  selectMove(index: number): void {
    if (index >= 0 && index < this.moves.length) {
      this.moveSelected.emit(index);
    }
  }

  onAddToRepertoire(event: Event, index: number): void {
    event.stopPropagation();
    this.addToRepertoire.emit(index);
  }

  getQualityIcon(quality: MoveQuality | null): string {
    if (!quality) return '';
    return MOVE_QUALITY_INFO[quality]?.symbol || '';
  }

  getQualityClass(quality: MoveQuality | null): string {
    if (!quality) return '';
    return MOVE_QUALITY_INFO[quality]?.cssClass || '';
  }

  getQualityColor(quality: MoveQuality | null): string {
    if (!quality) return 'transparent';
    return MOVE_QUALITY_INFO[quality]?.color || 'transparent';
  }

  getRepertoireStatus(index: number): RepertoireStatus | null {
    return this.repertoireStatuses[index] ?? null;
  }

  getRepertoireClass(index: number): string {
    const status = this.getRepertoireStatus(index);
    if (!status) return '';
    return status;
  }

  isUnknownRepertoire(index: number): boolean {
    return this.getRepertoireStatus(index) === RepertoireStatus.Unknown;
  }

  isActive(index: number): boolean {
    return index === this.currentMoveIndex;
  }
}
