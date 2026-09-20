import { ProgressItem } from '../../../core/models';

export type MetricKey = 'weight' | 'fat' | 'muscle';

export interface Metric {
  key: MetricKey;
  label: string;
  unit: string;
  value: string;
  /** "−1.1 kg", "+0.7 pts", "Sin cambios" o `null` si solo hay un registro. */
  delta: string | null;
  tone: 'green' | 'blue';
  series: number[];
}

/** Un decimal y punto decimal, como en el diseño ("74.5"). Redondea la mitad hacia arriba (19.65 -> 19.7). */
export const fmt = (n: number): string => (Math.round((n + Number.EPSILON) * 10) / 10).toFixed(1);

const SPARK_POINTS = 12;

/** Cambio redondeado a un decimal (evita ruido de coma flotante: 75.6 - 74.5 = 1.0999...). */
export function roundedDelta(latest: number, previous: number): number {
  return Math.round((latest - previous) * 10) / 10;
}

function deltaText(delta: number, unit: string): string {
  if (delta === 0) return 'Sin cambios';
  const sign = delta > 0 ? '+' : '−';
  return `${sign}${Math.abs(delta).toFixed(1)} ${unit}`;
}

/** Registros de más antiguo a más reciente, sin depender del orden del API. */
export function sortAscending(items: readonly ProgressItem[]): ProgressItem[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

/** Tres métricas con el último valor, su cambio contra el registro anterior y la serie del gráfico. */
export function buildMetrics(items: readonly ProgressItem[]): Metric[] {
  const sorted = sortAscending(items);
  if (!sorted.length) return [];
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const recent = sorted.slice(-SPARK_POINTS);

  const defs: {
    key: MetricKey;
    label: string;
    unit: string;
    deltaUnit: string;
    pick: (i: ProgressItem) => number;
    /** `true` si subir es mejorar (músculo); bajar es mejorar en peso y grasa. */
    higherIsBetter: boolean;
  }[] = [
    {
      key: 'weight',
      label: 'Peso',
      unit: 'kg',
      deltaUnit: 'kg',
      pick: (i) => i.weight_kg,
      higherIsBetter: false,
    },
    {
      key: 'fat',
      label: 'Grasa corporal',
      unit: '%',
      deltaUnit: 'pts',
      pick: (i) => i.body_fat_pct,
      higherIsBetter: false,
    },
    {
      key: 'muscle',
      label: 'Músculo',
      unit: '%',
      deltaUnit: 'pts',
      pick: (i) => i.muscle_pct,
      higherIsBetter: true,
    },
  ];

  return defs.map((d) => {
    const delta = previous ? roundedDelta(d.pick(latest), d.pick(previous)) : null;
    const improved = delta !== null && delta !== 0 && (d.higherIsBetter ? delta > 0 : delta < 0);
    return {
      key: d.key,
      label: d.label,
      unit: d.unit,
      value: fmt(d.pick(latest)),
      delta: delta === null ? null : deltaText(delta, d.deltaUnit),
      tone: improved ? 'green' : 'blue',
      series: recent.map(d.pick),
    };
  });
}

/** Promedios que entrega el API, listos para mostrar; `null` si no hay registros. */
export function averagesText(
  total: number,
  avgWeight: number,
  avgFat: number,
  avgMuscle: number,
): string | null {
  if (total <= 0) return null;
  return `Promedio: ${fmt(avgWeight)} kg · ${fmt(avgFat)} % grasa · ${fmt(avgMuscle)} % músculo`;
}
