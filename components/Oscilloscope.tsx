import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { Activity } from 'lucide-react';
import { SimulationState } from '../types';
import { calculateDopplerShift, calculateSpeedFromShift } from '../utils/physics';

interface OscilloscopeProps {
  simState: SimulationState;
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({ simState }) => {
  const { cars, radar, speedResolution, maxSpeed } = simState;

  // Generate REALISTIC discrete FFT bins
  const generateDiscreteSpectrum = () => {
    // Number of positive frequency bins = N / 2
    const numBins = radar.fftSize / 2;
    // Resolution in Hz per bin
    const freqRes = radar.basebandSampleRateHz / radar.fftSize;
    
    // Initialize empty bins
    // We limit display to a reasonable range for visualization (e.g. up to 250km/h or full range if lower)
    // If we showed all 1024 bins, the bars would be too thin to see "binning" effect nicely in this small chart.
    // However, to show the *physics* of binning, we must compute it on the real grid.
    
    // Let's generate the data array. To keep Recharts performant, if bins > 200, we might need to be careful,
    // but standard area charts handle ~500 points okay. 
    
    const data = new Array(numBins).fill(0).map((_, i) => ({
      binIndex: i,
      freq: i * freqRes,
      speed: calculateSpeedFromShift(i * freqRes, radar.frequencyGHz),
      amp: 2 + Math.random() * 2 // Noise floor
    }));

    // Add signal energy
    cars.forEach(car => {
        if (car.speedKmh > 0) {
            const shiftHz = calculateDopplerShift(car.speedKmh, radar.frequencyGHz);
            
            // Aliasing check
            const maxFreq = radar.basebandSampleRateHz / 2;
            let effectiveFreq = Math.abs(shiftHz);
            
            // Simple aliasing wrapping (if freq > Nyquist, it wraps back)
            while (effectiveFreq > maxFreq) {
                effectiveFreq = Math.abs(effectiveFreq - radar.basebandSampleRateHz);
            }

            // Find bin
            const exactBin = effectiveFreq / freqRes;
            const binIndex = Math.round(exactBin);

            if (binIndex >= 0 && binIndex < numBins) {
                // Main lobe
                data[binIndex].amp += 100;
                // Spectral leakage (simplified windowing effect)
                if (binIndex > 0) data[binIndex - 1].amp += 30;
                if (binIndex < numBins - 1) data[binIndex + 1].amp += 30;
            }
        }
    });

    // 0Hz DC Component (Static Clutter)
    data[0].amp += 150; 
    data[1].amp += 50;

    // Filter for display: Only show up to a reasonable visual limit (e.g. 300km/h) unless range is smaller
    // This ensures we can see the bins clearly.
    const visualCutoffSpeed = Math.max(200, maxSpeed * 0.8);
    return data.filter(d => d.speed < visualCutoffSpeed);
  };

  const spectrumData = generateDiscreteSpectrum();
  const tickFormatter = (val: number) => val.toFixed(0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
      <div className="bg-slate-800/50 p-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <Activity size={16} className="text-emerald-500" />
           <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Baseband Spectrum (FFT)</span>
        </div>
        <div className="flex gap-4 text-[10px] font-mono text-slate-500">
           <span>Bin Width: <span className="text-slate-300">{speedResolution.toFixed(2)} km/h</span></span>
        </div>
      </div>
      
      <div className="flex-grow relative min-h-[250px] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spectrumData}>
            <defs>
              <linearGradient id="fftGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey="speed" 
              type="number" 
              domain={[0, 'auto']}
              tick={{fill: '#64748b', fontSize: 10}}
              tickFormatter={tickFormatter}
              label={{ value: 'Speed (km/h)', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
              allowDataOverflow={false}
            />
            <YAxis hide domain={[0, 180]} />
            <Tooltip 
              cursor={{stroke: '#fff', strokeWidth: 1, strokeDasharray: '3 3'}}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-2 rounded shadow-xl text-xs font-mono">
                      <div className="text-emerald-400 font-bold mb-1">Bin {data.binIndex}</div>
                      <div>Freq:  {data.freq.toFixed(1)} Hz</div>
                      <div>Speed: {data.speed.toFixed(1)} km/h</div>
                      <div>Amp:   {data.amp.toFixed(0)} dB</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* We use stepAfter to emphasize the discrete nature of bins */}
            <Area 
                type="stepAfter" 
                dataKey="amp" 
                stroke="#10b981" 
                strokeWidth={2}
                fill="url(#fftGradient)" 
                isAnimationActive={false} 
            />
            {/* Draw speed limit line if within view */}
            <ReferenceLine x={100} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'LIMIT', fill: 'red', fontSize: 10, position: 'insideTopRight' }} />
          </AreaChart>
        </ResponsiveContainer>
        
        {/* Overlay showing Nyquist Limit if visible */}
        <div className="absolute top-2 right-2 text-[10px] text-slate-500 bg-black/40 px-2 py-1 rounded">
           Max Range: {maxSpeed.toFixed(0)} km/h
        </div>
      </div>
    </div>
  );
};