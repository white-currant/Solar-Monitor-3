
import { KpDataPoint, WindDataPoint, FlareDataPoint, ForecastDataPoint, ProtonDataPoint } from '../types';

// 1. Try Direct (Best if CORS allowed - sometimes works with NOAA)
// 2. AllOrigins (Usually reliable for text)
// 3. Corsproxy.io (Fast but strict)
const PROXIES = [
  "", 
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://thingproxy.freeboard.io/fetch/"
];

const URLS = {
  kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
  // 1-day plasma data
  wind: "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json", 
  // Official NOAA GOES Primary X-rays (1-day)
  flare: "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json",
  // 3-Day Forecast Kp
  forecast: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
  // Proton Flux (1-day)
  proton: "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json"
};

// Helper to determine solar flare class (A, B, C, M, X)
export const getFlareClass = (flux: number): string => {
  if (flux < 1e-7) return "A" + (flux * 1e8).toFixed(1);
  if (flux < 1e-6) return "B" + (flux * 1e7).toFixed(1);
  if (flux < 1e-5) return "C" + (flux * 1e6).toFixed(1);
  if (flux < 1e-4) return "M" + (flux * 1e5).toFixed(1);
  return "X" + (flux * 1e4).toFixed(1);
};

// Helper to ensure string is treated as UTC for correct local conversion
const parseUtcTime = (timeStr: string): string => {
    if (!timeStr) return new Date().toISOString();
    if (timeStr.includes(' ') && !timeStr.includes('T')) {
        return timeStr.replace(' ', 'T') + 'Z';
    }
    if (!timeStr.endsWith('Z') && !timeStr.includes('+')) {
        return timeStr + 'Z';
    }
    return timeStr;
};

async function smartFetch(url: string): Promise<any> {
  const t = new Date().getTime();
  const urlWithCacheBuster = url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;

  for (let proxy of PROXIES) {
    try {
      const targetUrl = proxy ? proxy + encodeURIComponent(urlWithCacheBuster) : urlWithCacheBuster;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(targetUrl, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        
        // ROBUST JSON CLEANING
        // Proxies often append garbage or HTML tags. We look for the outermost JSON structure.
        const firstChar = text.search(/\[|\{/);
        const lastCharSq = text.lastIndexOf(']');
        const lastCharCur = text.lastIndexOf('}');
        const lastChar = Math.max(lastCharSq, lastCharCur);

        if (firstChar !== -1 && lastChar !== -1 && lastChar > firstChar) {
            const cleanJson = text.substring(firstChar, lastChar + 1);
            try {
                return JSON.parse(cleanJson);
            } catch (jsonError) {
                console.warn(`JSON Parse error for ${proxy}:`, jsonError);
                continue;
            }
        }
      }
    } catch (e) {
      // Try next proxy
    }
  }
  throw new Error("All proxies failed");
}

export const fetchSolarData = async () => {
  try {
    // 1. Fetch KP (NOAA)
    const kpRaw = await smartFetch(URLS.kp);
    const kpData: KpDataPoint[] = Array.isArray(kpRaw) ? kpRaw.slice(1).map((row: any) => ({
      time: parseUtcTime(row[0]),
      kp: parseFloat(row[1])
    })).slice(-8) : [];

    // 2. Fetch Wind (NOAA 1-day)
    const windRaw = await smartFetch(URLS.wind);
    
    let windData: WindDataPoint[] = [];
    if (Array.isArray(windRaw)) {
         windData = windRaw.slice(1)
          .filter((row: any) => row[2] !== null) // Speed not null
          .filter((_: any, index: number) => index % 15 === 0) // Downsample
          .map((row: any) => ({
            time: parseUtcTime(row[0]),
            density: parseFloat(row[1] || 0),
            speed: parseFloat(row[2] || 0),
            temperature: parseFloat(row[3] || 0)
          }));
    }

    // 3. Fetch Flares (NOAA GOES JSON)
    const flareRaw = await smartFetch(URLS.flare);
    let flareData: FlareDataPoint[] = [];

    if (Array.isArray(flareRaw)) {
        flareData = flareRaw
            .filter((item: any) => item.energy === "0.1-0.8nm")
            .map((item: any) => ({
                time: parseUtcTime(item.time_tag),
                flux: item.flux,
                class: getFlareClass(item.flux)
            }));
        
        // Downsample for chart performance
        if (flareData.length > 300) {
            flareData = flareData.filter((_, i) => i % 5 === 0);
        }
    }

    // 4. Fetch Forecast (NOAA Forecast JSON)
    let forecastData: ForecastDataPoint[] = [];
    try {
        const forecastRaw = await smartFetch(URLS.forecast);
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        if (Array.isArray(forecastRaw)) {
            forecastData = forecastRaw.slice(1)
                .map((row: any) => ({
                    time: parseUtcTime(row[0]),
                    kp: parseFloat(row[1])
                }))
                .filter((item) => new Date(item.time) >= cutoffTime)
                .slice(0, 24);
        }
    } catch (e) {
        console.warn("Forecast fetch failed", e);
    }

    // 5. Fetch Proton Flux (NOAA GOES)
    let protonData: ProtonDataPoint[] = [];
    try {
        const protonRaw = await smartFetch(URLS.proton);
        if (Array.isArray(protonRaw)) {
            protonData = protonRaw
                .filter((item: any) => item.energy === ">=10 MeV") // Standard S-Scale energy
                .map((item: any) => ({
                    time: parseUtcTime(item.time_tag),
                    flux: parseFloat(item.flux)
                }));
            
            // Downsample
            if (protonData.length > 200) {
                protonData = protonData.filter((_, i) => i % 5 === 0);
            }
        }
    } catch (e) {
        console.warn("Proton fetch failed", e);
    }

    if (kpData.length === 0 && windData.length === 0) throw new Error("Empty data received");

    return {
      kp: kpData,
      wind: windData,
      flares: flareData,
      forecast: forecastData,
      protons: protonData,
      isDemo: false
    };
  } catch (error) {
    console.error("Solar data fetch failed, utilizing demo data:", error);
    return { ...getDemoData(), isDemo: true };
  }
};

const getDemoData = () => {
  const now = new Date();
  const kp: KpDataPoint[] = Array.from({ length: 8 }, (_, i) => ({
    time: new Date(now.getTime() - (7 - i) * 3 * 3600000).toISOString(),
    kp: Math.max(1, Math.min(9, 3 + Math.sin(i) * 2))
  }));
  
  const wind: WindDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now.getTime() - (23 - i) * 3600000).toISOString(),
    density: 5 + Math.random() * 5,
    speed: 350 + Math.sin(i/5) * 100 + Math.random() * 50,
    temperature: 100000
  }));

  const flares: FlareDataPoint[] = Array.from({ length: 50 }, (_, i) => {
    const flux = 1e-7 * (1 + Math.random() * 10);
    return {
      time: new Date(now.getTime() - (49 - i) * 30 * 60000).toISOString(),
      flux: flux,
      class: getFlareClass(flux)
    };
  });

  const forecast: ForecastDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
      time: new Date(now.getTime() + i * 3 * 3600000).toISOString(),
      kp: Math.max(1, Math.min(7, 2 + Math.random() * 4))
  }));

  const protons: ProtonDataPoint[] = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(now.getTime() - (19 - i) * 3600000).toISOString(),
      flux: 0.1 + Math.random() * 0.5 // Low background levels
  }));

  return { kp, wind, flares, forecast, protons };
};
