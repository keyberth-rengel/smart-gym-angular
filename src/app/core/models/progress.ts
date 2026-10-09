/** Lo que se ENVÍA al backend: camelCase. */
export interface ProgressCreate {
  dni: string;
  weightKg: number;
  bodyFatPct: number;
  musclePct: number;
  /** yyyy-MM-dd: el "hoy" local del cliente (opcional en el backend). */
  date?: string;
  /** Desfase del cliente respecto de UTC en minutos (positivo al este; Lima = -300). */
  utcOffsetMinutes?: number;
}

/** Lo que se RECIBE del backend: snake_case. */
export interface ProgressItem {
  date: string;
  weight_kg: number;
  body_fat_pct: number;
  muscle_pct: number;
}

export interface ProgressList {
  items: ProgressItem[];
  total: number;
  avg_weight_kg: number;
  avg_body_fat_pct: number;
  avg_muscle_pct: number;
}
