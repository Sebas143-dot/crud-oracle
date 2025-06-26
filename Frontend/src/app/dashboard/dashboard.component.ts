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

  token: string = '';
  inputCedula: string = '';
  resultadoCedula: string = '';


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

predefinedCommands: PredefinedCommand[] = [
  {
    id: 'tiempo',
    name: 'Script de Tiempo y Tipos de Datos',
    description: 'Ejecuta operaciones con fechas y muestra todos los tipos de datos PostgreSQL',
    sqlPreview: `DO $$
    DECLARE
      v_fecha DATE := '2025-06-11'::DATE;
      v_proximo_dia DATE;
      v_dia_anterior DATE;
      v_anio INTEGER;
      v_anio_anterior INTEGER;
      v_anio_siguiente INTEGER;
      v_bisiesto VARCHAR(3) := 'No';
      v_char CHAR(10) := 'TextoA';
      v_varchar VARCHAR(20) := 'Texto B';
      v_numeric NUMERIC(10,2) := 12345.67;
      v_integer INTEGER := -100;
      v_timestamp_with_date TIMESTAMP := '2025-06-11 10:30:00'::TIMESTAMP;
      v_interval_months INTERVAL := '2 years 6 months'::INTERVAL;
      v_interval_days INTERVAL := '5 days 12 hours 30 minutes 45.123456 seconds'::INTERVAL;
    BEGIN
      RAISE NOTICE '============================================================================';
      RAISE NOTICE '                           OPERACIONES CON FECHAS';
      RAISE NOTICE '============================================================================';
      v_proximo_dia := v_fecha + INTERVAL '1 day';
      v_dia_anterior := v_fecha - INTERVAL '1 day';
      v_anio := EXTRACT(YEAR FROM v_fecha);
      v_anio_anterior := v_anio - 1;
      v_anio_siguiente := v_anio + 1;
      IF (v_anio % 4 = 0 AND v_anio % 100 != 0) OR (v_anio % 400 = 0) THEN
        v_bisiesto := 'Sí';
      END IF;
      RAISE NOTICE 'Fecha original:         %', v_fecha;
      RAISE NOTICE 'Día anterior:           %', v_dia_anterior;
      RAISE NOTICE 'Próximo día:            %', v_proximo_dia;
      RAISE NOTICE 'Año actual:             %', v_anio;
      RAISE NOTICE 'Año anterior:           %', v_anio_anterior;
      RAISE NOTICE 'Año siguiente:          %', v_anio_siguiente;
      RAISE NOTICE '¿Es bisiesto?:          %', v_bisiesto;
      RAISE NOTICE 'Fecha más 1 semana:     %', v_fecha + INTERVAL '7 days';
      RAISE NOTICE 'Fecha más 1 mes:        %', v_fecha + INTERVAL '1 month';
      RAISE NOTICE 'Fecha más 1 año:        %', v_fecha + INTERVAL '1 year';
      RAISE NOTICE 'Último día del mes:     %', (DATE_TRUNC('month', v_fecha) + INTERVAL '1 month - 1 day')::DATE;
      RAISE NOTICE '';
      RAISE NOTICE '================================================================================';
      RAISE NOTICE '                            TIPOS DE DATOS POSTGRESQL';
      RAISE NOTICE '================================================================================';
      RAISE NOTICE 'TIPO DE DATO                   VALOR';
      RAISE NOTICE '--------------------------------------------------------------------------------';
      RAISE NOTICE 'CHAR                           %', v_char;
      RAISE NOTICE 'VARCHAR                        %', v_varchar;
      RAISE NOTICE 'NUMERIC                        %', v_numeric;
      RAISE NOTICE 'INTEGER                        %', v_integer;
      RAISE NOTICE 'TIMESTAMP                      %', v_timestamp_with_date;
      RAISE NOTICE 'INTERVAL (YEARS-MONTHS)        %', v_interval_months;
      RAISE NOTICE 'INTERVAL (DAYS-SECONDS)        %', v_interval_days;
      RAISE NOTICE '--------------------------------------------------------------------------------';
      RAISE NOTICE '';
      RAISE NOTICE '================================================================================';
      RAISE NOTICE '                              FIN DEL PROGRAMA';
      RAISE NOTICE '================================================================================';
    END $$;`,
    endpoint: () => this.auth.ejecutarScriptTiempo()
  },
  {
    id: 'total-empleados',
    name: 'Contar Empleados (HR)',
    description: 'Muestra la cantidad total de empleados en la tabla EMPLOYEES',
    sqlPreview: `DO $$
    DECLARE
      v_total_empleados INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_total_empleados
      FROM employees;
      RAISE NOTICE 'Total de empleados: %', v_total_empleados;
    END $$;`,
    endpoint: () => this.auth.ejecutarTotalEmpleadosHR()
  },
  {
    id: 'info-base-datos',
    name: 'Información de la Base de Datos',
    description: 'Muestra información sobre la base de datos actual',
    sqlPreview: `DO $$
    DECLARE
      v_nombre_bd TEXT;
      v_fecha_crea TIMESTAMP;
    BEGIN
      SELECT current_database() INTO v_nombre_bd;
      SELECT pg_postmaster_start_time() INTO v_fecha_crea;
      RAISE NOTICE 'Nombre de la base de datos: %', v_nombre_bd;
      RAISE NOTICE 'Fecha de inicio del servidor: %', v_fecha_crea;
    END $$;`,
    endpoint: () => this.auth.ejecutarFechaCreacionBase()
  },
  {
  id: 'reporte-empleados',
  name: 'Reporte de Años Trabajados (HR)',
  description: 'Genera un reporte con los años trabajados por cada empleado en HR',
  sqlPreview: `DO $$
DECLARE
  -- Cursor para empleados
  c_empleados CURSOR FOR
    SELECT first_name, last_name, hire_date FROM employees;

  -- Record type para empleado
  empleado_record RECORD;
  
  -- Variables para cálculos
  v_anios INTEGER;
  v_nombre_completo TEXT;
  
BEGIN
  -- Encabezado de la tabla
  RAISE NOTICE '%', RPAD('Nombre del empleado', 31) || '|' || ' Años de trabajo';
  RAISE NOTICE '%', REPEAT('-', 50);

  -- Abrir cursor y procesar cada empleado
  FOR empleado_record IN c_empleados LOOP
    -- Calcular años de trabajo
    v_anios := EXTRACT(YEAR FROM AGE(CURRENT_DATE, empleado_record.hire_date));
    
    -- Formatear nombre completo
    v_nombre_completo := empleado_record.first_name || ' ' || empleado_record.last_name;
    
    -- Mostrar resultado formateado
    RAISE NOTICE '%', RPAD(v_nombre_completo, 30) || ' | ' || LPAD(v_anios::TEXT, 5);
  END LOOP;

  RAISE NOTICE '%', REPEAT('-', 50);
  RAISE NOTICE 'Fin del reporte de años de trabajo';
END $$;`,
  endpoint: () => this.auth.ejecutarComandoSQL(`
    DO $$
    DECLARE
      c_empleados CURSOR FOR SELECT first_name, last_name, hire_date FROM employees;
      empleado_record RECORD;
      v_anios INTEGER;
      v_nombre_completo TEXT;
    BEGIN
      RAISE NOTICE '%', RPAD('Nombre del empleado', 31) || '|' || ' Años de trabajo';
      RAISE NOTICE '%', REPEAT('-', 50);
      FOR empleado_record IN c_empleados LOOP
        v_anios := EXTRACT(YEAR FROM AGE(CURRENT_DATE, empleado_record.hire_date));
        v_nombre_completo := empleado_record.first_name || ' ' || empleado_record.last_name;
        RAISE NOTICE '%', RPAD(v_nombre_completo, 30) || ' | ' || LPAD(v_anios::TEXT, 5);
      END LOOP;
      RAISE NOTICE '%', REPEAT('-', 50);
      RAISE NOTICE 'Fin del reporte de años de trabajo';
    END $$;
  `)
}
];

  constructor(
    private auth: AuthService,
    private router: Router,
    private layoutService: LayoutControlService
  ) { }

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

  validarCedula(): void {
  if (!this.inputCedula.trim()) {
    this.resultadoCedula = '⚠️ Ingrese una cédula válida.';
    return;
  }

  this.resultadoCedula = '⌛ Validando...';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.token}`
  };

  const body = { cedula: this.inputCedula.trim() };

  fetch('http://localhost:3000/api/script/validar-cedula', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        throw data;
      }
      this.resultadoCedula = data.output || '✓ Cédula validada correctamente';
    })
    .catch(err => {
      const rawMessage =
        err?.details ||
        err?.error ||
        err?.message ||
        JSON.stringify(err);

      this.resultadoCedula = `❌ ${rawMessage}`;
    });
}

}