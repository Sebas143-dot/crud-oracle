import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  tablas: any[] = [];
  error: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.getTablas().subscribe({
      next: (res) => {
        this.tablas = res.result;
      },
      error: (err) => {
        this.error = 'Error al obtener tablas: ' + (err.error?.error || err.message);
      }
    });
  }

  logout(): void {
    this.authService.cerrarSesion();
    this.router.navigate(['/login']);
  }

  editarTabla(tabla: any): void {
    console.log('Modificando tabla:', tabla.table_name);
    // Aquí podrías redirigir a una ruta específica si lo deseas
    // this.router.navigate(['/editar', tabla.table_name]);
  }
}
