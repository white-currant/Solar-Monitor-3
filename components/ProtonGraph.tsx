
import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X, Radiation } from 'lucide-react';

interface ProtonGraphProps {
  flux: number; // pfu >= 10MeV
}

export const ProtonGraph: React.FC<ProtonGraphProps> = ({ flux }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<{x: number, y: number, speed: number, len: number, alpha: number}[]>([]);
  const initializedRef = useRef(false);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const updateDimensions = () => {
       if(canvas.parentElement) {
           canvas.width = canvas.parentElement.clientWidth;
           canvas.height = 160; 
       }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // FPS THROTTLING
    let lastTime = 0;
    const fps = 30; 
    const interval = 1000 / fps;

    const draw = (timestamp: number) => {
        animationRef.current = requestAnimationFrame(draw);
        
        const deltaTime = timestamp - lastTime;
        if (deltaTime < interval) return;
        lastTime = timestamp - (deltaTime % interval);

        const w = canvas.width;
        const h = canvas.height;

        // Flux Scaling
        // S0 (Background) < 10
        // S1 (Minor) > 10
        // S2 (Moderate) > 100
        // S3 (Strong) > 1000
        
        // Visual Count: Scale logarithmically
        // flux 0.1 -> ~5 particles
        // flux 10 -> ~20 particles
        // flux 1000 -> ~100 particles
        const targetCount = Math.max(5, Math.min(150, Math.log10(Math.max(0.1, flux)) * 30 + 10));
        
        // Adjust pool size
        if (particlesRef.current.length < targetCount) {
            particlesRef.current.push({
                x: Math.random() * w,
                y: Math.random() * -h,
                speed: 5 + Math.random() * 10,
                len: 5 + Math.random() * 10,
                alpha: 0.2 + Math.random() * 0.5
            });
        } else if (particlesRef.current.length > targetCount) {
            particlesRef.current.pop();
        }

        // Clear
        ctx.fillStyle = '#10141e';
        ctx.fillRect(0, 0, w, h);

        // Storm Warning Background
        if (flux >= 10) {
            const intensity = Math.min(0.3, Math.log10(flux) * 0.05);
            ctx.fillStyle = `rgba(0, 230, 118, ${intensity})`; // Radioactive green glow
            ctx.fillRect(0, 0, w, h);
        }

        // Draw Particles (Rain)
        ctx.strokeStyle = flux >= 100 ? '#ffff00' : '#00e676'; // Green normal, Yellow/Red for storm
        if (flux >= 1000) ctx.strokeStyle = '#ff1744';

        ctx.lineWidth = 1.5;
        
        particlesRef.current.forEach(p => {
            p.y += p.speed;
            if (p.y > h) {
                p.y = -p.len;
                p.x = Math.random() * w;
            }

            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + p.len);
            ctx.stroke();
        });
        ctx.globalAlpha = 1;

        if (!showLegend) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px monospace';
            ctx.fillText('ПОТОК ЧАСТИЦ (ВИЗУАЛИЗАЦИЯ)', 10, h-10);
            
            let status = "ФОН";
            if (flux >= 10) status = "ШТОРМ S1";
            if (flux >= 100) status = "ШТОРМ S2";
            if (flux >= 1000) status = "ШТОРМ S3";
            if (flux >= 10000) status = "ШТОРМ S4";
            
            ctx.fillStyle = flux >= 10 ? '#ffca28' : '#4b5563';
            ctx.fillText(`СТАТУС: ${status}`, w - 100, h - 10);
        }
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [flux, showLegend]);

  return (
    <div className="w-full h-[160px] bg-black/40 rounded border border-white/5 mb-4 relative overflow-hidden group">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      <div className="absolute top-2 left-2 text-[10px] text-gray-500 font-mono tracking-widest pointer-events-none">
        МОДЕЛЬ ИЗЛУЧЕНИЯ
      </div>

      <button 
        onClick={() => setShowLegend(!showLegend)}
        className="absolute top-2 right-2 text-gray-500 hover:text-cyan-400 transition-colors z-20"
        title="Что изображено?"
      >
        {showLegend ? <X size={16} /> : <HelpCircle size={16} />}
      </button>

      {showLegend && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 text-xs text-gray-300 flex flex-col justify-center z-10">
            <h4 className="text-cyan-400 font-bold mb-2 uppercase">Протонный дождь</h4>
            <ul className="space-y-2">
                <li className="flex items-center gap-2">
                    <Radiation size={14} className="text-green-400" />
                    <span>Визуализация плотности потока заряженных частиц.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-yellow-400 font-bold">Интенсивность:</span>
                    <span>Количество линий соответствует уровню S-шкалы.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-gray-400">Безопасность:</span>
                    <span>Показывает обстановку на орбите, не на земле.</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};
