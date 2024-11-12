import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerminalTabComponent } from './terminal-tab.component';

describe('TerminalTabComponent', () => {
  let component: TerminalTabComponent;
  let fixture: ComponentFixture<TerminalTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminalTabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerminalTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
