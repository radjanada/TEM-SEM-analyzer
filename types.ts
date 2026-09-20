
export interface ImageFile {
  file: File;
  base64: string;
  url: string;
}

export type MicroscopyType = 'TEM' | 'SEM';
export type Detector = 'ETD' | 'CBS' | 'LFD' | 'BED-C' | 'LED' | 'STEM';
export type Vacuum = 'High' | 'Low' | 'Unknown';
export type ScaleUnit = 'nm' | 'µm' | 'mm';

export interface AnalysisParams {
  materialType: string;
  synthesisMethod: string;
  nanoparticleName?: string;
  crystalStructure?: string;
  edxData?: string;
  startingMaterials?: string[];
  microscopyType: MicroscopyType;
  detector: Detector;
  vacuum: Vacuum;
  magnification?: string;
  userConfirmedAggregation?: string;
  temMode?: 'Bright-field' | 'Dark-field';
  manualScaleValue?: string;
  manualScaleUnit?: ScaleUnit;
  manualParticleSize?: string;
  manualParticleShapes?: string[];
  application?: string;
  additionalContext?: string;
  imageStage?: 'before' | 'after' | 'not_specified';
  imageStageDetails?: string;
}

export interface Annotation {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface TemAnalysis {
  isApplicable: boolean;
  averageSizeNm?: number;
  sizeDistribution?: string;
  particleCount?: number;
  shapeAnalysis?: string;
  geometryDetails?: string;
  topographyDetails?: string;
  annotations?: Annotation[];
}

export interface SemAnalysis {
  isApplicable: boolean;
  surfaceRoughness?: string;
  morphology?: string;
}

export interface LiteratureItem {
  title: string;
  authors?: string;
  year: string;
  journal?: string;
  keyFindings: string;
  comparison?: string;
  url: string;
  doi?: string;
  fullCitation?: string;
}

export interface AnalysisReportData {
  summary: string;
  temAnalysis: TemAnalysis;
  semAnalysis: SemAnalysis;
  aggregation: string;
  contextualInterpretation: string;
  comprehensiveInterpretation?: string;
  finalSynthesis?: string; // New field for integrated discussion
  interpretationVersions?: string[];
  comparisonAnalysis?: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export interface Scale {
  pixelLength: number;
  knownLength: number;
  unit: ScaleUnit;
}

export interface Measurement {
  id: string;
  lengthInNm: number;
  line: { x1: number, y1: number, x2: number, y2: number };
}
