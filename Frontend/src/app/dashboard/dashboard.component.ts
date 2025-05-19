import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  atributos: { name: string; type: string }[] = [];

  nuevaFila: string[] = []; // ✅ Inicializar vacío

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
    this.nuevaFila = [];

    if (tabla.privileges.select) {
      this.authService.obtenerDatosTabla(tabla.owner, tabla.table_name).subscribe({
        next: (res) => {
          this.filas = res.data;
          this.columnas = res.columns.map((col: any) => col.name);
        },
        error: (err) => {
          console.error('Error al obtener datos de la tabla:', err);
          this.error = 'No se pudieron cargar los datos de la tabla';
        }
      });

      this.authService.getTiposDeTabla(tabla.owner, tabla.table_name).subscribe({
        next: (res) => {
          this.atributos = res.columns.map((col: any) => ({
            name: col.name,
            type: col.type || 'Desconocido'
          }));
        },
        error: (err) => {
          console.error('Error al obtener tipos de columnas:', err);
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
    this.nuevaFila = [];
  }

  accion(tipo: string): void {
    if (tipo === 'insert') {
      this.nuevaFila = new Array(this.columnas.length).fill('');
    }
    console.log(`Acción '${tipo}' en tabla '${this.tablaSeleccionada.table_name}'`);
  }

  obtenerTipoDato(nombreColumna: string): string {
    const atributo = this.atributos.find(attr => attr.name === nombreColumna);
    return atributo ? atributo.type : 'Desconocido';
  }

  insertarFila(): void {
    if (!this.tablaSeleccionada) return;
    this.authService.insertarEnTabla(
      this.tablaSeleccionada.owner,
      this.tablaSeleccionada.table_name,
      this.columnas,
      [this.nuevaFila]
    ).subscribe({
      next: () => {
        alert('Fila insertada correctamente');
        this.editarTabla(this.tablaSeleccionada); // Refresca los datos
      },
      error: (err) => {
        console.error('Error al insertar:', err);
        alert('Error al insertar datos');
      }
    });
  }
}
