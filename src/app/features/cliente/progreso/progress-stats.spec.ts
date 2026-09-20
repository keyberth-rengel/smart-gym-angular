import { ProgressItem } from '../../../core/models';
import { averagesText, buildMetrics, fmt, roundedDelta, sortAscending } from './progress-stats';

const item = (date: string, w: number, f: number, m: number): ProgressItem => ({
  date,
  weight_kg: w,
  body_fat_pct: f,
  muscle_pct: m,
});

// Serie del diseño: 78.2/21.0/39.8 -> 76.9/20.1/40.6 -> 75.6/19.3/41.4 -> 74.5/18.2/42.1
const SERIES = [
  item('2026-07-06', 78.2, 21.0, 39.8),
  item('2026-08-03', 76.9, 20.1, 40.6),
  item('2026-08-31', 75.6, 19.3, 41.4),
  item('2026-09-15', 74.5, 18.2, 42.1),
];

describe('progress-stats', () => {
  it('fmt usa un decimal y punto', () => {
    expect(fmt(74.5)).toBe('74.5');
    expect(fmt(19.65)).toBe('19.7'); // la mitad redondea hacia arriba, no como toFixed
    expect(fmt(41)).toBe('41.0');
  });

  it('roundedDelta evita el ruido de coma flotante', () => {
    expect(roundedDelta(74.5, 75.6)).toBe(-1.1);
    expect(roundedDelta(42.1, 41.4)).toBe(0.7);
    expect(roundedDelta(70, 70)).toBe(0);
  });

  it('sortAscending ordena por fecha sin mutar la entrada', () => {
    const shuffled = [SERIES[2], SERIES[0], SERIES[3], SERIES[1]];
    const copy = [...shuffled];
    expect(sortAscending(shuffled).map((i) => i.date)).toEqual(SERIES.map((i) => i.date));
    expect(shuffled).toEqual(copy);
  });

  it('sin registros no hay métricas', () => {
    expect(buildMetrics([])).toEqual([]);
  });

  it('con varios registros: último valor, cambio contra el anterior y tono', () => {
    const [weight, fat, muscle] = buildMetrics(SERIES);
    expect(weight).toMatchObject({
      key: 'weight',
      value: '74.5',
      unit: 'kg',
      delta: '−1.1 kg',
      tone: 'green',
    });
    expect(fat).toMatchObject({
      key: 'fat',
      value: '18.2',
      unit: '%',
      delta: '−1.1 pts',
      tone: 'green',
    });
    expect(muscle).toMatchObject({
      key: 'muscle',
      value: '42.1',
      unit: '%',
      delta: '+0.7 pts',
      tone: 'green',
    });
  });

  it('funciona aunque el API entregue los registros desordenados', () => {
    const [weight] = buildMetrics([SERIES[3], SERIES[1], SERIES[0], SERIES[2]]);
    expect(weight.value).toBe('74.5');
    expect(weight.series).toEqual([78.2, 76.9, 75.6, 74.5]);
  });

  it('empeorar es azul: peso o grasa suben, músculo baja', () => {
    const [weight, fat, muscle] = buildMetrics([
      item('2026-09-01', 70, 15, 45),
      item('2026-09-02', 71.2, 15.5, 44.4),
    ]);
    expect(weight).toMatchObject({ delta: '+1.2 kg', tone: 'blue' });
    expect(fat).toMatchObject({ delta: '+0.5 pts', tone: 'blue' });
    expect(muscle).toMatchObject({ delta: '−0.6 pts', tone: 'blue' });
  });

  it('sin cambios es neutro (azul) y con texto "Sin cambios"', () => {
    const [weight] = buildMetrics([item('2026-09-01', 70, 15, 45), item('2026-09-02', 70, 15, 45)]);
    expect(weight).toMatchObject({ delta: 'Sin cambios', tone: 'blue' });
  });

  it('un cambio menor a una décima cuenta como "Sin cambios"', () => {
    const [weight] = buildMetrics([
      item('2026-09-01', 70.02, 15, 45),
      item('2026-09-02', 70.04, 15, 45),
    ]);
    expect(weight.delta).toBe('Sin cambios');
  });

  it('con un solo registro no hay cambio', () => {
    const metrics = buildMetrics([SERIES[3]]);
    expect(metrics.map((m) => m.delta)).toEqual([null, null, null]);
    expect(metrics[0].series).toEqual([74.5]);
    expect(metrics[0].tone).toBe('blue');
  });

  it('la serie del gráfico se limita a los últimos 12 registros', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      item(`2026-01-${String(i + 1).padStart(2, '0')}`, 80 - i, 20, 40),
    );
    const [weight] = buildMetrics(many);
    expect(weight.series).toHaveLength(12);
    expect(weight.series[0]).toBe(77);
    expect(weight.series[11]).toBe(66);
  });

  it('averagesText con datos del API', () => {
    expect(averagesText(4, 76.3, 19.65, 40.975)).toBe(
      'Promedio: 76.3 kg · 19.7 % grasa · 41.0 % músculo',
    );
  });

  it('averagesText sin registros es null', () => {
    expect(averagesText(0, 0, 0, 0)).toBeNull();
  });
});
