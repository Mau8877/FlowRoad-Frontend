import { environment } from '#/environments/environment';
import { Injectable, inject } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import SockJS from 'sockjs-client';
import { AuthService } from '../../auth/services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class DiagramSyncService {
  private stompClient!: Client;
  private sessionToken = '';
  private authService = inject(AuthService);

  // Observables para que JointJS escuche
  public onNodeMoved$ = new Subject<any>();
  public onUserJoined$ = new Subject<any>();

  /**
   * 1. Conectar al Broker STOMP
   */
  CONNECT(sessionToken: string): void {
    this.sessionToken = sessionToken;

    // Obtenemos el token desde el CookieService (vía AuthService)
    // O directamente del signal si prefieres: this.authService.getToken()
    // Pero como tu AuthService usa cookies, lo más seguro es:
    const token =
      this.authService.getToken?.() ||
      document.cookie
        .split('; ')
        .find((row) => row.startsWith('auth_token='))
        ?.split('=')[1];

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(environment.BASE_URL + '/ws-flowroad'),
      connectHeaders: {
        // IMPORTANTE: Aquí pasamos el token real
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      debug: (msg: string) => {
        if (!environment.production) console.log(msg);
      },
    });

    this.stompClient.onConnect = () => {
      console.log(`[STOMP] Conectado con Identidad: ${this.authService.currentUser()?.email}`);
      this.SUBSCRIBE_TO_TOPICS();
    };

    this.stompClient.activate();
  }

  /**
   * 2. Suscribirse a los tópicos de respuesta
   */
  private SUBSCRIBE_TO_TOPICS(): void {
    this.stompClient.subscribe(
      `/topic/session/${this.sessionToken}/cambios`,
      (message: Message) => {
        const payload = JSON.parse(message.body);
        this.onNodeMoved$.next(payload);
      },
    );
  }

  /**
   * 3. VÍA RÁPIDA: Bypass de movimiento (Se llama al arrastrar)
   */
  SEND_LIVE_MOVEMENT(nodeId: string, x: number, y: number): void {
    if (!this.stompClient?.connected) return;

    const payload = { opType: 'MOVE_LIVE', nodeId, delta: { x, y } };

    this.stompClient.publish({
      destination: `/topic/session/${this.sessionToken}/cambios`,
      body: JSON.stringify(payload),
    });
  }

  /**
   * 4. VÍA OFICIAL: Guardado en BD (Se llama en el pointerup)
   */
  SAVE_OFFICIAL_MOVEMENT(nodeId: string, x: number, y: number, userId: string): void {
    if (!this.stompClient?.connected) return;

    const payload = { opType: 'MOVE', nodeId, delta: { x, y }, userId };

    this.stompClient.publish({
      destination: `/app/session/${this.sessionToken}/operacion`,
      body: JSON.stringify(payload),
    });
  }

  /**
   * 5. Ping de mantenimiento (Opcional, si usas el scheduler)
   */
  SEND_PING(userId: string, cursorX: number, cursorY: number): void {
    if (!this.stompClient?.connected) return;

    const payload = { opType: 'PING', userId, delta: { x: cursorX, y: cursorY } };

    this.stompClient.publish({
      destination: `/app/session/${this.sessionToken}/ping`,
      body: JSON.stringify(payload),
    });
  }

  /**
   * 6. Desconectar al salir de la pantalla
   */
  public DISCONNECT(): void {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.deactivate();
      console.log('🔌 Conexión de WebSocket cerrada manualmente.');
    }
  }
}
