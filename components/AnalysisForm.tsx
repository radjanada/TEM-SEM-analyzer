
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { AnalysisParams, ImageFile } from '../types';
import { MATERIAL_TYPES, SYNTHESIS_METHODS, MICROSCOPY_TYPES, DETECTORS, VACUUM_LEVELS, AGGREGATION_STATES, TEM_MODES, PARTICLE_SHAPES, STARTING_MATERIALS } from '../constants';
import { SparklesIcon, UploadIcon, TrashIcon } from './icons';

interface AnalysisFormProps {
  params: AnalysisParams;
  setParams: React.Dispatch<React.SetStateAction<AnalysisParams>>;
  isAutoFilling: boolean;
  onAutoFillRequest: () => void;
  baselineImage: ImageFile | null;
  onBaselineImageUpload: (file: File) => void;
  onRemoveBaselineImage: () => void;
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({ 
  params, 
  setParams, 
  isAutoFilling, 
  onAutoFillRequest,
  baselineImage,
  onRemoveBaselineImage,
  onBaselineImageUpload
}) => {
  const [isOptionalOpen, setIsOptionalOpen] = useState(false);
  const [isShapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const [isPrecursorDropdownOpen, setPrecursorDropdownOpen] = useState(false);
  
  const shapeDropdownRef = useRef<HTMLDivElement>(null);
  const precursorDropdownRef = useRef<HTMLDivElement>(null);

  const onDropBaseline = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onBaselineImageUpload(acceptedFiles[0]);
    }
  }, [onBaselineImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropBaseline,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tif', '.tiff'],
      'image/bmp': ['.bmp'],
    },
    multiple: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiSelectChange = (field: 'manualParticleShapes' | 'startingMaterials', value: string) => {
    setParams(prev => {
        const currentItems = prev[field] || [];
        const newItems = currentItems.includes(value)
            ? currentItems.filter(s => s !== value)
            : [...currentItems, value];
        return { ...prev, [field]: newItems };
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shapeDropdownRef.current && !shapeDropdownRef.current.contains(event.target as Node)) {
        setShapeDropdownOpen(false);
      }
      if (precursorDropdownRef.current && !precursorDropdownRef.current.contains(event.target as Node)) {
        setPrecursorDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const renderSelect = (name: keyof AnalysisParams, label: string, options: readonly string[]) => (
    <div>
      <label htmlFor={name} className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
      <select
        id={name}
        name={name}
        value={params[name] as string || ''}
        onChange={handleChange}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 focus:ring-1 focus:ring-cyan-500 outline-none text-sm transition-all"
      >
        <option value="">-- Choose --</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );

  const renderInput = (name: keyof AnalysisParams, label: string, placeholder: string, type: string = "text") => (
    <div>
      <label htmlFor={name} className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
      <input
        type={type}
        id={name}
        name={name}
        value={params[name] as string || ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
      />
    </div>
  );

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 relative shadow-inner">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Metadata Configuration</h3>
        <button 
          onClick={onAutoFillRequest}
          disabled={isAutoFilling}
          className="bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700/50 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
        >
          <SparklesIcon className="w-4 h-4" />
          {isAutoFilling ? 'Scanning Image...' : 'AI Suggest Parameters'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderInput('nanoparticleName', 'Nanoparticle ID', 'e.g., Fe3O4-NC-01')}
            {renderInput('crystalStructure', 'XRD Phase', 'e.g., Cubic Spinel')}
            {renderSelect('materialType', 'Target Material', MATERIAL_TYPES)}
            
            {renderSelect('synthesisMethod', 'Synthesis Route', SYNTHESIS_METHODS)}
            
            <div className="relative" ref={precursorDropdownRef}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Metal Precursors</label>
                <button onClick={() => setPrecursorDropdownOpen(!isPrecursorDropdownOpen)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 text-left flex justify-between items-center text-sm">
                    <span className="truncate pr-2 text-xs">
                        {params.startingMaterials?.length ? `${params.startingMaterials.length} selected` : 'Choose components...'}
                    </span>
                     <span>▼</span>
                </button>
                {isPrecursorDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-2xl max-h-60 overflow-y-auto ring-1 ring-black ring-opacity-5">
                        {STARTING_MATERIALS.map(mat => (
                            <label key={mat} className="flex items-center px-3 py-2 text-sm text-white hover:bg-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={params.startingMaterials?.includes(mat) || false}
                                    onChange={() => handleMultiSelectChange('startingMaterials', mat)}
                                    className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600"
                                />
                                <span className="ml-3 text-xs">{mat}</span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {renderSelect('microscopyType', 'Instrument', MICROSCOPY_TYPES)}
            {params.microscopyType === 'TEM' ? renderSelect('temMode', 'TEM Mode', TEM_MODES) : renderSelect('detector', 'SEM Detector', DETECTORS)}
            {renderSelect('vacuum', 'Vacuum Environment', VACUUM_LEVELS)}
            {renderInput('magnification', 'Magnification', 'e.g., 50.00 kX')}
        </div>

        {/* Image Life Cycle Context Option Zone */}
        <div className="bg-gray-900/40 border border-gray-700/60 rounded-lg p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-md">
              <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">Image Life Cycle Context</label>
              <p className="text-xs text-gray-400">Specify if this image represents the material before or after an application/reaction (e.g. adsorption, photocatalysis).</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setParams(prev => ({ ...prev, imageStage: 'before' }))}
                className={`px-4 py-2 rounded-md text-xs font-bold border transition-all flex items-center gap-2 ${
                  params.imageStage === 'before'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${params.imageStage === 'before' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                Before Use (Pristine)
              </button>
              
              <button
                type="button"
                onClick={() => setParams(prev => ({ ...prev, imageStage: 'after' }))}
                className={`px-4 py-2 rounded-md text-xs font-bold border transition-all flex items-center gap-2 ${
                  params.imageStage === 'after'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${params.imageStage === 'after' ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'}`} />
                After Use (Post-Reaction)
              </button>
              
              <button
                type="button"
                onClick={() => setParams(prev => ({ ...prev, imageStage: 'not_specified' }))}
                className={`px-4 py-2 rounded-md text-xs font-bold border transition-all flex items-center gap-2 ${
                  !params.imageStage || params.imageStage === 'not_specified'
                    ? 'bg-gray-700 border-gray-600 text-white shadow-sm'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${(!params.imageStage || params.imageStage === 'not_specified') ? 'bg-gray-300' : 'bg-gray-600'}`} />
                Unspecified
              </button>
            </div>
          </div>

          {/* Conditional sub-input for details */}
          {params.imageStage && params.imageStage !== 'not_specified' && (
            <div className="mt-3 border-t border-gray-800 pt-3 animate-fadeIn space-y-4">
              <div>
                <label htmlFor="imageStageDetails" className="block text-xs font-bold text-gray-400 mb-1.5">
                  {params.imageStage === 'before' ? 'Before Use Context / Treatment Details' : 'After Use Context / Reaction & Application Details'}
                </label>
                <input
                  type="text"
                  id="imageStageDetails"
                  name="imageStageDetails"
                  value={params.imageStageDetails || ''}
                  onChange={handleChange}
                  placeholder={
                    params.imageStage === 'before'
                      ? "e.g., prior to dye adsorption, pristine sample, as-synthesized, or target control"
                      : "e.g., after 3 cycles of photocatalysis, post-adsorption of heavy metals, spent catalyst"
                  }
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-md p-2 focus:ring-1 focus:ring-cyan-500 outline-none text-xs transition-all"
                />
              </div>

              {/* Optional pristine image upload specifically for after-use micrograph comparison */}
              {params.imageStage === 'after' && (
                <div className="border-t border-gray-800/80 pt-3 animate-fadeIn">
                  <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                    Before Use / Pristine Micrograph (Optional Comparison)
                  </label>
                  <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
                    Upload a corresponding pristine/before-use micrograph. The AI characterization engine will perform a side-by-side comparative analysis of structural modifications, sintering, active site blockage, and surface morphology changes.
                  </p>

                  {baselineImage ? (
                    <div className="flex items-center gap-3 bg-gray-900/80 border border-amber-900/40 p-2.5 rounded-lg">
                      <img 
                        src={baselineImage.url} 
                        alt="Pristine baseline Micrograph" 
                        className="w-14 h-14 object-cover rounded-md border border-gray-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-200 truncate">{baselineImage.file.name}</p>
                        <p className="text-[10px] text-gray-500">{(baselineImage.file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={onRemoveBaselineImage}
                        className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-md transition-colors border border-red-900/30"
                        title="Remove pristine micrograph"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      {...getRootProps()} 
                      className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                        isDragActive ? 'border-cyan-400 bg-cyan-950/20' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/20'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <UploadIcon className="w-6 h-6 text-gray-500 mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-gray-300">
                        {isDragActive ? 'Drop the pristine micrograph here...' : 'Drag & drop pristine image, or click to browse'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Supports JPG, PNG, TIF, BMP</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
                <label htmlFor="edxData" className="block text-xs font-bold text-gray-500 uppercase mb-1">EDX / Elemental Mapping Data</label>
                <textarea
                    id="edxData"
                    name="edxData"
                    value={params.edxData || ''}
                    onChange={handleChange}
                    placeholder="Enter atomic ratios or mapping findings (e.g., Fe: 65%, O: 35%)."
                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-3 focus:ring-1 focus:ring-cyan-500 outline-none h-20 text-sm"
                />
            </div>
            <div>
                <label htmlFor="additionalContext" className="block text-xs font-bold text-gray-500 uppercase mb-1">Crystallography & Chemical Observations</label>
                <textarea
                    id="additionalContext"
                    name="additionalContext"
                    value={params.additionalContext || ''}
                    onChange={handleChange}
                    placeholder="Mention stoichiometry (e.g. Zn:Al = 2:1), doping agents, or specific facet observations."
                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-3 focus:ring-1 focus:ring-cyan-500 outline-none h-20 text-sm"
                />
            </div>
        </div>
        
        <div className="border-t border-gray-700 pt-4">
            <button onClick={() => setIsOptionalOpen(!isOptionalOpen)} className="text-xs font-bold text-cyan-400 hover:text-cyan-300 w-full text-left flex items-center gap-2 uppercase tracking-tighter">
                <span>{isOptionalOpen ? '▼' : '▶'}</span> 
                Advanced Morphological Parameters
            </button>
            {isOptionalOpen && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="relative" ref={shapeDropdownRef}>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expected Geometry</label>
                        <button onClick={() => setShapeDropdownOpen(!isShapeDropdownOpen)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 text-left flex justify-between items-center text-sm">
                            <span className="truncate pr-2">
                                {params.manualParticleShapes?.length ? `${params.manualParticleShapes.length} selected` : 'Identify shapes...'}
                            </span>
                             <span>▼</span>
                        </button>
                        {isShapeDropdownOpen && (
                            <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-2xl max-h-60 overflow-y-auto ring-1 ring-black ring-opacity-5">
                                {PARTICLE_SHAPES.map(shape => (
                                    <label key={shape} className="flex items-center px-3 py-2 text-sm text-white hover:bg-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={params.manualParticleShapes?.includes(shape) || false}
                                            onChange={() => handleMultiSelectChange('manualParticleShapes', shape)}
                                            className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600"
                                        />
                                        <span className="ml-3">{shape}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    {renderSelect('userConfirmedAggregation', 'Dispersion State', AGGREGATION_STATES)}
                    {renderInput('manualParticleSize', 'Expected Dimensions', 'e.g., 20 nm')}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisForm;
