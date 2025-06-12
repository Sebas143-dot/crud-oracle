import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '../navbar/navbar.component';
import { LayoutControlService } from '../services/layout-control.service';

import {
  AuthService,
  TablasResponse,
  DatosTablaResponse,
  TiposTablaResponse,
  SqlCommandResponse
} from '../services/auth.service';

// INTERFACE PARA COMANDOS PREDEFINIDOS
interface PredefinedCommand {
  id: string;
  name: string;
  description: string;
  sqlPreview: string;
  endpoint: () => any; // Función que ejecuta el comando
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {

  tablas: any[] = [];
  error = '';

  mostrarModal = false;
  modalVisible = false;

  tablaSeleccionada: any = null;

  columnas: string[] = [];
  filas: any[][] = [];
  atributos: { name: string; type: string }[] = [];

  paginaActual = 1;
  filasPorPagina = 10;

  // PROPIEDADES PARA EL LAYOUT DIVIDIDO
  showSqlPanel = false;
  currentSqlCommand = '';
  sqlResult: string | null = null;
  private subscription: Subscription = new Subscription();

  resultAsTable: string[][] = [];

  // NUEVAS PROPIEDADES PARA COMANDOS PREDEFINIDOS
  selectedPredefinedCommand = '';
  isExecutingCommand: boolean = false;

  // COMANDOS PREDEFINIDOS DISPONIBLES
  predefinedCommands: PredefinedCommand[] = [
    {
      id: 'tiempo',
      name: 'Script de Tiempo y Tipos de Datos',
      description: 'Ejecuta operaciones con fechas y muestra todos los tipos de datos Oracle',
      sqlPreview: `DECLARE
  v_fecha DATE := TO_DATE('2025-06-11', 'YYYY-MM-DD');
  v_proximo_dia DATE;
  v_dia_anterior DATE;
  -- Variables para tipos de datos
  v_char CHAR(10) := 'TextoA';
  v_varchar2 VARCHAR2(20) := 'Texto B';
  v_number NUMBER(10,2) := 12345.67;
BEGIN
  -- Operaciones con fechas y tipos de datos...
END;`,
      endpoint: () => this.auth.ejecutarScriptTiempo()
    },
    {
      id: 'empleados-hr',
      name: 'Total Empleados HR',
      description: 'Cuenta el total de empleados en la tabla HR.EMPLOYEES',
      sqlPreview: `DECLARE
  v_total_empleados NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_total_empleados
  FROM HR.EMPLOYEES;
  
  DBMS_OUTPUT.PUT_LINE('Total de empleados: ' || v_total_empleados);
END;`,
      endpoint: () => this.auth.ejecutarTotalEmpleadosHR()
    },
    {
      id: 'fecha-bd',
      name: 'Fecha Creación Base de Datos',
      description: 'Muestra el nombre y fecha de creación de la base de datos',
      sqlPreview: `DECLARE
  v_nombre_bd VARCHAR2(50);
  v_fecha_crea DATE;
BEGIN
  SELECT NAME, CREATED INTO v_nombre_bd, v_fecha_crea
  FROM V$DATABASE;
  
  DBMS_OUTPUT.PUT_LINE('Nombre de la BD: ' || v_nombre_bd);
  DBMS_OUTPUT.PUT_LINE('Fecha creación: ' || TO_CHAR(v_fecha_crea, 'YYYY-MM-DD HH24:MI:SS'));
END;`,
      endpoint: () => this.auth.ejecutarFechaCreacionBase()
    }
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private layoutService: LayoutControlService
  ) { }

  ngOnInit(): void {
    this.auth.getTablas().subscribe({
      next: (r: TablasResponse) => this.tablas = r.result,
      error: e => this.error = 'Error al obtener tablas: ' + (e.error?.error || e.message)
    });

    // SUSCRIBIRSE A LOS CAMBIOS DEL LAYOUT
    this.subscription.add(
      this.layoutService.showSqlPanel$.subscribe(show => {
        this.showSqlPanel = show;
      })
    );

    this.subscription.add(
      this.layoutService.sqlCommand$.subscribe(command => {
        this.currentSqlCommand = command;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  // Cargar comando seleccionado en el textarea
  loadPredefinedCommand(): void {
    if (this.selectedPredefinedCommand) {
      const command = this.predefinedCommands.find(cmd => cmd.id === this.selectedPredefinedCommand);
      if (command) {
        this.currentSqlCommand = command.sqlPreview;
        this.onSqlCommandChange();
        this.sqlResult = null;
      }
    }
  }

  // Ejecutar comando predefinido directamente (sin editar)
  executePredefinedCommand(): void {
    if (this.selectedPredefinedCommand && !this.isExecutingCommand) {
      const command = this.predefinedCommands.find(cmd => cmd.id === this.selectedPredefinedCommand);
      if (command) {
        this.isExecutingCommand = true;
        this.sqlResult = 'Ejecutando comando...';

        command.endpoint().subscribe({
          next: (res: SqlCommandResponse) => {
            this.isExecutingCommand = false;
            if (res.output) {
              this.sqlResult = res.output;
            } else if (res.result && res.result.length > 0) {
              this.sqlResult = this.formatQueryResult(res.result, res.columns || []);
            } else {
              this.sqlResult = res.message || 'Comando ejecutado correctamente';
            }
          },
          error: (e: any) => {
            this.isExecutingCommand = false;
            this.sqlResult = 'Error: ' + (e.error?.error || e.message);
          }
        });
      }
    }
  }

  // Formatear resultados de consultas SELECT
  private formatQueryResult(rows: { [key: string]: any }[], columns: string[]): string {
    if (!rows || rows.length === 0) return 'No hay resultados';

    let result = '';
    this.resultAsTable = [];

    if (columns && columns.length > 0) {
      this.resultAsTable.push(columns);
      result += columns.join(' | ') + '\n';
      result += '-'.repeat(columns.join(' | ').length) + '\n';
    }

    rows.forEach((row: { [key: string]: any }) => {
      const values = Object.values(row);
      this.resultAsTable.push(values.map(v => v.toString()));
      result += values.join(' | ') + '\n';
    });

    return result;
  }

  clearSelection(): void {
    this.selectedPredefinedCommand = '';
    this.sqlResult = null;
    this.currentSqlCommand = '';
  }

  // MÉTODOS EXISTENTES PARA MANEJO DEL PANEL SQL

  ejecutarComandoSQL(): void {
    if (this.currentSqlCommand.trim() && !this.isExecutingCommand) {
      this.isExecutingCommand = true;
      this.sqlResult = 'Ejecutando comando...';

      this.auth.ejecutarComandoSQL(this.currentSqlCommand).subscribe({
        next: (res: SqlCommandResponse) => {
          this.isExecutingCommand = false;

          if (res.output) {
            this.sqlResult = res.output;
          } else if (res.result && res.result.length > 0) {
            this.sqlResult = this.formatQueryResult(res.result, res.columns || []);
          } else {
            this.sqlResult = res.message || 'Comando ejecutado correctamente';
          }
        },
        error: (e) => {
          this.isExecutingCommand = false;
          this.sqlResult = 'Error: ' + (e.error?.error || e.message);
        }
      });
    }
  }

  cerrarPanelSQL(): void {
    this.layoutService.hideSqlPanel();
    this.sqlResult = null;
    this.selectedPredefinedCommand = '';
  }

  onSqlCommandChange(): void {
    this.layoutService.updateSqlCommand(this.currentSqlCommand);
    this.sqlResult = null;
  }

  // MÉTODOS EXISTENTES (sin cambios)

  logout(): void {
    this.auth.cerrarSesion();
    this.router.navigate(['/login']);
  }

  get selectedPredefinedDescription(): string | undefined {
    const cmd = this.predefinedCommands.find(cmd => cmd.id === this.selectedPredefinedCommand);
    return cmd?.description;
  }

  editarTabla(tabla: any): void {
    if (!tabla.privileges.select) {
      this.error = `No tienes privilegio SELECT para la tabla ${tabla.table_name}. No puedes ver sus datos.`;
      return;
    }
    this.tablaSeleccionada = tabla;
    this.mostrarModal = true;
    this.loadTableData(tabla.owner, tabla.table_name);  // Cargar los datos de la tabla seleccionada
  }

  loadTableData(owner: string, tableName: string): void {
    this.auth.obtenerDatosTabla(owner, tableName).subscribe({
      next: (res: DatosTablaResponse) => {
        this.columnas = res.columns.map(col => col.name);
        this.filas = res.data;
        this.error = '';  // Limpiar el error si los datos se cargan correctamente
      },
      error: (e) => {
        this.error = 'Error al obtener datos de la tabla: ' + (e.error?.error || e.message);
      }
    });
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas()) {
      this.paginaActual = nuevaPagina;
    }
  }

  totalPaginas(): number {
    return Math.ceil((this.filas.length || 0) / this.filasPorPagina);
  }

  get filasPaginadas(): any[] {
    const inicio = (this.paginaActual - 1) * this.filasPorPagina;
    return this.filas.slice(inicio, inicio + this.filasPorPagina);
  }

  cerrarModal(): void {
    this.modalVisible = false;
    setTimeout(() => {
      this.mostrarModal = false;
      this.tablaSeleccionada = null;
      this.columnas = [];
      this.filas = [];
      this.paginaActual = 1;
    }, 300);
  }

  obtenerTipoDato(nombreColumna: string): string {
    const atributo = this.atributos?.find(a => a.name === nombreColumna);
    return atributo ? atributo.type : 'Desconocido';
  }
}
