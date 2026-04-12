import { Component } from '@angular/core';
import { LoginCarousel } from './components/login-carousel/login-carousel';
import { LoginModal } from './components/login-modal/login-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginCarousel, LoginModal],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {}
