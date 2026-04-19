import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantillasForm } from './plantillas-form';

describe('PlantillasForm', () => {
  let component: PlantillasForm;
  let fixture: ComponentFixture<PlantillasForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlantillasForm],
    }).compileComponents();

    fixture = TestBed.createComponent(PlantillasForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
