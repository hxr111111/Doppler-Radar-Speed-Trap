import React, { useRef, useEffect } from 'react';
import { Car } from '../types';

interface HighwaySceneProps {
  cars: Car[];
  isRadarActive: boolean;
}

export const HighwayScene: React.FC<HighwaySceneProps> = ({ cars, isRadarActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  
  // We use a Map to track the continuous X position of cars by ID.
  // This prevents cars from resetting to the start when React re-renders (e.g., speed change).
  const carPositionsRef = useRef<Map<number, number>>(new Map());

  // Initialize random positions for new cars
  useEffect(() => {
    cars.forEach(car => {
      if (!carPositionsRef.current.has(car.id)) {
        carPositionsRef.current.set(car.id, Math.random() * 800);
      }
    });
  }, [cars]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#334155'; // Dark Asphalt
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grass
      ctx.fillStyle = '#166534';
      ctx.fillRect(0, 0, canvas.width, 40); // Top grass
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40); // Bottom grass

      // Draw Lanes
      const roadTop = 40;
      const roadHeight = canvas.height - 80;
      const laneHeight = roadHeight / 3;

      // Lane markers
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([20, 20]);
      ctx.lineWidth = 2;
      
      [1, 2].forEach(i => {
        ctx.beginPath();
        ctx.moveTo(0, roadTop + laneHeight * i);
        ctx.lineTo(canvas.width, roadTop + laneHeight * i);
        ctx.stroke();
      });

      // Reset dash
      ctx.setLineDash([]);

      // Draw Radar Station (Top Left)
      const radarX = 100;
      const radarY = 30;
      
      // Pole
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(radarX - 2, radarY, 4, 30);
      // Box
      ctx.fillStyle = isRadarActive ? '#ef4444' : '#64748b';
      ctx.fillRect(radarX - 15, radarY - 15, 30, 20);
      // Speed Limit Sign
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(radarX + 50, radarY - 20, 30, 40);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(radarX + 50, radarY - 20, 30, 40);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('100', radarX + 65, radarY + 5);

      // --- Animation & Drawing Loop ---
      
      cars.forEach(car => {
          // Get current position from Ref, fallback to car.x if needed
          let currentX = carPositionsRef.current.get(car.id) ?? car.x;
          
          // Update Position based on INDIVIDUAL speed
          // Scale factor: 0.03 pixels per km/h per frame
          const pixelsPerFrame = (car.speedKmh * 0.03);
          
          currentX += pixelsPerFrame;
          
          // Loop around
          if (currentX > canvas.width + 100) currentX = -100;
          
          // Save back to Ref
          carPositionsRef.current.set(car.id, currentX);

          // Calculate Y
          const carY = roadTop + (car.lane * laneHeight) + (laneHeight / 2);
          
          // Draw Car Body
          ctx.fillStyle = car.color;
          
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(currentX, carY - 10, 40, 20, 5);
            ctx.fill();
          } else {
             ctx.fillRect(currentX, carY - 10, 40, 20);
          }

          // Windows
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(currentX + 25, carY - 8, 10, 16); // Windshield

          // Speed Label above car
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${car.speedKmh}`, currentX + 20, carY - 15);

          // Radar Waves Visualization
          const dx = currentX - radarX;
          const dy = carY - radarY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Simple beam logic: active, in front of radar, within range
          if (isRadarActive && currentX > radarX && dist < 600) {
             const opacity = Math.max(0, 1 - dist / 600);

             // Draw beam (Tx)
             const gradient = ctx.createLinearGradient(radarX, radarY, currentX, carY);
             gradient.addColorStop(0, `rgba(34, 197, 94, ${opacity * 0.4})`); 
             gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
             
             ctx.beginPath();
             ctx.moveTo(radarX, radarY);
             ctx.lineTo(currentX, carY);
             ctx.strokeStyle = gradient;
             ctx.lineWidth = 1;
             ctx.stroke();

             // Draw "Reflected" waves (Rx - Doppler visual)
             // Only if moving
             if (car.speedKmh > 0) {
                const time = Date.now() / 150; 
                // Draw a few arcs radiating from the car back towards the radar
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
                ctx.lineWidth = 1.5;

                for(let i=0; i<2; i++) {
                    const offset = (time + i * 5) % 15;
                    const radius = 20 + offset;
                    const angleToRadar = Math.atan2(radarY - carY, radarX - currentX);
                    ctx.beginPath();
                    ctx.arc(currentX, carY, radius, angleToRadar - 0.5, angleToRadar + 0.5);
                    ctx.stroke();
                }
             }
          }
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cars, isRadarActive]); // Re-bind if cars array changes (length/speeds)

  return (
    <div className="relative w-full h-64 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={256}
        className="w-full h-full block"
      />
      <div className="absolute top-2 right-2 bg-black/50 text-xs px-2 py-1 rounded text-white pointer-events-none select-none">
        Multi-Target Tracking Active
      </div>
    </div>
  );
};