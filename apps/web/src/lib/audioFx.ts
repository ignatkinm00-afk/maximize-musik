/**
 * Web Audio: 5-полосный эквалайзер + усиление громкости.
 * Подключается к HTMLAudioElement плеера один раз.
 */

export const EQ_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [9, 8, 6, 4, 2, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 0, 2, 4, 6, 8],
  vocal: [-4, -3, -1, 2, 4, 5, 4, 2, 0, -2],
  rock: [5, 4, 2, 0, -1, 0, 2, 4, 5, 4],
  electronic: [7, 6, 3, 0, 0, 2, 3, 4, 6, 7],
  quiet: [3, 3, 3, 2, 2, 2, 2, 2, 2, 2],
};

export const EQ_MAX_GAIN = 2.5;

class AudioFx {
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private boostNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private element: HTMLAudioElement | null = null;

  private enabled = true;
  private bands: number[] = [...EQ_PRESETS.flat!];
  private boost = 1;
  private failed = false;

  attach(element: HTMLAudioElement): void {
    this.element = element;
  }

  get supported(): boolean {
    return typeof window !== 'undefined' && Boolean(window.AudioContext);
  }

  /** Создаёт граф. Должно вызываться из пользовательского жеста (клик/тап). */
  ensure(): boolean {
    if (this.failed || !this.element) return false;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    if (!this.supported) return false;

    try {
      const Context = window.AudioContext;
      this.ctx = new Context();
      this.source = this.ctx.createMediaElementSource(this.element);
      this.boostNode = this.ctx.createGain();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;

      this.compressor.threshold.value = -8;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      this.filters = EQ_FREQUENCIES.map((frequency) => {
        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.gain.value = 0;
        return filter;
      });

      this.source.connect(this.boostNode);
      let node: AudioNode = this.boostNode;
      for (const filter of this.filters) {
        node.connect(filter);
        node = filter;
      }
      node.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.apply();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    } catch (error) {
      console.warn('[audioFx] не удалось создать AudioContext:', (error as Error).message);
      this.failed = true;
      this.ctx = null;
      return false;
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.apply();
  }

  setBands(bands: number[]): void {
    this.bands = EQ_FREQUENCIES.map((_, index) =>
      Math.max(-12, Math.min(12, Number(bands[index]) || 0)),
    );
    this.apply();
  }

  setBand(index: number, gain: number): void {
    if (index < 0 || index >= this.bands.length) return;
    this.bands[index] = Math.max(-12, Math.min(12, Number(gain) || 0));
    this.apply();
  }

  /** 1 = обычная громкость, 2.5 = +250%. */
  setBoost(value: number): void {
    this.boost = Math.max(1, Math.min(EQ_MAX_GAIN, Number(value) || 1));
    this.apply();
  }

  setNormalization(enabled: boolean): void {
    if (!this.compressor) return;
    this.compressor.threshold.value = enabled ? -22 : -8;
    this.compressor.ratio.value = enabled ? 3 : 6;
    this.compressor.knee.value = enabled ? 18 : 12;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  private apply(): void {
    if (!this.ctx) return;
    if (this.boostNode) this.boostNode.gain.value = this.boost;
    this.filters.forEach((filter, index) => {
      filter.gain.value = this.enabled ? this.bands[index] ?? 0 : 0;
    });
  }
}

export const audioFx = new AudioFx();
