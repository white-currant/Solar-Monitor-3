import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, YAxis, XAxis, ResponsiveContainer, BarChart, Bar, Cell, Tooltip as RechartsTooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, Wind, Zap, RefreshCw, Clock, WifiOff, HelpCircle, CalendarDays, Radiation } from 'lucide-react';
import { AnalysisBox } from './components/AnalysisBox';
import { InfoTooltip } from './components/InfoTooltip';
import { SpaceSound } from './components/SpaceSound';
import { SolarMap } from './components/SolarMap';
import { GeomagneticMap } from './components/GeomagneticMap';
import { SolarFlareMap } from './components/SolarFlareMap';
import { ProtonGraph } from './components/ProtonGraph';
import { SDOModal } from './components/SDOModal';
import { fetchSolarData, getFlareClass } from './services/noaaService';
import { KpDataPoint, WindDataPoint, FlareDataPoint, ForecastDataPoint, ProtonDataPoint } from './types';

// Custom styles for the star background
const starBgStyle: React.CSSProperties = {
  backgroundImage: `
    radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 3px),
    radial-gradient(white, rgba(255,255,255,.15) 1px, transparent 2px),
    radial-gradient(white, rgba(255,255,255,.1) 2px, transparent 3px)
  `,
  backgroundSize: '550px 550px, 350px 350px, 250px 250px',
  backgroundPosition: '0 0, 40px 60px, 130px 270px',
  backgroundColor: '#050a14'
};

const formatTime = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
};

const formatShortDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
    } catch (e) {
        return '';
    }
};

const formatFullDate = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } catch (e) {
        return '---';
    }
};

// Helper to calculate travel time from Satellite (L1 Point) to Earth
// Distance L1 to Earth is approx 1.5 million km
const calculateTravelTimeParts = (speedKmS: number) => {
    if (speedKmS <= 0) return { hours: 0, minutes: 0 };
    
    const distanceKm = 1500000; // Distance from L1 to Earth
    const totalSeconds = distanceKm / speedKmS;
    
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { hours, minutes };
};

// Helper to get average of last N items
const getAverage = (data: any[], key: string, count: number) => {
    if (!data || data.length === 0) return 0;
    const slice = data.slice(-count);
    const sum = slice.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    return sum / slice.length;
};

interface ExtendedFlare extends FlareDataPoint {
    isSignificant: boolean; 
}

