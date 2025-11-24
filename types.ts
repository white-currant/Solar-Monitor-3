export interface KpDataPoint {
  time: string;
  kp: number;
}

export interface WindDataPoint {
  time: string;
  density: number;
  speed: number;
  temperature: number;
}

export interface FlareDataPoint {
  time: string;
  flux: number; // primary x-ray flux
  class: string;
}

export interface ForecastDataPoint {
  time: string;
  kp: number;
}

export interface SolarStatus {
  kp: KpDataPoint[];
  wind: WindDataPoint[];
  flares: FlareDataPoint[];
  forecast: ForecastDataPoint[];
  loading: boolean;
  error: string | null;
}

export type ScaleStatus = 'normal' | 'warning' | 'critical';
