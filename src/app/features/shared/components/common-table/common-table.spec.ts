import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommonTable } from './common-table';

describe('CommonTable', () => {
  let component: CommonTable;
  let fixture: ComponentFixture<CommonTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonTable],
    }).compileComponents();

    fixture = TestBed.createComponent(CommonTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
