import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ApiError } from '../http/api-error';

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

/** DNI: exactamente 8 dígitos. */
export const dniValidator: ValidatorFn = (c) =>
  isEmpty(c.value) || /^\d{8}$/.test(String(c.value).trim()) ? null : { dni: true };

/** Sin `<` ni `>` (el backend los rechaza en nombres). */
export const noAngleBracketsValidator: ValidatorFn = (c) =>
  isEmpty(c.value) || !/[<>]/.test(String(c.value)) ? null : { angleBrackets: true };

/** Número entero (sin decimales). */
export const integerValidator: ValidatorFn = (c) =>
  isEmpty(c.value) || /^-?\d+$/.test(String(c.value).trim()) ? null : { integer: true };

/** Hora HH:mm en formato de 24 h (00:00–23:59). */
export const timeValidator: ValidatorFn = (c) =>
  isEmpty(c.value) || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(c.value).trim())
    ? null
    : { time: true };

function rangeValidator(key: string, min: number, max: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    if (isEmpty(c.value)) return null;
    const text = String(c.value).trim();
    const n = Number(text);
    if (text === '' || !Number.isFinite(n) || n < min || n > max) return { [key]: true };
    return null;
  };
}

/** Peso en kg: entre 0.1 y 400 (ambos incluidos). */
export const weightValidator = rangeValidator('weight', 0.1, 400);

/** Porcentaje: entre 0 y 100 (ambos incluidos). */
export const percentValidator = rangeValidator('percent', 0, 100);

/** Longitud máxima de la nota de una reserva. */
export const NOTE_MAX_LENGTH = 250;

const MESSAGES: Record<string, (e: ValidationErrors) => string> = {
  required: () => 'Este campo es obligatorio.',
  email: () => 'Ingresa un correo válido.',
  dni: () => 'El DNI debe tener 8 dígitos.',
  angleBrackets: () => 'No puede contener los caracteres < o >.',
  integer: () => 'Ingresa un número entero.',
  time: () => 'Usa el formato HH:mm (24 h).',
  weight: () => 'El peso debe estar entre 0.1 y 400 kg.',
  percent: () => 'Debe estar entre 0 y 100.',
  min: (e) => `Debe ser mayor o igual a ${e['min']}.`,
  max: (e) => `Debe ser menor o igual a ${e['max']}.`,
  maxlength: (e) => `Máximo ${e['requiredLength']} caracteres.`,
  minlength: (e) => `Mínimo ${e['requiredLength']} caracteres.`,
  pattern: () => 'El formato no es válido.',
  server: (e) => String(e['server']),
};

/** Primer mensaje de error en español del control, o null si es válido. */
export function errorMessage(control: AbstractControl | null): string | null {
  const errors = control?.errors;
  if (!errors) return null;
  for (const key of Object.keys(errors)) {
    const build = MESSAGES[key];
    if (build) {
      const detail = errors[key];
      return build(typeof detail === 'object' && detail ? { ...errors, ...detail } : errors);
    }
  }
  return 'El valor no es válido.';
}

/**
 * Marca en los controles los errores de campo devueltos por el backend (400).
 * Devuelve los nombres de campo del error que no tienen control en el formulario.
 */
export function applyServerErrors(
  form: { get(path: string): AbstractControl | null },
  error: ApiError,
): string[] {
  const unmatched: string[] = [];
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: message });
      control.markAsTouched();
    } else {
      unmatched.push(field);
    }
  }
  return unmatched;
}
