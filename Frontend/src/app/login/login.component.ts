import { Component, OnInit, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  ngOnInit(): void {
    this.checkSavedCredentials();
  }

  ngAfterViewInit(): void {
    const loginForm = document.getElementById('loginForm') as HTMLFormElement;
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const emailError = document.getElementById('emailError') as HTMLElement;
    const passwordError = document.getElementById('passwordError') as HTMLElement;
    const togglePassword = document.getElementById('togglePassword') as HTMLElement;
    const rememberMeCheckbox = document.getElementById('rememberMe') as HTMLInputElement;

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

      if (!this.validateEmail(emailInput.value)) {
        emailError.textContent = 'Por favor, introduce un correo electrónico válido';
        this.animateError(emailInput);
        isValid = false;
      } else {
        emailError.textContent = '';
      }

      if (passwordInput.value.length < 6) {
        passwordError.textContent = 'La contraseña debe tener al menos 6 caracteres';
        this.animateError(passwordInput);
        isValid = false;
      } else {
        passwordError.textContent = '';
      }

      if (isValid) {
        if (rememberMeCheckbox.checked) {
          this.saveCredentials(emailInput.value, passwordInput.value);
        } else {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        }
        this.simulateLogin();
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

  saveCredentials(email: string, password: string): void {
    localStorage.setItem('savedEmail', email);
    localStorage.setItem('savedPassword', password);
    localStorage.setItem('rememberMe', 'true');
  }

  checkSavedCredentials(): void {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const rememberMeCheckbox = document.getElementById('rememberMe') as HTMLInputElement;

    const savedEmail = localStorage.getItem('savedEmail');
    const savedPassword = localStorage.getItem('savedPassword');
    const remembered = localStorage.getItem('rememberMe');

    if (savedEmail && savedPassword && remembered) {
      emailInput.value = savedEmail;
      passwordInput.value = savedPassword;
      rememberMeCheckbox.checked = true;
    }
  }

  simulateLogin(): void {
    const loginBtn = document.querySelector('.login-btn') as HTMLButtonElement;
    const originalText = loginBtn.textContent;

    loginBtn.textContent = 'Iniciando sesión...';
    loginBtn.disabled = true;

    setTimeout(() => {
      alert('¡Inicio de sesión exitoso!');
      loginBtn.textContent = originalText!;
      loginBtn.disabled = false;
    }, 1500);
  }
}
