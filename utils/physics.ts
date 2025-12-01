import { C } from '../types';

/**
 * Calculates the Doppler Frequency Shift
 * f_d = (2 * v * f_0 * cos(theta)) / c
 */
export const calculateDopplerShift = (
  velocityKmh: number, 
  frequencyGHz: number, 
  thetaDegrees: number = 0
): number => {
  const velocityMs = velocityKmh / 3.6;
  const frequencyHz = frequencyGHz * 1e9;
  const thetaRad = (thetaDegrees * Math.PI) / 180;
  
  const shift = (2 * velocityMs * frequencyHz * Math.cos(thetaRad)) / C;
  return shift;
};

/**
 * Inverse Doppler: Calculates Speed from Frequency Shift
 * v = (c * f_d) / (2 * f_0)
 */
export const calculateSpeedFromShift = (
  shiftHz: number,
  frequencyGHz: number
): number => {
  const frequencyHz = frequencyGHz * 1e9;
  const velocityMs = (shiftHz * C) / (2 * frequencyHz);
  return velocityMs * 3.6; // Convert to km/h
};

export const calculateWavelengthMm = (frequencyGHz: number): number => {
  const frequencyHz = frequencyGHz * 1e9;
  return (C / frequencyHz) * 1000;
};

/**
 * DSP: Frequency Resolution = SampleRate / FFT_Size
 */
export const calculateFreqResolution = (sampleRateHz: number, fftSize: number): number => {
  return sampleRateHz / fftSize;
};

/**
 * DSP: Speed Resolution
 * Delta_v = (c * Delta_f) / (2 * f_0)
 */
export const calculateSpeedResolution = (
  sampleRateHz: number, 
  fftSize: number, 
  frequencyGHz: number
): number => {
  const freqRes = calculateFreqResolution(sampleRateHz, fftSize);
  return calculateSpeedFromShift(freqRes, frequencyGHz);
};

/**
 * DSP: Max Unambiguous Speed (Nyquist Limit)
 * Max Freq = SampleRate / 2
 */
export const calculateMaxUnambiguousSpeed = (
  sampleRateHz: number, 
  frequencyGHz: number
): number => {
  const maxFreq = sampleRateHz / 2;
  return calculateSpeedFromShift(maxFreq, frequencyGHz);
};