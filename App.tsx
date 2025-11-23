import React, { useEffect, useState } from 'react';
import { LineChart, Line, YAxis, XAxis, ResponsiveContainer, BarChart, Bar, Cell, Tooltip as RechartsTooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, Wind, Zap, RefreshCw, Clock, WifiOff, HelpCircle } from 'lucide-react';
import { AnalysisBox } from './components/AnalysisBox';
import { InfoTooltip } from './components/InfoTooltip';
import { SpaceSound } from './components/SpaceSound';
import { SolarMap } from './components/SolarMap';
import { GeomagneticMap } from './components/GeomagneticMap';
import { SolarFlareMap } from './components/SolarFlareMap';
import { fetchSolarData, getFlareClass } from './services/noaaService';
import { KpDataPoint, WindDataPoint, FlareDataPoint } from './types';

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

interface ExtendedFlare extends FlareDataPoint {
    isSignificant: boolean; 
}

const App: React.FC = () => {
  // State
  const [kpData, setKpData] = useState<KpDataPoint[]>([]);
  const [windData, setWindData] = useState<WindDataPoint[]>([]);
  const [flareData, setFlareData] = useState<FlareDataPoint[]>([]);
  const [detectedFlares, setDetectedFlares] = useState<ExtendedFlare[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [report, setReport] = useState("Инициализация нейросети... Сбор данных...");
  const [dangerIndex, setDangerIndex] = useState({ score: 0, label: 'ЗАГРУЗКА...', colorClass: 'text-gray-500' });
  const [activeFlareTime, setActiveFlareTime] = useState<string | null>(null);

  // Data fetching loop
  const loadData = async () => {
    setLoading(true);
    const result = await fetchSolarData();
    
    setFetchError(result.isDemo);

    if (result) {
      setKpData(result.kp);
      setWindData(result.wind);
      setFlareData(result.flares);
      analyzeData(result.kp, result.wind, result.flares);
      
      // Detect Flares (Peaks)
      const peaks: ExtendedFlare[] = [];
      // Threshold A1.0 = 1e-8. We want to capture almost all identifiable peaks.
      const threshold = 1e-8; 
      
      for (let i = 1; i < result.flares.length - 1; i++) {
          const prev = result.flares[i-1].flux;
          const curr = result.flares[i].flux;
          const next = result.flares[i+1].flux;
          
          // Simple peak detection
          if (curr > prev && curr > next && curr > threshold) {
              // Significant = Class C1.0 (1e-6) or higher
              const isSignificant = curr >= 1e-6;
              
              peaks.push({
                  ...result.flares[i],
                  isSignificant: isSignificant
              });
          }
      }
      
      // Sort by time descending (newest first)
      const sortedPeaks = peaks.sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setDetectedFlares(sortedPeaks);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Analysis Logic
  const analyzeData = (kp: KpDataPoint[], wind: WindDataPoint[], flares: FlareDataPoint[]) => {
    const lastKp = kp[kp.length - 1]?.kp || 0;
    const lastWind = wind[wind.length - 1]?.speed || 0;
    const lastFlareFlux = flares[flares.length - 1]?.flux || 0;
    const lastFlareClass = getFlareClass(lastFlareFlux);

    // 1. Calculate Danger Index (Score 0-10)
    let score = 0;
    
    // KP Impact (Weight 40%)
    if (lastKp >= 7) score += 4;
    else if (lastKp >= 5) score += 3;
    else if (lastKp >= 4) score += 2;
    else if (lastKp >= 3) score += 1;

    // Wind Impact (Weight 30%)
    if (lastWind >= 700) score += 3;
    else if (lastWind >= 500) score += 2;
    else if (lastWind >= 400) score += 1;

    // Flare Impact (Weight 30%)
    if (lastFlareClass.includes('X')) score += 3;
    else if (lastFlareClass.includes('M')) {
       const val = parseFloat(lastFlareClass.replace('M', ''));
       if (val >= 5) score += 2;
       else score += 1;
    }

    // Determine Level
    let dLabel = 'НИЗКИЙ';
    let dColor = 'text-[#00e676]'; // Green

    if (score >= 5) {
        dLabel = 'КРИТИЧЕСКИЙ';
        dColor = 'text-[#ff1744]'; // Red
    } else if (score >= 3) {
        dLabel = 'ПОВЫШЕННЫЙ';
        dColor = 'text-[#ffca28]'; // Yellow
    }

    setDangerIndex({ score, label: dLabel, colorClass: dColor });

    // 2. Generate Text Report
    let text = [];

    // Kp Analysis
    if (lastKp >= 5) text.push("ВНИМАНИЕ: ЗАФИКСИРОВАНА МАГНИТНАЯ БУРЯ. Возможны сбои в работе спутников и GPS.");
    else if (lastKp >= 3) text.push("СОСТОЯНИЕ: Магнитосфера в возбужденном состоянии. Метеозависимым приготовиться.");
    else text.push("СОСТОЯНИЕ: Геомагнитная обстановка спокойная. Угроз не выявлено.");

    // Wind Analysis
    if (lastWind > 600) text.push(`\nСкорость солнечного ветра экстремальная (${Math.round(lastWind)} км/с).`);
    else if (lastWind > 450) text.push(`\nПоток плазмы ускорен (${Math.round(lastWind)} км/с).`);
    else text.push(`\nСолнечный ветер в норме (${Math.round(lastWind)} км/с).`);

    // Flare Analysis
    if (lastFlareClass.includes('X')) text.push("\nРАДИАЦИОННАЯ ТРЕВОГА: Вспышка класса X. Риск отключения радиосвязи.");
    else if (lastFlareClass.includes('M')) text.push("\nВысокая вспышечная активность (Класс M).");
    else text.push("\nРентгеновское излучение Солнца фоновое.");

    setReport(text.join(" "));
  };

  // Current Values
  const currentKp = kpData[kpData.length - 1]?.kp || 0;
  const currentWind = windData[windData.length - 1]?.speed || 0;
  const currentDensity = windData[windData.length - 1]?.density || 0;
  const currentFlareClass = flareData[flareData.length - 1]?.class || "A0.0";
  const currentFlareFlux = flareData[flareData.length - 1]?.flux || 0;
  const isFlareHigh = currentFlareClass.includes('M') || currentFlareClass.includes('X');

  const travelInfo = calculateTravelTimeParts(currentWind);

  // Filter list: Show ONLY Significant Flares in list (C1.0+)
  const significantFlaresList = detectedFlares.filter(f => f.isSignificant);

  return (
    <div style={starBgStyle} className="min-h-screen p-4 md:p-8 text-gray-100 selection:bg-cyan-500 selection:text-white">
      
      <header className="max-w-7xl mx-auto mb-8 pb-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-[0.2em] flex items-center gap-4 drop-shadow-[0_0_15px_rgba(0,188,212,0.4)]">
            Solar Monitor
            <span className={`inline-block w-3 h-3 rounded-full shadow-[0_0_10px] animate-pulse ${loading ? 'bg-yellow-400 shadow-yellow-400' : fetchError ? 'bg-red-500 shadow-red-500' : 'bg-[#00e676] shadow-[#00e676]'}`}></span>
          </h1>
          <div className="text-gray-500 text-sm font-mono mt-1 tracking-widest">LIVE TELEMETRY // NOAA SWPC DATA STREAM</div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3">
            <SpaceSound 
                windSpeed={currentWind} 
                windDensity={currentDensity} 
                kpIndex={currentKp} 
                flareClass={currentFlareClass} 
                flareFlux={currentFlareFlux}
            />
            
            <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 border border-[#00bcd4] text-[#00bcd4] rounded hover:bg-[#00bcd4] hover:text-black transition-all uppercase text-xs font-bold tracking-wider h-[34px]">
              <RefreshCw size={14} className="animate-spin-slow" /> Обновить
            </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        
        {/* CONNECTION ERROR BANNER */}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* --- CARD 1: KP INDEX --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col h-[720px]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Activity size={16} /> ГЕОМАГНИТНЫЙ ИНДЕКС
              </h3>
              <InfoTooltip 
                title="Kp-Index (Планетарный)"
                description={
                  <>
                    <p>Показатель геомагнитной активности Земли.</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><span className="text-green-400">0-3</span>: Спокойно (Норма)</li>
                      <li><span className="text-yellow-400">4</span>: Возмущение (Внимание)</li>
                      <li><span className="text-red-500">5-9</span>: <strong className="text-red-400">Магнитная буря</strong> (Опасно)</li>
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
                {currentKp >= 5 ? 'БУРЯ' : currentKp >= 4 ? 'Активно' : 'Спокойно'}
              </div>
            </div>

             {/* VISUALIZATION */}
            <GeomagneticMap kp={currentKp} windSpeed={currentWind} density={currentDensity} />

            {/* Interactive Chart */}
            <div className="bg-black/20 rounded border border-white/5 p-2 relative flex-1 min-h-[100px]">
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

          {/* --- CARD 2: SOLAR WIND --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col h-[720px]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Wind size={16} /> СОЛНЕЧНЫЙ ВЕТЕР
              </h3>
              <InfoTooltip 
                title="Solar Wind Speed"
                description={
                  <>
                    <p>Скорость потока частиц от Солнца к Земле.</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><span className="text-green-400">300-400 км/с</span>: Норма</li>
                      <li><span className="text-yellow-400">&gt;500 км/с</span>: Высокая скорость</li>
                      <li><span className="text-red-500">&gt;700 км/с</span>: <strong className="text-red-400">Ударная волна</strong></li>
                    </ul>
                  </>
                }
              />
            </div>

            {/* COMPACT DATA ROW: SPEED + TIME */}
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
                        <InfoTooltip title="Время прилета" description="Спутник DSCOVR находится в точке L1 (1.5 млн км от Земли). Это время, за которое солнечный ветер, зафиксированный спутником прямо сейчас, достигнет Земли." />
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

            {/* SOLAR MAP VISUALIZATION */}
            <SolarMap speed={currentWind} density={currentDensity} kp={currentKp} />

            {/* Interactive Chart */}
            <div className="flex-1 bg-black/20 rounded border border-white/5 p-2 min-h-[150px]">
               <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <LineChart data={windData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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

          {/* --- CARD 3: FLARES --- */}
          <div className="bg-[#10141e]/90 border border-white/10 rounded-lg p-6 shadow-2xl hover:border-white/30 transition-colors duration-300 flex flex-col h-[720px]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-400 text-sm font-bold tracking-widest flex items-center gap-2">
                <Zap size={16} /> ВСПЫШКИ (X-RAY)
              </h3>
              <InfoTooltip 
                title="Solar Flares (Вспышки)"
                description={
                  <>
                    <p>Мощные выбросы энергии на Солнце (Рентген).</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li><span className="text-green-400">A, B, C</span>: Обычная активность</li>
                      <li><span className="text-yellow-400">M</span>: Средние вспышки (Радиопомехи)</li>
                      <li><span className="text-red-500">X</span>: <strong className="text-red-400">Опасные</strong> (Радиация)</li>
                    </ul>
                  </>
                }
              />
            </div>

            <div className="flex items-end gap-2 mb-4">
              <span className={`font-mono text-5xl leading-none drop-shadow-md ${isFlareHigh ? 'text-[#ff1744]' : 'text-white'}`}>
                {currentFlareClass}
              </span>
              <div className="mb-2 px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                 {isFlareHigh ? 'АКТИВНОСТЬ' : 'Фон'}
              </div>
            </div>

             {/* VISUALIZATION */}
            <SolarFlareMap flareClass={currentFlareClass} flux={currentFlareFlux} />
            
            {/* --- SIGNIFICANT FLARES LIST (NOW AT TOP) --- */}
            <div className="flex-1 flex flex-col min-h-0 bg-black/20 rounded border border-white/5 overflow-hidden mb-4">
                <div className="text-gray-500 p-3 border-b border-gray-800 flex justify-between items-center font-bold text-xs font-mono bg-black/40 rounded-t">
                    <div className="flex items-center gap-2">
                        <span>ЗНАЧИМЫЕ ВСПЫШКИ (КЛАСС C+)</span>
                        <InfoTooltip title="Список вспышек" description="Список включает только значимые вспышки класса C1.0 и выше за последние 24 часа." />
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

            {/* --- FLARE CHART (NOW AT BOTTOM) --- */}
            <div className="h-[180px] bg-black/20 rounded border border-white/5 p-2">
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
                  
                  {/* Reference lines for ALL detected events */}
                  {detectedFlares.map((flare, index) => {
                      // Check if this specific flare is highlighted
                      const isActive = activeFlareTime === flare.time;
                      // Is it significant? (C+)
                      const isSig = flare.isSignificant;
                      
                      // Color: 
                      // If Active -> White
                      // If Sig -> Color based on class
                      // If Bg -> Gray
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

          </div>

        </div>
      </main>
    </div>
  );
};

export default App;