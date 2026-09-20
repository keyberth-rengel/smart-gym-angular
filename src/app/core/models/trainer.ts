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

/** Cliente con al menos una reserva con el entrenador (`GET /trainers/{email}/customers`). */
export interface TrainerCustomer {
  email: string;
  name: string;
  age: number;
  /** Cantidad de reservas con este entrenador. */
  sessions: number;
  /** yyyy-MM-dd de la reserva más reciente. */
  last_booking_date: string;
  /** HH:mm de la reserva más reciente. */
  last_booking_time: string;
}
