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
    const unlockAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const toggleSound = () => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
    setIsSoundOn(!isSoundOn);
  };

  const playBlip = () => {
     if (!isSoundOn || !audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
     const ctx = audioCtxRef.current;
     
     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     
     osc.type = 'sine';
     const freq = 800 + Math.random() * 100;
     osc.frequency.setValueAtTime(freq, ctx.currentTime);
     
     gain.gain.setValueAtTime(0.01, ctx.currentTime); 
     gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
     
     osc.connect(gain);
     gain.connect(ctx.destination);
     
     osc.start();
     osc.stop(ctx.currentTime + 0.05);
  };

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i));
      
      if (i > 0 && i < text.length && i % 2 === 0) {
        playBlip();
      }
      
      i++;
      if (i > text.length) clearInterval(timer);
    }, 25); 

    return () => clearInterval(timer);
  }, [text, isSoundOn]);

  return (
    <div className={`mb-8 p-5 border-l-4 bg-[#10141e]/60 backdrop-blur-md rounded shadow-[0_0_20px_rgba(0,188,212,0.05)] border border-white/10 min-h-[140px] relative transition-colors duration-500 ${danger.colorClass.replace('text-', 'border-')}`}>
      <div className="absolute top-3 right-3 z-10">
        <button 
            onClick={toggleSound} 
            className={`p-2 rounded-full transition-all border border-transparent ${isSoundOn ? 'text-[#00bcd4] bg-[#00bcd4]/10 border-[#00bcd4]/30' : 'text-gray-500 hover:text-gray-300'}`}
            title={isSoundOn ? "Выключить звук" : "Включить звук печати"}
        >
            {isSoundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>
      
      <div className="flex flex-wrap justify-between items-center mb-4 pb-2 border-b border-white/5">
        <div className="text-xs font-bold tracking-widest text-[#00bcd4] uppercase flex items-center gap-2">
          <span>/// ОБЩАЯ СВОДКА</span>
          <span className="text-gray-500 hidden md:inline">|</span>
          <span className="text-gray-400 hidden md:inline">{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} UTC</span>
        </div>

        {/* Danger Index Indicator */}
        <div className="flex items-center gap-3 bg-black/30 px-3 py-1 rounded border border-white/10 mt-2 md:mt-0">
            <div className="flex items-center gap-2">
                <AlertTriangle size={16} className={danger.colorClass} />
                <span className="text-[10px] uppercase tracking-widest text-gray-400">ГЕОМАГНИТНЫЙ ФОН:</span>
            </div>
            <div className={`font-bold ${danger.colorClass}`}>
                {danger.label}
            </div>
            <InfoTooltip 
                title="Общий статус"
                align="left"
                description={
                    <>
                        <p className="mb-2">Интегральная оценка текущей космической погоды.</p>
                        <p className="text-xs text-gray-400 mb-2">Рассчитывается на основе усредненных данных за последние часы для исключения случайных помех.</p>
                        <ul className="list-disc list-inside space-y-1 mt-1">
                            <li><span className="text-green-400">Фоновый</span>: Обычные условия.</li>
                            <li><span className="text-yellow-400">Умеренный</span>: Повышенная активность, безопасная для человека.</li>
                            <li><span className="text-red-500">Высокий</span>: Пиковые значения (Бури, Вспышки).</li>
                        </ul>
                    </>
                }
            />
        </div>
      </div>

      <div className="font-mono text-base md:text-lg leading-relaxed text-cyan-50 whitespace-pre-wrap min-h-[3rem]">
        {displayedText}
        <span className="animate-pulse inline-block w-2 h-4 bg-[#00bcd4] ml-1 align-middle"></span>
      </div>
    </div>
  );
};
