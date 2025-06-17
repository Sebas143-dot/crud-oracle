import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import {
  SqlCommandResponse,
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
  selector: 'app-ejecutar-codigo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ejecutar-codigo.component.html',
  styleUrls: ['./ejecutar-codigo.component.css']
})
export class EjecutarCodigoComponent implements OnInit {

  error = '';
  currentSqlCommand = '';
  sqlResult: string | null = null;
  parsedResult: ParsedResult | null = null;
  isExecutingCommand: boolean = false;
  selectedPredefinedCommand = '';
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
  -- Operaciones con fechas...
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
  DBMS_OUTPUT.PUT_LINE('Nombre de la BD: ' + v_nombre_bd);
  DBMS_OUTPUT.PUT_LINE('Fecha creación: ' + TO_CHAR(v_fecha_crea, 'YYYY-MM-DD HH24:MI:SS'));
END;`,
      endpoint: () => this.auth.ejecutarFechaCreacionBase()
    }
  ];

  constructor(private auth: AuthService) {}

  ngOnInit(): void {}

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
      headers = columns && columns.length > 0 ? columns : Array.from({ length: rows[0].length }, (_, i) => `Columna ${i + 1}`);
      tableRows = (rows as (string | number | null | undefined)[][]).map((row: (string | number | null | undefined)[]) =>
        row.map((cell: string | number | null | undefined) => cell === null || cell === undefined ? 'NULL' : String(cell))
      );
    } else {
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
    if (Array.isArray(rows[0])) {
      if (columns && columns.length > 0) {
        result += columns.join(' | ') + '\n';
        result += '-'.repeat(columns.join(' | ').length) + '\n';
        rows.forEach((row: any[]) => {
          const values = row.map(v => v === null || v === undefined ? 'NULL' : String(v));
          result += values.join(' | ') + '\n';
        });
      } else {
        rows.forEach((row: any[]) => {
          const values = row.map(v => v === null || v === undefined ? 'NULL' : String(v));
          result += values.join(' | ') + '\n';
        });
      }
    } else {
      if (columns && columns.length > 0) {
        result += columns.join(' | ') + '\n';
        result += '-'.repeat(columns.join(' | ').length) + '\n';
        rows.forEach((row: { [key: string]: any }) => {
          const values = columns.map(colName => {
            const value = row[colName];
            return value === null || value === undefined ? 'NULL' : String(value);
          });
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

  onSqlCommandChange(): void {
    this.sqlResult = null;
    this.parsedResult = null;
  }

  get selectedPredefinedDescription(): string | undefined {
    const cmd = this.predefinedCommands.find(cmd => cmd.id === this.selectedPredefinedCommand);
    return cmd?.description;
  }
}