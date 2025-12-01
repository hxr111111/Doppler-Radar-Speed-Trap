import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Activity, Gauge, Share2, Check, Plus, Minus, Shuffle, Sliders, Zap, Clock } from 'lucide-react';
import { RadarParams, Car, SPEED_LIMIT_KMH, SimulationState, C } from './types';
import { 
  calculateDopplerShift, 
  calculateWavelengthMm, 
  calculateSpeedResolution, 
  calculateMaxUnambiguousSpeed,
  calculateSpeedFromShift
} from './utils/physics';
import { HighwayScene } from './components/HighwayScene';
import { Oscilloscope } from './components/Oscilloscope';

const CAR_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4'];

const App: React.FC = () => {
  // --- Initialize State ---
  const getInitialState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const speedsParam = params.get('speeds');
      let initialSpeeds = [80, 110, 60];

      if (speedsParam) {
        initialSpeeds = speedsParam.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
      }

      return {
        speeds: initialSpeeds,
        freq: parseFloat(params.get('freq') || '24.15'),
        sample: parseFloat(params.get('sample') || '44100'),
        fft: parseInt(params.get('fft') || '512', 10),
      };
    } catch (e) {
      return null;
    }
  };

  const urlState = getInitialState();

  const [radarParams, setRadarParams] = useState<RadarParams>({
    frequencyGHz: urlState?.freq || 24.15,
    intermediateFreqMHz: 30, // Fixed hardware param
    adcSamplingRateMHz: 100, // Fixed hardware param
    basebandSampleRateHz: urlState?.sample || 44100,
    fftSize: urlState?.fft || 512,
  });

  const [cars, setCars] = useState<Car[]>(() => {
    const speeds = urlState?.speeds || [80, 110, 60];
    return speeds.map((speed, index) => ({
      id: index,
      x: Math.random() * 800,
      lane: index % 3,
      color: CAR_COLORS[index % CAR_COLORS.length],
      speedKmh: speed
    }));
  });

  const [isCopied, setIsCopied] = useState(false);

  // --- Calculations ---
  const resolutionKmh = useMemo(() => 
    calculateSpeedResolution(radarParams.basebandSampleRateHz, radarParams.fftSize, radarParams.frequencyGHz),
    [radarParams]
  );

  const maxSpeedKmh = useMemo(() => 
    calculateMaxUnambiguousSpeed(radarParams.basebandSampleRateHz, radarParams.frequencyGHz),
    [radarParams]
  );

  const wavelengthMm = useMemo(() => 
    calculateWavelengthMm(radarParams.frequencyGHz), 
    [radarParams.frequencyGHz]
  );

  // Measurement Time T_obs = N / Fs
  const observationTimeMs = useMemo(() => 
    (radarParams.fftSize / radarParams.basebandSampleRateHz) * 1000,
    [radarParams]
  );

  const fastestCar = useMemo(() => {
    if (cars.length === 0) return null;
    return cars.reduce((prev, current) => (prev.speedKmh > current.speedKmh) ? prev : current);
  }, [cars]);

  const realTargetSpeed = fastestCar ? fastestCar.speedKmh : 0;
  const realDopplerShift = calculateDopplerShift(realTargetSpeed, radarParams.frequencyGHz);

  // Simulated Measurement (Quantized by FFT Resolution)
  const freqResolutionHz = radarParams.basebandSampleRateHz / radarParams.fftSize;
  const measuredShiftHz = Math.round(realDopplerShift / freqResolutionHz) * freqResolutionHz;
  const measuredSpeedKmh = calculateSpeedFromShift(measuredShiftHz, radarParams.frequencyGHz);

  // --- Sync URL ---
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      const speedStr = cars.map(c => c.speedKmh).join(',');
      params.set('speeds', speedStr);
      if (radarParams.frequencyGHz !== 24.15) params.set('freq', radarParams.frequencyGHz.toString());
      if (radarParams.basebandSampleRateHz !== 44100) params.set('sample', radarParams.basebandSampleRateHz.toString());
      if (radarParams.fftSize !== 512) params.set('fft', radarParams.fftSize.toString());

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    } catch (e) {}
  }, [cars, radarParams]);

  // --- Handlers ---
  const updateCarSpeed = (id: number, newSpeed: number) => {
    setCars(prev => prev.map(c => c.id === id ? { ...c, speedKmh: newSpeed } : c));
  };
  const addCar = () => {
    setCars(prev => {
      if (prev.length >= 10) return prev;
      const newId = prev.length > 0 ? Math.max(...prev.map(c => c.id)) + 1 : 0;
      return [...prev, { id: newId, x: -100, lane: prev.length % 3, color: CAR_COLORS[newId % CAR_COLORS.length], speedKmh: 80 }];
    });
  };
  const removeCar = () => setCars(prev => prev.slice(0, -1));
  const randomizeSpeeds = () => setCars(prev => prev.map(c => ({ ...c, speedKmh: Math.floor(Math.random() * 100) + 40 })));
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const simState: SimulationState = {
    radar: radarParams,
    cars: cars,
    fastestTargetSpeed: realTargetSpeed,
    primaryDopplerShiftHz: realDopplerShift,
    speedResolution: resolutionKmh,
    maxSpeed: maxSpeedKmh
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Doppler Radar Simulator
            </h1>
            <p className="text-slate-400 text-sm mt-1">DSP & Multi-Target Physics Engine</p>
          </div>
          <div className="flex gap-4">
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 text-sm">
               {isCopied ? <Check size={16} className="text-emerald-400"/> : <Share2 size={16}/>} Share
            </button>
            <div className={`px-6 py-2 rounded-lg border ${measuredSpeedKmh > SPEED_LIMIT_KMH ? 'bg-red-950/30 border-red-500/50' : 'bg-slate-900 border-slate-700'} min-w-[180px]`}>
               <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Radar Measured Speed</div>
               <div className={`text-3xl font-mono font-bold ${measuredSpeedKmh > SPEED_LIMIT_KMH ? 'text-red-400' : 'text-emerald-400'}`}>
                 {measuredSpeedKmh.toFixed(1)} <span className="text-sm text-slate-500">km/h</span>
               </div>
               <div className="text-[10px] text-slate-600 mt-1 flex justify-between">
                 <span>Real: {realTargetSpeed} km/h</span>
                 <span title="Measurement Error">Err: {(measuredSpeedKmh - realTargetSpeed).toFixed(2)}</span>
               </div>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* LEFT COL: Scene & Traffic (8 cols) */}
          <div className="xl:col-span-7 space-y-6">
            <HighwayScene cars={cars} isRadarActive={true} />
            
            {/* Traffic Controls */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                   <Settings size={18} className="text-blue-400"/> Traffic
                 </h2>
                 <div className="flex gap-2">
                    <button onClick={randomizeSpeeds} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-slate-300"><Shuffle size={14}/></button>
                    <div className="w-px bg-slate-700 mx-1"></div>
                    <button onClick={removeCar} disabled={cars.length === 0} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-red-300"><Minus size={14}/></button>
                    <button onClick={addCar} disabled={cars.length >= 10} className="p-1.5 bg-slate-800 rounded hover:bg-slate-700 text-emerald-300"><Plus size={14}/></button>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {cars.map((car, idx) => (
                    <div key={car.id} className="flex items-center gap-3 bg-slate-950 p-2.5 rounded border border-slate-800">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: car.color, backgroundColor: car.color }}></div>
                        <span className="text-xs font-mono text-slate-500">T{idx + 1}</span>
                        <input 
                            type="range" min="0" max={maxSpeedKmh > 250 ? 250 : maxSpeedKmh - 10} step="1"
                            value={car.speedKmh} onChange={(e) => updateCarSpeed(car.id, parseInt(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="font-mono text-sm w-12 text-right">{car.speedKmh}</span>
                    </div>
                ))}
              </div>
            </div>

            {/* DSP / Radar Parameters */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                 <Zap size={100} />
               </div>
               <div className="flex justify-between items-center mb-6 relative z-10">
                 <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                   <Sliders size={18} className="text-purple-400"/> Radar DSP Configuration
                 </h2>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                  {/* Sampling Rate */}
                  <div className="space-y-3">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">Sampling Rate (Fs)</label>
                    <div className="flex items-center gap-2">
                       <input 
                         type="range" min="10000" max="100000" step="1000" 
                         value={radarParams.basebandSampleRateHz}
                         onChange={(e) => setRadarParams(p => ({...p, basebandSampleRateHz: parseInt(e.target.value)}))}
                         className="w-full accent-purple-500 h-1.5 bg-slate-700 rounded"
                       />
                    </div>
                    <div className="flex justify-between font-mono text-sm">
                       <span className="text-purple-300">{radarParams.basebandSampleRateHz} Hz</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Higher sampling increases measurable <strong>Range</strong> but reduces resolution (if FFT size is fixed).
                    </p>
                  </div>

                  {/* FFT Size */}
                  <div className="space-y-3">
                    <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">FFT Size (N)</label>
                    <select 
                      value={radarParams.fftSize}
                      onChange={(e) => setRadarParams(p => ({...p, fftSize: parseInt(e.target.value)}))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm font-mono text-purple-300 focus:border-purple-500 outline-none"
                    >
                       <option value="128">128 points</option>
                       <option value="256">256 points</option>
                       <option value="512">512 points</option>
                       <option value="1024">1024 points</option>
                       <option value="2048">2048 points (High Res)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Larger FFT size increases <strong>Observation Time</strong>, improving accuracy.
                    </p>
                  </div>

                  {/* RF Frequency */}
                  <div className="space-y-3">
                     <label className="text-xs uppercase font-bold text-slate-500 tracking-wider">RF Frequency</label>
                     <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded px-3 py-1.5">
                        <input 
                           type="number" step="0.01" value={radarParams.frequencyGHz}
                           onChange={(e) => setRadarParams(p => ({...p, frequencyGHz: parseFloat(e.target.value)}))}
                           className="bg-transparent w-full font-mono text-sm text-blue-300 outline-none"
                        />
                        <span className="text-xs text-slate-500">GHz</span>
                     </div>
                     <div className="text-[10px] text-slate-500">Wavelength: {wavelengthMm.toFixed(2)} mm</div>
                  </div>
               </div>
            </div>
          </div>

          {/* RIGHT COL: Analysis & Blackboard (4 cols) */}
          <div className="xl:col-span-5 space-y-6">
            
            {/* Physics Blackboard */}
            <div className="bg-black/40 rounded-xl border border-slate-800 p-5 font-mono text-sm shadow-inner">
               <h3 className="text-slate-400 text-xs uppercase font-bold mb-4 border-b border-slate-800 pb-2">DSP Physics Blackboard</h3>
               
               <div className="space-y-4">
                  {/* Measurement Time */}
                  <div className="flex justify-between items-center group border-b border-slate-800 pb-3 border-dashed">
                     <div>
                        <div className="text-slate-500 text-[10px]">Measurement Time (T_obs)</div>
                        <div className="text-slate-300">
                           T = <span className="text-purple-400">N</span> / <span className="text-purple-400">Fs</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-lg font-bold text-blue-400 flex items-center justify-end gap-2">
                          <Clock size={14} className="text-slate-500"/> {observationTimeMs.toFixed(1)} ms
                        </div>
                     </div>
                  </div>

                  {/* Resolution Formula */}
                  <div className="flex justify-between items-center group">
                     <div>
                        <div className="text-slate-500 text-[10px]">Speed Resolution (Accuracy)</div>
                        <div className="text-slate-300 mt-1">
                          Δv = <span className="text-yellow-500">λ</span> / (2 × <span className="text-blue-400">T_obs</span>)
                        </div>
                        <div className="text-[10px] text-slate-600 mt-1">
                           λ = {wavelengthMm.toFixed(2)}mm
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-2xl font-bold text-yellow-400">{resolutionKmh.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-500">km/h per bin</div>
                     </div>
                  </div>

                  {/* Range Formula */}
                  <div className="flex justify-between items-center group pt-2 border-t border-slate-800 border-dashed">
                     <div>
                        <div className="text-slate-500 text-[10px]">Max Unambiguous Speed</div>
                        <div className="text-slate-300">
                          V<sub>max</sub> ∝ <span className="text-purple-400">Fs</span> / 2
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-lg font-bold text-blue-400">{maxSpeedKmh.toFixed(0)}</div>
                        <div className="text-[10px] text-slate-500">km/h</div>
                     </div>
                  </div>
                  
                  {/* Warning for Aliasing */}
                  {fastestCar && fastestCar.speedKmh > maxSpeedKmh && (
                     <div className="bg-red-900/20 border border-red-500/50 p-2 rounded text-red-400 text-xs flex items-center gap-2">
                        <Activity size={14} /> Warning: Aliasing Detected! Increase Sample Rate.
                     </div>
                  )}
               </div>
            </div>

            {/* Spectrum Analyzer */}
            <div className="h-[400px]">
               <Oscilloscope simState={simState} />
            </div>
            
          </div>

        </main>
      </div>
    </div>
  );
};

export default App;