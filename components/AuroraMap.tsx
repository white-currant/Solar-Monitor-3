import React, { useRef, useEffect, useState } from 'react';
import { HelpCircle, X, Map, Layers, RotateCw } from 'lucide-react';

interface AuroraMapProps {
  kp: number;
}

export const AuroraMap: React.FC<AuroraMapProps> = ({ kp }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [showLegend, setShowLegend] = useState(false);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  // Load Map Texture (NASA Blue Marble)
  useEffect(() => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      // Reliable standard NASA map
      img.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png";
      
      const onLoad = () => {
          mapImageRef.current = img;
          setImageLoaded(true);
      };

      const onError = () => {
          console.warn("Map image failed to load, switching to vector grid.");
          setUseFallback(true);
          setImageLoaded(true); // Stop loading spinner
      };

      img.onload = onLoad;
      img.onerror = onError;

      // Safety timeout: If image hangs for 3s, force fallback
      const timeout = setTimeout(() => {
          if (!imageLoaded && !mapImageRef.current) {
              onError();
          }
      }, 3000);

      return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateDimensions = () => {
        if(canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = 320;
        }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    let lastTime = 0;
    const fps = 30;
    const interval = 1000 / fps;

    // --- PROJECTION CONFIG ---
    // Focus on Northern Hemisphere: Lat 35N to 90N
    const MIN_LAT = 35;
    const MAX_LAT = 88;
    
    const project = (lat: number, lon: number, w: number, h: number) => {
        // Clamp
        const cLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat));
        // Equirectangular X: (-180..180) -> (0..w)
        const x = ((lon + 180) / 360) * w;
        // Equirectangular Y: (MaxLat..MinLat) -> (0..h)
        const y = ((MAX_LAT - cLat) / (MAX_LAT - MIN_LAT)) * h;
        return { x, y };
    };

    const draw = (timestamp: number) => {
        animationRef.current = requestAnimationFrame(draw);
        
        const deltaTime = timestamp - lastTime;
        if (deltaTime < interval) return;
        lastTime = timestamp - (deltaTime % interval);

        const w = canvas.width;
        const h = canvas.height;
        
        // Time Calc for Day/Night
        const now = new Date();
        const utcHours = now.getUTCHours() + (now.getUTCMinutes()/60);
        // Sun is at Longitude: (12 - UTC) * 15deg
        const sunLon = (12 - utcHours) * 15;
        // Normalize to -180...180
        let sunLonNorm = ((sunLon + 180) % 360) - 180;
        if (sunLonNorm < -180) sunLonNorm += 360;

        const midnightLon = sunLonNorm > 0 ? sunLonNorm - 180 : sunLonNorm + 180;

        ctx.clearRect(0, 0, w, h);

        // --- 1. MAP BACKGROUND ---
        if (!useFallback && imageLoaded && mapImageRef.current) {
            const img = mapImageRef.current;
            // Crop calculation
            const imgPxPerDeg = img.naturalHeight / 180;
            const sy = (90 - MAX_LAT) * imgPxPerDeg;
            const sh = (MAX_LAT - MIN_LAT) * imgPxPerDeg;
            
            // Draw darker "Night Mode" version
            ctx.filter = 'grayscale(80%) contrast(110%) brightness(40%)'; 
            ctx.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, w, h);
            ctx.filter = 'none';
        } else {
            // Fallback Vector Grid
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath();
            for(let x=0; x<=w; x+=w/6) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
            for(let y=0; y<=h; y+=h/4) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
            ctx.stroke();
            
            // Simple Continents hint (Very rough approximation for context)
            ctx.fillStyle = '#1e293b';
            // North America blob
            ctx.beginPath(); ctx.arc(w*0.2, h*0.5, w*0.1, 0, Math.PI*2); ctx.fill();
            // Europe blob
            ctx.beginPath(); ctx.arc(w*0.55, h*0.4, w*0.05, 0, Math.PI*2); ctx.fill();
            // Russia blob
            ctx.beginPath(); ctx.ellipse(w*0.75, h*0.3, w*0.15, w*0.05, 0, 0, Math.PI*2); ctx.fill();
        }

        // --- 2. AURORA HEATMAP (OVATION MODEL) ---
        // Centered on Magnetic Pole (approx 80N, 72W)
        // Shifted towards Night Side
        
        const MAG_POLE_LON = -72.5; 
        const centerLat = 82 - (kp * 1.5); 
        const bandWidth = 5 + (kp * 2.5); 
        
        ctx.save();
        ctx.globalCompositeOperation = 'screen'; // Additive blending makes it glow
        
        // High res drawing
        const step = 2; 
        
        for (let lon = -180; lon < 180; lon += step) {
            // Magnetic Offset
            let deltaLon = (lon - MAG_POLE_LON + 180 + 360) % 360 - 180;
            const magFactor = Math.cos((deltaLon * Math.PI) / 180);
            
            // Night Offset
            let timeDelta = (lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);
            
            // Combined Latitude
            const lat = 74 - (kp * 2.0) - (magFactor * 4) + (nightFactor * 3);
            
            if (lat < MIN_LAT) continue;

            const x1 = project(lat, lon, w, h).x;
            const x2 = project(lat, lon + step, w, h).x;
            const wSlice = x2 - x1 + 1;

            const pTop = project(lat + bandWidth/2, lon, w, h);
            const pBot = project(lat - bandWidth/2, lon, w, h);
            const hSlice = Math.abs(pBot.y - pTop.y);

            // PROBABILITY INTENSITY
            const intensity = 0.3 + (Math.max(0, nightFactor) * 0.7);
            const kpStrength = Math.min(1, kp / 7);

            // Vertical Gradient
            const grad = ctx.createLinearGradient(0, pTop.y, 0, pBot.y);
            
            const baseHue = 140; // Green
            const stormHue = 60; // Yellow
            const hue = baseHue - (kpStrength * (baseHue - stormHue));
            
            grad.addColorStop(0, `hsla(${hue}, 100%, 50%, 0)`);
            grad.addColorStop(0.2, `hsla(${hue}, 100%, 50%, ${0.2 * intensity})`);
            grad.addColorStop(0.5, `hsla(${hue - (kp>6?60:0)}, 100%, ${kp>6?70:50}%, ${0.6 * intensity})`);
            grad.addColorStop(0.8, `hsla(${hue}, 100%, 50%, ${0.2 * intensity})`);
            grad.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);

            ctx.fillStyle = grad;
            ctx.fillRect(x1, pTop.y, wSlice, hSlice);
        }
        
        ctx.restore();

        // --- 3. CITIES ---
        const cities = [
            { name: "Мурманск", lat: 68.9, lon: 33.0 },
            { name: "Минск", lat: 53.9, lon: 27.5 },
            { name: "Осло", lat: 59.9, lon: 10.7 },
            { name: "Анкоридж", lat: 61.2, lon: -149.9 },
            { name: "Торонто", lat: 43.6, lon: -79.3 },
            { name: "Рейкьявик", lat: 64.1, lon: -21.8 },
            { name: "Москва", lat: 55.7, lon: 37.6 }
        ];

        cities.forEach(city => {
            if (city.lat < MIN_LAT || city.lat > MAX_LAT) return;
            const p = project(city.lat, city.lon, w, h);
            
            // Visibility Logic
            let timeDelta = (city.lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);
            let magDelta = (city.lon - MAG_POLE_LON + 180 + 360) % 360 - 180;
            const magFactor = Math.cos((magDelta * Math.PI) / 180);
            
            const auroraLat = 74 - (kp * 2.0) - (magFactor * 4) + (nightFactor * 3);
            const southernEdge = auroraLat - (bandWidth * 0.8); 
            
            const isVisible = city.lat >= southernEdge;
            const isNight = Math.abs(timeDelta) < 100; // Approx night

            ctx.beginPath(); 
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2); 
            
            if (isVisible && isNight) {
                ctx.fillStyle = '#00e676';
                ctx.shadowColor = '#00e676';
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = '#64748b';
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = (isVisible && isNight) ? '#fff' : '#94a3b8';
            ctx.font = '10px monospace';
            ctx.fillText(city.name, p.x + 5, p.y + 3);
        });

        // --- 4. NIGHT SHADOW ---
        const nightX = project(0, midnightLon, w, h).x;
        
        ctx.save();
        ctx.globalCompositeOperation = 'multiply'; // Darkens map
        
        const drawShadow = (nx: number) => {
            const g = ctx.createRadialGradient(nx, h/2, w*0.1, nx, h/2, w*0.8);
            g.addColorStop(0, 'rgba(0,0,0,0.8)');
            g.addColorStop(0.5, 'rgba(0,0,0,0.3)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }
        drawShadow(nightX);
        if (nightX < w/2) drawShadow(nightX + w);
        else drawShadow(nightX - w);
        
        ctx.restore();

        if (!showLegend) {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(useFallback ? 'VECTOR MAP (FALLBACK)' : 'SATELLITE VIEW (NASA)', w - 10, h - 10);
            ctx.textAlign = 'left';
        }
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [kp, showLegend, imageLoaded, useFallback]);

  return (
    <div className="w-full h-[320px] bg-[#050a14] rounded border border-white/5 mb-4 relative overflow-hidden group">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      <div className="absolute top-2 left-2 text-[10px] text-gray-300 font-bold font-mono tracking-widest pointer-events-none flex items-center gap-2 drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-md border border-white/10">
        <Map size={12} />
        КАРТА СИЯНИЙ (СЕВЕРНОЕ ПОЛУШАРИЕ)
      </div>
      
      {!imageLoaded && !useFallback && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050a14] z-10">
              <span className="text-xs text-gray-500 font-mono animate-pulse flex items-center gap-2">
                  <RotateCw className="animate-spin" size={12} /> ЗАГРУЗКА КАРТЫ...
              </span>
          </div>
      )}

      <button 
        onClick={() => setShowLegend(!showLegend)}
        className="absolute top-2 right-2 text-gray-400 hover:text-cyan-400 transition-colors z-20 bg-black/30 p-1.5 rounded backdrop-blur-sm border border-white/5"
        title="Легенда"
      >
        {showLegend ? <X size={16} /> : <Layers size={16} />}
      </button>

      {showLegend && (
        <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md p-5 text-xs text-gray-300 flex flex-col justify-center z-10 animate-in fade-in duration-200">
            <h4 className="text-cyan-400 font-bold mb-3 uppercase flex items-center gap-2">
                <Map size={14} /> Легенда Карты
            </h4>
            <p className="mb-4 leading-relaxed text-gray-400">
                Карта отображает зону вероятности полярных сияний (OVATION) и терминатор (линию ночи).
            </p>
            <div className="space-y-3 font-mono">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-3 bg-gradient-to-r from-transparent via-green-500 to-transparent rounded shadow-[0_0_10px_rgba(0,255,0,0.5)]"></div>
                    <span><strong>Овал:</strong> Авроральная зона.</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full shadow-[0_0_8px_#00e676]"></div>
                    <span><strong>Зеленая точка:</strong> Город видит сияние.</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-black/80 border border-gray-600"></div>
                    <span><strong>Тень:</strong> Зона ночи.</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
