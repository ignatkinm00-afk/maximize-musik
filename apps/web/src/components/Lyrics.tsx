import { useEffect, useMemo, useRef } from 'react';

interface LyricLine {
  time: number | null;
  text: string;
}

const TIME_TAG = /^\[(\d{1,3}):(\d{1,2}(?:[.,]\d{1,3})?)\]\s*(.*)$/;

export function parseLyrics(text: string): LyricLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[[a-z]+:.*\]$/i.test(line))
    .map((line) => {
      const match = line.match(TIME_TAG);
      if (!match) return { time: null, text: line };
      return {
        time: Number(match[1]) * 60 + Number(match[2].replace(',', '.')),
        text: match[3] ?? '',
      };
    })
    .filter((line) => line.text);
}

export function LyricsView({ text, time }: { text: string; time: number }) {
  const lines = useMemo(() => parseLyrics(text), [text]);
  const timed = lines.some((line) => line.time !== null);
  const activeIndex = timed
    ? Math.max(
        0,
        lines.findIndex((line, index) => {
          const next = lines[index + 1];
          return line.time !== null && time >= line.time && (!next || next.time === null || time < next.time);
        }),
      )
    : -1;
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex]);

  if (!text.trim()) {
    return <p className="lyrics-empty">Текст для этого трека пока не добавлен.</p>;
  }

  return (
    <div className="lyrics-view">
      {lines.map((line, index) => (
        <p
          key={`${line.text}-${index}`}
          ref={index === activeIndex ? activeRef : undefined}
          className={timed && index === activeIndex ? 'lyrics-line active' : 'lyrics-line'}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}
