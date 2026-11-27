import { useEffect, useRef, useState } from 'react';
import { audioFx } from '../lib/audioFx';
import { usePlayer } from '../store/player';

export function Visualizer({ bars = 26 }: { bars?: number }) {
  const playing = usePlayer((state) => state.playing);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: bars }, () => 5),
  );
  const frame = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let active = true;
    const data = new Uint8Array(128);

    const tick = (time: number) => {
      if (!active) return;
      frame.current = requestAnimationFrame(tick);
      if (time - last.current < 55) return;
      last.current = time;

      const analyser = audioFx.getAnalyser();
      if (!analyser) return;
      analyser.frequencyBinCount;
      analyser.getByteFrequencyData(data);

      setLevels((previous) =>
        previous.map((value, index) => {
          const bucket = Math.min(
            data.length - 1,
            Math.floor(Math.pow(index / bars, 1.8) * data.length),
          );
          const target = 4 + ((data[bucket] ?? 0) / 255) * 48;
          return value + (target - value) * 0.45;
        }),
      );
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frame.current);
    };
  }, [playing, bars]);

  return (
    <div className="fp-visualizer" aria-hidden="true">
      {levels.map((height, index) => (
        <i key={index} style={{ height: `${Math.max(4, height)}px` }} />
      ))}
    </div>
  );
}
