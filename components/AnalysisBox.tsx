import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface DangerLevel {
    score: number; // 0-100
    label: string;
    colorClass: string;
}

interface AnalysisBoxProps {
  text: string;
  danger: DangerLevel;
}

export const AnalysisBox: React.FC<AnalysisBoxProps> = ({ text, danger }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isSoundOn, setIsSoundOn] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // 1. Initialize AudioContext immediately (it will start in 'suspended' state)
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
        }
    } catch (e) {
        console.warn("Web Audio API not supported");
    }

    // 2. Unlock function to resume context on ANY interaction
    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };

    // Try once immediately
    unlockAudio();

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const toggleSound = async () => {
    if (!audioCtxRef.current) return;

    // CRITICAL FIX: If context is suspended (blocked by browser),
    // the first click should just WAKE IT UP, not turn sound off.
    if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
        setIsSoundOn(true); // Ensure it stays ON
    } else {
        // Normal toggle behavior if already running
        setIsSoundOn(!isSoundOn);
    }
  };

  const playBlip = () => {
     // Only play if sound is on, context exists, and context is running (not suspended)
     if (!isSoundOn || !audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
     
     try {
         const ctx = audioCtxRef.current;
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         
         osc.type = 'sine';
         // Randomize pitch slightly for typewriter effect
         const freq = 800 + Math.random() * 100; 
         osc.frequency.setValueAtTime(freq, ctx.currentTime);
         
         // Short blip envelope
         gain.gain.setValueAtTime(0.02, ctx.currentTime); 
         gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
         
         osc.connect(gain);
         gain.connect(ctx.destination);
         
         osc.start();
         osc.stop(ctx.currentTime + 0.05);
     } catch(e) {
         // Ignore audio errors
     }
  };

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    
    const startDelay = setTimeout(() => {
        const timer = setInterval(() => {
          setDisplayedText(text.substring(0, i));
          
          if (i > 0 && i <= text.length && i % 2 === 0) {
            playBlip();
          }
          
          i++;
          if (i > text.length) clearInterval(timer);
        }, 15); // Speed of typing

        return () => clearInterval(timer);
    }, 500);

    return () => clearTimeout(startDelay);
  }, [text, isSoundOn]);

  // Parser to split by newlines and highlight specific keywords
  const paragraphs = displayedText.split('\n\n');

  return (
    <div className={`mb-8 p-5 border-l-4 bg-[#10141e]/60 backdrop-blur-md rounded shadow-[0_0_20px_rgba(0,188,212,0.05)] border border-white/10 min-h-[140px] relative transition-colors duration-500 ${danger.colorClass.replace('text-', 'border-')}`}>
      
      {/* Header Container - Flex Layout to prevent overlap */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 pb-2 border-b border-white/5 gap-3">
        
        <div className="text-xs font-bold tracking-widest text-[#00bcd4] uppercase flex items-center gap-2 shrink-0">
          <span>/// ОБЩАЯ СВОДКА</span>
          <span className="text-gray-500 hidden md:inline">|</span>
          <span className="text-gray-400 hidden md:inline">{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} UTC</span>
        </div>

        {/* Controls Container */}
        <div className="flex items-center gap-3 self-end md:self-auto">
            {/* Danger Index Indicator */}
            <div className="flex items-center gap-3 bg-black/30 px-3 py-1 rounded border border-white/10">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className={danger.colorClass} />
                    <span className="text-[10px] uppercase tracking-widest text-gray-400 hidden sm:inline">ГЕОМАГНИТНЫЙ ФОН:</span>
                </div>
                <div className={`font-bold text-sm ${danger.colorClass}`}>
                    {danger.label}
                </div>
                <InfoTooltip 
                    title="Общий статус"
                    description={
                        <>
                            <p className="mb-2">Интегральная оценка текущей космической погоды.</p>
                            <ul className="list-disc list-inside space-y-1 mt-1">
                                <li><span className="text-green-400">Фоновый</span>: Обычные условия.</li>
                                <li><span className="text-yellow-400">Умеренный</span>: Повышенная активность.</li>
                                <li><span className="text-red-500">Высокий</span>: Пиковые значения.</li>
                            </ul>
                        </>
                    }
                />
            </div>

            {/* Sound Button - Now part of the flow, no absolute positioning */}
            <button 
                onClick={toggleSound} 
                className={`p-1.5 rounded-full transition-all border flex-shrink-0 ${isSoundOn ? 'text-[#00bcd4] bg-[#00bcd4]/10 border-[#00bcd4]/30' : 'text-gray-500 hover:text-gray-300 border-transparent'}`}
                title={isSoundOn ? "Выключить звук" : "Включить звук печати"}
            >
                {isSoundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
        </div>
      </div>

      <div className="font-mono text-sm md:text-base leading-relaxed text-cyan-50 min-h-[3rem]">
        {paragraphs.map((para, i) => {
            if (!para) return null;
            return (
                <div key={i} className="mb-3 last:mb-0">
                    {/* Parse highlights for specific keywords */}
                    {para.split(/(СТАТУС:|ПРИМЕЧАНИЕ:|ВНИМАНИЕ:)/g).map((chunk, j) => {
                        if (['СТАТУС:', 'ПРИМЕЧАНИЕ:', 'ВНИМАНИЕ:'].includes(chunk)) {
                            return <span key={j} className="text-[#00bcd4] font-bold mr-1">{chunk}</span>;
                        }
                        return <span key={j}>{chunk}</span>;
                    })}
                    {/* Cursor only on the last line while typing */}
                    {i === paragraphs.length - 1 && displayedText.length < text.length && (
                        <span className="animate-pulse inline-block w-2 h-4 bg-[#00bcd4] ml-1 align-middle"></span>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};