const App: React.FC = () => {
  // State
  const [kpData, setKpData] = useState<KpDataPoint[]>([]);
  const [windData, setWindData] = useState<WindDataPoint[]>([]);
  const [flareData, setFlareData] = useState<FlareDataPoint[]>([]);
  const [forecastData, setForecastData] = useState<ForecastDataPoint[]>([]);
  const [protonData, setProtonData] = useState<ProtonDataPoint[]>([]);
  const [detectedFlares, setDetectedFlares] = useState<ExtendedFlare[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [report, setReport] = useState("СИНХРОНИЗАЦИЯ ТЕЛЕМЕТРИИ...");
  const [dangerIndex, setDangerIndex] = useState({ score: 0, label: 'ЗАГРУЗКА...', colorClass: 'text-gray-500' });
  const [activeFlareTime, setActiveFlareTime] = useState<string | null>(null);
  const [isSDOOpen, setIsSDOOpen] = useState(false);

  // Data fetching loop
  const loadData = async () => {
    // Optimization: Don't fetch if tab is hidden to save resources
    if (document.hidden) return;

    setLoading(true);
    const result = await fetchSolarData();
    
    setFetchError(result.isDemo);

    if (result) {
      setKpData(result.kp);
      setWindData(result.wind);
      setFlareData(result.flares);
      setForecastData(result.forecast || []);
      setProtonData(result.protons || []);
      analyzeData(result.kp, result.wind, result.flares, result.protons || []);
      
      // Detect Flares (Peaks)
      const peaks: ExtendedFlare[] = [];
      const threshold = 1e-8; 
      
      for (let i = 1; i < result.flares.length - 1; i++) {
          const prev = result.flares[i-1].flux;
          const curr = result.flares[i].flux;
          const next = result.flares[i+1].flux;
          
          if (curr > prev && curr > next && curr > threshold) {
              const isSignificant = curr >= 1e-6;
              peaks.push({
                  ...result.flares[i],
                  isSignificant: isSignificant
              });
          }
      }
      
      const sortedPeaks = peaks.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setDetectedFlares(sortedPeaks);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Update every minute
    
    const handleVisibilityChange = () => {
        if (!document.hidden) {
            loadData();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Analysis Logic (Smoothed & Scientific)
  const analyzeData = (kp: KpDataPoint[], wind: WindDataPoint[], flares: FlareDataPoint[], protons: ProtonDataPoint[]) => {
    const lastKp = kp[kp.length - 1]?.kp || 0;
    const avgWind = getAverage(wind, 'speed', 6); 
    const avgFlux = getAverage(flares, 'flux', 12); 
    const avgProton = getAverage(protons, 'flux', 6);
    const avgFlareClass = getFlareClass(avgFlux);

    let score = 0;
    
    if (lastKp >= 7) score += 4;
    else if (lastKp >= 5) score += 3;
    else if (lastKp >= 4) score += 2;
    else if (lastKp >= 3) score += 1;

    if (avgWind >= 700) score += 3;
    else if (avgWind >= 500) score += 2;
    else if (avgWind >= 400) score += 1;

    if (avgFlareClass.includes('X')) score += 3;
    else if (avgFlareClass.includes('M')) {
       const val = parseFloat(avgFlareClass.replace('M', ''));
       if (val >= 5) score += 2;
       else score += 1;
    }

    let dLabel = 'ФОНОВЫЙ';
    let dColor = 'text-[#00e676]'; 

    if (score >= 5) {
        dLabel = 'ВЫСОКИЙ'; 
        dColor = 'text-[#ff1744]'; 
    } else if (score >= 3) {
        dLabel = 'УМЕРЕННЫЙ';
        dColor = 'text-[#ffca28]'; 
    }

    setDangerIndex({ score, label: dLabel, colorClass: dColor });

    const parts = [];

    // 1. STATUS (Geomagnetic Field)
    let statusText = "";
    if (lastKp >= 7) {
        statusText = "СТАТУС: Сильная магнитная буря (G3). Порог стабильности значительно превышен. Вероятны яркие полярные сияния в средних широтах. Для людей на поверхности Земли угрозы нет благодаря атмосферному щиту.";
    } else if (lastKp >= 5) {
        statusText = "СТАТУС: Порог геомагнитной стабильности превышен. Фиксируется умеренная магнитная буря (G1-G2). Магнитосфера находится в активной фазе сопротивления солнечному ветру. Это штатный режим работы планетарной защиты.";
    } else if (lastKp >= 4) {
        statusText = "СТАТУС: Активность приближается к порогу магнитной бури. Магнитосфера находится в возбужденном состоянии, но критический порог (G1) на данный момент не преодолен.";
    } else if (lastKp >= 3) {
        statusText = "СТАТУС: Неустойчивое геомагнитное поле (K-index 3). Наблюдаются незначительные флуктуации, характерные для высоких широт. Обстановка в пределах природной нормы.";
    } else {
        statusText = "СТАТУС: Спокойная геомагнитная обстановка. Поле стабильно, значимых возмущений не зарегистрировано. Благоприятные условия.";
    }
    parts.push(statusText);

    // 2. DYNAMICS (Wind & Impact) - Updated with Source Distinction Logic
    let dynText = "";
    if (avgWind >= 500) {
        // Distinguish source: CH HSS (Low Proton) vs CME (High Proton)
        const sourceNote = avgProton < 10 
            ? "Ветер усилен, но радиационный фон в норме — признак корональной дыры, а не вспышки." 
            : "Высокая скорость ветра сопровождается ростом протонного фона, что указывает на возможное влияние CME (выброса массы).";

        if (lastKp < 4) {
             dynText = `ДИНАМИКА: ${sourceNote} Скорость ветра высокая (${Math.round(avgWind)} км/с), однако текущая полярность поля (Bz) блокирует передачу энергии внутрь магнитосферы.`;
        } else {
             dynText = `ДИНАМИКА: ${sourceNote} Поток плазмы ускорен (${Math.round(avgWind)} км/с), поддерживая геомагнитную активность.`;
        }
    } 
    else {
        dynText = `ДИНАМИКА: Параметры солнечного ветра (скорость ${Math.round(avgWind)} км/с) находятся в значениях, близких к фоновым. Поток стабилен.`;
    }
    parts.push(dynText);

    // 3. PHYSICS (Flares & Protons)
    let physText = "";
    if (avgFlareClass.includes('X')) {
        physText = "ФИЗИКА: Зарегистрирован мощный всплеск рентгеновского излучения (Класс X). Возможны краткосрочные нарушения радиосвязи на освещенной стороне планеты.";
    } else if (avgProton >= 10) {
        physText = "ФИЗИКА: Фиксируется протонное событие (S-Scale). Поток заряженных частиц в околоземном пространстве повышен (S1+), что влияет на спутниковую электронику.";
    } else {
        physText = "ФИЗИКА: Радиационный фон в норме. Рентгеновское и протонное излучение Солнца находится на минимальных значениях.";
    }
    parts.push(physText);

    setReport(parts.join("\n\n"));
  };

  // Current Values
  const currentKp = kpData[kpData.length - 1]?.kp || 0;
  const lastKpTime = kpData.length > 0 ? formatFullDate(kpData[kpData.length-1].time) : "---";

  const currentWind = windData[windData.length - 1]?.speed || 0;
  const currentDensity = windData[windData.length - 1]?.density || 0;
  const lastWindTime = windData.length > 0 ? formatFullDate(windData[windData.length-1].time) : "---";

  const currentFlareClass = flareData[flareData.length - 1]?.class || "A0.0";
  const currentFlareFlux = flareData[flareData.length - 1]?.flux || 0;
  const lastFlareTime = flareData.length > 0 ? formatFullDate(flareData[flareData.length-1].time) : "---";
  
  const isFlareHigh = currentFlareClass.includes('M') || currentFlareClass.includes('X');

  const travelInfo = calculateTravelTimeParts(currentWind);

  const logFlux = Math.log10(currentFlareFlux || 1e-8);
  const activeZonesCount = Math.max(2, Math.min(8, Math.floor((logFlux + 8) * 2)));
  
  let intensityDesc = "НИЗКАЯ";
  if (currentFlareClass.includes('M')) intensityDesc = "УМЕРЕННАЯ";
  if (currentFlareClass.includes('X')) intensityDesc = "ВЫСОКАЯ";

  const significantFlaresList = detectedFlares.filter(f => f.isSignificant);

  // Proton Logic
  const currentProtonFlux = protonData[protonData.length - 1]?.flux || 0;
  // S-Scale: S1 > 10, S2 > 100, S3 > 1000
  let protonScale = "S0 (Фон)";
  let protonColor = "text-green-400";
  if (currentProtonFlux >= 100000) { protonScale = "S5 (Экстремально)"; protonColor = "text-red-600"; }
  else if (currentProtonFlux >= 10000) { protonScale = "S4 (Жесткий)"; protonColor = "text-red-500"; }
  else if (currentProtonFlux >= 1000) { protonScale = "S3 (Сильный)"; protonColor = "text-red-400"; }
  else if (currentProtonFlux >= 100) { protonScale = "S2 (Умеренный)"; protonColor = "text-yellow-400"; }
  else if (currentProtonFlux >= 10) { protonScale = "S1 (Слабый)"; protonColor = "text-yellow-200"; }

  // --- SCIENTIFIC SOURCE DETECTION ---
  const isHighWind = currentWind > 500;
  const isProtonStorm = currentProtonFlux >= 10;

  // Coronal Hole Stream: High Wind + LOW Protons
  // CME / Flare Event: High Wind + HIGH Protons (usually)
  const isCoronalHoleSource = isHighWind && !isProtonStorm;
  const isCMESource = isHighWind && isProtonStorm;

  return (
    <div style={starBgStyle} className="min-h-screen p-4 md:p-8 text-gray-100 selection:bg-cyan-500 selection:text-white">
      
      <SDOModal isOpen={isSDOOpen} onClose={() => setIsSDOOpen(false)} />

      <header className="max-w-2xl mx-auto mb-8 pb-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.2em] flex items-center gap-4 drop-shadow-[0_0_15px_rgba(0,188,212,0.4)]">
            Solar Monitor
            <span className={`inline-block w-3 h-3 rounded-full shadow-[0_0_10px] animate-pulse ${loading ? 'bg-yellow-400 shadow-yellow-400' : fetchError ? 'bg-red-500 shadow-red-500' : 'bg-[#00e676] shadow-[#00e676]'}`}></span>
          </h1>
          <div className="flex items-center gap-3 text-gray-500 text-sm font-mono mt-1 tracking-widest">
            <span>LIVE TELEMETRY // NOAA SWPC DATA STREAM</span>
            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">v2.8</span>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3">
            <SpaceSound 
                windSpeed={currentWind} 
                windDensity={currentDensity} 
                kpIndex={currentKp} 
                flareClass={currentFlareClass} 
                flareFlux={currentFlareFlux}
            />
            
            <button onClick={() => !loading && loadData()} className="flex items-center gap-2 px-4 py-2 border border-[#00bcd4] text-[#00bcd4] rounded hover:bg-[#00bcd4] hover:text-black transition-all uppercase text-xs font-bold tracking-wider h-[34px]">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Обновить
            </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        
        {fetchError && (
            <div className="mb-6 bg-red-900/50 border border-red-500 text-red-100 px-6 py-4 rounded shadow-[0_0_20px_rgba(255,23,68,0.3)] flex items-center gap-4 animate-pulse">
                <WifiOff size={32} className="text-red-500" />
                <div>
                    <h3 className="font-bold text-lg uppercase tracking-wider">Ошибка соединения с NOAA</h3>
                    <p className="text-sm font-mono">Не удалось получить свежие данные. Отображается ДЕМОНСТРАЦИОННЫЙ РЕЖИМ (Симуляция).</p>
                </div>
            </div>
        )}

        <AnalysisBox text={report} danger={dangerIndex} />

        <div className="flex flex-col gap-8">
          
          {/* --- CARD 1: KP INDEX --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Activity size={16} /> ГЕОМАГНИТНЫЙ ИНДЕКС
              </h3>
              <InfoTooltip 
                title="Kp-Index (Планетарный)"
                source="NOAA SWPC / GFZ"
                lastUpdate={lastKpTime}
                description={
                  <>
                    <p>Глобальный индекс геомагнитной активности.</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><span className="text-green-400">0-3</span>: Спокойное поле</li>
                      <li><span className="text-yellow-400">4</span>: Возмущенное поле</li>
                      <li><span className="text-red-500">5-9</span>: <span className="text-red-400">Магнитная буря</span></li>
                    </ul>
                  </>
                }
              />
            </div>

            <div className="flex items-end gap-2 mb-4">
              <span className={`font-mono text-6xl leading-none drop-shadow-md ${currentKp >= 5 ? 'text-[#ff1744]' : currentKp >= 4 ? 'text-[#ffca28]' : 'text-white'}`}>
                {currentKp.toFixed(1)}
              </span>
              <div className="mb-2 px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                {currentKp >= 5 ? 'БУРЯ' : currentKp >= 4 ? 'Возбуждение' : 'Спокойно'}
              </div>
            </div>

            <GeomagneticMap kp={currentKp} windSpeed={currentWind} density={currentDensity} />

            <div className="h-[160px] bg-black/20 rounded border border-white/5 p-2 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={kpData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={formatTime} 
                    tick={{ fill: '#6b7280', fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={[0, 9]} 
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={20}
                  />
                  <RechartsTooltip 
                     cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                     contentStyle={{ backgroundColor: '#151a25', borderColor: '#00bcd4', color: '#fff', borderRadius: '4px' }}
                     itemStyle={{ color: '#00bcd4' }}
                     labelFormatter={(label) => formatTime(label)}
                     formatter={(value: number) => [`Kp: ${value}`, 'Индекс']}
                  />
                  <Bar dataKey="kp" radius={[2, 2, 0, 0]}>
                    {kpData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.kp >= 5 ? '#ff1744' : entry.kp >= 4 ? '#ffca28' : '#00e676'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- CARD 2: 3-DAY FORECAST --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <CalendarDays size={16} /> ПРОГНОЗ ГЕОМАГНИТНЫХ БУРЬ
              </h3>
              <InfoTooltip 
                title="Forecast (Прогноз Kp)"
                source="NOAA SWPC (Model)"
                description={
                  <>
                    <p>Прогноз геомагнитной активности на ближайшие 3 дня.</p>
                    <p className="mt-2 text-xs text-gray-400">Столбцы показывают ожидаемый Kp-индекс с интервалом в 3 часа.</p>
                  </>
                }
              />
            </div>

            <div className="h-[160px] bg-black/20 rounded border border-white/5 p-2 relative">
              {forecastData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={forecastData} margin={{ top: 27, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="time" 
                        tickFormatter={formatShortDate} 
                        tick={{ fill: '#6b7280', fontSize: 10 }} 
                        axisLine={false}
                        tickLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        domain={[0, 9]} 
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={20}
                      />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                        contentStyle={{ backgroundColor: '#151a25', borderColor: '#00bcd4', color: '#fff', borderRadius: '4px' }}
                        itemStyle={{ color: '#00bcd4' }}
                        labelFormatter={(label) => `${formatShortDate(label)} ${formatTime(label)}`}
                        formatter={(value: number) => [`Kp: ${value}`, 'Прогноз']}
                      />
                      <Bar dataKey="kp" radius={[2, 2, 0, 0]}>
                        {forecastData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? '#ffffff' : (entry.kp >= 5 ? '#ff1744' : entry.kp >= 4 ? '#ffca28' : '#4fc3f7')} 
                          />
                        ))}
                      </Bar>
                      
                      <ReferenceLine 
                        x={forecastData[0].time} 
                        stroke="none" 
                        label={{ 
                            position: 'top', 
                            value: 'СЕЙЧАС', 
                            fill: '#ffffff', 
                            fontSize: 10, 
                            fontWeight: 'bold',
                            dy: -10,
                            className: "animate-pulse"
                        }} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-xs font-mono">
                      ДАННЫЕ ПРОГНОЗА НЕДОСТУПНЫ
                  </div>
              )}
            </div>
          </div>

          {/* --- CARD 3: SOLAR WIND --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Wind size={16} /> СОЛНЕЧНЫЙ ВЕТЕР
              </h3>
              <InfoTooltip 
                title="Solar Wind Speed"
                source="DSCOVR (L1 Orbit)"
                lastUpdate={lastWindTime}
                description={
                  <>
                    <p>Скорость потока частиц от Солнца.</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><span className="text-green-400">300-400 км/с</span>: Обычный поток</li>
                      <li><span className="text-yellow-400">&gt;500 км/с</span>: Скоростной поток</li>
                      <li><span className="text-red-500">&gt;700 км/с</span>: <span className="text-red-400">Высокоскоростной</span></li>
                    </ul>
                  </>
                }
              />
            </div>

            <div className="flex justify-between items-end mb-4 border-b border-gray-800 pb-4">
               <div>
                   <div className="text-gray-500 text-[9px] uppercase tracking-widest mb-1">Скорость потока</div>
                   <div className="flex items-baseline gap-2">
                      <span className="font-mono text-5xl leading-none text-white drop-shadow-md">
                        {Math.round(currentWind)}
                      </span>
                      <span className="text-gray-500 text-sm font-mono">км/с</span>
                   </div>
               </div>
               <div className="text-right">
                   <div className="text-gray-500 text-[9px] uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                        Прилет от L1 (DSCOVR)
                        <InfoTooltip 
                            title="Время прилета" 
                            description="Спутник DSCOVR находится в точке L1 (1.5 млн км от Земли). Это расчетное время, за которое солнечный ветер, зафиксированный спутником, достигнет магнитосферы Земли при текущей скорости." 
                        />
                   </div>
                   <div className="flex items-center justify-end gap-2 font-mono text-[#00bcd4]">
                        <Clock size={18} />
                        <span className="text-2xl font-bold">
                           {travelInfo.hours > 0 ? `${travelInfo.hours}ч ${travelInfo.minutes}м` : `${travelInfo.minutes} мин`}
                        </span>
                   </div>
               </div>
            </div>
            
            <div className="flex justify-between items-center mb-2 text-xs font-mono text-gray-400">
                <div className="flex items-center gap-1 text-yellow-500">
                   <span>ПЛОТНОСТЬ: {currentDensity.toFixed(1)} p/cm³</span>
                </div>
            </div>

            <SolarMap speed={currentWind} density={currentDensity} kp={currentKp} />

            <div className="h-[160px] bg-black/20 rounded border border-white/5 p-2">
               <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={windData} margin={{ top: 10, right: 35, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={formatTime} 
                    tick={{ fill: '#6b7280', fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />
                  
                  <ReferenceLine 
                    y={500} 
                    stroke="#ffca28" 
                    strokeDasharray="3 3" 
                    label={{ position: 'right', value: 'FAST', fill: '#ffca28', fontSize: 9 }} 
                  />
                  <ReferenceLine 
                    y={700} 
                    stroke="#ff1744" 
                    strokeDasharray="3 3" 
                    label={{ position: 'right', value: 'STORM', fill: '#ff1744', fontSize: 9 }} 
                  />

                  <RechartsTooltip 
                     contentStyle={{ backgroundColor: '#151a25', borderColor: '#00bcd4', color: '#fff', borderRadius: '4px' }}
                     labelFormatter={(label) => formatTime(label)}
                     formatter={(value: number) => [`${Math.round(value)} км/с`, 'Скорость']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="speed" 
                    stroke="#ffca28" 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ r: 4, fill: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* --- CARD 4: FLARES --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Zap size={16} /> ВСПЫШКИ (X-RAY)
              </h3>
              <InfoTooltip 
                title="Solar Flares (Вспышки)"
                source="GOES-16/18 (Sat)"
                lastUpdate={lastFlareTime}
                description={
                  <>
                    <p>Импульсные всплески излучения.</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><span className="text-green-400">A, B, C</span>: Базовый уровень</li>
                      <li><span className="text-yellow-400">M</span>: Умеренные вспышки</li>
                      <li><span className="text-red-500">X</span>: <span className="text-red-400">Мощные вспышки</span></li>
                    </ul>
                  </>
                }
              />
            </div>

            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                <div className="flex items-end gap-3">
                    <span className={`font-mono text-5xl leading-none drop-shadow-md ${isFlareHigh ? 'text-[#ff1744]' : 'text-white'}`}>
                        {currentFlareClass}
                    </span>
                    <div className="mb-1 px-2 py-0.5 bg-white/10 rounded text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                        {isFlareHigh ? 'АКТИВНОСТЬ' : 'Фон'}
                    </div>
                </div>
                
                <div className="text-right flex flex-col gap-1 text-[10px] font-mono text-gray-400">
                    <div className="flex items-center justify-end gap-2">
                        <span>АКТИВНЫЕ ЗОНЫ:</span>
                        <span className="text-white font-bold">{activeZonesCount}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <span>ИЗЛУЧЕНИЕ:</span>
                        <span className={`font-bold ${isFlareHigh ? 'text-red-400' : 'text-green-400'}`}>{currentFlareFlux.toExponential(1)} W/m²</span>
                    </div>
                    <div className="text-gray-500 uppercase tracking-wide mt-0.5">
                        ИНТЕНСИВНОСТЬ: <span className={isFlareHigh ? 'text-yellow-500' : 'text-gray-300'}>{intensityDesc}</span>
                    </div>
                </div>
            </div>
            
            {/* SOURCE ANALYSIS ALERTS */}
            {isCoronalHoleSource && (
                <div className="mb-3 flex items-center gap-2 bg-orange-900/30 border border-orange-700/50 rounded px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="text-[10px] font-mono text-orange-200 uppercase tracking-wider">
                        КОРОНАЛЬНАЯ ДЫРА: ВЫСОКОСКОРОСТНОЙ ПОТОК
                    </span>
                </div>
            )}
            
            {isCMESource && (
                <div className="mb-3 flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded px-3 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[10px] font-mono text-red-200 uppercase tracking-wider">
                        ВОЗМОЖНЫЙ ВЫБРОС (CME) + ПРОТОННОЕ СОБЫТИЕ
                    </span>
                </div>
            )}

            <SolarFlareMap 
                flareClass={currentFlareClass} 
                flux={currentFlareFlux} 
                windSpeed={currentWind} 
                isCoronalHoleSource={isCoronalHoleSource}
                onOpenSdo={() => setIsSDOOpen(true)}
            />

            <div className="h-[180px] bg-black/20 rounded border border-white/5 p-2 mb-4">
               <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={flareData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="time" 
                    tickFormatter={formatTime} 
                    tick={{ fill: '#6b7280', fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <RechartsTooltip 
                     contentStyle={{ backgroundColor: '#151a25', borderColor: '#00bcd4', color: '#fff', borderRadius: '4px' }}
                     labelFormatter={(label) => formatTime(label)}
                     formatter={(value: number, name: string, props: any) => [props.payload.class, 'Класс']}
                  />
                  <YAxis 
                    scale="log" 
                    domain={[1e-8, 1e-3]} 
                    allowDataOverflow 
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    tickFormatter={(val) => val.toExponential(0)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="flux" 
                    stroke="#ff1744" 
                    strokeWidth={2} 
                    dot={false}
                  />
                  
                  {detectedFlares.map((flare, index) => {
                      const isActive = activeFlareTime === flare.time;
                      const isSig = flare.isSignificant;
                      let strokeColor = '#6b7280';
                      if (isActive) strokeColor = '#ffffff';
                      else if (flare.class.includes('X')) strokeColor = '#ff1744';
                      else if (flare.class.includes('M')) strokeColor = '#ffca28';
                      else if (flare.class.includes('C')) strokeColor = '#00e676';
                      
                      return (
                          <ReferenceLine 
                            key={index} 
                            x={flare.time} 
                            stroke={strokeColor} 
                            strokeWidth={isActive ? 2 : 1}
                            strokeDasharray={isSig ? "" : "2 2"}
                            opacity={isActive ? 1 : (isSig ? 0.8 : 0.5)} 
                          />
                      );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex-1 flex flex-col max-h-[200px] bg-black/20 rounded border border-white/5 overflow-hidden">
                <div className="text-gray-500 p-3 border-b border-gray-800 flex justify-between items-center font-bold text-xs font-mono bg-black/40 rounded-t">
                    <div className="flex items-center gap-2">
                        <span>ЗНАЧИМЫЕ ВСПЫШКИ (КЛАСС C+)</span>
                        <InfoTooltip title="Список вспышек" description="Регистрируются только события класса C1.0 и выше, которые выделяются на общем фоне." />
                    </div>
                    <span className="text-[10px] text-gray-600">{significantFlaresList.length} ЗА 24Ч</span>
                </div>
                
                <div className="overflow-y-auto overflow-x-hidden flex-1 p-2 space-y-1 custom-scrollbar">
                    {significantFlaresList.length > 0 ? (
                        significantFlaresList.map((f, i) => (
                            <div 
                                key={i} 
                                className={`flex justify-between items-center text-gray-300 text-xs font-mono py-1.5 px-2 rounded transition-all cursor-pointer border border-transparent ${activeFlareTime === f.time ? 'bg-white/10 border-white/20' : 'hover:bg-white/5'}`}
                                onMouseEnter={() => setActiveFlareTime(f.time)}
                                onMouseLeave={() => setActiveFlareTime(null)}
                            >
                                <div className="flex flex-col">
                                    <span className={`${activeFlareTime === f.time ? 'text-white font-bold' : 'text-gray-400'}`}>{formatTime(f.time)}</span>
                                </div>
                                <span className={`font-bold text-sm px-2 py-0.5 rounded min-w-[50px] text-center ${
                                    f.class.includes('X') ? 'bg-red-900/50 text-red-400 border border-red-800 shadow-[0_0_10px_rgba(255,23,68,0.3)]' : 
                                    f.class.includes('M') ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800' : 
                                    'bg-green-900/30 text-green-400 border border-green-800'
                                }`}>
                                    {f.class}
                                </span>
                            </div>
                        ))
                    ) : (
                        <div className="text-gray-600 italic text-center py-10 text-xs">
                            Вспышек класса C+ не зафиксировано
                        </div>
                    )}
                </div>
            </div>
          </div>

          {/* --- CARD 5: PROTON FLUX --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Radiation size={16} /> ПРОТОННЫЙ ПОТОК (S-SCALE)
              </h3>
              <InfoTooltip 
                title="Solar Radiation Storms"
                source="GOES (Protons >10MeV)"
                description={
                  <>
                    <p className="font-bold mb-2 text-white">Интенсивность потока солнечных протонов.</p>
                    <div className="text-xs space-y-2 text-gray-300">
                        <p><span className="text-[#00bcd4]">ВАЖНОСТЬ:</span> Критично для спутников (сбои электроники), космонавтов и полярной КВ-радиосвязи.</p>
                        <p className="border-l-2 border-green-500 pl-2 text-green-100 italic">
                            <span className="text-green-400 font-bold">ДЛЯ ЧЕЛОВЕКА:</span> На поверхности Земли угрозы НЕ ПРЕДСТАВЛЯЕТ. Атмосфера планеты полностью поглощает и блокирует эти частицы. Вы в безопасности.
                        </p>
                    </div>
                  </>
                }
              />
            </div>

            <div className="flex items-end gap-2 mb-4 border-b border-white/5 pb-4">
              <span className={`font-mono text-4xl leading-none drop-shadow-md text-white`}>
                {currentProtonFlux.toExponential(2)}
              </span>
              <span className="text-gray-500 text-xs font-mono mb-1">pfu</span>
              <div className={`ml-auto px-2 py-1 bg-white/10 rounded text-xs font-bold tracking-wider ${protonColor}`}>
                {protonScale}
              </div>
            </div>

            <ProtonGraph flux={currentProtonFlux} />

            <div className="h-[120px] bg-black/20 rounded border border-white/5 p-2 mt-auto">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={protonData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} />
                        <YAxis scale="log" domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#151a25', borderColor: '#00bcd4', color: '#fff' }} 
                            labelFormatter={formatTime}
                            formatter={(val: number) => [val.toExponential(2), 'Flux']}
                        />
                        <Line type="monotone" dataKey="flux" stroke="#00e676" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
