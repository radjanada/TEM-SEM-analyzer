
import React, { useState } from 'react';
import { CrosshairIcon, RulerIcon, ScaleIcon, TrashIcon, DownloadIcon, ArrowsExpandIcon } from './icons';
import { DrawingMode } from '../App';
import { Scale, ScaleUnit, Measurement } from '../types';
import SizeDistributionChart from './SizeDistributionChart';

interface MeasurementPanelProps {
    drawingMode: DrawingMode;
    setDrawingMode: (mode: DrawingMode) => void;
    scale: Scale | null;
    setScale: (scale: Scale | null) => void;
    scaleDrawLine: {x1:number, y1:number, x2:number, y2:number} | null;
    setScaleDrawLine: (line: {x1:number, y1:number, x2:number, y2:number} | null) => void;
    measurements: Measurement[];
    setMeasurements: (measurements: Measurement[]) => void;
    resetRoi: () => void;
    onDeleteMeasurement: (id: string) => void;
    onDownloadRequest: () => void;
    manualStats: { mean: number; stdDev: number; } | null;
}

const ToolButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; tooltip: string; }> = ({ active, onClick, children, tooltip }) => (
  <button
    onClick={onClick}
    className={`relative group p-2 rounded-lg transition-colors duration-200 border ${active ? 'bg-cyan-600 text-white border-cyan-400' : 'bg-gray-700 hover:bg-gray-600 border-gray-600'}`}
  >
    {children}
    <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-900 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {tooltip}
    </span>
  </button>
);

// Helper icon for Pan (Hand)
const HandIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075-5.925V4.5a1.575 1.575 0 013.15 0V8.25m-3.15-3.675V3c0-.828.705-1.5 1.575-1.5s1.575.672 1.575 1.5v.75m-1.575 10.125a5.175 5.175 0 0010.35 0V8.25m-10.35 0v3.75m0 0a1.575 1.575 0 10-3.15 0V12a1.575 1.575 0 10-3.15 0v4.5a1.575 1.575 0 10-3.15 0V5.25a1.575 1.575 0 10-3.15 0v11.25c0 4.47 3.978 8.1 8.865 8.1 4.887 0 8.865-3.63 8.865-8.1V9" />
    </svg>
);

