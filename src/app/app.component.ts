import { Component } from '@angular/core';
import { AnalysisDashboardComponent } from './components/analysis-dashboard/analysis-dashboard.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AnalysisDashboardComponent],
  template: '<app-analysis-dashboard></app-analysis-dashboard>',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
