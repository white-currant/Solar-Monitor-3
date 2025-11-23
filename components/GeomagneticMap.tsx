import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface GeomagneticMapProps {
  kp: number;
  windSpeed?: number;
  density?: number;
}

export const GeomagneticMap: React.FC<GeomagneticMapProps> = ({ kp, windSpeed = 400, density = 5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateDimensions = () => {
        if(canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = 160;
        }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // FPS Limiter
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
        const time = Date.now() * 0.002; 
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);

        // 1. Sunlight Gradient (Instead of Arrow)
        const sunGrad = ctx.createRadialGradient(0, cy, 10, 80, cy, 120);
        sunGrad.addColorStop(0, 'rgba(255, 202, 40, 0.2)');
        sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, cx, h);

        // Physics Calculation for Breathing
        const pressure = (density * Math.pow(windSpeed, 2)) / 200000;
        // Breathing effect based on time and pressure
        const breath = Math.sin(time * 2) * 2;
        const compression = Math.min(30, Math.max(5, (pressure * 10))) + breath;
        
        // Magnetosphere Shape (Teardrop / Bullet)
        // Day side (left) is compressed, Night side (right) is elongated
        const r = 30; // Earth Radius (Visual)
        const noseX = cx - (r + 30 - compression); // Compressed nose
        const tailX = cx + (r + 80); // Long tail
        
        // Colors
        let lineColor = '#00e676';
        let jitter = 0;
        if (kp >= 4) { lineColor = '#ffca28'; jitter = 1; }
        if (kp >= 5) { lineColor = '#ff1744'; jitter = 3; }

        // Draw Field Lines (Teardrop shape)
        const drawShell = (scale: number, alpha: number) => {
            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.globalAlpha = alpha;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -time * 20; // Flow animation

            // Bezier curve to form teardrop
            // Start at poles
            ctx.moveTo(cx, cy - 10); // North Pole
            
            // Curve around day side
            // CP1 (Top Left), CP2 (Bottom Left)
            const dX = noseX - (scale * 10) + (Math.random()-0.5)*jitter;
            
            // Left lobe
            ctx.bezierCurveTo(
                dX, cy - (40 * scale), // CP1
                dX, cy + (40 * scale), // CP2
                cx, cy + 10 // South Pole
            );
            
            // Right lobe (Tail)
            const tX = tailX + (scale * 20);
            ctx.bezierCurveTo(
                tX, cy + (40 * scale), 
                tX, cy - (40 * scale), 
                cx, cy - 10
            );
            
            ctx.stroke();
            ctx.setLineDash([]);
        };

        for(let i=1; i<=3; i++) {
            drawShell(i * 0.5, 1 - (i*0.2));
        }
        ctx.globalAlpha = 1;

        // Draw Earth
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#151a25';
        ctx.fill();
        // Day/Night on Earth
        ctx.beginPath();
        ctx.arc(cx, cy, 12, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#4fc3f7'; // Day side facing left
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 12, Math.PI * 1.5, Math.PI * 0.5);
        ctx.fillStyle = '#0d47a1'; // Night side facing right
        ctx.fill();

        // Aurora Glow
        if (kp >= 5) {
            ctx.fillStyle = `rgba(0, 255, 100, 0.5)`;
            ctx.beginPath();
            ctx.arc(cx, cy, 16, 0, Math.PI*2);
            ctx.fill();
        }

        // Text Overlays
        if (!showLegend) {
            ctx.fillStyle = '#ffca28';
            ctx.font = '9px monospace';
            ctx.fillText('ДАВЛЕНИЕ ВЕТРА', 10, cy);
            
            ctx.fillStyle = '#6b7280';
            ctx.fillText(kp >= 5 ? 'МАГНИТОСФЕРА (СЖАТИЕ)' : 'МАГНИТОСФЕРА (НОРМА)', w - 130, h-10);
        }
    };
    
    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [kp, showLegend, windSpeed, density]);

  return (
    <div className="w-full h-[160px] bg-black/40 rounded border border-white/5 mb-4 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 text-[10px] text-gray-500 font-mono tracking-widest pointer-events-none">
        МОДЕЛЬ МАГНИТОСФЕРЫ
      </div>

      <button 
        onClick={() => setShowLegend(!showLegend)}
        className="absolute top-2 right-2 text-gray-500 hover:text-cyan-400 transition-colors z-20"
        title="Справка"
      >
        {showLegend ? <X size={16} /> : <HelpCircle size={16} />}
      </button>

      {showLegend && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 text-xs text-gray-300 flex flex-col justify-center z-10">
            <h4 className="text-cyan-400 font-bold mb-2 uppercase">Как читать карту?</h4>
            <ul className="space-y-2">
                <li className="flex items-center gap-2">
                    <span className="text-yellow-400 font-bold">Свечение слева:</span>
                    <span>Давление солнечного ветра.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-green-400 font-bold">Форма капли:</span>
                    <span>Реальная форма магнитного щита Земли.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-red-500">Вибрация:</span>
                    <span>Реакция поля на геомагнитный шторм.</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};