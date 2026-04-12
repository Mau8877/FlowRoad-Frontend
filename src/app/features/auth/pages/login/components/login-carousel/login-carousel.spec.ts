import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginCarousel } from './login-carousel';

describe('LoginCarousel', () => {
  let component: LoginCarousel;
  let fixture: ComponentFixture<LoginCarousel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginCarousel],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginCarousel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
