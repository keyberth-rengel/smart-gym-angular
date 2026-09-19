/** Traducción al español de los mensajes conocidos del backend (que responde en inglés). */

interface Rule {
  pattern: RegExp;
  text: string | ((m: RegExpExecArray) => string);
}

const MESSAGE_RULES: Rule[] = [
  {
    pattern: /^Trainer already has a booking/i,
    text: 'Ese horario ya está ocupado para este entrenador. Elige otra hora.',
  },
  {
    pattern: /^Bookings in the past/i,
    text: 'No se pueden crear reservas en horas que ya pasaron.',
  },
  {
    pattern: /^DNI not linked/i,
    text: 'Este DNI no está vinculado a ninguna cuenta de SmartGym.',
  },
  { pattern: /^Customer already exists/i, text: 'Ya existe un cliente con ese correo.' },
  { pattern: /^Trainer already exists/i, text: 'Ya existe un entrenador con ese correo.' },
  {
    pattern: /^Customer (not found|does not exist)/i,
    text: 'No encontramos un cliente con esos datos.',
  },
  {
    pattern: /^Trainer (not found|does not exist)/i,
    text: 'No encontramos un entrenador con esos datos.',
  },
  { pattern: /^Booking not found/i, text: 'La reserva no existe o ya fue cancelada.' },
  { pattern: /^No active routine/i, text: 'Aún no hay una rutina activa.' },
  { pattern: /^No enum constant/i, text: 'El día indicado no es válido.' },
  { pattern: /^Weight must be/i, text: 'El peso debe estar entre 0.1 y 400 kg.' },
  {
    pattern: /^Body fat percentage must be/i,
    text: 'La grasa corporal debe estar entre 0 y 100 %.',
  },
  { pattern: /^Muscle percentage must be/i, text: 'El músculo debe estar entre 0 y 100 %.' },
  {
    pattern: /^Conflict with existing data/i,
    text: 'Ya existe un registro con esos datos (por ejemplo, un progreso ya registrado hoy).',
  },
  {
    pattern: /^Identity not recognized/i,
    text: 'Tu identidad no está reconocida como cliente ni entrenador.',
  },
  { pattern: /^Incomplete data/i, text: 'Faltan datos para completar la operación.' },
  { pattern: /^Validation failed/i, text: 'Revisa los datos ingresados.' },
  { pattern: /^Malformed JSON/i, text: 'No se pudo leer la información enviada.' },
  { pattern: /^(Route|Resource) not found/i, text: 'No encontramos lo que buscas.' },
];

const FIELD_RULES: Rule[] = [
  { pattern: /must not be blank|must not be null/i, text: 'Este campo es obligatorio.' },
  { pattern: /well-formed email|Invalid .*email/i, text: 'Ingresa un correo válido.' },
  {
    pattern: /must be greater than or equal to (-?\d+(?:\.\d+)?)/i,
    text: (m) => `Debe ser mayor o igual a ${m[1]}.`,
  },
  {
    pattern: /must be less than or equal to (-?\d+(?:\.\d+)?)/i,
    text: (m) => `Debe ser menor o igual a ${m[1]}.`,
  },
  { pattern: /DNI must be 8 digits/i, text: 'El DNI debe tener 8 dígitos.' },
  { pattern: /Time must be HH:mm/i, text: 'Usa el formato HH:mm (24 h).' },
  { pattern: /^Weight must be/i, text: 'El peso debe estar entre 0.1 y 400 kg.' },
  { pattern: /^Body fat must be/i, text: 'La grasa corporal debe estar entre 0 y 100 %.' },
  { pattern: /^Muscle % must be/i, text: 'El músculo debe estar entre 0 y 100 %.' },
  { pattern: /angle brackets/i, text: 'No puede contener los caracteres < o >.' },
  {
    pattern: /size must be between \d+ and (\d+)/i,
    text: (m) => `Máximo ${m[1]} caracteres.`,
  },
];

function apply(rules: Rule[], raw: string): string | null {
  for (const rule of rules) {
    const m = rule.pattern.exec(raw);
    if (m) return typeof rule.text === 'function' ? rule.text(m) : rule.text;
  }
  return null;
}

const FALLBACK_BY_STATUS: Record<number, string> = {
  400: 'Revisa los datos ingresados.',
  404: 'No encontramos lo que buscas.',
  409: 'Hay un conflicto con los datos existentes.',
  422: 'Los datos no son válidos para esta operación.',
};

export const UNAVAILABLE_MESSAGE =
  'El servicio no está disponible. Inténtalo de nuevo en unos minutos.';
export const FORBIDDEN_MESSAGE = 'No tienes permisos para esta acción.';

export function translateMessage(raw: string | undefined, status: number): string {
  if (status === 0 || status >= 500) return UNAVAILABLE_MESSAGE;
  if (status === 401 || status === 403) return FORBIDDEN_MESSAGE;
  return (
    (raw ? apply(MESSAGE_RULES, raw) : null) ??
    FALLBACK_BY_STATUS[status] ??
    'No se pudo completar la operación.'
  );
}

export function translateFieldError(raw: string): string {
  return apply(FIELD_RULES, raw) ?? raw;
}
