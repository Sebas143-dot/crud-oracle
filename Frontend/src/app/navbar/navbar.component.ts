import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { LayoutControlService } from '../services/layout-control.service';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {

  nombreUsuario: string | null = null;
  roles: string[] = [];
  privilegios: string[] = [];
  mostrarPrivilegios = false;
  mostrarComando = false;
  comando: string = '';
  resultadoComando: string | null = null;
  error = '';

  constructor(
    private auth: AuthService,
    private layoutService: LayoutControlService // NUEVA INYECCIÓN
  ) { }

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

  // MÉTODO MODIFICADO
  toggleComando(): void {
    this.mostrarComando = !this.mostrarComando;

    // Si se abre el comando, activar panel en dashboard
    if (this.mostrarComando) {
      this.layoutService.activatesSqlPanel(this.comando);
    }
  }

  // MÉTODO MODIFICADO
  ejecutarComando(): void {
    if (this.comando.trim()) {
      // Cerrar dropdown del navbar y activar panel en dashboard
      this.mostrarComando = false;
      this.layoutService.activatesSqlPanel(this.comando);

      this.auth.ejecutarComandoSQL(this.comando).subscribe({
        next: (res) => this.resultadoComando = res.output ?? null,
        error: (e: HttpErrorResponse) => {
          this.error = 'Error ejecutando el comando';
          console.error(e);
        }
      });
    } else {
      this.error = 'Por favor, ingrese un comando SQL';
    }
  }

  logout(): void {
    this.auth.cerrarSesion();
    window.location.href = '/login';
  }
}