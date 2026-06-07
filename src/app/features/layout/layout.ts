import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Sidebar } from './components/sidebar/sidebar';
import { Header } from './components/header/header';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Header],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private readonly router = inject(Router);

  isFullscreenEditorRoute(): boolean {
    return /^\/document-management\/[^/]+\/documents\/[^/]+\/editor(?:[?#].*)?$/.test(
      this.router.url,
    );
  }
}
