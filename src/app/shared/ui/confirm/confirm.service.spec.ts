import { TestBed } from '@angular/core/testing';
import { ConfirmDialog } from './confirm-dialog';
import { ConfirmService } from './confirm.service';

describe('ConfirmService', () => {
  let service: ConfirmService;
  beforeEach(() => (service = TestBed.inject(ConfirmService)));

  it('publica la petición con valores por defecto y se resuelve al confirmar', async () => {
    const p = service.confirm({ title: 'T', message: 'M' });
    await Promise.resolve();
    expect(service.request()?.options).toEqual({
      title: 'T',
      message: 'M',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Volver',
      danger: false,
    });
    service.settle(true);
    await expect(p).resolves.toBe(true);
    expect(service.request()).toBeNull();
  });

  it('se resuelve false al cancelar', async () => {
    const p = service.confirm({ title: 'T', message: 'M', danger: true });
    await Promise.resolve();
    expect(service.request()?.options.danger).toBe(true);
    service.settle(false);
    await expect(p).resolves.toBe(false);
  });

  it('atiende las peticiones en orden', async () => {
    const a = service.confirm({ title: 'A', message: '' });
    const b = service.confirm({ title: 'B', message: '' });
    await Promise.resolve();
    expect(service.request()?.options.title).toBe('A');
    service.settle(true);
    await a;
    await Promise.resolve();
    await Promise.resolve();
    expect(service.request()?.options.title).toBe('B');
    service.settle(false);
    await expect(b).resolves.toBe(false);
  });
});

describe('ConfirmDialog', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const service = TestBed.inject(ConfirmService);
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
    // jsdom no implementa <dialog>: se simula lo mínimo de su API
    dialog.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialog.close = function (this: HTMLDialogElement, value?: string) {
      this.removeAttribute('open');
      if (value !== undefined) this.returnValue = value;
      this.dispatchEvent(new Event('close'));
    };
    return { fixture, service, dialog, el: fixture.nativeElement as HTMLElement };
  }
  const open = async (f: Awaited<ReturnType<typeof setup>>, danger = false) => {
    const p = f.service.confirm({
      title: 'Titulo',
      message: 'Mensaje',
      danger,
      confirmLabel: 'Sí',
    });
    await Promise.resolve();
    f.fixture.detectChanges();
    await f.fixture.whenStable();
    return p;
  };

  it('abre el diálogo con el título, mensaje y etiqueta de confirmar', async () => {
    const f = await setup();
    const p = open(f);
    await new Promise((r) => setTimeout(r));
    expect(f.dialog.hasAttribute('open')).toBe(true);
    expect(f.el.querySelector('#confirm-title')?.textContent).toContain('Titulo');
    expect(f.el.querySelector('[data-testid=confirm-accept]')?.textContent).toContain('Sí');
    f.service.settle(false);
    await p;
  });

  it('confirmar resuelve true; el botón normal es primario', async () => {
    const f = await setup();
    const p = open(f);
    await new Promise((r) => setTimeout(r));
    const accept = f.el.querySelector<HTMLButtonElement>('[data-testid=confirm-accept]')!;
    expect(accept.classList.contains('btn-primary')).toBe(true);
    accept.click();
    await expect(p).resolves.toBe(true);
  });

  it('volver resuelve false; danger usa botón rojo', async () => {
    const f = await setup();
    const p = open(f, true);
    await new Promise((r) => setTimeout(r));
    expect(
      f.el.querySelector('[data-testid=confirm-accept]')?.classList.contains('btn-outline-danger'),
    ).toBe(true);
    f.el.querySelector<HTMLButtonElement>('[data-testid=confirm-cancel]')!.click();
    await expect(p).resolves.toBe(false);
  });

  it('Esc (cierre nativo sin valor) resuelve false', async () => {
    const f = await setup();
    const p = open(f);
    await new Promise((r) => setTimeout(r));
    f.dialog.close();
    await expect(p).resolves.toBe(false);
  });

  it('clic en el fondo cancela', async () => {
    const f = await setup();
    const p = open(f);
    await new Promise((r) => setTimeout(r));
    f.dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect(p).resolves.toBe(false);
  });
});
