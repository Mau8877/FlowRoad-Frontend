import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiagramEditor } from './diagram-editor';

describe('DiagramEditor', () => {
  let component: DiagramEditor;
  let fixture: ComponentFixture<DiagramEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
