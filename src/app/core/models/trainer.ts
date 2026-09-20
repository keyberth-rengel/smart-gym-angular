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
  /** 8 dígitos; si viene, el backend lo vincula al correo del entrenador. */
  dni?: string;
}

/** Resultado de invitar al entrenador en Clerk (`message` es un código estable, no un texto para mostrar). */
export type InvitationStatus = 'INVITED' | 'ROLE_UPDATED' | 'SKIPPED' | 'FAILED';

export interface Invitation {
  status: InvitationStatus;
  message: string;
}

/** `POST /trainers`: el entrenador creado más el resultado de la invitación. */
export interface TrainerCreated extends Trainer {
  dni: string | null;
  invitation: Invitation;
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
