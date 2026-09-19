import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiPlayground } from './api-playground';

describe('ApiPlayground', () => {
  it('se crea y muestra los controles de prueba', async () => {
    await TestBed.configureTestingModule({
      imports: [ApiPlayground],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ApiPlayground);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="health"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="result"]')?.textContent).toContain('Sin resultados');
  });
});
