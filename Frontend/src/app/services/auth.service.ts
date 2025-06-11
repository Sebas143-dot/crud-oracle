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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3000/api';

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
    data: any[][]
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

  /* ========== ejecutar comando SQL ========== */
  ejecutarComandoSQL(comando: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/ejecutar-comando`, { comando }, { headers: this.header() });
  }
}
