import React from 'react';
import { Measurement } from '../types';

interface SizeDistributionChartProps {
  measurements: Measurement[];
  manualStats: { mean: number; stdDev: number; } | null;
  showFit: boolean;
  bins?: number;
}

const SizeDistributionChart: React.FC<SizeDistributionChartProps> = ({ measurements, manualStats, showFit, bins = 10 }) => {
  const data = measurements.map(m => m.lengthInNm);

  if (data.length < 2) {
    return (
        <div className="h-48 flex flex-col items-center justify-center bg-gray-900/50 rounded-lg text-gray-500 text-sm p-4 text-center">
            <p>At least 2 measurements are needed for a distribution plot.</p>
            {data.length === 1 && <p className="mt-2 text-gray-300">Current: {data[0].toFixed(2)} nm</p>}
        </div>
    );
  }

  // --- Use pre-calculated stats ---
  const { mean, stdDev } = manualStats || { mean: 0, stdDev: 0 };
  
  // --- Histogram Calculation ---
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  if (range === 0) { // Handle case where all data points are the same
    return (
        <div className="h-48 flex flex-col items-center justify-center bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="font-semibold text-cyan-300">
                {mean.toFixed(2)} ± 0.00 nm
            </div>
             <p className="text-xs text-gray-400">(All measurements are identical)</p>
        </div>
    );
  }

  const binSize = range / bins;
  const histogramData = Array.from({ length: bins }, (_, i) => {
    const binMin = min + i * binSize;
    const binMax = binMin + binSize;
    const label = `${binMin.toFixed(1)}-${binMax.toFixed(1)}`;
    const count = data.filter(d => (d >= binMin && d < binMax) || (i === bins - 1 && d === max)).length;
    return { label, count, binMin, binMax };
  });
  const maxCount = Math.max(...histogramData.map(b => b.count), 0);
  
  // --- Gaussian Curve Calculation ---
  const gaussianPDF = (x: number) => (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
  
  let pathD = '';
  if (stdDev > 0) {
    const curvePoints = [];
    const numCurvePoints = 100;
    const curveRange = (max - min) * 1.2;
    const curveMin = mean - curveRange/2;
    const curveMax = mean + curveRange/2;

    for (let i = 0; i <= numCurvePoints; i++) {
        const x = curveMin + (i / numCurvePoints) * (curveMax - curveMin);
        const y = gaussianPDF(x) * data.length * binSize; 
        curvePoints.push({ x, y });
    }

    pathD = curvePoints
        .map((p, i) => {
            const xPos = ((p.x - min) / range) * 100;
            const yPos = 100 - (p.y / maxCount) * 100;
            if (xPos < 0 || xPos > 100 || yPos > 100 || isNaN(xPos) || isNaN(yPos)) return null;
            return `${i === 0 ? 'M' : 'L'} ${xPos.toFixed(3)} ${yPos.toFixed(3)}`;
        })
        .filter(Boolean)
        .join(' ');
  }

  return (
    <div className="flex flex-col items-center">
        {manualStats && (
            <div className="font-semibold text-cyan-300 text-sm">
                μ: {manualStats.mean.toFixed(2)} nm, σ: {manualStats.stdDev.toFixed(2)} nm
            </div>
        )}
        <div className="h-40 w-full flex items-end justify-center gap-[1px] p-2 bg-gray-900/50 rounded-lg mt-2 relative" aria-label="Histogram chart">
        {histogramData.map((bin, i) => (
            <div key={i} className="flex flex-col items-center flex-grow h-full justify-end" title={`Range: ${bin.label}\nCount: ${bin.count}`}>
            <div
                className="w-full bg-cyan-600 hover:bg-cyan-500 rounded-t-sm transition-colors duration-200"
                style={{ height: `${maxCount > 0 ? (bin.count / maxCount) * 100 : 0}%` }}
            ></div>
            </div>
        ))}
        {showFit && pathD && (
            <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d={pathD} stroke="#facc15" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke"/>
            </svg>
        )}
        </div>
        <div className="w-full flex justify-between text-xs text-gray-400 px-2">
            <span>{min.toFixed(1)}</span>
            <span>{max.toFixed(1)}</span>
        </div>
    </div>
  );
};

export default SizeDistributionChart;
