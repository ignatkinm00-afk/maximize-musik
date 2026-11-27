import { Gauge, Moon, RotateCcw, SlidersHorizontal, Volume2 } from 'lucide-react';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../lib/audioFx';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import { Modal } from './ui';

const PRESET_LABELS: Array<[keyof typeof EQ_PRESETS, string]> = [
  ['flat', 'Ровно'],
  ['bass', 'Бас'],
  ['treble', 'Высокие'],
  ['vocal', 'Вокал'],
  ['rock', 'Рок'],
  ['electronic', 'Электро'],
  ['quiet', 'Тихие'],
];

const formatBand = (frequency: number) =>
  frequency >= 1000 ? `${frequency / 1000} кГц` : `${frequency} Гц`;

export function EqualizerDialog() {
  const open = useUi((state) => state.eqOpen);
  const setOpen = useUi((state) => state.setEqOpen);

  const enabled = usePlayer((state) => state.eqEnabled);
  const bands = usePlayer((state) => state.eqBands);
  const volume = usePlayer((state) => state.volume);
  const setEqEnabled = usePlayer((state) => state.setEqEnabled);
  const setEqBand = usePlayer((state) => state.setEqBand);
  const setEqPreset = usePlayer((state) => state.setEqPreset);
  const resetEq = usePlayer((state) => state.resetEq);
  const setVolume = usePlayer((state) => state.setVolume);
  const speed = usePlayer((state) => state.speed);
  const setSpeed = usePlayer((state) => state.setSpeed);
  const normalize = usePlayer((state) => state.normalize);
  const setNormalize = usePlayer((state) => state.setNormalize);
  const sleepUntil = usePlayer((state) => state.sleepUntil);
  const setSleepTimer = usePlayer((state) => state.setSleepTimer);
  const crossfade = usePlayer((state) => state.crossfade);
  const setCrossfade = usePlayer((state) => state.setCrossfade);

  const activePreset = PRESET_LABELS.find(([id]) => {
    const preset = EQ_PRESETS[id]!;
    return preset.every((value, index) => value === bands[index]);
  })?.[0];

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Эквалайзер и громкость" width={600}>
      <div className="eq-top">
        <div>
          <strong>Эквалайзер</strong>
          <p className="hint">10 полос. Настройки сохраняются на этом устройстве.</p>
        </div>
        <button
          className={`switch ${enabled ? 'on' : ''}`}
          onClick={() => setEqEnabled(!enabled)}
          aria-pressed={enabled}
          aria-label="Включить эквалайзер"
        >
          <span />
        </button>
      </div>

      <div className="eq-presets">
        {PRESET_LABELS.map(([id, label]) => (
          <button
            key={id}
            className={`chip chip-sm ${activePreset === id ? 'active' : ''}`}
            onClick={() => setEqPreset(EQ_PRESETS[id]!)}
            disabled={!enabled}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`eq-bands ${enabled ? '' : 'disabled'}`}>
        {EQ_FREQUENCIES.map((frequency, index) => {
          const gain = bands[index] ?? 0;
          return (
            <div key={frequency} className="eq-band">
              <span className="eq-band-value">
                {gain > 0 ? '+' : ''}
                {gain} дБ
              </span>
              <div className="eq-band-slider">
                <span
                  className="eq-band-fill"
                  style={{ width: `${Math.max(0, Math.min(100, ((gain + 12) / 24) * 100))}%` }}
                />
                <input
                  type="range"
                  className="eq-slider"
                  min={-12}
                  max={12}
                  step={1}
                  value={gain}
                  disabled={!enabled}
                  onChange={(event) => setEqBand(index, Number(event.target.value))}
                  aria-label={`Полоса ${formatBand(frequency)}`}
                />
              </div>
              <span className="eq-band-frequency">{formatBand(frequency)}</span>
            </div>
          );
        })}
      </div>

      <div className="eq-boost">
        <div className="eq-boost-head">
          <span>
            <Volume2 size={16} /> Громкость и усиление
          </span>
          <strong>{Math.round(volume * 100)}%</strong>
        </div>
        <input
          type="range"
          className="seek"
          min={0}
          max={2}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          style={{
            ['--progress' as string]: `${(volume / 2) * 100}%`,
          }}
          aria-label="Громкость и усиление"
        />
        <p className="hint">
          До 100% — обычная громкость. Выше — цифровое усиление через лимитер: громче, но
          возможны искажения на очень громких треках.
        </p>
      </div>

      <div className="eq-extra">
        <div className="eq-extra-block">
          <div className="eq-boost-head">
            <span>
              <Gauge size={16} /> Скорость
            </span>
            <strong>{speed.toFixed(2)}×</strong>
          </div>
          <input
            type="range"
            className="seek"
            min={0.5}
            max={2}
            step={0.05}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            style={{ ['--progress' as string]: `${((speed - 0.5) / 1.5) * 100}%` }}
            aria-label="Скорость воспроизведения"
          />
        </div>

        <div className="eq-extra-block">
          <div className="eq-boost-head">
            <span>
              <Moon size={16} /> Таймер сна
            </span>
            <strong>
              {sleepUntil ? `${Math.max(0, Math.ceil((sleepUntil - Date.now()) / 60000))} мин` : 'выкл'}
            </strong>
          </div>
          <div className="eq-chips">
            {[15, 30, 45, 60].map((minutes) => (
              <button key={minutes} className="chip chip-sm" onClick={() => setSleepTimer(minutes)}>
                {minutes} мин
              </button>
            ))}
            <button className="chip chip-sm" onClick={() => setSleepTimer(null)}>
              Выкл
            </button>
          </div>
        </div>

        <div className="eq-extra-block">
          <div className="eq-boost-head">
            <span>Плавные переходы</span>
            <strong>{crossfade ? `${crossfade} с` : 'выкл'}</strong>
          </div>
          <div className="eq-chips">
            {[0, 2, 4, 6].map((seconds) => (
              <button
                key={seconds}
                className={`chip chip-sm ${crossfade === seconds ? 'active' : ''}`}
                onClick={() => setCrossfade(seconds)}
              >
                {seconds === 0 ? 'Выкл' : `${seconds} с`}
              </button>
            ))}
          </div>
          <p className="hint">Плавное затухание в конце трека и появление следующего.</p>
        </div>

        <div className="eq-boost-head">
          <span>Нормализация громкости</span>
          <button
            className={`switch ${normalize ? 'on' : ''}`}
            onClick={() => setNormalize(!normalize)}
            aria-pressed={normalize}
            aria-label="Нормализация громкости"
          >
            <span />
          </button>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={resetEq}>
          <RotateCcw size={16} /> Сбросить
        </button>
        <button className="btn btn-primary" onClick={() => setOpen(false)}>
          <SlidersHorizontal size={16} /> Готово
        </button>
      </div>
    </Modal>
  );
}
