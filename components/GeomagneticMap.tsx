
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
            // Increased canvas height slightly to accommodate larger drawing
            canvas.height = 260;
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

        // 1. Sunlight Gradient (Intensity depends on wind speed)
        const sunIntensity = Math.min(0.8, Math.max(0.2, windSpeed / 1000));
        const sunGrad = ctx.createRadialGradient(0, cy, 10, 80 + (windSpeed/10), cy, 160);
        sunGrad.addColorStop(0, `rgba(255, 202, 40, ${sunIntensity})`);
        sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, cx, h);

        // SCALE FACTOR for larger drawing
        const S = 1.5; 

        // --- PHYSICS CALCULATIONS ---
        
        // Dynamic Pressure P = rho * v^2
        // Normal ~ 2nPa. Storm ~ 10-20nPa.
        // We scale this to pixels for visualization.
        const pressure = (density * Math.pow(windSpeed, 2)) / 100000; // Adjusted divider for better visual range
        
        // Breathing Animation (faster if wind is high)
        const breathSpeed = 1 + (windSpeed / 400);
        const breath = Math.sin(time * breathSpeed) * 2;
        
        // COMPRESSION (Day Side / Left):
        // High pressure pushes the nose closer to Earth.
        // Max compression shouldn't touch Earth (radius ~12*S).
        const maxCompression = 50 * S; 
        const compression = Math.min(maxCompression, (pressure * 3)) + breath;
        
        // TAIL STRETCH (Night Side / Right):
        // High wind speed elongates the magnetotail.
        const tailStretch = (windSpeed - 300) / 5; 

        // TURBULENCE (Flapping):
        // If Kp is high, the tail waves like a flag.
        const isStorm = kp >= 5;
        const turbulence = isStorm ? Math.sin(time * 3) * 10 : 0;

        // Coordinates
        const r = 12 * S; // Earth Radius Visual
        // Nose starts at roughly -70px from center (scaled), minus compression implies moving RIGHT (closer to 0 relative to Earth)
        // In this coordinate system, Earth is at cx. Nose is to the left (cx - offset).
        const baseNoseDist = 70 * S;
        const noseX = cx - (baseNoseDist - compression); 
        
        const baseTailDist = 120 * S;
        const tailX = cx + (baseTailDist + tailStretch);
        
        // Colors
        let lineColor = '#00e676';
        let jitter = 0;
        if (kp >= 4) { lineColor = '#ffca28'; jitter = 1; }
        if (kp >= 5) { lineColor = '#ff1744'; jitter = 3; }

        // Draw Field Lines
        const drawShell = (scale: number, alpha: number) => {
            ctx.beginPath();
            ctx.strokeStyle = lineColor;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -time * (10 + windSpeed/50); // Flow speed depends on wind speed

            // North Pole
            ctx.moveTo(cx, cy - (10 * S)); 
            
            // Control Points for Bezier
            // We add 'turbulence' to the Y coordinates of the tail control points
            
            const dX = noseX - (scale * 10 * S) + (Math.random()-0.5)*jitter;
            
            // Left lobe (Day side - Compressed)
            ctx.bezierCurveTo(
                dX, cy - (40 * scale * S), 
                dX, cy + (40 * scale * S), 
                cx, cy + (10 * S) // South Pole
            );
            
            // Right lobe (Tail side - Stretched & Turbulent)
            // Scale effect increases towards the tail
            const tailYOffset = turbulence * scale; 
            const tX = tailX + (scale * 20 * S);
            
            ctx.bezierCurveTo(
                tX, cy + (40 * scale * S) + tailYOffset, 
                tX, cy - (40 * scale * S) + tailYOffset, 
                cx, cy - (10 * S) // Back to North Pole
            );
            
            ctx.stroke();
            ctx.setLineDash([]);
        };

        for(let i=1; i<=3; i++) {
            drawShell(i * 0.55, 1 - (i*0.2));
        }
        ctx.globalAlpha = 1;

        // Draw Earth
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#151a25';
        ctx.fill();
        // Day/Night on Earth
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#4fc3f7'; // Day side
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 0.5);
        ctx.fillStyle = '#0d47a1'; // Night side
        ctx.fill();

        // Aurora Glow
        if (kp >= 5) {
            const glowSize = 4 + (Math.sin(time * 10) * 2);
            ctx.fillStyle = `rgba(0, 255, 100, 0.6)`;
            ctx.beginPath();
            ctx.arc(cx, cy - (r-2), glowSize, 0, Math.PI*2); // North
            ctx.arc(cx, cy + (r-2), glowSize, 0, Math.PI*2); // South
            ctx.fill();
        }

        // Text Overlays
        if (!showLegend) {
            ctx.fillStyle = '#ffca28';
            ctx.font = '9px monospace';
            ctx.fillText('ДАВЛЕНИЕ ВЕТРА', 10, cy);
            
            ctx.textAlign = 'right';
            ctx.fillStyle = '#6b7280';
            let statusText = 'МАГНИТОСФЕРА (НОРМА)';
            if (pressure > 20 || kp >= 5) statusText = 'МАГНИТОСФЕРА (СЖАТИЕ/ШТОРМ)';
            else if (pressure > 10) statusText = 'МАГНИТОСФЕРА (НАГРУЗКА)';
            
            ctx.fillText(statusText, w - 10, h-10);
            ctx.textAlign = 'left';
        }
    };
    
    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [kp, showLegend, windSpeed, density]);

  return (
    <div className="w-full h-[260px] bg-black/40 rounded border border-white/5 mb-4 relative overflow-hidden group">
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
                    <span>Давление ветра. Сильнее ветер = ярче свет.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-green-400 font-bold">Форма:</span>
                    <span>При шторме сжимается слева и вытягивается справа.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-red-500">Вибрация:</span>
                    <span>Турбулентность хвоста при высоком Kp-индексе.</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};
