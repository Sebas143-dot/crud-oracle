import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/* ---------- interfaces de respuesta ---------- */
export interface TablasResponse {
  result: any[];
}

export interface DatosTablaResponse {
  columns: { name: string }[];    // el backend envía objetos {name,type}
  data: any[][];
}

export interface TiposTablaResponse {
  columns: { name: string; type: string }[];
}

// NUEVA INTERFACE PARA COMANDOS SQL
export interface SqlCommandResponse {
  message: string;
  output?: string;
  result?: any[];
  columns?: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api';  // Asegúrate de que este URL sea el correcto para tu API

  constructor(private http: HttpClient) { }

  /* ========== helpers ========== */
  private header(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.obtenerToken() || ''}`
    });
  }

  /* ========== auth ========== */
  login(user: string, password: string) {
    return this.http.post<{ token: string }>(`${this.apiUrl}/login`, { user, password });
  }

  guardarToken(t: string) { localStorage.setItem('token', t); }
  obtenerToken() { return localStorage.getItem('token'); }
  cerrarSesion() { localStorage.removeItem('token'); }
  estaAutenticado() { return !!this.obtenerToken(); }

  /* ========== tablas ========== */
  getTablas(): Observable<TablasResponse> {
    return this.http.get<TablasResponse>(`${this.apiUrl}/tablas`, { headers: this.header() });
  }

  obtenerDatosTabla(owner: string, tableName: string): Observable<DatosTablaResponse> {
    return this.http.get<DatosTablaResponse>(`${this.apiUrl}/tabla`, {
      headers: this.header(),
      params: { owner, table_name: tableName }
    });
  }

  getTiposDeTabla(owner: string, tableName: string): Observable<TiposTablaResponse> {
    return this.http.get<TiposTablaResponse>(`${this.apiUrl}/types`, {
      headers: this.header(),
      params: { owner, table_name: tableName }
    });
  }

  insertarDatosTabla(
    owner: string,
    tableName: string,
    columns: string[],
    data: any[][]  // Asegúrate de que este parámetro coincida con lo que espera tu API
  ) {
    return this.http.post(
      `${this.apiUrl}/tabla`,
      { owner, table_name: tableName, columns, data },
      { headers: this.header() }
    );
  }

  /* ========== roles y privilegios ========== */
  getRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/rol`, { headers: this.header() });
  }

  getPrivilegios(): Observable<{ result: string[] }> {
    return this.http.get<{ result: string[] }>(`${this.apiUrl}/privilegios`, { headers: this.header() });
  }

  /* ========== COMANDOS SQL - ACTUALIZADOS ========== */
  
  // Comando SQL personalizado (corregido el endpoint)
  ejecutarComandoSQL(comando: string): Observable<SqlCommandResponse> {
    return this.http.post<SqlCommandResponse>(
      `${this.apiUrl}/script/ejecutar-personalizado`, 
      { query: comando }, 
      { headers: this.header() }
    );
  }

  // NUEVOS MÉTODOS PARA COMANDOS PREDEFINIDOS
  
  // Script de tiempo y tipos de datos
  ejecutarScriptTiempo(): Observable<SqlCommandResponse> {
    return this.http.get<SqlCommandResponse>(`${this.apiUrl}/script/tiempo`, { headers: this.header() });
  }

  // Total empleados HR
  ejecutarTotalEmpleadosHR(): Observable<SqlCommandResponse> {
    return this.http.get<SqlCommandResponse>(`${this.apiUrl}/script/total-empleados-hr`, { headers: this.header() });
  }

  // Fecha creación base de datos
  ejecutarFechaCreacionBase(): Observable<SqlCommandResponse> {
    return this.http.get<SqlCommandResponse>(`${this.apiUrl}/script/fecha-creacion-base`, { headers: this.header() });
  }
}
