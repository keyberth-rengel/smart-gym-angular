export type AttendanceRole = 'CUSTOMER' | 'TRAINER';

export interface AttendanceRecord {
  id: number;
  email: string;
  role: AttendanceRole;
  /** Fecha y hora local sin zona. */
  timestamp: string;
}
