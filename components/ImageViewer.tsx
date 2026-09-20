
import React, { useRef, useState, MouseEvent, useEffect, useCallback } from 'react';
import { ZoomInIcon, ZoomOutIcon, ArrowsExpandIcon } from './icons';
import { Measurement, Scale } from '../types';
import { DrawingMode } from '../App';

interface ImageViewerProps {
  imageUrl: string;
  baselineImageUrl?: string;
  zoom: number;
  setZoom: (zoom: number | ((prevZoom: number) => number)) => void;
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  drawingMode: DrawingMode;
  onDrawEnd: (coords: { start: {x:number, y:number}, end: {x:number, y:number} }) => void;
  roi: { x: number; y: number; width: number; height: number; } | null;
  scaleLine: { x1: number, y1: number, x2: number, y2: number } | null;
  measurements: Measurement[];
  scale: Scale | null;
  triggerDownload: boolean;
  onDownloadComplete: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
    imageUrl, baselineImageUrl, zoom, setZoom, panOffset, setPanOffset, onDrawEnd, drawingMode, 
    roi, scaleLine, measurements, scale, triggerDownload, onDownloadComplete 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'primary' | 'baseline'>('primary');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isRightAltPressed, setIsRightAltPressed] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const handleResetView = useCallback(() => {
    if (!imageRef.current || !viewportRef.current) return;
    const img = imageRef.current;
    const vp = viewportRef.current;
    const fitZoom = Math.min((vp.offsetWidth - 40) / img.naturalWidth, (vp.offsetHeight - 40) / img.naturalHeight, 1);
    setZoom(fitZoom);
    setPanOffset({
      x: (vp.offsetWidth - img.naturalWidth * fitZoom) / 2,
      y: (vp.offsetHeight - img.naturalHeight * fitZoom) / 2
    });
  }, [setZoom, setPanOffset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // e.code 'AltRight' specifically handles the right alt key
        if (e.code === 'AltRight' && !e.repeat) {
            e.preventDefault();
            setIsRightAltPressed(true);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'AltRight') setIsRightAltPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!baselineImageUrl) {
      setActiveTab('primary');
    }
  }, [baselineImageUrl]);

  const handleZoom = useCallback((factor: number, center: { x: number, y: number }) => {
    setZoom(prevZoom => {
        const newZoom = Math.max(0.01, Math.min(prevZoom * factor, 50));
        setPanOffset(prevPan => ({
            x: center.x - ((center.x - prevPan.x) / prevZoom) * newZoom,
            y: center.y - ((center.y - prevPan.y) / prevZoom) * newZoom,
        }));
        return newZoom;
    });
  }, [setZoom, setPanOffset]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        const center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        handleZoom(factor, center);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [handleZoom]);

  const getMeasurementDisplay = useCallback((measurement: Measurement) => {
    const unit = scale?.unit || 'nm';
    let value = measurement.lengthInNm;
    if (unit === 'µm') value /= 1000;
    if (unit === 'mm') value /= 1000000;
    return `${value.toFixed(2)} ${unit}`;
  }, [scale]);

  useEffect(() => {
    if (!triggerDownload) return;
    const exportImage = async () => {
        const img = imageRef.current;
        if (!img) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0);
        ctx.lineWidth = 4;
        ctx.font = '24px Arial';
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#facc15';

        measurements.forEach(m => {
            ctx.beginPath();
            ctx.moveTo(m.line.x1, m.line.y1);
            ctx.lineTo(m.line.x2, m.line.y2);
            ctx.stroke();
            const text = getMeasurementDisplay(m);
            ctx.fillText(text, (m.line.x1 + m.line.x2) / 2, (m.line.y1 + m.line.y2) / 2 - 10);
        });

        const link = document.createElement('a');
        link.download = `characterization_export_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        onDownloadComplete();
    };
    exportImage();
  }, [triggerDownload, measurements, getMeasurementDisplay, onDownloadComplete]);

  const getMousePos = (e: MouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffset.x) / zoom,
      y: (e.clientY - rect.top - panOffset.y) / zoom,
    };
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (isRightAltPressed || drawingMode === 'pan') {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        return;
    }
    setIsDrawing(true);
    const pos = getMousePos(e);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (rect) setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (isPanning) {
        setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        return;
    }
    if (isDrawing) setCurrentPos(getMousePos(e));
  };

  const activePan = isRightAltPressed || drawingMode === 'pan';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 border-b border-gray-700 pb-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              Analysis Workbench {activePan && <span className="text-cyan-400 font-black animate-pulse">[GRAB ENABLED]</span>}
          </h3>
          {baselineImageUrl && (
            <div className="flex bg-gray-900/80 p-0.5 rounded-lg border border-gray-700">
              <button
                onClick={() => setActiveTab('primary')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                  activeTab === 'primary' 
                    ? 'bg-cyan-600/80 text-white shadow-sm font-extrabold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Post-Reaction (Spent)
              </button>
              <button
                onClick={() => setActiveTab('baseline')}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                  activeTab === 'baseline' 
                    ? 'bg-amber-600/80 text-white shadow-sm font-extrabold' 
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Pre-Reaction (Pristine)
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button onClick={handleResetView} className="p-1.5 bg-gray-700 rounded hover:bg-cyan-600 text-[10px] font-bold text-white px-3 transition-all">Recenter View</button>
          <div className="h-4 w-px bg-gray-700 mx-1"></div>
          <button onClick={() => handleZoom(0.8, cursorPos)} className="p-1.5 bg-gray-700 rounded hover:bg-cyan-600 transition-all"><ZoomOutIcon className="w-4 h-4"/></button>
          <span className="text-white text-[10px] font-mono w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button onClick={() => handleZoom(1.2, cursorPos)} className="p-1.5 bg-gray-700 rounded hover:bg-cyan-600 transition-all"><ZoomInIcon className="w-4 h-4"/></button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="w-full h-[500px] bg-black rounded-md overflow-hidden relative border border-gray-700"
        style={{ cursor: isPanning ? 'grabbing' : (activePan ? 'grab' : 'crosshair') }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => {setIsDrawing(false); setIsPanning(false); if(isDrawing) onDrawEnd({start: startPos, end: currentPos});}}
        onMouseLeave={() => {setIsDrawing(false); setIsPanning(false);}}
      >
        <div className="absolute pointer-events-none border-l border-cyan-400/20 w-px h-full z-10" style={{ left: cursorPos.x }} />
        <div className="absolute pointer-events-none border-t border-cyan-400/20 h-px w-full z-10" style={{ top: cursorPos.y }} />

        <div
            ref={containerRef}
            className="absolute top-0 left-0"
            style={{ 
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, 
                transformOrigin: '0 0',
                willChange: 'transform'
            }}
        >
            <img ref={imageRef} src={activeTab === 'primary' ? imageUrl : baselineImageUrl} alt="Microscopy Source" className="max-w-none block pointer-events-none select-none" onLoad={handleResetView} referrerPolicy="no-referrer" />
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ strokeWidth: `${2/zoom}px`, overflow: 'visible' }}>
                {roi && <rect x={roi.x} y={roi.y} width={roi.width} height={roi.height} className="stroke-cyan-400 fill-cyan-400/10" />}
                {measurements.map(m => (
                    <g key={m.id}>
                        <line x1={m.line.x1} y1={m.line.y1} x2={m.line.x2} y2={m.line.y2} className="stroke-yellow-400" />
                        <text x={(m.line.x1 + m.line.x2)/2} y={(m.line.y1 + m.line.y2)/2 - 5/zoom} className="fill-yellow-400 font-bold" style={{ fontSize: `${12/zoom}px`, textAnchor: 'middle' }}>{getMeasurementDisplay(m)}</text>
                    </g>
                ))}
                {isDrawing && drawingMode === 'roi' && (
                    <rect x={Math.min(startPos.x, currentPos.x)} y={Math.min(startPos.y, currentPos.y)} width={Math.abs(currentPos.x - startPos.x)} height={Math.abs(currentPos.y - startPos.y)} className="stroke-cyan-400 fill-cyan-400/10" />
                )}
                {isDrawing && (drawingMode === 'measure') && (
                    <line x1={startPos.x} y1={startPos.y} x2={currentPos.x} y2={currentPos.y} className="stroke-yellow-400" />
                )}
            </svg>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-gray-500 uppercase flex justify-between font-bold">
          <span>Hold <span className="text-cyan-400">RIGHT-ALT</span> to Grab & Pan • <span className="text-cyan-400">Ctrl+Z</span> to Undo</span>
          <span>Scroll to Zoom (Centered on Mouse)</span>
      </div>
    </div>
  );
};

export default ImageViewer;
