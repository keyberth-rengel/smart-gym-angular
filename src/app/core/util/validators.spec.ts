import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ApiError } from '../http/api-error';
import {
  NOTE_MAX_LENGTH,
  applyServerErrors,
  dniValidator,
  errorMessage,
  percentValidator,
  timeValidator,
  weightValidator,
} from './validators';

const valid = (validator: (c: FormControl) => unknown, value: unknown) =>
  validator(new FormControl(value)) === null;

describe('validators', () => {
  describe('dniValidator', () => {
    it.each(['12345678', '00000000'])('acepta %s', (v) =>
      expect(valid(dniValidator, v)).toBe(true),
    );
    it.each(['1234567', '123456789', '1234567a', ' ', '12 45678'])('rechaza %s', (v) =>
      expect(valid(dniValidator, v)).toBe(false),
    );
    it('vacío es válido (lo cubre required)', () => {
      expect(valid(dniValidator, '')).toBe(true);
      expect(valid(dniValidator, null)).toBe(true);
    });
  });

  describe('weightValidator (0.1–400 kg)', () => {
    it.each([0.1, 74.5, 400, '74.5', '0.1'])('acepta %s', (v) =>
      expect(valid(weightValidator, v)).toBe(true),
    );
    it.each([0, 0.09, 400.01, -5, 'abc', '1e999', NaN])('rechaza %s', (v) =>
      expect(valid(weightValidator, v)).toBe(false),
    );
  });

  describe('percentValidator (0–100)', () => {
    it.each([0, 18.2, 100, '0', '100'])('acepta %s', (v) =>
      expect(valid(percentValidator, v)).toBe(true),
    );
    it.each([-0.1, 100.1, 101, 'x'])('rechaza %s', (v) =>
      expect(valid(percentValidator, v)).toBe(false),
    );
  });

  describe('timeValidator (HH:mm 24 h)', () => {
    it.each(['00:00', '09:05', '16:30', '23:59'])('acepta %s', (v) =>
      expect(valid(timeValidator, v)).toBe(true),
    );
    it.each(['24:00', '23:60', '7:30', '16:3', '1630', '16:30:00', 'ab:cd'])('rechaza %s', (v) =>
      expect(valid(timeValidator, v)).toBe(false),
    );
  });

  describe('nota (máx. 250)', () => {
    const control = (n: number) =>
      new FormControl('a'.repeat(n), Validators.maxLength(NOTE_MAX_LENGTH));
    it('250 caracteres es válido', () => expect(control(250).valid).toBe(true));
    it('251 caracteres es inválido', () => {
      const c = control(251);
      expect(c.valid).toBe(false);
      expect(errorMessage(c)).toBe('Máximo 250 caracteres.');
    });
  });

  describe('errorMessage', () => {
    it('null si el control es válido o no existe', () => {
      expect(errorMessage(new FormControl('ok'))).toBeNull();
      expect(errorMessage(null)).toBeNull();
    });

    it('traduce cada error a español', () => {
      const msg = (validators: never[] | unknown[], value: unknown) =>
        errorMessage(new FormControl(value, validators as never));
      expect(msg([Validators.required], '')).toBe('Este campo es obligatorio.');
      expect(msg([Validators.email], 'x')).toBe('Ingresa un correo válido.');
      expect(msg([dniValidator], '1')).toBe('El DNI debe tener 8 dígitos.');
      expect(msg([weightValidator], 500)).toBe('El peso debe estar entre 0.1 y 400 kg.');
      expect(msg([percentValidator], 101)).toBe('Debe estar entre 0 y 100.');
      expect(msg([timeValidator], '24:00')).toBe('Usa el formato HH:mm (24 h).');
      expect(msg([Validators.min(0)], -1)).toBe('Debe ser mayor o igual a 0.');
    });
  });

  describe('applyServerErrors', () => {
    it('marca los controles con el error del backend y devuelve los campos sin control', () => {
      const form = new FormGroup({ email: new FormControl(''), name: new FormControl('') });
      const error = new ApiError(400, 'BAD_REQUEST', 'x', {
        email: 'Ingresa un correo válido.',
        extra: 'algo',
      });
      const unmatched = applyServerErrors(form, error);
      expect(unmatched).toEqual(['extra']);
      expect(errorMessage(form.controls.email)).toBe('Ingresa un correo válido.');
      expect(form.controls.email.touched).toBe(true);
      expect(form.controls.name.errors).toBeNull();
    });
  });
});
