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

export interface SolarStatus {
  kp: KpDataPoint[];
  wind: WindDataPoint[];
  flares: FlareDataPoint[];
  loading: boolean;
  error: string | null;
}

export type ScaleStatus = 'normal' | 'warning' | 'critical';
