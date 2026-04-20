import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionDiagramas } from './gestion-diagramas';

describe('GestionDiagramas', () => {
  let component: GestionDiagramas;
  let fixture: ComponentFixture<GestionDiagramas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionDiagramas],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionDiagramas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
