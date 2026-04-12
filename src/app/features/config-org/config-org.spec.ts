import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigOrg } from './config-org';

describe('ConfigOrg', () => {
  let component: ConfigOrg;
  let fixture: ComponentFixture<ConfigOrg>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigOrg],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigOrg);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
