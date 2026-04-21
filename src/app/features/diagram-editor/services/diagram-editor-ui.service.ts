import { Injectable, inject, signal } from '@angular/core';
import { EditorSettingsSubmitPayload } from '../components/editor-settings-popover/editor-settings-popover';
import { DiagramService } from './diagram.service';

@Injectable()
export class DiagramEditorUiService {
  private readonly diagramService = inject(DiagramService);

  public diagramName = signal('Diagrama de actividades');
  public diagramDescription = signal('');
  public isSettingsOpen = signal(false);
  public isDebugOpen = signal(false);
  public isSavingSettings = signal(false);

  openDebugModal(): void {
    this.isDebugOpen.set(true);
  }

  closeDebugModal(): void {
    this.isDebugOpen.set(false);
  }

  toggleSettingsPopover(): void {
    this.isSettingsOpen.update((value) => !value);
  }

  closeSettingsPopover(): void {
    this.isSettingsOpen.set(false);
  }

  setMetadata(name: string, description: string): void {
    this.diagramName.set(name || 'Diagrama de actividades');
    this.diagramDescription.set(description || '');
  }

  saveDiagramSettings(
    diagramId: string,
    payload: EditorSettingsSubmitPayload,
    onSuccess?: () => void,
    onError?: () => void,
  ): void {
    this.isSavingSettings.set(true);

    this.diagramService.UPDATE_METADATA(diagramId, payload.name, payload.description).subscribe({
      next: () => {
        this.diagramName.set(payload.name);
        this.diagramDescription.set(payload.description);
        this.isSavingSettings.set(false);
        this.isSettingsOpen.set(false);
        onSuccess?.();
      },
      error: (error) => {
        console.error(error);
        this.isSavingSettings.set(false);
        onError?.();
      },
    });
  }
}
