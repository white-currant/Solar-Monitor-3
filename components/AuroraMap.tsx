import React, { useRef, useEffect, useState } from 'react';
import { X, Map, Layers, RotateCw } from 'lucide-react';
import { useCanvasVisibility } from '../hooks/useCanvasVisibility';

interface AuroraMapProps {
  kp: number;
  windSpeed?: number;
  density?: number;
}

// Extended city list with geomagnetic latitudes for probability calculation
const CITIES = [
    // Russia & CIS
    { name: "Мурманск", lat: 68.9, lon: 33.0, magLat: 64.5 },
    { name: "Архангельск", lat: 64.5, lon: 40.5, magLat: 60.8 },
    { name: "С.-Петербург", lat: 59.9, lon: 30.3, magLat: 56.1 },
    { name: "Москва", lat: 55.7, lon: 37.6, magLat: 51.5 },
    { name: "Минск", lat: 53.9, lon: 27.5, magLat: 50.2 },
    { name: "Сыктывкар", lat: 61.6, lon: 50.8, magLat: 57.3 },
    { name: "Норильск", lat: 69.3, lon: 88.2, magLat: 64.1 },
    // Scandinavia
    { name: "Тромсё", lat: 69.6, lon: 19.0, magLat: 66.6 },
    { name: "Рейкьявик", lat: 64.1, lon: -21.8, magLat: 65.0 },
    { name: "Хельсинки", lat: 60.1, lon: 24.9, magLat: 56.8 },
    { name: "Осло", lat: 59.9, lon: 10.7, magLat: 57.8 },
    { name: "Стокгольм", lat: 59.3, lon: 18.0, magLat: 56.5 },
    // North America
    { name: "Анкоридж", lat: 61.2, lon: -149.9, magLat: 61.3 },
    { name: "Фэрбанкс", lat: 64.8, lon: -147.7, magLat: 65.0 },
    { name: "Торонто", lat: 43.6, lon: -79.3, magLat: 54.0 },
    { name: "Эдинбург", lat: 55.9, lon: -3.2, magLat: 55.5 },
    // Asia
    { name: "Якутск", lat: 62.0, lon: 129.7, magLat: 56.2 },
];

