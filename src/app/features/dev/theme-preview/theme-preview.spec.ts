import { TestBed } from '@angular/core/testing';
import { ThemePreview } from './theme-preview';

describe('ThemePreview', () => {
  it('should render the brand', async () => {
    await TestBed.configureTestingModule({ imports: [ThemePreview] }).compileComponents();
    const fixture = TestBed.createComponent(ThemePreview);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('SMARTGYM');
  });
});
