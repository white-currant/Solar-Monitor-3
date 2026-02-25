import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useCanvasVisibility } from '../hooks/useCanvasVisibility';

interface SolarMapProps {
  speed: number;    // km/s
  density: number;  // p/cm3
  kp: number;       // 0-9
}

export const SolarMap: React.FC<SolarMapProps> = ({ speed, density, kp }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<{x: number, y: number, vx: number, vy: number, size: number, alpha: number}[]>([]);
  const initializedRef = useRef(false);
  const [showLegend, setShowLegend] = useState(false);
  const isVisible = useCanvasVisibility(containerRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;
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

    // Initialize Particles Pool
    if (!initializedRef.current) {
        const count = 80; // Increased pool size for better density visualisation
        for(let i=0; i<count; i++) {
            particlesRef.current.push({
                x: Math.random() * canvas.width, 
                y: (Math.random() * canvas.height * 0.8) + (canvas.height * 0.1),
                vx: 0, 
                vy: 0,
                size: Math.random() < 0.2 ? 1.5 : 0.8,
                alpha: 0.3 + Math.random() * 0.7
            });
        }
        initializedRef.current = true;
    }

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
        const time = Date.now() * 0.001;

        // Clear
        ctx.fillStyle = '#10141e';
        ctx.fillRect(0, 0, w, h);

        // 1. Draw Sun (Left)
        const sunX = 0; 
        const sunY = h / 2;
        const sunRadius = 40;
        
        const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunRadius * 3);
        sunGrad.addColorStop(0, '#ffca28');
        sunGrad.addColorStop(0.3, 'rgba(255, 160, 0, 0.6)');
        sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(0, 0, 150, h);
        
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffeb3b';
        ctx.fill();

        // 2. Draw Earth (Right)
        const earthX = w - 60;
        const earthY = h / 2;
        const earthRadius = 12;

        ctx.beginPath();
        ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e88e5'; 
        ctx.fill();
        
        // Day/Night terminator
        ctx.beginPath();
        ctx.arc(earthX, earthY, earthRadius, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#4fc3f7'; 
        ctx.fill();

        // 3. Magnetosphere (Bow Shock)
        const pressure = (speed * density) / 2000; 
        const shockDist = Math.max(18, Math.min(50, 45 - pressure)); 
        
        let shieldColor = '#00e676'; 
        let shieldWidth = 2;
        
        if (kp >= 5) { shieldColor = '#ff1744'; shieldWidth = 4; } 
        else if (kp >= 4) { shieldColor = '#ffca28'; shieldWidth = 3; }

        ctx.beginPath();
        ctx.strokeStyle = shieldColor;
        ctx.lineWidth = shieldWidth;
        
        const jitter = kp >= 5 ? (Math.random() - 0.5) * 3 : 0;
        ctx.arc(earthX + jitter, earthY, shockDist, Math.PI * 0.7, Math.PI * 1.3);
        ctx.stroke();

        // 4. Solar Wind Particles (Dynamic Speed)
        
        // CALCULATE VISUAL SPEED
        // Real wind varies from ~300 (slow) to ~800+ (storm).
        // We want a noticeable difference.
        // 300km/s -> 2 pixels/frame (Lazy)
        // 500km/s -> 8 pixels/frame (Fast)
        // 800km/s -> 18 pixels/frame (Blazing)
        const visualSpeed = Math.max(2, (speed - 250) / 30);

        const activeCount = Math.min(particlesRef.current.length, Math.max(15, density * 6));

        ctx.fillStyle = '#fff';
        
        for (let i = 0; i < particlesRef.current.length; i++) {
            if (i > activeCount) continue; 

            const p = particlesRef.current[i];
            
            // Apply Speed with slight randomization for natural flow
            p.vx = visualSpeed * (0.9 + Math.random() * 0.2); 
            p.x += p.vx;
            
            // Reset logic
            const distToEarth = Math.sqrt(Math.pow(p.x - earthX, 2) + Math.pow(p.y - earthY, 2));
            const hitShield = (distToEarth < shockDist && p.x < earthX);
            
            if (p.x > w || hitShield) {
                p.x = sunRadius + Math.random() * 20; 
                p.y = sunY + (Math.random() * h * 0.8) - (h * 0.4); 
            }

            // Draw DOTS
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 5. DSCOVR Satellite (L1)
        const satX = w - 130;
        const satY = h / 2;
        
        const pulseR = (time * 30) % 15;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 255, 255, ${1 - (pulseR/15)})`;
        ctx.lineWidth = 1;
        ctx.arc(satX, satY, 8 + pulseR, -0.5, 0.5);
        ctx.stroke();

        ctx.fillStyle = '#00e5ff'; 
        ctx.fillRect(satX - 2, satY - 7, 4, 14);
        ctx.fillStyle = '#fff'; 
        ctx.fillRect(satX - 3, satY - 3, 6, 6);
        
        // Text Overlays
        if (!showLegend) {
            ctx.fillStyle = '#00e5ff';
            ctx.font = '9px monospace';
            ctx.fillText('L1', satX - 5, satY + 15);

            ctx.fillStyle = '#6b7280';
            ctx.font = '10px monospace';
            ctx.fillText('СОЛНЦЕ', 10, h - 10);
            ctx.fillText('ЗЕМЛЯ', w - 50, h - 10);
            ctx.fillStyle = '#4b5563';
            ctx.fillText(`(СКОРОСТЬ: ${Math.round(speed)} км/с)`, w/2 - 60, h - 10);
        }
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [speed, density, kp, showLegend, isVisible]);

  return (
    <div ref={containerRef} className="w-full h-[160px] bg-black/40 rounded border border-white/5 mb-4 relative overflow-hidden group">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      <div className="absolute top-2 left-2 text-[10px] text-gray-500 font-mono tracking-widest pointer-events-none">
        СИМУЛЯЦИЯ ВЕТРА
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
            <h4 className="text-cyan-400 font-bold mb-2 uppercase">Легенда карты</h4>
            <ul className="space-y-2">
                <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    <span><strong>Частицы:</strong> Скорость полета зависит от данных в реальном времени.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="w-1 h-3 bg-cyan-400"></span>
                    <span><strong>L1 (DSCOVR):</strong> Спутник, передающий данные.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 border border-cyan-300"></span>
                    <span><strong>Земля:</strong> Масштаб расстояний сжат для наглядности.</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};
