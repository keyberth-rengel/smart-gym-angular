export interface Trainer {
  email: string;
  name: string;
  age: number;
  specialty: string | null;
}

export interface TrainerCreate {
  email: string;
  name: string;
  age: number;
  specialty?: string;
}

/** Horas ocupadas de un entrenador en una fecha (sin datos personales). */
export interface TrainerAvailability {
  date: string;
  /** "HH:mm" ordenadas. */
  booked_times: string[];
}
