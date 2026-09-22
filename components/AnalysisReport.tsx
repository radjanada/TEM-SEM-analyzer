
import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { AnalysisParams, AnalysisReportData, LiteratureItem } from '../types';
import { regenerateInterpretation, processAIAction, performLiteratureReview, generateFinalSynthesis } from '../services/geminiService';
import { buildLiteratureSearchQuery } from '../services/academicSearchService';
import { ScientificMarkdownRenderer } from './ScientificMarkdownRenderer';
import { 
  DocumentTextIcon, 
  CheckCircleIcon, 
  RulerIcon, 
  DocumentDownloadIcon, 
  BeakerIcon, 
  SparklesIcon, 
  TableCellsIcon, 
  LinkIcon, 
  ClipboardIcon, 
  PlusIcon,
  ArrowsExpandIcon,
  AcademicCapIcon,
  KeyIcon
} from './icons';
import { INTERPRETATION_TONES } from '../constants';

interface AnalysisReportProps {
  report: AnalysisReportData;
  manualStats: { mean: number; stdDev: number; } | null;
  measurementCount: number;
  analysisParams: AnalysisParams;
  setAnalysisParams: React.Dispatch<React.SetStateAction<AnalysisParams>>;
  literature: LiteratureItem[] | null;
  onExtendLiterature: (items: LiteratureItem[]) => void;
  onSearchLiterature?: () => void;
  isSearchingLiterature?: boolean;
  imageUrl: string;
}

const ReportSection: React.FC<{ title: string; children: React.ReactNode; icon: React.ReactNode; className?: string }> = ({ title, children, icon, className = "" }) => (
    <div className={`bg-gray-800 p-4 rounded-lg border border-gray-700 ${className}`}>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h4>
      <div className="space-y-2 text-gray-300">{children}</div>
    </div>
);

const ReportItem: React.FC<{ label: string; value?: string | number }> = ({ label, value }) => (
  value ? <p className="text-sm"><strong className="font-semibold text-cyan-500/80 mr-1">{label}:</strong> <span className="text-gray-200">{value}</span></p> : null
);

