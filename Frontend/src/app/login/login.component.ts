import { Component, OnInit, AfterViewInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, AfterViewInit {
  user = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    const loginForm = document.getElementById('loginForm') as HTMLFormElement;
    const userInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const emailError = document.getElementById('emailError') as HTMLElement;
    const passwordError = document.getElementById('passwordError') as HTMLElement;
    const togglePassword = document.getElementById('togglePassword') as HTMLElement;

    togglePassword.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePassword.classList.remove('fa-eye');
        togglePassword.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        togglePassword.classList.remove('fa-eye-slash');
        togglePassword.classList.add('fa-eye');
      }
    });

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      let isValid = true;

      if (!userInput.value.trim()) {
        emailError.textContent = 'Por favor, introduce tu usuario de Oracle';
        this.animateError(userInput);
        isValid = false;
      } else {
        emailError.textContent = '';
      }

      if (!passwordInput.value.trim()) {
        passwordError.textContent = 'Por favor, introduce la contraseña';
        this.animateError(passwordInput);
        isValid = false;
      }
      else {
        passwordError.textContent = '';
      }

      if (isValid) {
        this.user = userInput.value;
        this.password = passwordInput.value;

        // Eliminadas referencias a rememberMe

        this.realLogin();
      }
    });

    const style = document.createElement('style');
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      .shake {
        animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
      }
    `;
    document.head.appendChild(style);

    const inputFields = document.querySelectorAll('.input-field input');
    inputFields.forEach(input => {
      input.addEventListener('focus', () => {
        (input as HTMLInputElement).parentElement!.style.borderColor = '#667eea';
      });

      input.addEventListener('blur', () => {
        if (!(input as HTMLInputElement).value) {
          (input as HTMLInputElement).parentElement!.style.borderColor = '#ddd';
        }
      });
    });

    const socialButtons = document.querySelectorAll('.social-btn');
    socialButtons.forEach(button => {
      button.addEventListener('click', () => {
        alert(`Inicio de sesión con ${button.textContent!.trim()} no implementado en este ejemplo.`);
      });
    });
  }

  validateEmail(email: string): boolean {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}(\.[0-9]{1,3}){3}])|(([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email.toLowerCase());
  }

  animateError(element: HTMLInputElement): void {
    const parent = element.parentElement!;
    parent.classList.add('shake');
    parent.style.borderColor = '#e74c3c';

    setTimeout(() => {
      parent.classList.remove('shake');
    }, 500);

    element.addEventListener('input', () => {
      parent.style.borderColor = '#ddd';
    }, { once: true });
  }

  // Eliminados métodos relacionados a guardar/checkear credenciales

  realLogin(): void {
    const loginBtn = document.querySelector('.login-btn') as HTMLButtonElement;
    const originalText = loginBtn.textContent;

    loginBtn.textContent = 'Iniciando sesión...';
    loginBtn.disabled = true;

    this.authService.login(this.user, this.password).subscribe({
      next: (res) => {
        this.authService.guardarToken(res.token);
        loginBtn.textContent = originalText!;
        loginBtn.disabled = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Error al iniciar sesión';
        loginBtn.textContent = originalText!;
        loginBtn.disabled = false;
        alert(this.errorMessage);
      }
    });
  }
}
