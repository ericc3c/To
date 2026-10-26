export class SetouchiAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oceanGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private isMuted = false;
  private isPaused = false;
  private isStarted = false;
  private furinTimer = 0;

  public initAndResume(): void {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : 0.45;
      this.masterGain.connect(this.ctx.destination);

      this.setupOceanAndWindLoops();
      this.isStarted = true;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restrictions before user gesture
      });
    }
  }

  private setupOceanAndWindLoops(): void {
    if (!this.ctx || !this.masterGain) return;

    // Generate 4 seconds of warm pink-ish noise buffer
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    // 1. Gentle Setouchi Ocean Waves loop
    const oceanSource = this.ctx.createBufferSource();
    oceanSource.buffer = buffer;
    oceanSource.loop = true;

    const oceanFilter = this.ctx.createBiquadFilter();
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 320;
    oceanFilter.Q.value = 0.7;

    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.value = 0.22;

    // Slow surf swell LFO (0.14 Hz ~ 7s wave period)
    const waveLfo = this.ctx.createOscillator();
    waveLfo.type = 'sine';
    waveLfo.frequency.value = 0.14;

    const waveLfoGain = this.ctx.createGain();
    waveLfoGain.gain.value = 0.12;

    const filterLfoGain = this.ctx.createGain();
    filterLfoGain.gain.value = 180;

    waveLfo.connect(waveLfoGain);
    waveLfoGain.connect(this.oceanGain.gain);
    waveLfo.connect(filterLfoGain);
    filterLfoGain.connect(oceanFilter.frequency);

    oceanSource.connect(oceanFilter);
    oceanFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.masterGain);

    oceanSource.start();
    waveLfo.start();

    // 2. Hillside Cedar Breeze loop
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 580;
    windFilter.Q.value = 2.4;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.09;

    const windLfo = this.ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.09;
    const windFreqMod = this.ctx.createGain();
    windFreqMod.gain.value = 220;
    windLfo.connect(windFreqMod);
    windFreqMod.connect(windFilter.frequency);

    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    windSource.start(0, 1.7);
    windLfo.start();
  }

  /**
   * Updates spatial mix of ocean vs hillside breeze based on player elevation (y)
   * and triggers occasional Furin glass wind chimes.
   */
  public update(dt: number, playerY: number): void {
    if (!this.isStarted || !this.ctx || this.isMuted || this.isPaused) return;

    const now = this.ctx.currentTime;
    const elevFactor = Math.max(0, Math.min(1, playerY / 11.0));
    if (this.oceanGain) {
      const targetOcean = 0.26 * (1 - elevFactor * 0.55);
      this.oceanGain.gain.setTargetAtTime(targetOcean, now, 0.25);
    }
    if (this.windGain) {
      const targetWind = 0.07 + elevFactor * 0.12;
      this.windGain.gain.setTargetAtTime(targetWind, now, 0.25);
    }

    this.furinTimer -= dt;
    if (this.furinTimer <= 0) {
      // More frequent near the hilltop shrine
      this.furinTimer = (4.8 + Math.random() * 6.5) * (1.15 - elevFactor * 0.45);
      this.playFurinChime(0.45 + elevFactor * 0.5);
    }
  }

  /**
   * Synthesizes a delicate Edo-glass Furin (wind chime) ring.
   */
  public playFurinChime(intensity = 0.8): void {
    if (!this.ctx || !this.masterGain || this.isMuted || this.isPaused) return;
    if (this.ctx.state !== 'running') return;

    const notes = [1567.98, 1760.0, 2093.0, 2349.32, 2637.02, 3135.96];
    const baseFreq = notes[Math.floor(Math.random() * notes.length)];
    const now = this.ctx.currentTime;

    // Primary crystal strike + metallic overtone partial
    const partials = [1.0, 2.41, 3.82];
    const gains = [0.09 * intensity, 0.035 * intensity, 0.015 * intensity];
    const decays = [1.85, 0.95, 0.45];

    partials.forEach((ratio, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * ratio, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(gains[idx], now + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, now + decays[idx]);

      osc.connect(env);
      env.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + decays[idx] + 0.05);
    });

    // Occasional double-tap flutter from the paper tanzaku clapper
    if (Math.random() < 0.48) {
      const delay = 0.14 + Math.random() * 0.12;
      const osc2 = this.ctx.createOscillator();
      const env2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.004, now + delay);
      env2.gain.setValueAtTime(0.0001, now + delay);
      env2.gain.linearRampToValueAtTime(0.055 * intensity, now + delay + 0.01);
      env2.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.4);

      osc2.connect(env2);
      env2.connect(this.masterGain);
      osc2.start(now + delay);
      osc2.stop(now + delay + 1.45);
    }
  }

  /**
   * Soft cobblestone/wood footstep tap.
   */
  public playFootstep(isWoodenPier = false): void {
    if (!this.ctx || !this.masterGain || this.isMuted || this.isPaused) return;
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    const basePitch = isWoodenPier
      ? 115 + (Math.random() - 0.5) * 18
      : 165 + (Math.random() - 0.5) * 26;

    osc.type = isWoodenPier ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(basePitch, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.45, now + 0.065);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.045, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.syncMasterGain();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.syncMasterGain();
  }

  private syncMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.isMuted || this.isPaused ? 0.0001 : 0.45;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }
}
