import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LayoutControlService {
  private showSqlPanelSubject = new BehaviorSubject<boolean>(false);
  public showSqlPanel$ = this.showSqlPanelSubject.asObservable();

  private sqlCommandSubject = new BehaviorSubject<string>('');
  public sqlCommand$ = this.sqlCommandSubject.asObservable();

  constructor() { }

  // Activar el panel SQL en el dashboard
  activatesSqlPanel(command?: string) {
    this.showSqlPanelSubject.next(true);
    if (command) {
      this.sqlCommandSubject.next(command);
    }
  }

  // Ocultar el panel SQL
  hideSqlPanel() {
    this.showSqlPanelSubject.next(false);
  }

  // Actualizar comando SQL
  updateSqlCommand(command: string) {
    this.sqlCommandSubject.next(command);
  }
}