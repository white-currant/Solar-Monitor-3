
import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X, Radiation } from 'lucide-react';

interface ProtonGraphProps {
  flux: number; // pfu >= 10MeV
}

export const ProtonGraph: React.FC<ProtonGraphProps> = ({ flux }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<{x: number, y: number, speed: number, len: number, alpha: number}[]>([]);
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
        const time = Date.now() * 0.001;

        // --- PHYSICS LOGIC ---
        
        // Flux Scaling
        // S0 (Background) < 10
        // S1 (Minor) > 10
        // S2 (Moderate) > 100
        // S3 (Strong) > 1000
        
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

        // Storm Warning Background Glow
        if (flux >= 10) {
            const intensity = Math.min(0.3, Math.log10(flux) * 0.05);
            ctx.fillStyle = `rgba(0, 230, 118, ${intensity})`; 
            ctx.fillRect(0, 0, w, h);
        }

        // 1. Draw Particles (Rain)
        ctx.strokeStyle = flux >= 100 ? '#ffff00' : '#00e676'; 
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

        // --- DRAW ASSETS ---

        // Determine Impact Levels
        // Satellite (GPS) - Sensitive to > 100 pfu (S2)
        let satStatus = 'OK';
        let satColor = '#00bcd4';
        let satJitter = 0;
        
        if (flux >= 100) { satStatus = 'WARN'; satColor = '#ffca28'; }
        if (flux >= 1000) { satStatus = 'FAIL'; satColor = '#ff1744'; satJitter = 2; }
        if (flux >= 10000) { satStatus = 'CRIT'; satColor = '#ff1744'; satJitter = 5; }

        // Plane (Atmosphere) - Sensitive to > 1000 pfu (S3) for HF Radio/Radiation
        let planeStatus = 'OK';
        let planeColor = '#00e676';
        if (flux >= 1000) { planeStatus = 'WARN'; planeColor = '#ffca28'; }
        if (flux >= 10000) { planeStatus = 'RISK'; planeColor = '#ff1744'; }

        // Draw Satellite (Orbit - High)
        const satX = (w * 0.8) + (Math.random() - 0.5) * satJitter;
        const satY = (h * 0.25) + Math.sin(time) * 5 + (Math.random() - 0.5) * satJitter;
        
        drawSatellite(ctx, satX, satY, satColor, satStatus);

        // Draw Plane (Atmosphere - Low)
        const planeSpeed = 0.5;
        const planeX = ((time * 30) % (w + 100)) - 50; // Moving
        const planeY = h * 0.65;
        
        drawPlane(ctx, planeX, planeY, planeColor, planeStatus);

        // Legend / HUD
        if (!showLegend) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px monospace';
            ctx.fillText('МОДЕЛЬ ВОЗДЕЙСТВИЯ', 10, h-10);
            
            let status = "ФОН";
            if (flux >= 10) status = "ШТОРМ S1";
            if (flux >= 100) status = "ШТОРМ S2";
            if (flux >= 1000) status = "ШТОРМ S3";
            if (flux >= 10000) status = "ШТОРМ S4";
            
            ctx.fillStyle = flux >= 10 ? '#ffca28' : '#4b5563';
            ctx.textAlign = 'right';
            ctx.fillText(`СТАТУС: ${status}`, w - 10, h - 10);
            ctx.textAlign = 'left';
        }
    };

    // Helper: Draw Satellite
    const drawSatellite = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, status: string) => {
        ctx.save();
        ctx.translate(x, y);
        
        // Panels
        ctx.fillStyle = '#1565c0'; // Solar panel blue
        ctx.fillRect(-18, -4, 36, 8);
        // Body
        ctx.fillStyle = color;
        ctx.fillRect(-6, -6, 12, 12);
        // Antenna
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.moveTo(0, 6);
        ctx.lineTo(0, 12);
        ctx.stroke();
        
        // Pulse if critical
        if (status === 'FAIL' || status === 'CRIT') {
            if (Math.floor(Date.now() / 200) % 2 === 0) {
                ctx.strokeStyle = '#ff1744';
                ctx.beginPath();
                ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
                ctx.moveTo(10, -10); ctx.lineTo(-10, 10);
                ctx.stroke();
            }
        }

        // Label
        ctx.fillStyle = color;
        ctx.font = '9px monospace';
        ctx.fillText(`GPS: ${status}`, 20, 4);
        
        ctx.restore();
    };

    // Helper: Draw Plane
    const drawPlane = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, status: string) => {
        ctx.save();
        ctx.translate(x, y);
        
        ctx.fillStyle = color;
        // Fuselage
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-10, 0);
        ctx.lineTo(-12, -4); // Tail
        ctx.lineTo(-8, 0);
        ctx.fill();
        // Wings
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-4, 8);
        ctx.lineTo(4, 8);
        ctx.fill();

        // Label
        ctx.fillStyle = color;
        ctx.font = '9px monospace';
        ctx.fillText(`NAV: ${status}`, -10, 18);

        ctx.restore();
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
      
      <button 
        onClick={() => setShowLegend(!showLegend)}
        className="absolute top-2 right-2 text-gray-500 hover:text-cyan-400 transition-colors z-20"
        title="Что изображено?"
      >
        {showLegend ? <X size={16} /> : <HelpCircle size={16} />}
      </button>

      {showLegend && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm p-4 text-xs text-gray-300 flex flex-col justify-center z-10">
            <h4 className="text-cyan-400 font-bold mb-2 uppercase">Влияние на технику</h4>
            <ul className="space-y-2">
                <li className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-400 rounded-sm"></div>
                    <span><strong>Спутники (GPS):</strong> Уязвимы для прямых попаданий частиц (сбои памяти).</span>
                </li>
                <li className="flex items-center gap-2">
                    <div className="text-green-400 font-bold text-[10px]">✈</div>
                    <span><strong>Авиация:</strong> Защищена атмосферой. Риск только при S4/S5 на полюсах.</span>
                </li>
                <li className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">Красный статус:</span>
                    <span>Высокая вероятность сбоев электроники на орбите.</span>
                </li>
            </ul>
        </div>
      )}
    </div>
  );
};
