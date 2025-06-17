import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { EjecutarCodigoComponent } from './ejecutar-codigo/ejecutar-codigo.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'ejecutar-codigo', component: EjecutarCodigoComponent },
  { path: '', redirectTo: '/ejecutar-codigo', pathMatch: 'full' }
];