const MeasurementPanel: React.FC<MeasurementPanelProps> = ({
  drawingMode, setDrawingMode, scale, setScale, scaleDrawLine, setScaleDrawLine, 
  measurements, setMeasurements, resetRoi, onDeleteMeasurement, onDownloadRequest, manualStats
}) => {
  const [knownLength, setKnownLength] = useState('100');
  const [unit, setUnit] = useState<ScaleUnit>('nm');
  const [showGaussianFit, setShowGaussianFit] = useState(true);

  const handleSetScale = () => {
    if (!scaleDrawLine) return;
    const pixelLength = Math.sqrt(Math.pow(scaleDrawLine.x2 - scaleDrawLine.x1, 2) + Math.pow(scaleDrawLine.y2 - scaleDrawLine.y1, 2));
    if (pixelLength > 0 && parseFloat(knownLength) > 0) {
      setScale({
        pixelLength,
        knownLength: parseFloat(knownLength),
        unit,
      });
      setDrawingMode('measure');
    }
  };

  const handleClearMeasurements = () => {
      if (window.confirm('Are you sure you want to delete all measurements?')) {
          setMeasurements([]);
      }
  }

  const handleExportCsv = () => {
    if (measurements.length === 0) return;
    const headers = 'Measurement ID,Diameter (nm)';
    const rows = measurements.map((m, i) => `${i+1},${m.lengthInNm.toFixed(3)}`);
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join('\n')}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'measurements.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Workbench Tools</h3>
        <div className="flex items-center gap-2 p-1 bg-gray-900/50 rounded-lg border border-gray-700">
          <ToolButton active={drawingMode === 'pan'} onClick={() => setDrawingMode('pan')} tooltip="Grab & Move Image (Space + Drag)">
            <HandIcon className="w-5 h-5"/>
          </ToolButton>
          <ToolButton active={drawingMode === 'roi'} onClick={() => setDrawingMode('roi')} tooltip="Select ROI (Region of Interest)">
            <CrosshairIcon className="w-5 h-5"/>
          </ToolButton>
          <ToolButton active={drawingMode === 'scale'} onClick={() => setDrawingMode('scale')} tooltip="Draw Scale Bar Reference">
            <ScaleIcon className="w-5 h-5"/>
          </ToolButton>
          <ToolButton active={drawingMode === 'measure'} onClick={() => setDrawingMode('measure')} tooltip="Measure Particle Dimensions" >
            <RulerIcon className="w-5 h-5" />
          </ToolButton>
        </div>
        <div className="flex-grow flex items-center gap-2 justify-end">
          <button onClick={resetRoi} className="text-[10px] bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-md uppercase font-bold text-gray-300 border border-gray-600">Clear ROI</button>
          <button onClick={() => { setScale(null); setScaleDrawLine(null); }} className="text-[10px] bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-md uppercase font-bold text-gray-300 border border-gray-600">Clear Scale</button>
        </div>
      </div>
      
      {drawingMode === 'scale' && !scale && (
        <div className="bg-cyan-900/20 p-4 rounded-lg space-y-3 border border-cyan-500/30">
            <p className="text-xs text-cyan-300 font-medium leading-relaxed">
                {scaleDrawLine ? '2. Enter the known physical length of the line you just drew.' : '1. Click and drag across the image scale bar to calibrate measurements.'}
            </p>
            {scaleDrawLine && (
                <div className="flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                    <div className="relative">
                        <input 
                            type="number"
                            value={knownLength}
                            onChange={e => setKnownLength(e.target.value)}
                            className="w-24 bg-gray-900 border border-gray-600 rounded-md p-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="Value"
                        />
                    </div>
                    <select value={unit} onChange={e => setUnit(e.target.value as ScaleUnit)} className="bg-gray-900 border border-gray-600 rounded-md p-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none">
                        <option value="nm">nm</option>
                        <option value="µm">µm</option>
                        <option value="mm">mm</option>
                    </select>
                    <button onClick={handleSetScale} className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded-md text-xs font-bold text-white transition-all shadow-lg hover:shadow-cyan-500/20">Calibrate</button>
                </div>
            )}
        </div>
      )}
      {scale && (
          <div className="text-[11px] bg-green-900/30 text-green-400 p-3 rounded-md border border-green-500/30 flex items-center justify-between">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div> Scale Reference: <strong className="font-bold text-white">{scale.knownLength} {scale.unit}</strong> ({scale.pixelLength.toFixed(1)} px)</span>
              <button onClick={() => setDrawingMode('measure')} className="text-[9px] uppercase font-black bg-green-500/20 px-2 py-0.5 rounded hover:bg-green-500/40 transition-all">Start Measuring</button>
          </div>
      )}

      {measurements.length > 0 && (
          <div className="space-y-4 border-t border-gray-700 pt-4">
              <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Measurements Log ({measurements.length})</h4>
                  <div className="flex items-center gap-2">
                    <button onClick={onDownloadRequest} className="text-[10px] bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded-md flex items-center gap-1 font-bold hover:bg-indigo-800 border border-indigo-700/50"><DownloadIcon className="w-3.5 h-3.5" /> EXPORT IMG</button>
                    <button onClick={handleExportCsv} className="text-[10px] bg-cyan-900/50 text-cyan-300 px-3 py-1.5 rounded-md font-bold hover:bg-cyan-800 border border-cyan-700/50">CSV</button>
                    <button onClick={handleClearMeasurements} className="p-1.5 bg-red-900/40 text-red-400 hover:bg-red-800 hover:text-white rounded-md transition-all border border-red-700/50"><TrashIcon className="w-4 h-4" /></button>
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="max-h-48 overflow-y-auto bg-gray-900/50 rounded-lg p-2 space-y-1 custom-scrollbar border border-gray-700/50 shadow-inner">
                    {measurements.map((m, i) => (
                        <div key={m.id} className="flex justify-between items-center p-2 rounded bg-gray-700/30 group border border-transparent hover:border-cyan-500/20 transition-all">
                            <span className="text-xs font-mono">M{String(i+1).padStart(2, '0')}: <strong className="text-cyan-400">{m.lengthInNm.toFixed(2)} nm</strong></span>
                            <button onClick={() => onDeleteMeasurement(m.id)} className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="bg-gray-900/30 p-2 rounded-lg border border-gray-700/50 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                     <h5 className="text-[10px] font-bold text-gray-500 uppercase px-1">Statistical Dist.</h5>
                     <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="show-fit" 
                            checked={showGaussianFit} 
                            onChange={e => setShowGaussianFit(e.target.checked)}
                            className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-cyan-600 focus:ring-cyan-500"
                        />
                        <label htmlFor="show-fit" className="text-[10px] text-gray-400 font-bold uppercase cursor-pointer">Fit Curve</label>
                    </div>
                  </div>
                  <SizeDistributionChart measurements={measurements} manualStats={manualStats} showFit={showGaussianFit} />
                </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default MeasurementPanel;
