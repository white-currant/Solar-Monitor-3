import React, { useEffect, useRef, useState } from 'react';
import { Square, Globe, Sun, Activity, Volume2, Volume1 } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface SpaceSoundProps {
  windSpeed: number;
  windDensity: number;
  kpIndex: number;
  flareClass: string;
  flareFlux: number;
}

type SoundMode = 'magnetosphere' | 'sun';

export const SpaceSound: React.FC<SpaceSoundProps> = ({ windSpeed, windDensity, kpIndex, flareClass, flareFlux }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<SoundMode>('magnetosphere');
  const [volume, setVolume] = useState(0.5);
  
  // REFS
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<AudioScheduledSourceNode[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Helper: Create Pink Noise Buffer (for Wind Hiss & Solar Static)
  const createPinkNoise = (ctx: AudioContext): AudioBuffer => {
    const bufferSize = ctx.sampleRate * 5; // 5 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; // Compensate for gain
      b6 = white * 0.115926;
    }
    return buffer;
  };

  // Helper: Create Granular "Dust" Buffer (for Magnetosphere)
  const createGranularNoise = (ctx: AudioContext, density: number): AudioBuffer => {
      const bufferSize = ctx.sampleRate * 5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      // Density controls probability of a grain
      const grainChance = Math.min(0.0005 + (density / 10000), 0.01); 
      
      for (let i = 0; i < bufferSize; i++) {
          if (Math.random() < grainChance) {
              output[i] = (Math.random() * 2 - 1) * 0.8; // A sharp click/grain
          } else {
              output[i] = 0;
          }
      }
      return buffer;
  }

  // --- AUDIO CLEANUP ---
  const stopAll = () => {
    if (masterGainRef.current) {
        try {
            masterGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current?.currentTime ?? 0, 0.1);
        } catch(e) {}
        
        setTimeout(() => {
             masterGainRef.current?.disconnect();
             masterGainRef.current = null;
        }, 150);
    }

    oscillatorsRef.current.forEach(osc => {
        try {
            osc.stop();
            osc.disconnect();
        } catch (e) {}
    });
    oscillatorsRef.current = [];

    if (audioCtxRef.current?.state === 'running') {
        audioCtxRef.current.suspend();
    }
  };

  // --- SYNTHESIS ENGINES ---

  // 1. MAGNETOSPHERE: Drone + Granular Wind
  const playMagnetosphere = (ctx: AudioContext, dest: AudioNode) => {
      const now = ctx.currentTime;
      
      // A. Ethereal Drone (Sine waves)
      const baseFreq = 150 + (Math.min(windSpeed, 1000) - 300) * 0.1;
      const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = baseFreq;
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = baseFreq * 1.01; // Detune
      const osc3 = ctx.createOscillator(); osc3.type = 'sine'; osc3.frequency.value = baseFreq * 0.5; // Sub

      // Tremolo (Kp)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = Math.max(0.5, kpIndex / 2); // Slow pulsation
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.1;
      
      const toneMix = ctx.createGain();
      toneMix.gain.value = 0.2;

      lfo.connect(lfoGain);
      lfoGain.connect(toneMix.gain);
      osc1.connect(toneMix);
      osc2.connect(toneMix);
      osc3.connect(toneMix);
      toneMix.connect(dest);

      osc1.start(now); osc2.start(now); osc3.start(now); lfo.start(now);
      oscillatorsRef.current.push(osc1, osc2, osc3, lfo);

      // B. Granular Wind (Pink Noise + Dust)
      const pinkBuffer = createPinkNoise(ctx);
      const pinkNode = ctx.createBufferSource();
      pinkNode.buffer = pinkBuffer;
      pinkNode.loop = true;

      const pinkFilter = ctx.createBiquadFilter();
      pinkFilter.type = 'bandpass';
      pinkFilter.frequency.value = 300 + (windSpeed * 0.5); 
      pinkFilter.Q.value = 0.5;

      const pinkGain = ctx.createGain();
      pinkGain.gain.value = 0.08;

      pinkNode.connect(pinkFilter);
      pinkFilter.connect(pinkGain);
      pinkGain.connect(dest);
      
      // C. Granules (Dust/Ice particles)
      const grainBuffer = createGranularNoise(ctx, windDensity);
      const grainNode = ctx.createBufferSource();
      grainNode.buffer = grainBuffer;
      grainNode.loop = true;
      
      // Randomize playback rate slightly for texture
      grainNode.playbackRate.value = 0.8 + (Math.random() * 0.4);

      const grainFilter = ctx.createBiquadFilter();
      grainFilter.type = 'highpass';
      grainFilter.frequency.value = 2000; // Only high clicks

      const grainGain = ctx.createGain();
      const densityVol = Math.min(windDensity / 15, 1) * 0.15; // Louder with density
      grainGain.gain.value = densityVol;

      grainNode.connect(grainFilter);
      grainFilter.connect(grainGain);
      grainGain.connect(dest);

      pinkNode.start(now);
      grainNode.start(now);
      oscillatorsRef.current.push(pinkNode, grainNode);
  };

  // 2. SUN: Radio Signal (Noisier, Less Bassy)
  const playSun = (ctx: AudioContext, dest: AudioNode) => {
      const now = ctx.currentTime;

      // A. Mid-Low Drone (The carrier signal)
      // Changed from 35Hz (Sub) to 60Hz (Mains hum / Radio carrier feel)
      const fund = 60.00; 
      const osc1 = ctx.createOscillator(); osc1.type = 'triangle'; osc1.frequency.value = fund;
      
      // B. Detuned Sine (Interference)
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = fund * 1.01; 
      
      // Signal Pulse LFO 
      const signalLfo = ctx.createOscillator();
      signalLfo.type = 'sine'; 
      signalLfo.frequency.value = 0.3; // Slow fade
      const signalGain = ctx.createGain();
      signalGain.gain.value = 0.1;

      const toneMix = ctx.createGain();
      toneMix.gain.value = 0.2; // Reduced tone volume to let noise cut through
      
      signalLfo.connect(signalGain);
      signalGain.connect(toneMix.gain);

      osc1.connect(toneMix);
      osc2.connect(toneMix);
      toneMix.connect(dest);

      osc1.start(now); osc2.start(now); signalLfo.start(now);
      oscillatorsRef.current.push(osc1, osc2, signalLfo);

      // C. Solar Static (Pink Noise + Bandpass + AM)
      // Switched from Brown Noise (Muffled) to Pink Noise (Crisper static)
      const noiseBuffer = createPinkNoise(ctx);
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass'; // Changed to lowpass to allow mids but cut harsh highs
      
      // Opened up the filter significantly
      let cutoff = 350; 
      if (flareClass.includes('C')) cutoff = 500;
      if (flareClass.includes('M')) cutoff = 1200;
      if (flareClass.includes('X')) cutoff = 3000; 
      noiseFilter.frequency.value = cutoff;
      noiseFilter.Q.value = 1; // Add some resonance

      // Static Modulation (AM) - The "Geiger Counter" effect
      const staticLfo = ctx.createOscillator();
      staticLfo.type = 'square'; 
      staticLfo.frequency.value = 12; // Faster stutter for "busy" signal
      const staticLfoGain = ctx.createGain();
      staticLfoGain.gain.value = 0.1; 
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.45; // Increased noise volume
      
      staticLfo.connect(staticLfoGain);
      staticLfoGain.connect(noiseGain.gain);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(dest);

      noiseNode.start(now);
      staticLfo.start(now);
      oscillatorsRef.current.push(noiseNode, staticLfo);
  };

  // --- VOLUME CONTROL ---
  useEffect(() => {
      if (masterGainRef.current && audioCtxRef.current) {
          masterGainRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.1);
      }
  }, [volume]);

  // --- VISUALIZER LOOP ---
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Initialize particles
      const particles: {x: number, y: number, speed: number, size: number, alpha: number}[] = [];
      for(let i=0; i<30; i++) {
          particles.push({
              x: Math.random() * 100,
              y: Math.random() * 40,
              speed: 0.2 + Math.random(),
              size: 0.5 + Math.random(),
              alpha: Math.random()
          });
      }

      // Visualizer FPS Limit (Low Priority)
      let lastTime = 0;
      const fps = 20;
      const interval = 1000 / fps;

      const draw = (timestamp: number) => {
          animationRef.current = requestAnimationFrame(draw);
          
          const deltaTime = timestamp - lastTime;
          if (deltaTime < interval) return;
          lastTime = timestamp - (deltaTime % interval);

          const w = canvas.width;
          const h = canvas.height;
          const time = Date.now() * 0.001;

          ctx.clearRect(0, 0, w, h);
          
          // Grid
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for(let i=0; i<w; i+=10) { ctx.moveTo(i,0); ctx.lineTo(i,h); }
          for(let i=0; i<h; i+=10) { ctx.moveTo(0,i); ctx.lineTo(w,i); }
          ctx.stroke();

          if (mode === 'magnetosphere') {
              // 1. Particles (Granulation/Density)
              const densityCount = Math.min(Math.max(windDensity * 3, 10), 60);
              ctx.fillStyle = '#fff';
              
              particles.forEach((p, i) => {
                  if (i > densityCount) return;
                  // Move
                  p.x += p.speed * (windSpeed / 300);
                  if (p.x > w) p.x = 0;
                  
                  // Flicker for granulation effect
                  const flicker = 0.5 + Math.random() * 0.5;
                  ctx.globalAlpha = p.alpha * flicker;
                  
                  ctx.beginPath();
                  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                  ctx.fill();
              });
              ctx.globalAlpha = 1;

              // 2. Waveform
              const freq = 0.05 + (windSpeed / 2000);
              const amp = 5 + (kpIndex * 2);
              
              ctx.beginPath();
              ctx.strokeStyle = '#00e676';
              ctx.lineWidth = 2;
              
              for (let x = 0; x < w; x++) {
                  const y = h/2 + Math.sin(x * freq + time * 5) * amp * Math.sin(time);
                  if (x === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
              }
              ctx.stroke();
              
              // Text
              ctx.fillStyle = '#00e676';
              ctx.font = '10px monospace';
              ctx.fillText(`WIND: ${Math.round(windSpeed)} km/s`, 5, h-5);
              ctx.fillText(`DENS: ${windDensity.toFixed(1)}`, w-60, h-5);

          } else {
              // 1. Solar Visuals
              const centerX = w / 2;
              const centerY = h / 2;
              
              let color = '#00bcd4'; 
              if (flareClass.includes('C')) color = '#fff';
              if (flareClass.includes('M')) color = '#ffca28';
              if (flareClass.includes('X')) color = '#ff1744';
              
              let pulseSpeed = 1;
              if (flareClass.includes('M')) pulseSpeed = 3;
              if (flareClass.includes('X')) pulseSpeed = 6;
              
              // Deep breathing effect
              const radius = 15 + Math.sin(time * pulseSpeed) * 3;

              const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 2.5);
              gradient.addColorStop(0, color);
              gradient.addColorStop(1, 'transparent');
              
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius * 2.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
              ctx.fill();
              
              // Random "Roar" sparks
              if (Math.random() < 0.2) {
                  ctx.fillStyle = color;
                  ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
              }

              // Text
              ctx.fillStyle = color;
              ctx.font = '10px monospace';
              ctx.fillText(`CLASS: ${flareClass}`, 5, h-5);
          }
      };
      
      animationRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(animationRef.current);
  }, [mode, windSpeed, windDensity, kpIndex, flareClass, flareFlux]);


  // --- MAIN CONTROL ---
  const toggle = () => {
    if (isPlaying) {
        setIsPlaying(false);
        stopAll();
    } else {
        setIsPlaying(true);
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        ctx.resume();

        const master = ctx.createGain();
        master.gain.value = volume;
        master.connect(ctx.destination);
        masterGainRef.current = master;

        if (mode === 'magnetosphere') playMagnetosphere(ctx, master);
        else playSun(ctx, master);
    }
  };

  const switchMode = (newMode: SoundMode) => {
      if (mode === newMode) return;
      if (isPlaying) {
          stopAll();
          setMode(newMode);
          setTimeout(() => {
             if (!audioCtxRef.current) return;
             const ctx = audioCtxRef.current;
             ctx.resume();
             const master = ctx.createGain();
             master.gain.value = volume;
             master.connect(ctx.destination);
             masterGainRef.current = master;
             if (newMode === 'magnetosphere') playMagnetosphere(ctx, master);
             else playSun(ctx, master);
          }, 50);
      } else {
          setMode(newMode);
      }
  };
  
  useEffect(() => {
      return () => stopAll();
  }, []);

  return (
    <div className="flex flex-col md:flex-row items-center gap-3 bg-[#10141e] p-2 rounded border border-gray-700 relative z-40">
      
      {/* VISUALIZER */}
      <div className="relative w-[100px] h-[40px] bg-black border border-white/10 rounded overflow-hidden hidden md:block">
          <canvas ref={canvasRef} width={100} height={40} />
          <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20"></div>
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/20"></div>
      </div>

      {/* CONTROLS WRAPPER */}
      <div className="flex items-center gap-2">
        {/* Mode Switcher */}
        <div className="flex gap-1 bg-black/30 p-1 rounded">
            <button 
                onClick={() => switchMode('magnetosphere')}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${mode === 'magnetosphere' ? 'text-[#00e676]' : 'text-gray-600'}`}
                title="Звук: Магнитосфера"
            >
                <Globe size={16} />
            </button>
            <button 
                onClick={() => switchMode('sun')}
                className={`p-1.5 rounded hover:bg-white/10 transition-colors ${mode === 'sun' ? 'text-[#ffca28]' : 'text-gray-600'}`}
                title="Звук: Солнце"
            >
                <Sun size={16} />
            </button>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-1 w-20 group">
            {volume > 0 ? <Volume2 size={14} className="text-[#00bcd4]" /> : <Volume1 size={14} className="text-gray-500" />}
            <input 
                type="range" 
                min="0" max="1" step="0.01" 
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#00bcd4]"
                title={`Громкость: ${Math.round(volume * 100)}%`}
            />
        </div>

        {/* Play Button */}
        <button 
            onClick={toggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all uppercase text-[10px] font-bold tracking-wider min-w-[110px] justify-center ${
            isPlaying 
                ? 'bg-[#00bcd4] text-black border-[#00bcd4] shadow-[0_0_10px_#00bcd4]' 
                : 'border-[#00bcd4] text-[#00bcd4] hover:bg-[#00bcd4]/10'
            }`}
        >
            {isPlaying ? <Square size={10} fill="currentColor" /> : <Activity size={12} />}
            {isPlaying ? 'СТОП' : 'LIVE AUDIO'}
        </button>

        {/* Info */}
        <InfoTooltip 
            title="Data Sonification (Аудио-Телеметрия)"
            description={
                <>
                    <p className="mb-2 text-xs text-gray-300">
                    Звук генерируется в реальном времени на основе входящих данных.
                    </p>
                    <div className="space-y-2 mt-3 pt-2 border-t border-gray-700">
                        <div className="text-xs">
                            <span className="text-gray-400 block mb-1 uppercase tracking-wider text-[9px]">Режим: Магнитосфера</span>
                            <div className="flex justify-between"><span>Свист ветра:</span> <span className="text-[#00e676]">Скорость (Wind Speed)</span></div>
                            <div className="flex justify-between"><span>Грануляция (Песок):</span> <span className="text-[#00e676]">Плотность (Density)</span></div>
                            <div className="flex justify-between"><span>Гул/Тремоло:</span> <span className="text-white">Kp-Index</span></div>
                        </div>
                        <div className="text-xs mt-2 pt-2 border-t border-gray-700">
                            <span className="text-gray-400 block mb-1 uppercase tracking-wider text-[9px]">Режим: Солнце (Radio Static)</span>
                            <div className="flex justify-between"><span>Static Noise:</span> <span className="text-[#ffca28]">Pink Noise (Radio)</span></div>
                            <div className="flex justify-between"><span>Carrier Wave:</span> <span className="text-white">60Hz Triangle</span></div>
                        </div>
                    </div>
                </>
            }
        />
      </div>
    </div>
  );
};