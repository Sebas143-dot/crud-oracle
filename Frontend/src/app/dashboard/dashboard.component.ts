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

  mostrarModal: boolean = false;
  tablaSeleccionada: any = null;

  columnas: string[] = [];
  filas: any[][] = [];

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
    this.tablaSeleccionada = tabla;
    this.mostrarModal = true;

    this.columnas = [];
    this.filas = [];

    if (tabla.privileges.select) {
      this.authService.obtenerDatosTabla(tabla.table_name).subscribe({
        next: (res) => {
          this.columnas = res.columns;
          this.filas = res.rows;
        },
        error: (err) => {
          console.error('Error al obtener datos de la tabla:', err);
          this.error = 'No se pudieron cargar los datos de la tabla';
        }
      });
    }
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.tablaSeleccionada = null;
    this.columnas = [];
    this.filas = [];
  }

  accion(tipo: string): void {
    console.log(`Acción '${tipo}' en tabla '${this.tablaSeleccionada.table_name}'`);
    // Aquí luego podrías mostrar otro modal o vista por tipo de acción
  }
}
