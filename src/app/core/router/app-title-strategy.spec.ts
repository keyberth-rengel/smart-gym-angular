import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { AppTitleStrategy } from './app-title-strategy';

@Component({ template: '' })
class Empty {}

describe('AppTitleStrategy', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', title: 'Mi Rutina', component: Empty },
          { path: 'b', title: 'Reservas', component: Empty },
          { path: 'sin-titulo', component: Empty },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
    return { router: TestBed.inject(Router), title: TestBed.inject(Title) };
  }

  it('pone "<pantalla> · SmartGym" con el título de la ruta', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/a');
    expect(title.getTitle()).toBe('Mi Rutina · SmartGym');
    await router.navigateByUrl('/b');
    expect(title.getTitle()).toBe('Reservas · SmartGym');
  });

  it('sin título de ruta deja solo "SmartGym"', async () => {
    const { router, title } = setup();
    await router.navigateByUrl('/sin-titulo');
    expect(title.getTitle()).toBe('SmartGym');
  });
});
