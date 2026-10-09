export interface Booking {
  id: number;
  customer_email: string;
  trainer_email: string;
  /** Fecha ISO (yyyy-MM-dd) de la reserva (hoy del cliente). */
  date: string;
  /** Hora HH:mm. */
  time: string;
  note: string | null;
}

export interface BookingCreate {
  customer_email: string;
  trainer_email: string;
  /** yyyy-MM-dd: el "hoy" local del cliente (opcional en el backend, que si no usa su fecha UTC). */
  date?: string;
  /** Desfase del cliente respecto de UTC en minutos (positivo al este; Lima = -300). */
  utcOffsetMinutes?: number;
  /** HH:mm en 24 h. */
  time: string;
  /** Máximo 250 caracteres. */
  note?: string;
}

/** Filtros de `GET /trainers/{email}/bookings`: `date` gana sobre `from`/`to`; sin nada, todas. */
export interface BookingQuery {
  /** yyyy-MM-dd */
  date?: string;
  /** yyyy-MM-dd, inclusivo */
  from?: string;
  /** yyyy-MM-dd, inclusivo */
  to?: string;
}
