import { environment } from '#/environments/environment';
import { Injectable, inject } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import SockJS from 'sockjs-client';
import { AuthService } from '../../auth/services/auth.service';
import { DiagramNodeType, SocketOperationMessage } from '../interfaces/diagram.models';

@Injectable({
  providedIn: 'root',
})
export class DiagramSyncService {
  private stompClient!: Client;
  private sessionToken = '';
  private authService = inject(AuthService);

  public onMessage$ = new Subject<SocketOperationMessage>();
  public onConnectionState$ = new Subject<'CONNECTED' | 'DISCONNECTED'>();

  CONNECT(sessionToken: string): void {
    this.sessionToken = sessionToken;

    const token = this.authService.getToken();

    console.log('[SYNC][CONNECT] sessionToken=', sessionToken);

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${environment.BASE_URL}/ws-flowroad`),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      debug: (msg: string) => {
        if (!environment.production) {
          console.log('[STOMP]', msg);
        }
      },
    });

    this.stompClient.onConnect = () => {
      console.log('[SYNC][CONNECTED]');
      this.SUBSCRIBE_TO_TOPICS();
      this.onConnectionState$.next('CONNECTED');
    };

    this.stompClient.onStompError = (frame) => {
      console.error('[SYNC][STOMP ERROR]', frame);
    };

    this.stompClient.onWebSocketClose = () => {
      console.warn('[SYNC][WS CLOSED]');
      this.onConnectionState$.next('DISCONNECTED');
    };

    this.stompClient.activate();
  }

  private SUBSCRIBE_TO_TOPICS(): void {
    this.stompClient.subscribe(
      `/topic/session/${this.sessionToken}/cambios`,
      (message: Message) => {
        const payload = JSON.parse(message.body) as SocketOperationMessage;
        console.log('[SYNC][RECV]', payload.opType, payload.cellId, payload.dragId, payload);
        this.onMessage$.next(payload);
      },
    );
  }

  SEND_OPERATION(message: SocketOperationMessage): void {
    if (!this.stompClient?.connected) {
      console.warn('[SYNC][SEND_BLOCKED_NOT_CONNECTED]', message);
      return;
    }

    console.log('[SYNC][SEND]', message.opType, message.cellId, message.dragId, message);

    this.stompClient.publish({
      destination: `/app/session/${this.sessionToken}/operacion`,
      body: JSON.stringify(message),
    });
  }

  SEND_PING(userId: string, cursorX: number, cursorY: number): void {
    if (!this.stompClient?.connected) {
      console.warn('[SYNC][PING_BLOCKED_NOT_CONNECTED]');
      return;
    }

    const payload = {
      opType: 'CURSOR',
      cellId: 'cursor',
      delta: { x: cursorX, y: cursorY },
      userId,
    };

    this.stompClient.publish({
      destination: `/app/session/${this.sessionToken}/ping`,
      body: JSON.stringify(payload),
    });
  }

  LOCK_CELL(cellId: string, userId: string, dragId: string): void {
    this.SEND_OPERATION({
      opType: 'LOCK_CELL',
      cellId,
      delta: {},
      userId,
      dragId,
    });
  }

  UNLOCK_CELL(cellId: string, userId: string, dragId: string): void {
    this.SEND_OPERATION({
      opType: 'UNLOCK_CELL',
      cellId,
      delta: {},
      userId,
      dragId,
    });
  }

  CREATE_NODE(
    cellId: string,
    userId: string,
    x: number,
    y: number,
    laneId: string,
    nodeType: DiagramNodeType,
  ): void {
    const cell = this.buildNodeCell(cellId, x, y, laneId, nodeType);

    this.SEND_OPERATION({
      opType: 'CREATE_NODE',
      cellId,
      userId,
      delta: {
        cell,
      },
    });
  }

    UPDATE_NODE(
    cellId: string,
    userId: string,
    payload: {
      label: string;
      width?: number;
      height?: number;
      templateDocumentId?: string;
    },
    dragId?: string,
  ): void {
    this.SEND_OPERATION({
      opType: 'UPDATE_NODE',
      cellId,
      userId,
      dragId,
      delta: {
        ...(payload.width !== undefined && payload.height !== undefined
          ? {
              size: {
                width: payload.width,
                height: payload.height,
              },
            }
          : {}),
        attrs: {
          label: {
            text: payload.label,
            fill: '#111827',
          },
        },
        customData: {
          nombre: payload.label,
          ...(payload.templateDocumentId !== undefined
            ? { templateDocumentId: payload.templateDocumentId }
            : {}),
        },
      },
    });
  }

  MOVE_LIVE(cellId: string, userId: string, x: number, y: number, dragId: string): void {
    this.SEND_OPERATION({
      opType: 'MOVE_LIVE',
      cellId,
      userId,
      dragId,
      delta: { x, y },
    });
  }

  MOVE_COMMIT(
    cellId: string,
    userId: string,
    x: number,
    y: number,
    dragId: string,
    laneId?: string,
  ): void {
    this.SEND_OPERATION({
      opType: 'MOVE_COMMIT',
      cellId,
      userId,
      dragId,
      delta: {
        x,
        y,
        ...(laneId ? { laneId } : {}),
      },
    });
  }

  CREATE_LINK(linkId: string, sourceId: string, targetId: string, userId: string): void {
    this.SEND_OPERATION({
      opType: 'CREATE_LINK',
      cellId: linkId,
      userId,
      delta: {
        cell: {
          id: linkId,
          type: 'standard.Link',
          source: { id: sourceId },
          target: { id: targetId },
          attrs: {
            line: {
              stroke: '#334155',
              strokeWidth: 2,
            },
          },
          customData: {
            tipo: 'CONTROL_FLOW',
          },
        },
      },
    });
  }

  DELETE_CELL(cellId: string, userId: string, dragId?: string): void {
    this.SEND_OPERATION({
      opType: 'DELETE_CELL',
      cellId,
      userId,
      dragId,
      delta: {},
    });
  }

  DISCONNECT(): void {
    if (this.stompClient) {
      console.log('[SYNC][DISCONNECT]');
      this.stompClient.deactivate();
      this.onConnectionState$.next('DISCONNECTED');
    }
  }

  private buildNodeCell(
    cellId: string,
    x: number,
    y: number,
    laneId: string,
    nodeType: DiagramNodeType,
  ): Record<string, any> {
    switch (nodeType) {
      case 'INITIAL':
        return {
          id: cellId,
          type: 'standard.Circle',
          position: { x, y },
          size: { width: 36, height: 36 },
          attrs: {
            body: {
              fill: '#111827',
              stroke: '#111827',
              strokeWidth: 2,
            },
            label: {
              text: '',
            },
          },
          customData: {
            nombre: 'Inicio',
            tipo: 'INITIAL',
            laneId,
          },
        };

      case 'DECISION':
        return {
          id: cellId,
          type: 'standard.Polygon',
          position: { x, y },
          size: { width: 90, height: 90 },
          attrs: {
            body: {
              refPoints: '50,0 100,50 50,100 0,50',
              fill: '#ffffff',
              stroke: '#2563eb',
              strokeWidth: 2,
            },
            label: {
              text: 'Decisión',
              fill: '#111827',
            },
          },
          customData: {
            nombre: 'Decisión',
            tipo: 'DECISION',
            laneId,
          },
        };

      case 'FORK':
      case 'JOIN':
        return {
          id: cellId,
          type: 'standard.Rectangle',
          position: { x, y },
          size: { width: 160, height: 18 },
          attrs: {
            body: {
              fill: '#111827',
              stroke: '#111827',
              strokeWidth: 1,
              rx: 4,
              ry: 4,
            },
            label: {
              text: '',
            },
          },
          customData: {
            nombre: nodeType === 'FORK' ? 'Fork' : 'Join',
            tipo: nodeType,
            laneId,
          },
        };

      case 'FINAL':
        return {
          id: cellId,
          type: 'standard.Circle',
          position: { x, y },
          size: { width: 40, height: 40 },
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#111827',
              strokeWidth: 4,
            },
            label: {
              text: '',
            },
          },
          customData: {
            nombre: 'Final',
            tipo: 'FINAL',
            laneId,
          },
        };

      case 'ACTION':
      default:
        return {
          id: cellId,
          type: 'standard.Rectangle',
          position: { x, y },
          size: { width: 160, height: 60 },
          attrs: {
            body: {
              fill: '#ffffff',
              stroke: '#2563eb',
              strokeWidth: 2,
              rx: 12,
              ry: 12,
            },
            label: {
              text: 'Nueva Actividad',
              fill: '#111827',
            },
          },
          customData: {
            nombre: 'Nueva Actividad',
            tipo: 'ACTION',
            laneId,
          },
        };
    }
  }
}