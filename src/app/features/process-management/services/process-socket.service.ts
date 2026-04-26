import { environment } from '#/environments/environment';
import { Injectable, inject } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import SockJS from 'sockjs-client';

import { AuthService } from '../../auth/services/auth.service';
import { ProcessAssignmentNotification } from '../interfaces/process-assignment-notification.model';
import { ProcessInstanceNotification } from '../interfaces/process-instance-notification.model';

@Injectable({
  providedIn: 'root',
})
export class ProcessSocketService {
  private stompClient!: Client;
  private authService = inject(AuthService);

  public onAssignmentNotification$ = new Subject<ProcessAssignmentNotification>();
  public onProcessInstanceNotification$ = new Subject<ProcessInstanceNotification>();
  public onConnectionState$ = new Subject<'CONNECTED' | 'DISCONNECTED'>();

  CONNECT(): void {
    const token = this.authService.getToken();

    if (!token) {
      console.warn('[PROCESS-WS][CONNECT_BLOCKED_NO_TOKEN]');
      return;
    }

    if (this.stompClient?.connected) {
      console.log('[PROCESS-WS][ALREADY_CONNECTED]');
      return;
    }

    const socketUrl = `${environment.BASE_URL}/ws-processes`;

    console.log('[PROCESS-WS][CONNECT]', socketUrl);

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(socketUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      debug: (msg: string) => {
        if (!environment.production) {
          console.log('[PROCESS-STOMP]', msg);
        }
      },
    });

    this.stompClient.onConnect = () => {
      console.log('[PROCESS-WS][CONNECTED]');
      this.SUBSCRIBE_TO_TOPICS();
      this.onConnectionState$.next('CONNECTED');
    };

    this.stompClient.onStompError = (frame) => {
      console.error('[PROCESS-WS][STOMP ERROR]', frame);
    };

    this.stompClient.onWebSocketClose = () => {
      console.warn('[PROCESS-WS][WS CLOSED]');
      this.onConnectionState$.next('DISCONNECTED');
    };

    this.stompClient.activate();
  }

  private SUBSCRIBE_TO_TOPICS(): void {
    this.subscribeToAssignmentQueue();
    this.subscribeToProcessInstanceTopic();
  }

  private subscribeToAssignmentQueue(): void {
    this.stompClient.subscribe('/user/queue/process-assignments', (message: Message) => {
      try {
        const payload = JSON.parse(message.body) as ProcessAssignmentNotification;

        console.log('[PROCESS-WS][RECV_ASSIGNMENT]', payload);

        this.onAssignmentNotification$.next(payload);
      } catch (error) {
        console.error('[PROCESS-WS][PARSE_ASSIGNMENT_ERROR]', error, message.body);
      }
    });
  }

  private subscribeToProcessInstanceTopic(): void {
    const orgId = this.authService.currentUser()?.orgId;

    if (!orgId) {
      console.warn('[PROCESS-WS][PROCESS_TOPIC_BLOCKED_NO_ORG]');
      return;
    }

    const destination = `/topic/process-instances/org/${orgId}`;

    this.stompClient.subscribe(destination, (message: Message) => {
      try {
        const payload = JSON.parse(message.body) as ProcessInstanceNotification;

        console.log('[PROCESS-WS][RECV_PROCESS_INSTANCE]', payload);

        this.onProcessInstanceNotification$.next(payload);
      } catch (error) {
        console.error('[PROCESS-WS][PARSE_PROCESS_INSTANCE_ERROR]', error, message.body);
      }
    });

    console.log('[PROCESS-WS][SUBSCRIBED_PROCESS_TOPIC]', destination);
  }

  DISCONNECT(): void {
    if (this.stompClient) {
      console.log('[PROCESS-WS][DISCONNECT]');
      this.stompClient.deactivate();
      this.onConnectionState$.next('DISCONNECTED');
    }
  }
}
