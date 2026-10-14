import { useEffect, useState } from 'react';
import { TimingTower, type TowerEntry } from '../../components/TimingTower';
import { calculateWpm } from '../../lib/stats';

/** Carrera simulada: letras del texto, duración simulada y duración real de la animación. */
const TEXT_LENGTH = 220;
const SIMULATED_MS = 45_000;
const ANIMATION_MS = 6_500;

/** Avance (0-1) en función del tiempo (0-1). Mateo arranca lento y adelanta a todos. */
const DRIVERS = [
  { id: 'valentina', nickname: 'Valentina', keyframes: [0, 0.48, 0.83] },
  { id: 'mateo', nickname: 'Mateo', keyframes: [0, 0.38, 0.97] },
  { id: 'camila', nickname: 'Camila', keyframes: [0, 0.42, 0.74], isSelf: true },
  { id: 'joaquin', nickname: 'Joaquín', keyframes: [0, 0.3, 0.61] },
];

function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function progressAt([start, middle, end]: number[], t: number): number {
  const [a = 0, b = 0, c = 0] = [start, middle, end];
  return t < 0.4 ? a + (b - a) * (t / 0.4) : b + (c - b) * ((t - 0.4) / 0.6);
}

/** Torre de la portada: reproduce una vez una carrera de muestra con un adelantamiento. */
export function DemoTower() {
  // Con movimiento reducido se muestra directamente el resultado final.
  const [t, setT] = useState(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0,
  );

  useEffect(() => {
    if (t === 1) return;
    // ~12 actualizaciones por segundo bastan para una animación fluida de la torre.
    const startedAt = performance.now();
    const id = setInterval(() => {
      const next = Math.min(1, Math.max(0, (performance.now() - startedAt) / ANIMATION_MS));
      setT(next);
      if (next === 1) clearInterval(id);
    }, 80);
    return () => {
      clearInterval(id);
    };
    // Solo al montar: la animación se reproduce una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const elapsed = t * SIMULATED_MS;
  const typed = DRIVERS.map((d) => ({
    ...d,
    typed: Math.round(progressAt(d.keyframes, t) * TEXT_LENGTH),
  })).sort((a, b) => b.typed - a.typed);
  const leaderTyped = typed[0]?.typed ?? 0;

  const entries: TowerEntry[] = typed.map((d, index) => ({
    id: d.id,
    nickname: d.nickname,
    isSelf: d.isSelf ?? false,
    percent: (d.typed / TEXT_LENGTH) * 100,
    value: Math.round(calculateWpm(d.typed, elapsed)),
    aside: index === 0 ? 'Líder' : `+${leaderTyped - d.typed}`,
  }));

  return (
    <figure aria-hidden="true" className="flex flex-col gap-2">
      <TimingTower
        label="Carrera de muestra"
        heading={{
          title: t < 1 ? 'Carrera en vivo' : 'Final de la carrera',
          detail: formatClock(elapsed),
          live: t < 1,
        }}
        valueHeader="ppm"
        asideHeader="Dif."
        entries={entries}
      />
      <figcaption className="text-sm text-muted">
        Así se ve una carrera: la torre se reordena con cada adelantamiento. «Dif.» son las letras
        que le faltan a cada piloto para alcanzar al líder.
      </figcaption>
    </figure>
  );
}
