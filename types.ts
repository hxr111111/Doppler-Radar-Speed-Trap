export interface RadarParams {
  frequencyGHz: number; // e.g., 24.15 GHz
  intermediateFreqMHz: number; // e.g., 30 MHz
  adcSamplingRateMHz: number; // Hardware IF sampling (e.g., 100 MHz)
  
  // DSP / Baseband parameters
  basebandSampleRateHz: number; // e.g., 44100 Hz
  fftSize: number; // e.g., 1024
}

export interface SimulationState {
  radar: RadarParams;
  cars: Car[];
  fastestTargetSpeed: number; // The highest speed detected (Real physics)
  primaryDopplerShiftHz: number; // The shift corresponding to the fastest target
  
  // Calculated Metrics
  speedResolution: number; // Resolution in km/h
  maxSpeed: number; // Max unambiguous speed in km/h
}

export interface Car {
  id: number;
  x: number; // Position in pixels
  lane: number; // 0, 1, or 2
  color: string;
  speedKmh: number; // Individual speed
}

export const SPEED_LIMIT_KMH = 100;
export const C = 299792458; // Speed of light in m/s