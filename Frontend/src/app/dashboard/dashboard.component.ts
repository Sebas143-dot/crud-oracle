import { Component, OnInit } from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { Router }        from '@angular/router';

import {
  AuthService,
  TablasResponse,
  DatosTablaResponse,
  TiposTablaResponse
} from '../services/auth.service';

/* ----------------------------------------------------------- */
/*  Stand-alone component                                     */
/* ----------------------------------------------------------- */
@Component({
  selector    : 'app-dashboard',
  standalone  : true,
  imports     : [CommonModule, FormsModule],
  templateUrl : './dashboard.component.html',
  styleUrls   : ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  /* ---------- estado general ---------- */
  tablas: any[] = [];
  error = '';

  /* ---------- estado modales ---------- */
  mostrarModal  = false;   // modal principal (datos, acciones)
  mostrarInsert = false;   // modal de inserción

  /* ---------- tabla seleccionada ---------- */
  tablaSeleccionada: any = null;

  columnas : string[] = [];
  filas    : any[][]  = [];
  atributos: { name: string; type: string }[] = [];

  /* fila que el usuario edita para insertar */
  nuevaFila: string[] = [];

  /* ---------- ctor ---------- */
  constructor(private auth: AuthService,
              private router: Router) {}

  /* ========================================================= */
  /*  Ciclo de vida                                            */
  /* ========================================================= */
  ngOnInit(): void {
    this.auth.getTablas().subscribe({
      next : (r: TablasResponse) => this.tablas = r.result,
      error: e => this.error = 'Error al obtener tablas: ' +
                               (e.error?.error || e.message)
    });
  }

  /* ========================================================= */
  /*  Logout                                                   */
  /* ========================================================= */
  logout(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }

  /* ========================================================= */
  /*  Abrir modal principal                                    */
  /* ========================================================= */
  editarTabla(tabla: any): void {
    this.tablaSeleccionada = tabla;
    this.mostrarModal  = true;
    this.mostrarInsert = false;

    /* limpiar estado */
    this.columnas  = [];
    this.filas     = [];
    this.atributos = [];
    this.nuevaFila = [];

    /* -------- obtener datos (si tiene SELECT) -------- */
    if (tabla.privileges.select) {
      this.auth.obtenerDatosTabla(tabla.owner, tabla.table_name)
        .subscribe({
          next : (r: DatosTablaResponse) => {
            this.filas    = r.data ?? [];
            this.columnas = r.columns.map(c => (c as any).name ?? c);
            this.nuevaFila = Array(this.columnas.length).fill('');
          },
          error: () => this.error = 'No se pudieron cargar los datos.'
        });

      /* -------- obtener tipos de columnas -------- */
      this.auth.getTiposDeTabla(tabla.owner, tabla.table_name)
        .subscribe({
          next : (r: TiposTablaResponse) => {
            this.atributos = r.columns.map(col => ({
              name: col.name,
              type: col.type || 'VARCHAR'
            }));
          },
          error: e => console.error('Error tipos:', e)
        });
    }
  }

  /* ========================================================= */
  /*  Cerrar modal principal                                   */
  /* ========================================================= */
  cerrarModal(): void {
    this.mostrarModal  = false;
    this.mostrarInsert = false;
    this.tablaSeleccionada = null;

    this.columnas = [];
    this.filas    = [];
    this.atributos= [];
    this.nuevaFila= [];
  }

  /* ========================================================= */
  /*  Abrir / cerrar modal de inserción                        */
  /* ========================================================= */
  abrirInsert(): void {
    if (this.tablaSeleccionada?.privileges.insert) {
      this.nuevaFila   = Array(this.columnas.length).fill('');
      this.mostrarInsert = true;
    }
  }
  cerrarInsert(): void { this.mostrarInsert = false; }

  /* ========================================================= */
  /*  Insertar fila                                            */
  /* ========================================================= */
  insertarFila(): void {
    if (!this.tablaSeleccionada) { return; }

    /** mapeo de valores al tipo adecuado */
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
      [filaConvertida]            // backend espera array de filas
    ).subscribe({
      next : () => {
        alert('Fila insertada');

        /* refrescar datos si el usuario tiene SELECT, para que vea la fila nueva */
        if (this.tablaSeleccionada.privileges.select) {
          this.editarTabla(this.tablaSeleccionada);
        } else {
          this.cerrarInsert();
        }
      },
      error: e => { console.error(e); alert('Error al insertar'); }
    });
  }

  /* ========================================================= */
  /*  Util: obtener tipo para cabecera                         */
  /* ========================================================= */
  obtenerTipoDato(nombreColumna: string): string {
    const a = this.atributos.find(x => x.name === nombreColumna);
    return a ? a.type : 'Desconocido';
  }
}
