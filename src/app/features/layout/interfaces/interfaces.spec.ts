import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Interfaces } from './interfaces';

describe('Interfaces', () => {
  let component: Interfaces;
  let fixture: ComponentFixture<Interfaces>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Interfaces],
    }).compileComponents();

    fixture = TestBed.createComponent(Interfaces);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
