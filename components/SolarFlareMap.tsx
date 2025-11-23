import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface SolarFlareMapProps {
  flareClass: string;
  flux: number;
}

export const SolarFlareMap: React.FC<SolarFlareMapProps> = ({ flareClass, flux }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [showLegend, setShowLegend] = useState(false);

  // Random spots generator based on current flux
  const [spots, setSpots] = useState<{angle: number, size: number}[]>([]);

  useEffect(() => {
      // Log scale flux to determine spot count
      const logFlux = Math.log10(flux || 1e-8);
      // Map flux to spot count roughly
      const spotCount = Math.max(2, Math.min(8, Math.floor((logFlux + 8) * 2)));
      
      const newSpots = Array.from({length: spotCount}, () => ({
          angle: Math.random(), 
          size: 2 + Math.random() * 4
      }));
      setSpots(newSpots);
  }, [Math.floor(Math.log10(flux || 1e-8))]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateDimensions = () => {
        if(canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            // Kept original height as user only asked to make Geomagnetic map larger
            canvas.height = 160;
        }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Optimized Lightning Function
    const drawLightning = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, displacement: number) => {
        if (displacement < 2) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return;
        }
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const midX_d = midX + (Math.random() - 0.5) * displacement;
        const midY_d = midY + (Math.random() - 0.5) * displacement;
        
        drawLightning(ctx, x1, y1, midX_d, midY_d, displacement / 2);
        drawLightning(ctx, midX_d, midY_d, x2, y2, displacement / 2);
    };

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
        const time = Date.now() * 0.001;

        ctx.clearRect(0, 0, w, h);

        // Intensity Colors
        let mainColor = '#f57f17'; 
        let coreColor = '#fff176';
        let coronaSize = 10;
        
        if (flareClass.includes('M')) { mainColor = '#ff6f00'; coreColor = '#fff'; coronaSize = 20; }
        if (flareClass.includes('X')) { mainColor = '#d50000'; coreColor = '#fff'; coronaSize = 40; }

        // 1. Draw Sun Geometry
        const cx = w / 2;
        const r = 180;
        const cy = h + 120; 

        // Corona Glow
        const pulse = Math.sin(time * (flareClass.includes('X') ? 20 : 4)) * 3;
        const grad = ctx.createRadialGradient(cx, cy, r, cx, cy, r + coronaSize + pulse);
        grad.addColorStop(0, mainColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r + coronaSize + pulse, 0, Math.PI * 2); 
        ctx.fill();

        // Sun Body
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        
        // 2. Active Regions (Spots) & Reactive Prominences
        const startAngle = Math.PI * 1.25;
        const endAngle = Math.PI * 1.75;
        const angleRange = endAngle - startAngle;

        // Activity Threshold: Only draw arcs if Flux is high enough (> C class roughly)
        // C class starts at 1e-6. Base flux is 1e-8.
        const activityLevel = Math.max(0, (Math.log10(flux) + 7) / 3); // 0 to 1 scale roughly

        spots.forEach((spot, idx) => {
            const angle = startAngle + (spot.angle * angleRange);
            const spotX = cx + Math.cos(angle) * (r - 3);
            const spotY = cy + Math.sin(angle) * (r - 3);

            ctx.beginPath();
            ctx.fillStyle = coreColor;
            ctx.arc(spotX, spotY, spot.size, 0, Math.PI * 2);
            ctx.fill();

            // Draw Electric Prominences (Reactive)
            // Probability depends on activity level
            if (Math.random() < activityLevel * 0.3) {
                 ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                 ctx.lineWidth = 1.5;
                 
                 const loopHeight = 30 + Math.sin(time * 10 + idx) * 10 * activityLevel;
                 const baseSpan = 0.05; 
                 const lx = cx + Math.cos(angle - baseSpan) * (r - 2);
                 const ly = cy + Math.sin(angle - baseSpan) * (r - 2);
                 const rx = cx + Math.cos(angle + baseSpan) * (r - 2);
                 const ry = cy + Math.sin(angle + baseSpan) * (r - 2);
                 const tipX = cx + Math.cos(angle) * (r + loopHeight);
                 const tipY = cy + Math.sin(angle) * (r + loopHeight);
                 
                 const jitter = (Math.random() - 0.5) * 8;

                 ctx.beginPath();
                 drawLightning(ctx, lx, ly, tipX + jitter, tipY + jitter, 8);
                 drawLightning(ctx, tipX + jitter, tipY + jitter, rx, ry, 8);
            }
        });
        
        if (!showLegend) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px monospace';
            ctx.fillText('ПОВЕРХНОСТЬ СОЛНЦА', 10, h-10);
            
            const pText = activityLevel > 0.5 ? 'АКТИВНОСТЬ: ВЫСОКАЯ' : 'АКТИВНОСТЬ: НИЗКАЯ';
            ctx.fillStyle = activityLevel > 0.5 ? '#ffca28' : '#6b7280';
            ctx.fillText(pText, w-130, h-10);
        }
    };
    
    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [flareClass, flux, showLegend, spots]);

  return (
    <div className="w-full h-[160px] bg-black/40 rounded border border-white/5 mb-4 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 text-[10px] text-gray-500 font-mono tracking-widest pointer-events-none">
        СИМУЛЯЦИЯ АКТИВНОСТИ
      </div>

      <button 
        onClick={() => setShowLegend(!showLegend)}
        className="absolute top-2 right-2 text-gray-500 hover:text-cyan-400 transition-colors z-20"
        title="Что это?"
      >
        {showLegend ? <X size={16} /> : <HelpCircle size={16} />}
      </button>

      {showLegend && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 text-xs text-gray-300 flex flex-col justify-center z-10">
            <h4 className="text-cyan-400 font-bold mb-2 uppercase">Симуляция Активности</h4>
            <ul className="space-y-2">
                <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    <span><strong>Пятна:</strong> Активные регионы на лимбе Солнца.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">Молнии:</span>
                    <span>Электрические дуги. Интенсивность зависит от потока излучения (Flux).</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">Цвет:</span>
                    <span>Зависит от класса вспышки (M/X = Ярче).</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};
