import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  Calendar,
  Camera,
  ChevronDown,
  Hash,
  List,
  LUCIDE_ICONS,
  LucideAngularModule,
  LucideIconProvider,
  Paperclip,
  Plus,
  Type,
} from 'lucide-angular';

@Component({
  selector: 'app-field-preview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './field-preview.html',
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Camera,
        ChevronDown,
        Calendar,
        Type,
        List,
        Hash,
        Paperclip,
        Plus,
      }),
    },
  ],
})
export class FieldPreview {
  @Input({ required: true }) type!: string;
  @Input() label = '';
  @Input() isPreview = false;
  @Input() required = false;
  @Input() options: any[] = [];
}