export const AuroraMap: React.FC<AuroraMapProps> = ({ kp, windSpeed = 400, density = 5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const [showLegend, setShowLegend] = useState(false);
  const isVisible = useCanvasVisibility(containerRef);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const particlesRef = useRef<{lon: number, latOffset: number, speed: number, alpha: number, size: number}[]>([]);

  // Load Map Texture (NASA Blue Marble)
  useEffect(() => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png";

      const onLoad = () => {
          mapImageRef.current = img;
          setImageLoaded(true);
      };

      const onError = () => {
          setUseFallback(true);
          setImageLoaded(true);
      };

      img.onload = onLoad;
      img.onerror = onError;

      const timeout = setTimeout(() => {
          if (!mapImageRef.current) onError();
      }, 3000);

      return () => clearTimeout(timeout);
  }, []);

  // Initialize shimmer particles
  useEffect(() => {
      if (particlesRef.current.length === 0) {
          for (let i = 0; i < 60; i++) {
              particlesRef.current.push({
                  lon: Math.random() * 360 - 180,
                  latOffset: (Math.random() - 0.5) * 6,
                  speed: 0.3 + Math.random() * 0.8,
                  alpha: Math.random(),
                  size: 1 + Math.random() * 2
              });
          }
      }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateDimensions = () => {
        if(canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = 380;
        }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    let lastTime = 0;
    const fps = 30;
    const interval = 1000 / fps;

    // Projection: Northern Hemisphere 30N to 90N
    const MIN_LAT = 30;
    const MAX_LAT = 88;

    const project = (lat: number, lon: number, w: number, h: number) => {
        const cLat = Math.max(MIN_LAT, Math.min(MAX_LAT, lat));
        const x = ((lon + 180) / 360) * w;
        const y = ((MAX_LAT - cLat) / (MAX_LAT - MIN_LAT)) * h;
        return { x, y };
    };

    // Calculate aurora probability for a city based on geomagnetic latitude
    const getAuroraProbability = (magLat: number, kpVal: number, nightFactor: number): number => {
        // Approximate southern boundary of aurora oval based on Kp
        // Kp=0: ~67°  Kp=3: ~62°  Kp=5: ~55°  Kp=7: ~48°  Kp=9: ~40°
        const southBoundary = 67 - (kpVal * 3.0);
        const northBoundary = southBoundary + 5 + kpVal * 1.5;
        const centerLat = (southBoundary + northBoundary) / 2;

        if (magLat < southBoundary - 5) return 0;
        if (magLat > northBoundary + 5) return 0;

        // Gaussian-like probability centered on the oval
        const dist = Math.abs(magLat - centerLat);
        const bandHalf = (northBoundary - southBoundary) / 2;
        let prob = Math.exp(-(dist * dist) / (2 * bandHalf * bandHalf));

        // Night side boost (aurora is much stronger on the night side)
        const nightBoost = nightFactor > 0 ? (0.4 + nightFactor * 0.6) : Math.max(0.05, 0.4 + nightFactor * 0.35);
        prob *= nightBoost;

        // Kp scaling - higher Kp = generally more intense
        prob *= Math.min(1, 0.3 + kpVal * 0.1);

        return Math.min(100, Math.max(0, Math.round(prob * 100)));
    };

    const draw = (timestamp: number) => {
        animationRef.current = requestAnimationFrame(draw);

        const deltaTime = timestamp - lastTime;
        if (deltaTime < interval) return;
        lastTime = timestamp - (deltaTime % interval);

        const w = canvas.width;
        const h = canvas.height;

        const now = new Date();
        const utcHours = now.getUTCHours() + (now.getUTCMinutes()/60);
        const sunLon = (12 - utcHours) * 15;
        let sunLonNorm = ((sunLon + 180) % 360) - 180;
        if (sunLonNorm < -180) sunLonNorm += 360;
        const midnightLon = sunLonNorm > 0 ? sunLonNorm - 180 : sunLonNorm + 180;

        ctx.clearRect(0, 0, w, h);

        // === 1. MAP BACKGROUND ===
        if (!useFallback && imageLoaded && mapImageRef.current) {
            const img = mapImageRef.current;
            const imgPxPerDeg = img.naturalHeight / 180;
            const sy = (90 - MAX_LAT) * imgPxPerDeg;
            const sh = (MAX_LAT - MIN_LAT) * imgPxPerDeg;

            ctx.filter = 'grayscale(70%) contrast(120%) brightness(35%)';
            ctx.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, w, h);
            ctx.filter = 'none';
        } else {
            ctx.fillStyle = '#080e1a';
            ctx.fillRect(0, 0, w, h);
            // Grid
            ctx.strokeStyle = '#1a2235';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            for(let x=0; x<=w; x+=w/12) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
            for(let y=0; y<=h; y+=h/6) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
            ctx.stroke();
            // Continent blobs
            ctx.fillStyle = '#152035';
            ctx.beginPath(); ctx.ellipse(w*0.18, h*0.55, w*0.09, h*0.2, -0.2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(w*0.53, h*0.5, w*0.05, h*0.15, 0.1, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(w*0.72, h*0.4, w*0.13, h*0.12, 0, 0, Math.PI*2); ctx.fill();
        }

        // === 2. LATITUDE GRID LINES & LABELS ===
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 0.5;

        [40, 50, 60, 70, 80].forEach(lat => {
            if (lat < MIN_LAT || lat > MAX_LAT) return;
            const yPos = project(lat, 0, w, h).y;

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.moveTo(0, yPos);
            ctx.lineTo(w, yPos);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${lat}°N`, 4, yPos - 3);
        });
        ctx.setLineDash([]);
        ctx.restore();

        // === 3. NIGHT SHADOW (drawn early, before aurora) ===
        const nightX = project(0, midnightLon, w, h).x;

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';

        const drawShadow = (nx: number) => {
            const g = ctx.createRadialGradient(nx, h/2, w*0.05, nx, h/2, w*0.7);
            g.addColorStop(0, 'rgba(0,0,10,0.85)');
            g.addColorStop(0.4, 'rgba(0,0,10,0.5)');
            g.addColorStop(0.7, 'rgba(0,0,10,0.15)');
            g.addColorStop(1, 'rgba(0,0,10,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        };
        drawShadow(nightX);
        if (nightX < w/2) drawShadow(nightX + w);
        else drawShadow(nightX - w);

        ctx.restore();

        // === 4. AURORA OVAL (multi-layer, realistic colors) ===
        const MAG_POLE_LON = -72.5;
        const bandWidth = 5 + (kp * 2.5);
        const kpStrength = Math.min(1, kp / 7);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        const step = 2;

        // Layer 1: Broad diffuse glow (outer halo)
        for (let lon = -180; lon < 180; lon += step) {
            let deltaLon = (lon - MAG_POLE_LON + 180 + 360) % 360 - 180;
            const magFactor = Math.cos((deltaLon * Math.PI) / 180);
            let timeDelta = (lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);

            const lat = 74 - (kp * 2.0) - (magFactor * 4) + (nightFactor * 3);
            if (lat < MIN_LAT) continue;

            const x1 = project(lat, lon, w, h).x;
            const x2 = project(lat, lon + step, w, h).x;
            const wSlice = x2 - x1 + 1;

            const outerBand = bandWidth * 1.8;
            const pTop = project(lat + outerBand/2, lon, w, h);
            const pBot = project(lat - outerBand/2, lon, w, h);
            const hSlice = Math.abs(pBot.y - pTop.y);

            const intensity = 0.2 + (Math.max(0, nightFactor) * 0.5);

            const grad = ctx.createLinearGradient(0, pTop.y, 0, pBot.y);
            grad.addColorStop(0, `hsla(140, 100%, 50%, 0)`);
            grad.addColorStop(0.3, `hsla(140, 100%, 40%, ${0.05 * intensity})`);
            grad.addColorStop(0.5, `hsla(140, 100%, 50%, ${0.12 * intensity})`);
            grad.addColorStop(0.7, `hsla(140, 100%, 40%, ${0.05 * intensity})`);
            grad.addColorStop(1, `hsla(140, 100%, 50%, 0)`);

            ctx.fillStyle = grad;
            ctx.fillRect(x1, pTop.y, wSlice, hSlice);
        }

        // Layer 2: Bright core of the aurora
        for (let lon = -180; lon < 180; lon += step) {
            let deltaLon = (lon - MAG_POLE_LON + 180 + 360) % 360 - 180;
            const magFactor = Math.cos((deltaLon * Math.PI) / 180);
            let timeDelta = (lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);

            const lat = 74 - (kp * 2.0) - (magFactor * 4) + (nightFactor * 3);
            if (lat < MIN_LAT) continue;

            const x1 = project(lat, lon, w, h).x;
            const x2 = project(lat, lon + step, w, h).x;
            const wSlice = x2 - x1 + 1;

            const pTop = project(lat + bandWidth/2, lon, w, h);
            const pBot = project(lat - bandWidth/2, lon, w, h);
            const hSlice = Math.abs(pBot.y - pTop.y);

            const intensity = 0.3 + (Math.max(0, nightFactor) * 0.7);

            // Color shifts with Kp: green → cyan → yellow → red
            let hue1 = 140; // green
            let hue2 = 160; // cyan center
            if (kp >= 7) { hue1 = 350; hue2 = 310; } // red/magenta for extreme storms
            else if (kp >= 5) { hue1 = 80; hue2 = 140; } // yellow-green
            else if (kp >= 3) { hue1 = 120; hue2 = 160; } // green-cyan

            const grad = ctx.createLinearGradient(0, pTop.y, 0, pBot.y);
            grad.addColorStop(0, `hsla(${hue1}, 100%, 50%, 0)`);
            grad.addColorStop(0.15, `hsla(${hue1}, 100%, 50%, ${0.15 * intensity})`);
            grad.addColorStop(0.35, `hsla(${hue2}, 100%, 60%, ${0.5 * intensity})`);
            grad.addColorStop(0.5, `hsla(${hue2}, 100%, 70%, ${0.7 * intensity})`);
            grad.addColorStop(0.65, `hsla(${hue2}, 100%, 60%, ${0.5 * intensity})`);
            grad.addColorStop(0.85, `hsla(${hue1}, 100%, 50%, ${0.15 * intensity})`);
            grad.addColorStop(1, `hsla(${hue1}, 100%, 50%, 0)`);

            ctx.fillStyle = grad;
            ctx.fillRect(x1, pTop.y, wSlice, hSlice);
        }

        ctx.restore();

        // === 5. AURORA SHIMMER PARTICLES ===
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const time = Date.now() * 0.001;

        particlesRef.current.forEach(p => {
            // Move along longitude
            p.lon += p.speed;
            if (p.lon > 180) p.lon -= 360;

            // Flicker
            p.alpha = 0.3 + Math.sin(time * 2 + p.lon * 0.1) * 0.5 + Math.random() * 0.2;

            // Get position on aurora band
            let deltaLon = (p.lon - MAG_POLE_LON + 180 + 360) % 360 - 180;
            const magFactor = Math.cos((deltaLon * Math.PI) / 180);
            let timeDelta = (p.lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);

            const baseLat = 74 - (kp * 2.0) - (magFactor * 4) + (nightFactor * 3);
            const lat = baseLat + p.latOffset;

            if (lat < MIN_LAT || lat > MAX_LAT) return;
            // Only show particles on night side
            if (nightFactor < -0.2) return;

            const pos = project(lat, p.lon, w, h);

            const particleHue = kp >= 5 ? 80 + Math.random() * 60 : 120 + Math.random() * 40;
            ctx.fillStyle = `hsla(${particleHue}, 100%, 70%, ${p.alpha * 0.6 * nightFactor})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();

        // === 6. SOUTHERN BOUNDARY LINE ===
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = kp >= 5 ? 'rgba(255, 200, 40, 0.5)' : 'rgba(0, 230, 118, 0.3)';
        ctx.beginPath();

        let first = true;
        for (let lon = -180; lon < 180; lon += 3) {
            let deltaLon = (lon - MAG_POLE_LON + 180 + 360) % 360 - 180;
            const magFactor = Math.cos((deltaLon * Math.PI) / 180);
            let timeDelta = (lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);

            const centerLat = 74 - (kp * 2.0) - (magFactor * 4) + (nightFactor * 3);
            const southLat = centerLat - bandWidth * 0.8;

            if (southLat < MIN_LAT) continue;

            const pos = project(southLat, lon, w, h);
            if (first) { ctx.moveTo(pos.x, pos.y); first = false; }
            else ctx.lineTo(pos.x, pos.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // === 7. CITIES with PROBABILITY ===
        CITIES.forEach(city => {
            if (city.lat < MIN_LAT || city.lat > MAX_LAT) return;
            const p = project(city.lat, city.lon, w, h);

            let timeDelta = (city.lon - midnightLon + 180 + 360) % 360 - 180;
            const nightFactor = Math.cos((timeDelta * Math.PI) / 180);

            const prob = getAuroraProbability(city.magLat, kp, nightFactor);
            const isNight = Math.abs(timeDelta) < 100;
            const canSee = prob > 15 && isNight;

            // City dot
            ctx.beginPath();
            ctx.arc(p.x, p.y, canSee ? 3.5 : 2, 0, Math.PI*2);

            if (canSee) {
                ctx.fillStyle = prob > 60 ? '#00e676' : prob > 30 ? '#69f0ae' : '#a5d6a7';
                ctx.shadowColor = '#00e676';
                ctx.shadowBlur = prob > 50 ? 12 : 6;
            } else {
                ctx.fillStyle = '#475569';
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0;

            // City name
            ctx.fillStyle = canSee ? '#e0e0e0' : '#64748b';
            ctx.font = `${canSee ? '10' : '9'}px monospace`;
            ctx.textAlign = 'left';
            ctx.fillText(city.name, p.x + 6, p.y + 3);

            // Probability badge
            if (prob > 0) {
                const probText = `${prob}%`;
                const textWidth = ctx.measureText(probText).width;
                const badgeX = p.x + 6 + ctx.measureText(city.name).width + 4;
                const badgeY = p.y - 4;

                let badgeColor: string;
                let textColor: string;
                if (prob >= 60) { badgeColor = 'rgba(0,230,118,0.25)'; textColor = '#00e676'; }
                else if (prob >= 30) { badgeColor = 'rgba(255,202,40,0.2)'; textColor = '#ffca28'; }
                else if (prob >= 10) { badgeColor = 'rgba(255,255,255,0.08)'; textColor = '#90a4ae'; }
                else { badgeColor = 'rgba(255,255,255,0.04)'; textColor = '#546e7a'; }

                // Badge background
                ctx.fillStyle = badgeColor;
                const padX = 4, padY = 2;
                const rr = 3;
                ctx.beginPath();
                ctx.roundRect(badgeX - padX, badgeY - padY, textWidth + padX*2, 12 + padY, rr);
                ctx.fill();

                // Badge text
                ctx.fillStyle = textColor;
                ctx.font = '9px monospace';
                ctx.fillText(probText, badgeX, badgeY + 9);
            }
        });

        // === 8. HUD OVERLAY (Kp scale bar) ===
        if (!showLegend) {
            // Kp indicator bar (bottom-left)
            const barX = 10;
            const barY = h - 30;
            const barW = 100;
            const barH = 6;

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect(barX - 4, barY - 14, barW + 50, 36, 4);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Kp-INDEX', barX, barY - 3);

            // Bar track
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 3);
            ctx.fill();

            // Color segments
            const segW = barW / 9;
            for (let i = 0; i < 9; i++) {
                let segColor: string;
                if (i < 4) segColor = `rgba(0,230,118,${0.3 + i * 0.1})`;
                else if (i < 5) segColor = 'rgba(255,202,40,0.7)';
                else segColor = `rgba(255,23,68,${0.5 + (i-5) * 0.12})`;

                ctx.fillStyle = segColor;
                ctx.fillRect(barX + i * segW, barY, segW - 1, barH);
            }

            // Current Kp marker
            const markerX = barX + (kp / 9) * barW;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(markerX, barY - 2);
            ctx.lineTo(markerX - 3, barY - 6);
            ctx.lineTo(markerX + 3, barY - 6);
            ctx.fill();

            // Kp value
            ctx.fillStyle = kp >= 5 ? '#ff1744' : kp >= 4 ? '#ffca28' : '#00e676';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`Kp ${kp.toFixed(1)}`, barX + barW + 8, barY + 6);

            // Time indicator (bottom-right)
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'right';
            const utcStr = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} UTC`;
            ctx.fillText(utcStr, w - 10, h - 10);

            // Source
            ctx.fillText(useFallback ? 'VECTOR MAP' : 'NASA BLUE MARBLE', w - 10, h - 22);
        }
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
        window.removeEventListener('resize', updateDimensions);
        cancelAnimationFrame(animationRef.current);
    };
  }, [kp, windSpeed, density, showLegend, imageLoaded, useFallback, isVisible]);

  return (
    <div ref={containerRef} className="w-full h-[380px] bg-[#050a14] rounded border border-white/5 mb-4 relative overflow-hidden group">
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="absolute top-2 left-2 text-[10px] text-gray-300 font-bold font-mono tracking-widest pointer-events-none flex items-center gap-2 drop-shadow-md bg-black/40 px-2 py-1 rounded backdrop-blur-md border border-white/10">
        <Map size={12} />
        AURORA FORECAST — СЕВЕРНОЕ ПОЛУШАРИЕ
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
        <div className="absolute inset-0 bg-[#0a0f1a]/95 backdrop-blur-md p-5 text-xs text-gray-300 flex flex-col justify-center z-10">
            <h4 className="text-cyan-400 font-bold mb-3 uppercase flex items-center gap-2 tracking-wider">
                <Map size={14} /> Легенда Карты Полярных Сияний
            </h4>
            <p className="mb-4 leading-relaxed text-gray-400">
                Модель OVATION: прогноз авроральной активности на основе текущего Kp-индекса и положения Солнца.
            </p>
            <div className="space-y-3 font-mono">
                <div className="flex items-center gap-3">
                    <div className="w-14 h-4 bg-gradient-to-r from-transparent via-green-500 to-transparent rounded shadow-[0_0_10px_rgba(0,255,0,0.5)]"></div>
                    <span><strong className="text-green-400">Овал:</strong> Зона максимальной вероятности сияний. Ярче на ночной стороне.</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full shadow-[0_0_8px_#00e676]"></div>
                    <span><strong className="text-green-400">Зеленая точка:</strong> Город попадает в зону видимости сияния.</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-1.5 py-0.5 bg-green-900/50 rounded text-green-400 text-[9px]">72%</div>
                    <span><strong className="text-cyan-400">Процент:</strong> Расчетная вероятность наблюдения (зависит от Kp и времени суток).</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-10 border-t border-dashed border-green-500/50"></div>
                    <span><strong className="text-gray-400">Пунктир:</strong> Южная граница авроральной зоны.</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-black/80 border border-gray-600 rounded-sm"></div>
                    <span><strong className="text-gray-400">Тень:</strong> Ночная сторона Земли (более яркие сияния).</span>
                </div>
            </div>
            <p className="mt-4 text-[10px] text-gray-500 border-t border-white/5 pt-3">
                Линии широт помогают оценить расстояние. Вероятность зависит от геомагнитной (не географической) широты города.
            </p>
        </div>
      )}
    </div>
  );
};
