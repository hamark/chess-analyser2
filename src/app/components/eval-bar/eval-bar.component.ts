import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-eval-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eval-bar.component.html',
  styleUrl: './eval-bar.component.scss',
})
export class EvalBarComponent implements OnChanges {
  @Input() cp: number | null = null;
  @Input() mate: number | null = null;

  whitePercentage = 50;
  displayText = '0.0';

  ngOnChanges(_changes: SimpleChanges): void {
    this.updateBar();
  }

  private updateBar(): void {
    if (this.mate !== null) {
      if (this.mate > 0) {
        this.whitePercentage = 100;
        this.displayText = `M${this.mate}`;
      } else if (this.mate < 0) {
        this.whitePercentage = 0;
        this.displayText = `M${Math.abs(this.mate)}`;
      } else {
        this.whitePercentage = 50;
        this.displayText = '#';
      }
      return;
    }

    if (this.cp !== null) {
      // Sigmoid-like mapping: cp → percentage (clamped 5-95)
      const score = this.cp / 100;
      this.whitePercentage = Math.max(
        5,
        Math.min(95, 50 + score * 10)
      );
      const abs = Math.abs(this.cp / 100);
      this.displayText = abs.toFixed(1);
    } else {
      this.whitePercentage = 50;
      this.displayText = '—';
    }
  }

  get isWhiteAdvantage(): boolean {
    if (this.mate !== null) return this.mate > 0;
    return (this.cp ?? 0) >= 0;
  }
}
