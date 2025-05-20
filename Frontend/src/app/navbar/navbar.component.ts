import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  nombreUsuario: string | null = null;
  roles: string[] = [];
  privilegios: string[] = [];
  mostrarPrivilegios = false;
  error = '';

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.nombreUsuario = this.extraerNombreUsuario();
    this.cargarRoles();
    this.cargarPrivilegios();
  }

  extraerNombreUsuario(): string | null {
    const token = this.auth.obtenerToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user || null;
    } catch {
      return null;
    }
  }

  cargarRoles(): void {
    this.auth.getRoles().subscribe({
      next: (roles) => this.roles = roles,
      error: (e: HttpErrorResponse) => {
        this.error = 'Error cargando roles';
        console.error(e);
      }
    });
  }

  cargarPrivilegios(): void {
    this.auth.getPrivilegios().subscribe({
      next: (res) => this.privilegios = res.result || [],
      error: (e: HttpErrorResponse) => {
        this.error = 'Error cargando privilegios';
        console.error(e);
      }
    });
  }

  togglePrivilegios(): void {
    this.mostrarPrivilegios = !this.mostrarPrivilegios;
  }

  logout(): void {
    this.auth.cerrarSesion();
    window.location.href = '/login'; // Ajusta esta ruta según tu configuración de rutas
  }
}
