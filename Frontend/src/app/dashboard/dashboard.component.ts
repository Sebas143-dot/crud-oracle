import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  tablas: any[] = [];
  error = '';

  mostrarModal  = false;    // modal principal
  mostrarInsert = false;    // modal de inserción
  tablaSeleccionada: any = null;

  columnas:  string[] = [];
  filas:     any[][]  = [];
  atributos: { name: string; type: string }[] = [];
  nuevaFila: string[] = [];

  constructor(private auth: AuthService, private router: Router) {}

  /* ───────── Init ───────── */
  ngOnInit(): void {
    this.auth.getTablas().subscribe({
      next:  r => this.tablas = r.result,
      error: e => this.error = 'Error al obtener tablas: ' + (e.error?.error || e.message)
    });
  }

  /* ───────── Logout ───────── */
  logout(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }

  /* ───────── Abrir modal tabla ───────── */
  editarTabla(t: any): void {
    this.tablaSeleccionada = t;
    this.mostrarModal      = true;
    this.mostrarInsert     = false;

    this.columnas  = [];
    this.filas     = [];
    this.atributos = [];
    this.nuevaFila = [];

    if (t.privileges.select) {
      this.auth.obtenerDatosTabla(t.owner, t.table_name).subscribe({
        next:  r => {
          this.filas    = r.data ?? [];
          this.columnas = r.columns.map((c: any) => c.name);
          this.nuevaFila = Array(this.columnas.length).fill('');
        },
        error: () => this.error = 'No se pudieron cargar los datos de la tabla'
      });

      this.auth.getTiposDeTabla(t.owner, t.table_name).subscribe({
        next:  r => this.atributos = r.columns.map((c: any) => ({ name: c.name, type: c.type || 'Desconocido' })),
        error: e => console.error('Error tipos:', e)
      });
    }
  }

  /* ───────── Cerrar modal tabla ───────── */
  cerrarModal(): void {
    this.mostrarModal  = false;
    this.mostrarInsert = false;
    this.tablaSeleccionada = null;
    this.columnas = this.filas = this.atributos = this.nuevaFila = [];
  }

  /* ───────── Acciones ───────── */
  accion(tipo: string): void {
    if (tipo === 'insert' && this.tablaSeleccionada?.privileges.insert) {
      this.mostrarInsert = true;
      //  nuevaFila ya fue inicializado al abrir la tabla
    }
  }

  /* ───────── Insertar ───────── */
  insertarFila(): void {
    if (!this.tablaSeleccionada) return;

    const fila = this.nuevaFila.map(v => v || null);
    this.auth.insertarEnTabla(
      this.tablaSeleccionada.owner,
      this.tablaSeleccionada.table_name,
      this.columnas,
      [fila]
    ).subscribe({
      next: () => {
        alert('Fila insertada');
        if (this.tablaSeleccionada.privileges.select) this.editarTabla(this.tablaSeleccionada);
        this.mostrarInsert = false;
      },
      error: e => { alert('Error al insertar'); console.error(e); }
    });
  }

  cerrarInsert(): void {
    this.mostrarInsert = false;
  }

  /* ───────── Util ───────── */
  obtenerTipoDato(col: string): string {
    const a = this.atributos.find(x => x.name === col);
    return a ? a.type : 'Desconocido';
  }
}
