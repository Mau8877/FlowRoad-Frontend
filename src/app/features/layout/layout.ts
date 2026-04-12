import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router'; // 👈 Fundamental
import { Sidebar } from './components/sidebar/sidebar'; // Ajusta las rutas
import { Header } from './components/header/header';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Header], // 👈 Registra tus piezas aquí
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {}
