import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { NavbarComponent } from '../navbar/navbar.component';

import {
  AuthService,
  TablasResponse,
  DatosTablaResponse,
  TiposTablaResponse
} from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent], // Incluye NavbarComponent aquí
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  tablas: any[] = [];
  error = '';

  mostrarModal = false;
  modalVisible = false;  // Para animación modal
  mostrarInsert = false;

  tablaSeleccionada: any = null;

  columnas: string[] = [];
  filas: any[][] = [];
  atributos: { name: string; type: string }[] = [];

  nuevaFila: string[] = [];

  paginaActual = 1;
  filasPorPagina = 10;

  constructor(private auth: AuthService,
              private router: Router) { }

  ngOnInit(): void {
    this.auth.getTablas().subscribe({
      next: (r: TablasResponse) => this.tablas = r.result,
      error: e => this.error = 'Error al obtener tablas: ' + (e.error?.error || e.message)
    });
  }

  logout(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }

  editarTabla(tabla: any): void {
    this.error = '';
    if (!tabla.privileges.select) {
      this.error = `No tienes privilegio SELECT para la tabla ${tabla.table_name}. No puedes ver sus datos.`;
      return;
    }
    this.tablaSeleccionada = tabla;
    this.mostrarModal = true;

    setTimeout(() => {
      this.modalVisible = true;
    }, 10);

    this.mostrarInsert = false;
    this.columnas = [];
    this.filas = [];
    this.atributos = [];
    this.nuevaFila = [];
    this.paginaActual = 1;

    if (tabla.privileges.select) {
      this.auth.obtenerDatosTabla(tabla.owner, tabla.table_name)
        .subscribe({
          next: (r: DatosTablaResponse) => {
            this.filas = r.data ?? [];
            this.columnas = r.columns.map(c => (c as any).name ?? c);
            this.nuevaFila = Array(this.columnas.length).fill('');
          },
          error: () => this.error = 'No se pudieron cargar los datos.'
        });

      this.auth.getTiposDeTabla(tabla.owner, tabla.table_name)
        .subscribe({
          next: (r: TiposTablaResponse) => {
            this.atributos = r.columns.map(col => ({
              name: col.name,
              type: col.type || 'VARCHAR'
            }));
          },
          error: e => console.error('Error tipos:', e)
        });
    }
  }

  cerrarModal(): void {
    this.modalVisible = false;
    setTimeout(() => {
      this.mostrarModal = false;
      this.tablaSeleccionada = null;
      this.columnas = [];
      this.filas = [];
      this.atributos = [];
      this.nuevaFila = [];
      this.paginaActual = 1;
    }, 300);
  }

  get filasPaginadas() {
    const start = (this.paginaActual - 1) * this.filasPorPagina;
    return this.filas.slice(start, start + this.filasPorPagina);
  }

  totalPaginas(): number {
    return Math.ceil(this.filas.length / this.filasPorPagina);
  }

  cambiarPagina(n: number): void {
    if (n >= 1 && n <= this.totalPaginas()) {
      this.paginaActual = n;
    }
  }

  abrirInsert(): void {
    if (this.tablaSeleccionada?.privileges.insert) {
      this.nuevaFila = Array(this.columnas.length).fill('');
      this.mostrarInsert = true;
    }
  }

  cerrarInsert(): void {
    this.mostrarInsert = false;
  }

  insertarFila(): void {
    if (!this.tablaSeleccionada) { return; }

    const filaConvertida = this.nuevaFila.map((v, i) => {
      const tipo = (this.atributos[i]?.type || '').toUpperCase();
      if (v === '' || v === null) return null;
      return tipo.includes('NUMBER') || tipo.includes('INT')
        ? Number(v)
        : v;
    });

    this.auth.insertarDatosTabla(
      this.tablaSeleccionada.owner,
      this.tablaSeleccionada.table_name,
      this.columnas,
      [filaConvertida]
    ).subscribe({
      next: () => {
        alert('Fila insertada');

        if (this.tablaSeleccionada.privileges.select) {
          this.editarTabla(this.tablaSeleccionada);
        } else {
          this.cerrarInsert();
        }
      },
      error: e => { console.error(e); alert('Error al insertar'); }
    });
  }

  obtenerTipoDato(nombreColumna: string): string {
    const a = this.atributos.find(x => x.name === nombreColumna);
    return a ? a.type : 'Desconocido';
  }
}
