import { Component } from '@angular/core';
import { PlaceholderHome } from '../../../shared/ui/placeholder-home/placeholder-home';

@Component({
  selector: 'app-admin-home',
  imports: [PlaceholderHome],
  template: `<app-placeholder-home title="Inicio de administración" />`,
})
export class AdminHome {}
