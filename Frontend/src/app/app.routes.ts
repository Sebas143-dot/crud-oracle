import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { EjecutarCodigoComponent } from './ejecutar-codigo/ejecutar-codigo.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'ejecutar-codigo', component: EjecutarCodigoComponent, canActivate: [authGuard] },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];