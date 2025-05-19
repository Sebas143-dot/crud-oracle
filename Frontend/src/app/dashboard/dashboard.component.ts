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

  atributos: { name: string; type: string }[] = []; // 👈 Nuevo arreglo para tipos

  constructor(private authService: AuthService, private router: Router) { }

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
    this.atributos = [];

    if (tabla.privileges.select) {
      this.authService.obtenerDatosTabla(tabla.owner, tabla.table_name).subscribe({
        next: (res) => {
          // Soporta respuesta con objetos de columna con tipo
          if (res.columns.length && typeof res.columns[0] === 'object') {
            this.atributos = res.columns.map((col: any) => ({
              name: col.name,
              type: col.type || 'Desconocido'
            }));
            this.columnas = this.atributos.map(attr => attr.name);
          } else {
            // Soporte para respuesta simple con solo nombres
            this.columnas = res.columns;
            this.atributos = res.columns.map((name: string) => ({
              name,
              type: 'Desconocido'
            }));
          }

          this.filas = res.data;
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
    this.atributos = [];
  }

  accion(tipo: string): void {
    console.log(`Acción '${tipo}' en tabla '${this.tablaSeleccionada.table_name}'`);
    // Aquí podrías abrir un modal de edición, inserción o eliminación
  }

  obtenerTipoDato(nombreColumna: string): string {
    const atributo = this.atributos.find(attr => attr.name === nombreColumna);
    return atributo ? atributo.type : 'Desconocido';
  }
}
