
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AnalysisParams, AnalysisReportData, ChatMessage, ImageFile, Scale, Measurement, LiteratureItem, AIServiceConfig } from './types';
import { getAutoFillSuggestions, performFullAnalysis, resetChat, performLiteratureReview, processAIAction } from './services/geminiService';
import { loadAIServiceConfig } from './services/aiConfig';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import AnalysisForm from './components/AnalysisForm';
import ImageViewer from './components/ImageViewer';
import AnalysisReport from './components/AnalysisReport';
import ChatAssistant from './components/ChatAssistant';
import Loader from './components/Loader';
import MeasurementPanel from './components/MeasurementPanel';
import OllamaSettingsModal from './components/OllamaSettingsModal';
import { RobotIcon, BeakerIcon, ChartBarIcon, AcademicCapIcon, CogIcon, XMarkIcon } from './components/icons';

export type DrawingMode = 'roi' | 'scale' | 'measure' | 'pan';

export default function App() {
  const [aiConfig, setAiConfig] = useState<AIServiceConfig>(loadAIServiceConfig);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [baselineImage, setBaselineImage] = useState<ImageFile | null>(null);
  const [analysisParams, setAnalysisParams] = useState<AnalysisParams>({
    materialType: 'Nanocomposite / Hybrid Material',
    synthesisMethod: '',
    nanoparticleName: '',
    crystalStructure: '',
    microscopyType: 'TEM',
    detector: 'ETD',
    vacuum: 'High',
    magnification: '',
    temMode: 'Bright-field',
    manualScaleValue: '',
    manualScaleUnit: 'nm',
    manualParticleSize: '',
    manualParticleShapes: [],
    application: 'Not Specified',
    imageStage: 'not_specified',
    imageStageDetails: '',
  });
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const [roi, setRoi] = useState<{ x: number; y: number; width: number; height: number; } | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('roi');
  const [scale, setScale] = useState<Scale | null>(null);
  const [scaleDrawLine, setScaleDrawLine] = useState<{x1:number, y1:number, x2:number, y2:number} | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [triggerDownload, setTriggerDownload] = useState(false);

  const [litReview, setLitReview] = useState<LiteratureItem[] | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const manualStats = useMemo(() => {
    const data = measurements.map(m => m.lengthInNm);
    if (data.length < 1) return null;
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const stdDev = n > 1 ? Math.sqrt(data.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / (n - 1)) : 0;
    return { mean, stdDev };
  }, [measurements]);

  useEffect(() => {
    const handleConfigChange = (e: CustomEvent<AIServiceConfig>) => {
      setAiConfig(e.detail);
    };
    window.addEventListener('ai-config-changed' as any, handleConfigChange);
    return () => window.removeEventListener('ai-config-changed' as any, handleConfigChange);
  }, []);

  useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        setMeasurements(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleUndo);
    return () => window.removeEventListener('keydown', handleUndo);
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      const imageUrl = URL.createObjectURL(file);
      setImage({ file, base64: base64String, url: imageUrl });
      resetState(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleBaselineImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      const imageUrl = URL.createObjectURL(file);
      setBaselineImage({ file, base64: base64String, url: imageUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveBaselineImage = useCallback(() => {
    setBaselineImage(null);
  }, []);
  
  const handleAutoFill = async () => {
    if (!image) return;
    setIsAutoFilling(true);
    setError(null);
    try {
      const suggestions = await getAutoFillSuggestions(image.base64);
      setAnalysisParams(prev => ({ ...prev, ...suggestions }));
    } catch (err) {
      setError(`Auto-fill failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisReport(null);
    resetChat();

    try {
      const report = await performFullAnalysis(
        image.base64, 
        analysisParams, 
        roi, 
        scale, 
        measurements, 
        manualStats,
        baselineImage?.base64
      );
      setAnalysisReport(report);
      
      if (analysisParams.materialType && analysisParams.materialType !== 'Other') {
        handleLitReview(analysisParams);
      }
    } catch (err) {
      setError(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLitReview = async (params: AnalysisParams) => {
    setIsReviewing(true);
    const components = [
        params.nanoparticleName,
        params.materialType,
        params.crystalStructure,
        params.synthesisMethod,
        params.startingMaterials?.join(' ')
    ].filter(Boolean);

    const query = `${components.join(', ')} microscopy characterization study`;
    
    try {
        const result = await performLiteratureReview(query);
        setLitReview(result);
    } catch (err) {
        console.error("Lit review error", err);
    } finally {
        setIsReviewing(false);
    }
  };

  const handleExtendLit = (items: LiteratureItem[]) => {
      setLitReview(prev => [...(prev || []), ...items]);
  };

  const resetState = (isNewImage = false) => {
      setBaselineImage(null);
      if (!isNewImage) {
        setImage(null);
        setAnalysisParams({
            materialType: 'Nanocomposite / Hybrid Material',
            synthesisMethod: '',
            nanoparticleName: '',
            crystalStructure: '',
            microscopyType: 'TEM',
            detector: 'ETD',
            vacuum: 'High',
            magnification: '',
            temMode: 'Bright-field',
            manualScaleValue: '',
            manualScaleUnit: 'nm',
            manualParticleSize: '',
            manualParticleShapes: [],
            application: 'Not Specified',
            imageStage: 'not_specified',
            imageStageDetails: '',
        });
      }
      setAnalysisReport(null);
      setError(null);
      setChatHistory([]);
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setRoi(null);
      setDrawingMode('roi');
      setScale(null);
      setScaleDrawLine(null);
      setMeasurements([]);
      setLitReview(null);
      resetChat();
  }

  const handleDrawEnd = ({ start, end }: { start: {x:number, y:number}, end: {x:number, y:number} }) => {
    if (drawingMode === 'roi') {
      const newRoi = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
      if (newRoi.width > 2 && newRoi.height > 2) setRoi(newRoi);
    } else if (drawingMode === 'scale') {
      setScaleDrawLine({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    } else if (drawingMode === 'measure' && scale) {
      const pixelLength = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      let lengthInNm = (pixelLength / scale.pixelLength) * scale.knownLength;
      if (scale.unit === 'µm') lengthInNm *= 1000;
      if (scale.unit === 'mm') lengthInNm *= 1000000;
      const newMeasurement: Measurement = {
        id: new Date().toISOString() + Math.random(),
        lengthInNm: lengthInNm,
        line: { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
      };
      setMeasurements(prev => [...prev, newMeasurement]);
    }
  };

  const getEngineLoaderMessage = () => {
    switch (aiConfig.provider) {
      case 'openai': return `Analyzing geometry and surface features with OpenAI (${aiConfig.openaiModel || 'gpt-4o'})...`;
      case 'claude': return `Analyzing geometry and surface features with Anthropic Claude (${aiConfig.claudeModel || 'Sonnet'})...`;
      case 'openrouter': return `Analyzing geometry and surface features with OpenRouter (${aiConfig.openrouterModel || 'AI'})...`;
      case 'custom': return `Analyzing geometry and surface features with Custom Provider (${aiConfig.customModel || 'v1'})...`;
      case 'ollama': return `Analyzing geometry and surface features with Local Ollama (${aiConfig.ollamaVisionModel || 'Local Vision'})...`;
      case 'gemini':
      default: return `Analyzing geometry and surface features with Google Gemini (${aiConfig.geminiModel || 'gemini-2.5-flash'})...`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      {isAnalyzing && (
        <Loader message={getEngineLoaderMessage()} />
      )}
      {isReviewing && <Loader message="Cross-referencing global publications for grounded characterization data..." />}
      
      <div className="max-w-8xl mx-auto space-y-8">
        <Header aiConfig={aiConfig} onOpenSettings={() => setIsSettingsOpen(true)} />

        {error && (
          <div className="bg-red-950/70 border border-red-800 text-red-200 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-red-400 text-xl font-bold">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 bg-red-900/60 hover:bg-red-850 border border-red-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <CogIcon className="w-3.5 h-3.5" />
                Change AI Engine / Keys
              </button>
              <button
                onClick={() => setError(null)}
                className="p-1.5 text-red-400 hover:text-white rounded-lg hover:bg-red-900/40"
                title="Dismiss"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!image && <ImageUploader onImageUpload={handleImageUpload} />}

        {image && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            <div className="xl:col-span-3 space-y-6">
               <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2"><BeakerIcon /> Project Context</h2>
                    <div className="flex gap-2">
                        <button onClick={() => resetState(false)} className="bg-red-600/20 hover:bg-red-700/40 text-red-400 border border-red-900/50 font-bold py-2 px-4 rounded-lg transition-all">
                            Reset Sample
                        </button>
                    </div>
               </div>

              <AnalysisForm 
                params={analysisParams} 
                setParams={setAnalysisParams}
                isAutoFilling={isAutoFilling}
                onAutoFillRequest={handleAutoFill}
                baselineImage={baselineImage}
                onBaselineImageUpload={handleBaselineImageUpload}
                onRemoveBaselineImage={handleRemoveBaselineImage}
              />
              
              <ImageViewer 
                imageUrl={image.url}
                baselineImageUrl={baselineImage?.url}
                zoom={zoom}
                setZoom={setZoom}
                panOffset={panOffset}
                setPanOffset={setPanOffset}
                onDrawEnd={handleDrawEnd}
                drawingMode={drawingMode}
                roi={roi}
                scaleLine={scaleDrawLine}
                measurements={measurements}
                scale={scale}
                triggerDownload={triggerDownload}
                onDownloadComplete={() => setTriggerDownload(false)}
              />

               <MeasurementPanel 
                drawingMode={drawingMode}
                setDrawingMode={setDrawingMode}
                scale={scale}
                setScale={setScale}
                scaleDrawLine={scaleDrawLine}
                setScaleDrawLine={setScaleDrawLine}
                measurements={measurements}
                setMeasurements={setMeasurements}
                resetRoi={() => setRoi(null)}
                onDeleteMeasurement={(id) => setMeasurements(prev => prev.filter(m => m.id !== id))}
                onDownloadRequest={() => setTriggerDownload(true)}
                manualStats={manualStats}
              />

              <div className="text-center mt-6">
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isAutoFilling}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all shadow-xl hover:shadow-cyan-500/20 flex items-center justify-center gap-3"
                >
                  <ChartBarIcon />
                  Generate Comprehensive Report
                </button>
              </div>
            </div>
            
            <div className="xl:col-span-2 space-y-6">
              {analysisReport ? (
                <>
                  <AnalysisReport 
                    report={analysisReport} 
                    manualStats={manualStats} 
                    measurementCount={measurements.length}
                    analysisParams={analysisParams}
                    setAnalysisParams={setAnalysisParams}
                    literature={litReview}
                    onExtendLiterature={handleExtendLit}
                    imageUrl={image.url}
                  />
                  <div>
                      <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2 mb-4"><RobotIcon /> Specialist Advisor</h2>
                      <ChatAssistant 
                        chatHistory={chatHistory} 
                        setChatHistory={setChatHistory} 
                        analysisContext={JSON.stringify({...analysisReport, literature: litReview, params: analysisParams})} 
                      />
                  </div>
                </>
              ) : (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 h-full flex flex-col justify-center items-center text-center opacity-75">
                    <RobotIcon className="w-20 h-20 text-gray-600 mb-4 animate-pulse"/>
                    <h3 className="text-xl font-bold text-gray-400">Characterization Engine</h3>
                    <p className="text-gray-500 mt-2 max-w-sm">Deep morphology interpretations and publication-ready discussions will be generated here.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <OllamaSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigUpdated={(cfg) => setAiConfig(cfg)}
      />
    </div>
  );
}