const AnalysisReport: React.FC<AnalysisReportProps> = ({ 
    report, manualStats, analysisParams, literature, onExtendLiterature, onSearchLiterature, isSearchingLiterature, imageUrl
}) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExpandingLit, setIsExpandingLit] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    
    const [interpretationVersions, setInterpretationVersions] = useState<string[]>([]);
    const [activeInterpretationIndex, setActiveInterpretationIndex] = useState(0);
    const [finalSynthesis, setFinalSynthesis] = useState<string | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenerationTone, setRegenerationTone] = useState(INTERPRETATION_TONES[0]);

    useEffect(() => {
        const initialText = report.comprehensiveInterpretation || report.contextualInterpretation || "";
        setInterpretationVersions([initialText]);
        setActiveInterpretationIndex(0);
        if (report.finalSynthesis) setFinalSynthesis(report.finalSynthesis);
    }, [report]);

    const handleGenerateSynthesis = async () => {
        if (!literature || literature.length === 0) {
            alert("Please find literature results first to enable in-text numeric citations.");
            return;
        }
        setIsSynthesizing(true);
        try {
            const result = await generateFinalSynthesis(report, analysisParams, literature, manualStats as any);
            setFinalSynthesis(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSynthesizing(false);
        }
    };

    const handleAIAction = async (action: 'explain' | 'expand' | 'summarize') => {
        setIsProcessing(true);
        try {
            const result = await processAIAction(action, interpretationVersions[activeInterpretationIndex]);
            setInterpretationVersions(prev => [...prev, `[${action.toUpperCase()} VERSION]\n\n${result}`]);
            setActiveInterpretationIndex(interpretationVersions.length);
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportFullReport = async () => {
        const reportElement = reportRef.current;
        if (!reportElement) return;
        setIsExportingPdf(true);
        try {
            const clone = reportElement.cloneNode(true) as HTMLDivElement;
            clone.style.width = '1200px';
            clone.style.position = 'fixed';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.padding = '60px';
            clone.style.backgroundColor = '#111827';
            document.body.appendChild(clone);

            const header = document.createElement('div');
            header.style.marginBottom = '40px';
            header.style.textAlign = 'center';
            header.innerHTML = `
                <h1 style="color: #22d3ee; font-size: 32px; font-family: sans-serif;">Manuscript-Ready Characterization Report</h1>
                <p style="color: #9ca3af; font-size: 16px;">Reference: ${analysisParams.nanoparticleName || 'Lab Sample'}</p>
                <img src="${imageUrl}" style="max-width: 90%; margin-top: 30px; border: 4px solid #374151; border-radius: 12px;" />
            `;
            clone.prepend(header);

            const canvas = await html2canvas(clone, { 
                scale: 2, 
                backgroundColor: '#111827',
                useCORS: true
            });
            document.body.removeChild(clone);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, pdfWidth, pdfHeight);
            pdf.save(`${analysisParams.nanoparticleName || 'Characterization'}_Full_Dossier.pdf`);
        } catch (error) {
            console.error(error);
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleShowMoreLiterature = async () => {
        setIsExpandingLit(true);
        try {
            const baseQuery = buildLiteratureSearchQuery(analysisParams);
            const query = `${baseQuery} XRD diffraction crystal facets peer-reviewed`;
            const results = await performLiteratureReview(query, true);
            onExtendLiterature(results);
        } catch (err) {
            console.error("Lit search error", err);
        } finally {
            setIsExpandingLit(false);
        }
    };

    const copyCitation = (citation?: string) => {
        if (!citation) return;
        navigator.clipboard.writeText(citation);
        alert("Citation copied!");
    };

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            const newText = await regenerateInterpretation(interpretationVersions[activeInterpretationIndex], report, analysisParams, regenerationTone);
            setInterpretationVersions(prev => [...prev, newText]);
            setActiveInterpretationIndex(interpretationVersions.length);
        } finally {
            setIsRegenerating(false);
        }
    };
    
    return (
        <div ref={reportRef} className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex flex-col gap-2 border-b border-gray-700 pb-4">
                 <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2"><DocumentTextIcon className="w-6 h-6"/> Characterization Profile</h2>
                    <button 
                        onClick={handleExportFullReport} 
                        disabled={isExportingPdf} 
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-md flex items-center gap-2 text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-cyan-900/20"
                    >
                        <DocumentDownloadIcon className="w-4 h-4"/>
                        {isExportingPdf ? 'Exporting...' : 'Download Full Report'}
                    </button>
                 </div>
                 <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>ID: {analysisParams.nanoparticleName || 'N/A'}</span>
                    <span>XRD: {analysisParams.crystalStructure || 'N/A'}</span>
                 </div>
            </div>

            {/* Main Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ReportSection title="Project Context" icon={<CheckCircleIcon className="w-4 h-4"/>}>
                    <ReportItem label="Synthesis" value={analysisParams.synthesisMethod} />
                    {analysisParams.reducingStabilizingAgent && (
                        <ReportItem label="Reducing / Plant Agent" value={analysisParams.reducingStabilizingAgent} />
                    )}
                    {analysisParams.extractionMethod && (
                        <ReportItem label="Extraction Protocol" value={analysisParams.extractionMethod} />
                    )}
                    {analysisParams.plantPart && (
                        <ReportItem label="Biomass Organ" value={analysisParams.plantPart} />
                    )}
                    <ReportItem label="EDX/Elemental" value={analysisParams.edxData} />
                    <ReportItem label="Instrument" value={`${analysisParams.microscopyType} @ ${analysisParams.magnification}`} />
                    <ReportItem 
                        label="Lifecycle Stage" 
                        value={
                            analysisParams.imageStage === 'before'
                                ? `Before Use (Pristine)${analysisParams.imageStageDetails ? `: ${analysisParams.imageStageDetails}` : ''}`
                                : analysisParams.imageStage === 'after'
                                    ? `After Use (Post-Reaction)${analysisParams.imageStageDetails ? `: ${analysisParams.imageStageDetails}` : ''}`
                                    : undefined
                        } 
                    />
                </ReportSection>
                {analysisParams.microscopyType === 'SEM' ? (
                  <ReportSection title="Surface Morphology Data" icon={<RulerIcon className="w-4 h-4"/>}>
                      <ReportItem label="Surface Structure" value={report.semAnalysis.morphology} />
                      <ReportItem label="Surface Roughness" value={report.semAnalysis.surfaceRoughness} />
                      <ReportItem label="Avg. Feature Size" value={manualStats ? `${manualStats.mean.toFixed(2)} nm` : `${report.temAnalysis.averageSizeNm} nm`} />
                  </ReportSection>
                ) : (
                  <ReportSection title="Structural & Facet Data" icon={<RulerIcon className="w-4 h-4"/>}>
                      <ReportItem label="Visual Shape" value={report.temAnalysis.shapeAnalysis} />
                      <ReportItem label="Geometry" value={report.temAnalysis.geometryDetails} />
                      <ReportItem label="Avg. Particle Size" value={manualStats ? `${manualStats.mean.toFixed(2)} nm` : `${report.temAnalysis.averageSizeNm} nm`} />
                  </ReportSection>
                )}
            </div>

            {/* COMPARATIVE STUDY BOX (Generated specifically for After Use / Post-Reaction states) */}
            {analysisParams.imageStage === 'after' && report.comparisonAnalysis && (
                <div className="bg-gradient-to-br from-amber-950/20 to-gray-900 border border-amber-500/30 p-5 rounded-lg shadow-xl relative overflow-hidden animate-fadeIn">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Spent vs. Pristine Comparative Morphology Study
                    </h4>
                    <p className="text-xs text-gray-400 mb-3 leading-relaxed font-semibold">
                        This comparative analysis evaluates structural modifications, active-site shielding, sintering, or facet weathering resulting from material usage:
                    </p>
                    <div className="bg-gray-950/60 p-4 rounded border border-gray-800 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-serif shadow-inner">
                        {report.comparisonAnalysis}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisParams.microscopyType === 'SEM' ? (
                  <ReportSection title="3D Topography" icon={<ArrowsExpandIcon className="w-4 h-4"/>}>
                      <ReportItem label="Texture & Depth" value={report.temAnalysis.topographyDetails} />
                      <ReportItem label="Sample Cond." value={analysisParams.vacuum ? `${analysisParams.vacuum} Vacuum` : undefined} />
                  </ReportSection>
                ) : (
                  <ReportSection title="Internal & Boundary Morphology" icon={<ArrowsExpandIcon className="w-4 h-4"/>}>
                      <ReportItem label="Lattice Topography" value={report.temAnalysis.topographyDetails} />
                      <ReportItem label="TEM Mode" value={analysisParams.temMode ? `${analysisParams.temMode}-field` : undefined} />
                  </ReportSection>
                )}
                <ReportSection title="Aggregation Profile" icon={<TableCellsIcon className="w-4 h-4"/>}>
                    <ReportItem label="State" value={report.aggregation} />
                    <ReportItem label="Dispersion" value={report.summary} />
                </ReportSection>
            </div>

            {/* INTEGRATED SYNTHESIS: The main highlight */}
            <ReportSection title="Final Synthesis & Integrated Discussion" icon={<KeyIcon className="w-4 h-4"/>} className="bg-cyan-900/10 border-cyan-500/40 border-2">
                {!finalSynthesis ? (
                    <div className="text-center py-6 space-y-3">
                        <p className="text-sm text-gray-400 italic max-w-xl mx-auto">Generate a professional 1000-word interpretation linking visual findings, precursors, XRD, and EDX with IEEE numeric citations.</p>
                        {literature && literature.length > 0 ? (
                            <button 
                                onClick={handleGenerateSynthesis}
                                disabled={isSynthesizing}
                                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto transition-all shadow-xl disabled:opacity-50"
                            >
                                <SparklesIcon className="w-5 h-5" />
                                {isSynthesizing ? 'Synthesizing Detailed Manuscript...' : 'Generate Integrated Synthesis'}
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <button 
                                    onClick={onSearchLiterature}
                                    disabled={isSearchingLiterature}
                                    className="bg-amber-600/80 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 mx-auto transition-all shadow-md"
                                >
                                    <AcademicCapIcon className="w-4 h-4" />
                                    {isSearchingLiterature ? 'Searching Academic Papers...' : '1. Search Literature Below First to Enable Citations'}
                                </button>
                                <p className="text-[11px] text-gray-400">Literature grounding provides the numeric references ([1], [2]...) needed for the synthesis.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-gray-900/60 p-6 rounded-xl border border-gray-700/80 shadow-inner">
                            <ScientificMarkdownRenderer content={finalSynthesis} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setFinalSynthesis(null)} className="text-[10px] text-gray-500 hover:text-red-400 font-bold uppercase">Reset Synthesis</button>
                            <button onClick={() => copyCitation(finalSynthesis)} className="text-[10px] text-cyan-500 hover:text-cyan-400 font-bold uppercase flex items-center gap-1"><ClipboardIcon className="w-3 h-3"/> Copy Text</button>
                        </div>
                    </div>
                )}
            </ReportSection>

            {/* Original Mechanistic Interpretation */}
            <ReportSection title="Visual Mechanism & Educational Notes" icon={<BeakerIcon className="w-4 h-4"/>} className="bg-gray-800/80">
                <div className="flex flex-wrap gap-2 mb-4">
                    {['summarize', 'expand', 'explain'].map((act: any) => (
                        <button 
                            key={act}
                            onClick={() => handleAIAction(act)}
                            disabled={isProcessing}
                            className="bg-gray-700 hover:bg-cyan-900 text-[9px] font-black uppercase px-2 py-1 rounded border border-gray-600 transition-all flex items-center gap-1"
                        >
                            <SparklesIcon className="w-3 h-3"/> {act}
                        </button>
                    ))}
                </div>
                <div className="bg-gray-900/40 p-4 rounded-lg border border-gray-700/50">
                    <ScientificMarkdownRenderer content={interpretationVersions[activeInterpretationIndex]} />
                </div>
                <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-700 pt-4 items-end">
                    <div className="flex flex-col gap-1 flex-grow">
                        <label className="text-[10px] text-gray-500 uppercase font-bold">Adjust Journal Tone</label>
                        <select value={regenerationTone} onChange={(e) => setRegenerationTone(e.target.value)} className="bg-gray-700 text-white rounded p-2 text-xs outline-none border border-gray-600">
                            {INTERPRETATION_TONES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <button onClick={handleRegenerate} disabled={isRegenerating} className="bg-cyan-900 px-4 py-2 rounded text-xs font-bold uppercase transition-all">
                        {isRegenerating ? 'Refining...' : 'Regenerate Draft'}
                    </button>
                </div>
            </ReportSection>

            {/* Literature Review with DOI extraction (On-demand by clicking) */}
            <ReportSection title="Scholar Grounding & Peer-Reviewed Literature" icon={<AcademicCapIcon className="w-4 h-4"/>} className="bg-amber-900/5 border-amber-500/20">
                {(!literature || literature.length === 0) ? (
                    <div className="p-4 bg-gray-900/60 rounded-lg border border-gray-700/60 text-center space-y-3">
                        <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-sm">
                            <AcademicCapIcon className="w-5 h-5" />
                            <span>Peer-Reviewed Literature Grounding (On-Demand)</span>
                        </div>
                        <p className="text-xs text-gray-300 max-w-xl mx-auto leading-relaxed">
                            Review your visual characterization and caliper sizing above first. When ready, click below to search verified peer-reviewed articles matching <strong className="text-cyan-300 font-semibold">{analysisParams.nanoparticleName || analysisParams.materialType || 'your sample'}</strong>.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-400">
                            <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700 font-mono">Sample: {analysisParams.nanoparticleName || analysisParams.materialType || 'Nanomaterial'}</span>
                            {analysisParams.crystalStructure && <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700 font-mono">Phase: {analysisParams.crystalStructure}</span>}
                            {analysisParams.synthesisMethod && <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700 font-mono">Synthesis: {analysisParams.synthesisMethod}</span>}
                            {analysisParams.reducingStabilizingAgent && (
                                <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60 font-mono">
                                    🌿 Agent: {analysisParams.reducingStabilizingAgent}
                                </span>
                            )}
                            {analysisParams.extractionMethod && (
                                <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60 font-mono">
                                    Extract: {analysisParams.extractionMethod}
                                </span>
                            )}
                        </div>
                        <div className="pt-2">
                            <button
                                onClick={onSearchLiterature}
                                disabled={isSearchingLiterature}
                                className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 mx-auto transition-all shadow-lg shadow-amber-950/40 hover:scale-[1.02]"
                            >
                                {isSearchingLiterature ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Searching Academic Repositories...
                                    </>
                                ) : (
                                    <>
                                        <AcademicCapIcon className="w-4 h-4" />
                                        Search Peer-Reviewed Literature
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500">
                            🌐 Live search works across all engines: Google Search (Gemini) and free open repositories OpenAlex & CrossRef (Ollama, OpenAI, Claude).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                                    {literature.length} Grounded References
                                </span>
                                {isSearchingLiterature && (
                                    <span className="text-[10px] text-cyan-400 flex items-center gap-1 animate-pulse">
                                        <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                                        Updating...
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={onSearchLiterature}
                                    disabled={isSearchingLiterature || isExpandingLit}
                                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-[9px] px-2.5 py-1 rounded font-bold uppercase transition-all"
                                    title="Re-run search with current sample metadata"
                                >
                                    Re-Search
                                </button>
                                <button 
                                    onClick={handleShowMoreLiterature} 
                                    disabled={isExpandingLit || isSearchingLiterature}
                                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white text-[9px] px-3 py-1 rounded font-black uppercase flex items-center gap-1.5 transition-all shadow-md"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    {isExpandingLit ? 'Searching Repositories...' : 'Find More Grounded Papers'}
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded border border-gray-700/50 shadow-inner">
                            <table className="w-full text-left text-[11px] leading-tight">
                                <thead className="bg-gray-900/80 text-gray-400 font-bold uppercase border-b border-gray-700">
                                    <tr>
                                        <th className="p-2 border-r border-gray-700 w-8">#</th>
                                        <th className="p-2 border-r border-gray-700">Publication / DOI</th>
                                        <th className="p-2 border-r border-gray-700">Findings Correlation</th>
                                        <th className="p-2">Access</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {literature.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                                            <td className="p-2 border-r border-gray-700 text-gray-500 font-bold">[{idx + 1}]</td>
                                            <td className="p-2 border-r border-gray-700">
                                                <div className="font-bold text-gray-200 mb-0.5">{item.title}</div>
                                                <div className="text-[9px] text-gray-400">{item.authors} ({item.year})</div>
                                                {item.doi && <div className="text-[8px] text-cyan-600 mt-1 font-mono uppercase bg-cyan-900/20 px-1 py-0.5 rounded inline-block">DOI: {item.doi}</div>}
                                            </td>
                                            <td className="p-2 border-r border-gray-700 italic text-gray-300">
                                                {item.comparison || item.keyFindings}
                                            </td>
                                            <td className="p-2">
                                                <div className="flex flex-col gap-2">
                                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="bg-cyan-900/40 hover:bg-cyan-800 text-cyan-300 text-[9px] px-2 py-1 rounded flex items-center justify-center gap-1 border border-cyan-700/50 shadow-sm">
                                                        <LinkIcon className="w-3 h-3" /> Source
                                                    </a>
                                                    <button onClick={() => copyCitation(item.fullCitation)} className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-[9px] px-2 py-1 rounded flex items-center justify-center gap-1 border border-gray-600 transition-all">
                                                        <ClipboardIcon className="w-3 h-3" /> Cite
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </ReportSection>
        </div>
    );
};

export default AnalysisReport;
