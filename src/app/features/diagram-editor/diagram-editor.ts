import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as joint from '@joint/core';

import { AuthService } from '#/app/features/auth/services/auth.service';
import { DiagramSyncService } from './services/diagram-sync.service';
import { DiagramService } from './services/diagram.service';

@Component({
  selector: 'app-diagram-editor',
  standalone: true,
  templateUrl: './diagram-editor.html',
  styleUrls: ['./diagram-editor.css'],
})
export class DiagramEditor implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: false }) canvasContainer!: ElementRef;

  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;

  // Inyección de dependencias moderna
  private diagramService = inject(DiagramService);
  private syncService = inject(DiagramSyncService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  private currentUserId = '';

  ngOnInit(): void {
    const user = this.authService.currentUser();

    if (user) {
      this.currentUserId = user.id;
    } else {
      console.warn('No hay usuario logueado en el Signal');
      this.currentUserId = 'usuario-anonimo';
    }
  }

  ngAfterViewInit(): void {
    this.initializeJointJS();
    this.setupSocketListeners();
    this.joinDiagramSession();
  }

  ngOnDestroy(): void {
    console.log('cleanup: Cerrando sesión de diseño...');

    // 1. Detener la sincronización
    this.syncService.DISCONNECT();

    // 2. Limpiar el grafo de JointJS para liberar memoria RAM
    this.graph.clear();

    // 3. (Opcional) Si usas un intervalo para el PING de los cursores, cancélalo aquí
    // clearInterval(this.pingInterval);
  }

  /**
   * 1. INICIALIZA EL LIENZO VACÍO
   */
  private initializeJointJS(): void {
    this.graph = new joint.dia.Graph({}, { cellNamespace: joint.shapes });

    this.paper = new joint.dia.Paper({
      el: this.canvasContainer.nativeElement,
      model: this.graph,
      width: '100%',
      height: 700,
      gridSize: 10,
      drawGrid: { name: 'dot', args: { color: '#cbd5e1' } },
      background: { color: '#f8fafc' },
      cellViewNamespace: joint.shapes,
      linkPinning: false,
      snapLinks: { radius: 20 },
      interactive: true,
      defaultLink: () =>
        new joint.shapes.standard.Link({
          attrs: {
            line: {
              stroke: '#626266',
              strokeWidth: 2,
              targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 Z' },
            },
          },
          router: { name: 'manhattan' },
        }),
    });

    // ==========================================
    // EMISIÓN DE EVENTOS (Frontend -> Backend)
    // ==========================================

    // VÍA RÁPIDA: Mientras se arrastra (Bypass)
    this.graph.on('change:position', (cell: any, newPosition: any, opt: any) => {
      // Si el movimiento vino del socket, no lo reenviamos para evitar loops
      if (opt && opt.fromServer) return;

      if (cell.isElement()) {
        this.syncService.SEND_LIVE_MOVEMENT(cell.id, newPosition.x, newPosition.y);
      }
    });

    // VÍA OFICIAL: Al soltar el click (Guardar en Mongo)
    this.paper.on('element:pointerup', (elementView: any) => {
      const cell = elementView.model;
      const pos = cell.position();

      this.syncService.SAVE_OFFICIAL_MOVEMENT(cell.id, pos.x, pos.y, this.currentUserId);
    });
  }

  /**
   * 2. ENTRAR A LA SALA Y CARGAR DIAGRAMA
   */
  private joinDiagramSession(): void {
    const diagramId = this.route.snapshot.paramMap.get('id');
    if (!diagramId) return;

    this.diagramService.JOIN_SESSION(diagramId).subscribe({
      next: (response) => {
        // 1. Cargamos el JSON inicial en el lienzo
        try {
          const cellsData = JSON.parse(response.snapshot);
          if (cellsData && cellsData.length > 0) {
            // Limpiamos lo que haya (incluyendo el hardcodeado de prueba)
            this.graph.clear();

            // Cargamos el estado real que vino de Atlas
            this.graph.fromJSON({ cells: cellsData });
            console.log('✅ Grafo sincronizado con Atlas');
          } else {
            // Solo si la sala es totalmente nueva creamos el 'Inicio'
            this.createUMLActivity(100, 150, 'Inicio', 'act-1');
          }
        } catch (e) {
          console.error('Error parseando el snapshot:', e);
        }

        // 2. Nos conectamos al WebSocket de alta velocidad
        this.syncService.CONNECT(response.sessionToken);
      },
      error: (err) => console.error('Error al entrar a la sesión:', err),
    });
  }

  /**
   * 3. ESCUCHAR LOS MOVIMIENTOS DE OTROS
   */
  private setupSocketListeners(): void {
    this.syncService.onNodeMoved$.subscribe((msg: any) => {
      // { opType: 'MOVE_LIVE', nodeId: 'act-1', delta: { x: 150, y: 200 } }
      if (msg.opType === 'MOVE_LIVE' || msg.opType === 'MOVE') {
        const cell = this.graph.getCell(msg.nodeId);
        if (cell && cell.isElement()) {
          // El flag 'fromServer: true' rompe el bucle infinito
          cell.position(msg.delta.x, msg.delta.y, { fromServer: true });
        }
      }
    });
  }

  // Helper para crear cajas manualmente (Si el diagrama es nuevo)
  private createUMLActivity(x: number, y: number, labelText: string, id: string): void {
    const rect = new joint.shapes.standard.Rectangle();
    rect.set('id', id);
    rect.position(x, y);
    rect.resize(160, 60);
    rect.prop('ports', {
      groups: {
        in: { position: 'left', attrs: { circle: { fill: '#3b82f6', r: 5, magnet: 'passive' } } },
        out: { position: 'right', attrs: { circle: { fill: '#ef4444', r: 5, magnet: true } } },
      },
    });
    rect.addPort({ group: 'in', id: 'p-in', attrs: { text: { text: 'In' } } });
    rect.addPort({ group: 'out', id: 'p-out', attrs: { text: { text: 'Out' } } });
    rect.attr({
      body: { fill: '#ffffff', stroke: '#541f14', strokeWidth: 2, rx: 20, ry: 20 },
      label: { text: labelText, fill: '#020304', fontSize: 13, fontWeight: '500' },
    });
    rect.addTo(this.graph);
  }
}
