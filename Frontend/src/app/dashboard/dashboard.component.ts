import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { NavbarComponent } from '../navbar/navbar.component';
import { LayoutControlService } from '../services/layout-control.service';
import {
  AuthService,
  TablasResponse,
  DatosTablaResponse,
  SqlCommandResponse
} from '../services/auth.service';

interface PredefinedCommand {
  id: string;
  name: string;
  description: string;
  sqlPreview: string;
  endpoint: () => any;
}

interface ParsedResult {
  type: 'output' | 'table' | 'error' | 'message';
  content: string;
  sections?: { title: string; content: string }[];
  tableData?: { headers: string[], rows: string[][] };
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

  showSqlPanel = false;
  currentSqlCommand = '';
  sqlResult: string | null = null;
  parsedResult: ParsedResult | null = null;

  private subscription: Subscription = new Subscription();
  resultAsTable: string[][] = [];

  selectedPredefinedCommand = '';
  isExecutingCommand: boolean = false;

  inputCedula: string = '';
  resultadoCedula: string = '';
  token: string = '';

  columnasSeleccionadas: string[] = [];
  separadorSeleccionado: string = ',';
  textoGenerado: string = '';

  predefinedCommands: PredefinedCommand[] = [
    {
      id: 'tiempo',
      name: 'Script de Tiempo y Tipos de Datos',
      description: 'Ejecuta operaciones con fechas y muestra todos los tipos de datos Oracle',
      sqlPreview: `DECLARE
  v_fecha DATE := TO_DATE('2025-06-11', 'YYYY-MM-DD');
  v_proximo_dia DATE;
  v_dia_anterior DATE;
  v_char CHAR(10) := 'TextoA';
  v_varchar2 VARCHAR2(20) := 'Texto B';
  v_number NUMBER(10,2) := 12345.67;
BEGIN
  NULL;
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
    private layoutService: LayoutControlService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.token = localStorage.getItem('token') || '';

    this.auth.getTablas().subscribe({
      next: (r: TablasResponse) => this.tablas = r.result,
      error: e => this.error = 'Error al obtener tablas: ' + (e.error?.error || e.message)
    });

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

   validarCedula(): void {
    if (!this.inputCedula.trim()) {
      this.resultadoCedula = '⚠️ Ingrese una cédula válida.';
      return;
    }

    this.resultadoCedula = '⌛ Validando...';

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`
    });

    const body = { cedula: this.inputCedula.trim() };

