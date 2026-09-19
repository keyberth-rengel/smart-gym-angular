import { Component } from '@angular/core';
import { PlaceholderHome } from '../../../shared/ui/placeholder-home/placeholder-home';

@Component({
  selector: 'app-cliente-home',
  imports: [PlaceholderHome],
  template: `<app-placeholder-home title="Inicio del cliente" />`,
})
export class ClienteHome {}
