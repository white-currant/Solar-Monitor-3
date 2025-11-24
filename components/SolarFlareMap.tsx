
import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X, Camera } from 'lucide-react';

interface SolarFlareMapProps {
  flareClass: string;
  flux: number;
  windSpeed: number; // Used to detect Coronal Hole High Speed Streams
  onOpenSdo: () => void;
}

export const SolarFlareMap: React.FC<SolarFlareMapProps> = ({ flareClass, flux, windSpeed, onOpenSdo }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [showLegend, setShowLegend] = useState(false);

  // Random spots generator based on current flux
  const [spots, setSpots] = useState<{angle: number, size: number}[]>([]);
  // Coronal Holes (Dark patches) - Generated if wind speed suggests CH HSS
  const [holes, setHoles] = useState<{x: number, y: number, r: number, points: number[], angleOffset: number}[]>([]);

  useEffect(() => {
      // 1. SUNSPOTS LOGIC
      const logFlux = Math.log10(flux || 1e-8);
      const spotCount = Math.max(2, Math.min(8, Math.floor((logFlux + 8) * 2)));
      
      const newSpots = Array.from({length: spotCount}, () => ({
          angle: Math.random(), 
          size: 2 + Math.random() * 4
      }));
      setSpots(newSpots);

      // 2. CORONAL HOLES LOGIC
      // Cleaned up logic for "Neater" shapes
      if (windSpeed > 450) {
          const holeCount = windSpeed > 650 ? 2 : 1; // Fewer, bigger holes for cleaner look
          const newHoles = Array.from({length: holeCount}, () => {
              // Pre-calculate noise points for a fixed shape that just rotates/morphs slightly
              const numPoints = 12;
              const points = Array.from({length: numPoints}, () => 0.8 + Math.random() * 0.4); // Radius multipliers
              
              return {
                  x: (Math.random() - 0.5) * 0.8, 
                  y: (Math.random() - 0.5) * 0.5, 
                  r: 60 + (windSpeed - 400) / 5, // Size
                  points: points,
                  angleOffset: Math.random() * Math.PI
              };
          });
          setHoles(newHoles);
      } else {
          setHoles([]);
      }

  }, [Math.floor(Math.log10(flux || 1e-8)), Math.floor(windSpeed / 100)]);

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

    // Lightning Function
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

        // Colors
        let mainColor = '#f57f17'; 
        let coreColor = '#fff176';
        let coronaSize = 10;
        
        if (flareClass.includes('M')) { mainColor = '#ff6f00'; coreColor = '#fff'; coronaSize = 20; }
        if (flareClass.includes('X')) { mainColor = '#d50000'; coreColor = '#fff'; coronaSize = 40; }

        const cx = w / 2;
        const r = 180;
        const cy = h + 120; 

        // 1. Corona (Glow)
        const pulse = Math.sin(time * (flareClass.includes('X') ? 20 : 4)) * 3;
        const grad = ctx.createRadialGradient(cx, cy, r, cx, cy, r + coronaSize + pulse);
        grad.addColorStop(0, mainColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r + coronaSize + pulse, 0, Math.PI * 2); 
        ctx.fill();

        // 2. Sun Body (Base)
        ctx.save(); // Save state for clipping
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip(); // CLIP! Nothing draws outside the sun circle now

        // Draw Background Color
        ctx.fillStyle = mainColor;
        ctx.fillRect(0, 0, w, h);

        // 3. Draw Coronal Holes (Dark Patches)
        // Using 'destination-out' or just dark color? 
        // Coronal holes are cooler/darker.
        if (holes.length > 0) {
            holes.forEach(hole => {
                const hx = cx + hole.x * r * 0.9; 
                const hy = cy + hole.y * r * 0.9;
                
                ctx.beginPath();
                const numPoints = hole.points.length;
                
                for (let i = 0; i <= numPoints; i++) {
                    const idx = i % numPoints;
                    const angle = (i / numPoints) * Math.PI * 2 + hole.angleOffset + (time * 0.05);
                    
                    // Morphing radius
                    const radius = hole.r * hole.points[idx] * (1 + Math.sin(time + idx)*0.05); 
                    
                    const px = hx + Math.cos(angle) * radius;
                    const py = hy + Math.sin(angle) * radius * 0.6; // Flattened perspective
                    
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();

                // Dark Void with soft edge
                const holeGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hole.r * 1.2);
                holeGrad.addColorStop(0, 'rgba(30, 10, 5, 0.95)'); // Dark core
                holeGrad.addColorStop(0.7, 'rgba(60, 20, 0, 0.8)'); 
                holeGrad.addColorStop(1, 'rgba(245, 127, 23, 0)'); // Fade to sun color

                ctx.fillStyle = holeGrad;
                ctx.fill();
            });
        }

        ctx.restore(); // Remove clip

        // 4. Active Regions (Spots) & Prominences (Above surface)
        const startAngle = Math.PI * 1.25;
        const endAngle = Math.PI * 1.75;
        const angleRange = endAngle - startAngle;
        const activityLevel = Math.max(0, (Math.log10(flux) + 7) / 3); 

        spots.forEach((spot, idx) => {
            const angle = startAngle + (spot.angle * angleRange);
            const spotX = cx + Math.cos(angle) * (r - 4); // Slightly inside
            const spotY = cy + Math.sin(angle) * (r - 4);

            ctx.beginPath();
            ctx.fillStyle = coreColor;
            ctx.arc(spotX, spotY, spot.size, 0, Math.PI * 2);
            ctx.fill();

            // Draw Lightning (Prominence)
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
  }, [flareClass, flux, showLegend, spots, holes]);

  return (
    <div className="w-full h-[160px] bg-black/40 rounded border border-white/5 mb-4 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-2 text-[10px] text-gray-500 font-mono tracking-widest pointer-events-none">
        СИМУЛЯЦИЯ АКТИВНОСТИ
      </div>

      <div className="absolute top-2 right-2 flex gap-2 z-20">
          <button 
            onClick={onOpenSdo}
            className="flex items-center gap-1 text-[10px] font-bold bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 text-[#00bcd4] border border-[#00bcd4]/30 px-2 py-1 rounded transition-all uppercase"
            title="Открыть реальные снимки солнца (SDO)"
          >
            <Camera size={12} />
            <span>SDO (ФОТО)</span>
          </button>

          <button 
            onClick={() => setShowLegend(!showLegend)}
            className="text-gray-500 hover:text-cyan-400 transition-colors"
            title="Легенда"
          >
            {showLegend ? <X size={16} /> : <HelpCircle size={16} />}
          </button>
      </div>

      {showLegend && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 text-xs text-gray-300 flex flex-col justify-center z-10">
            <h4 className="text-cyan-400 font-bold mb-2 uppercase">Симуляция Активности</h4>
            <ul className="space-y-2">
                <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    <span><strong>Пятна:</strong> Активные регионы.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-[#1a0500] rounded-full border border-[#5d4037]"></span>
                    <span><strong>Темные зоны:</strong> Корональные дыры.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">Молнии:</span>
                    <span>Вспышечная активность (Flux).</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};