    this.http.post<any>('http://localhost:3000/api/script/validar-cedula', body, { headers }).subscribe({
      next: (res: any) => {
        this.resultadoCedula = res.output || '✓ Cédula validada correctamente';
      },
      error: (err: any) => {
      console.error('Error al validar cédula:', err); // para depurar
      const rawMessage = err?.error?.details || err?.error?.error || err?.message || JSON.stringify(err);
      this.resultadoCedula = `❌ ${rawMessage}`;
}
    });
  }

  loadPredefinedCommand(): void {
    if (this.selectedPredefinedCommand) {
      const command = this.predefinedCommands.find(cmd => cmd.id === this.selectedPredefinedCommand);
      if (command) {
        this.currentSqlCommand = command.sqlPreview;
        this.onSqlCommandChange();
        this.sqlResult = null;
        this.parsedResult = null;
      }
    }
  }

  executePredefinedCommand(): void {
    if (this.selectedPredefinedCommand && !this.isExecutingCommand) {
      const command = this.predefinedCommands.find(cmd => cmd.id === this.selectedPredefinedCommand);
      if (command) {
        this.isExecutingCommand = true;
        this.sqlResult = 'Ejecutando comando...';
        this.parsedResult = null;

        command.endpoint().subscribe({
          next: (res: SqlCommandResponse) => {
            this.isExecutingCommand = false;
            this.processResult(res);
          },
          error: (e: any) => {
            this.isExecutingCommand = false;
            this.sqlResult = 'Error: ' + (e.error?.error || e.message);
            this.parsedResult = {
              type: 'error',
              content: 'Error: ' + (e.error?.error || e.message)
            };
          }
        });
      }
    }
  }

  ejecutarComandoSQL(): void {
    if (this.currentSqlCommand.trim() && !this.isExecutingCommand) {
      this.isExecutingCommand = true;
      this.sqlResult = 'Ejecutando comando...';
      this.parsedResult = null;

      this.auth.ejecutarComandoSQL(this.currentSqlCommand).subscribe({
        next: (res: SqlCommandResponse) => {
          this.isExecutingCommand = false;
          this.processResult(res);
        },
        error: (e) => {
          this.isExecutingCommand = false;
          this.sqlResult = 'Error: ' + (e.error?.error || e.message);
          this.parsedResult = {
            type: 'error',
            content: 'Error: ' + (e.error?.error || e.message)
          };
        }
      });
    }
  }

  private processResult(res: SqlCommandResponse): void {
    if (res.output) {
      this.sqlResult = res.output;
      this.parsedResult = this.parseOutput(res.output);
    } else if (res.result && res.result.length > 0) {
      // Aquí se corrige para que acepte array de arrays
      this.sqlResult = this.formatQueryResult(res.result, res.columns || []);
      this.parsedResult = this.parseTableResult(res.result, res.columns || []);
    } else {
      this.sqlResult = res.message || 'Comando ejecutado correctamente';
      this.parsedResult = {
        type: 'message',
        content: res.message || 'Comando ejecutado correctamente'
      };
    }
  }

  private parseOutput(output: string): ParsedResult {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    if (this.isStructuredOutput(output)) {
      return this.parseStructuredOutput(output);
    }
    return {
      type: 'output',
      content: output
    };
  }

  private isStructuredOutput(output: string): boolean {
    return output.includes('=====') ||
           output.includes('OPERACIONES CON FECHAS') ||
           output.includes('TIPOS DE DATOS ORACLE') ||
           output.includes('TIPO DE DATO');
  }

  private parseStructuredOutput(output: string): ParsedResult {
    const sections: { title: string; content: string }[] = [];
    const lines = output.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('OPERACIONES CON FECHAS')) {
        if (currentSection) {
          sections.push({ title: currentSection, content: currentContent.join('\n') });
        }
        currentSection = 'Operaciones con Fechas';
        currentContent = [];
      } else if (line.includes('TIPOS DE DATOS ORACLE')) {
        if (currentSection) {
          sections.push({ title: currentSection, content: currentContent.join('\n') });
        }
        currentSection = 'Tipos de Datos Oracle';
        currentContent = [];
      } else if (line.includes('FIN DEL PROGRAMA')) {
        if (currentSection) {
          sections.push({ title: currentSection, content: currentContent.join('\n') });
        }
        break;
      } else if (!line.includes('====') && line.trim() !== '') {
        currentContent.push(line);
      }
    }

    if (currentSection && currentContent.length > 0) {
      sections.push({ title: currentSection, content: currentContent.join('\n') });
    }

    const tableData = this.extractTableData(output);

    return {
      type: 'output',
      content: output,
      sections: sections,
      tableData: tableData
    };
  }

  private extractTableData(output: string): { headers: string[], rows: string[][] } | undefined {
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('TIPO DE DATO') && line.includes('VALOR')) {
        const headers = ['TIPO DE DATO', 'VALOR'];
        const rows: string[][] = [];
        for (let j = i + 2; j < lines.length; j++) {
          const dataLine = lines[j];
          if (dataLine.includes('-'.repeat(80)) || dataLine.trim() === '') {
            break;
          }
          const parts = dataLine.split(/\s{2,}/);
          if (parts.length >= 2) {
            rows.push([parts[0].trim(), parts[1].trim()]);
          }
        }
        if (rows.length > 0) {
          return { headers, rows };
        }
      }
    }
    return undefined;
  }

  private parseTableResult(rows: any[], columns: string[]): ParsedResult {
    if (!rows || rows.length === 0) {
      return {
        type: 'message',
        content: 'No hay resultados'
      };
    }

    let headers: string[];
    let tableRows: string[][];

    if (Array.isArray(rows[0])) {
      // Si es array de arrays
      headers = columns && columns.length > 0 ? columns : Array.from({ length: rows[0].length }, (_, i) => `Columna ${i + 1}`);
      tableRows = (rows as (string | number | null | undefined)[][]).map((row: (string | number | null | undefined)[]) =>
        row.map((cell: string | number | null | undefined) => cell === null || cell === undefined ? 'NULL' : String(cell))
      );
    } else {
      // Si es array de objetos
      headers = columns && columns.length > 0 ? columns : Object.keys(rows[0]);
      tableRows = rows.map(row =>
        headers.map(colName => {
          const value = row[colName];
          return value === null || value === undefined ? 'NULL' : String(value);
        })
      );
    }

    return {
      type: 'table',
      content: '',
      tableData: { headers, rows: tableRows }
    };
  }

  private formatQueryResult(rows: any[], columns: string[]): string {
    if (!rows || rows.length === 0) return 'No hay resultados';

    let result = '';
    this.resultAsTable = [];

    if (Array.isArray(rows[0])) {
      // Caso: array de arrays
      if (columns && columns.length > 0) {
        this.resultAsTable.push(columns);
        result += columns.join(' | ') + '\n';
        result += '-'.repeat(columns.join(' | ').length) + '\n';

        rows.forEach((row: any[]) => {
          const values = row.map(v => v === null || v === undefined ? 'NULL' : String(v));
          this.resultAsTable.push(values);
          result += values.join(' | ') + '\n';
        });
      } else {
        rows.forEach((row: any[]) => {
          const values = row.map(v => v === null || v === undefined ? 'NULL' : String(v));
          result += values.join(' | ') + '\n';
        });
      }
    } else {
      // Caso: array de objetos
      if (columns && columns.length > 0) {
        this.resultAsTable.push(columns);
        result += columns.join(' | ') + '\n';
        result += '-'.repeat(columns.join(' | ').length) + '\n';

        rows.forEach((row: { [key: string]: any }) => {
          const values = columns.map(colName => {
            const value = row[colName];
            return value === null || value === undefined ? 'NULL' : String(value);
          });
          this.resultAsTable.push(values);
          result += values.join(' | ') + '\n';
        });
      } else {
        rows.forEach((row: { [key: string]: any }) => {
          const values = Object.values(row).map(v => v === null || v === undefined ? 'NULL' : String(v));
          result += values.join(' | ') + '\n';
        });
      }
    }

    return result;
  }

  clearSelection(): void {
    this.selectedPredefinedCommand = '';
    this.sqlResult = null;
    this.parsedResult = null;
    this.currentSqlCommand = '';
  }

  cerrarPanelSQL(): void {
    this.layoutService.hideSqlPanel();
    this.sqlResult = null;
    this.parsedResult = null;
    this.selectedPredefinedCommand = '';
  }

  onSqlCommandChange(): void {
    this.layoutService.updateSqlCommand(this.currentSqlCommand);
    this.sqlResult = null;
    this.parsedResult = null;
  }

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
    this.loadTableData(tabla.owner, tabla.table_name);
  }

  loadTableData(owner: string, tableName: string): void {
    this.auth.obtenerDatosTabla(owner, tableName).subscribe({
      next: (res: DatosTablaResponse) => {
        this.columnas = res.columns.map(col => col.name);
        this.filas = res.data;
        this.error = '';
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
    const atributo = this.atributos.find(a => a.name === nombreColumna);
    return atributo ? atributo.type : 'Desconocido';
  }

  toggleColumnaSeleccionada(columna: string, event: any): void {
    if (event.target.checked) {
      this.columnasSeleccionadas.push(columna);
    } else {
      this.columnasSeleccionadas = this.columnasSeleccionadas.filter(c => c !== columna);
    }
  }

  generarDatosSeparados(): void {
    if (this.columnasSeleccionadas.length === 0) {
      this.textoGenerado = '⚠️ Debe seleccionar al menos una columna.';
      return;
    }

    const sep = this.separadorSeleccionado === '\\t' ? '\t' : this.separadorSeleccionado;
    const encabezado = this.columnasSeleccionadas.join(sep);

    const indices = this.columnasSeleccionadas.map(col => this.columnas.indexOf(col));
    const filasFormateadas = this.filas.map(fila =>
      indices.map(i => fila[i] ?? '').join(sep)
    );

    this.textoGenerado = [encabezado, ...filasFormateadas].join('\n');
  }

  descargarTxt(): void {
    const blob = new Blob([this.textoGenerado], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.tablaSeleccionada?.table_name || 'datos'}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  cargarArchivoTxt(event: any): void {
  const file: File = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const contenido = reader.result as string;
    this.textoGenerado = contenido;
  };
  reader.onerror = () => {
    this.textoGenerado = '❌ Error al leer el archivo.';
  };

  reader.readAsText(file);
}

}