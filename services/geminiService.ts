import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisParams, AnalysisReportData, ChatMessage, Scale, Measurement, LiteratureItem } from '../types';
import { loadAIServiceConfig } from './aiConfig';
import { searchOpenScholarlyRepositories } from './academicSearchService';
import { 
  ollamaGetAutoFillSuggestions, 
  ollamaPerformFullAnalysis, 
  ollamaPerformLiteratureReview, 
  ollamaGenerateFinalSynthesis, 
  ollamaProcessAIAction, 
  ollamaRegenerateInterpretation, 
  ollamaStreamChatResponse 
} from './ollamaService';
import {
  externalGetAutoFillSuggestions,
  externalPerformFullAnalysis,
  externalPerformLiteratureReview,
  externalGenerateFinalSynthesis,
  externalProcessAIAction,
  externalRegenerateInterpretation,
  externalStreamChatResponse
} from './externalAiService';

const getAi = (userApiKey?: string) => {
  const key = (userApiKey && userApiKey.trim()) || process.env.API_KEY;
  if (!key) {
    throw new Error("No Gemini API key found. Please open Settings in the top-right to enter your Gemini API key, or switch to OpenAI, Claude, OpenRouter, or Local Ollama.");
  }
  return new GoogleGenAI({ apiKey: key });
};

const PRO_MODEL = 'gemini-3.1-pro-preview';
const FLASH_MODEL = 'gemini-3.8-flash';

// List of currently supported valid Gemini models (AI Studio standard models)
export const SUPPORTED_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro'
];

export const normalizeGeminiModel = (model?: string, fallback: string = FLASH_MODEL): string => {
  if (!model) return fallback;
  const trimmed = model.trim();
  // Map deprecated / invalid names to modern Google AI Studio defaults
  if (
    trimmed === 'gemini-pro' ||
    trimmed === 'gemini-1.0-pro' ||
    trimmed === 'gemini-1.5-flash' ||
    trimmed === 'gemini-1.5-pro' ||
    trimmed === 'gemini-2.0-flash' ||
    trimmed === 'gemini-2.0-pro'
  ) {
    return fallback;
  }
  return trimmed;
};

const base64ToGenerativePart = (base64: string, mimeType: string) => {
  const clean = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  return {
    inlineData: {
      data: clean,
      mimeType,
    },
  };
};

export const getAutoFillSuggestions = async (imageBase64: string): Promise<Partial<AnalysisParams>> => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaGetAutoFillSuggestions(
        config.ollamaHost, 
        config.ollamaVisionModel || 'llama3.2-vision:11b', 
        imageBase64
      );
    }

    if (config.provider !== 'gemini') {
      return externalGetAutoFillSuggestions(config, imageBase64);
    }

    const ai = getAi(config.geminiApiKey);
    const imagePart = base64ToGenerativePart(imageBase64, 'image/jpeg');
    const prompt = `Analyze this microscopy image and extract technical metadata (Microscopy type, Detector, Vacuum, Magnification). Return as JSON.`;
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            microscopyType: { type: Type.STRING, enum: ["TEM", "SEM"] },
            detector: { type: Type.STRING, enum: ["ETD", "CBS", "LFD", "BED-C", "LED", "STEM"] },
            vacuum: { type: Type.STRING, enum: ["High", "Low", "Unknown"] },
            magnification: { type: Type.STRING },
            materialType: { type: Type.STRING },
            synthesisMethod: { type: Type.STRING },
            temMode: { type: Type.STRING, enum: ["Bright-field", "Dark-field"] },
            additionalContext: { type: Type.STRING }
        },
        required: ["microscopyType"]
    };

    const targetModel = normalizeGeminiModel(config.geminiModel, FLASH_MODEL);
    let response;
    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema,
        }
      });
    } catch (apiErr: any) {
      const errStr = apiErr?.message || String(apiErr);
      if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not found')) {
        console.warn(`Model ${targetModel} returned 404, falling back to gemini-flash-latest...`);
        try {
          response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
              responseMimeType: 'application/json',
              responseSchema,
            }
          });
        } catch {
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
              responseMimeType: 'application/json',
              responseSchema,
            }
          });
        }
      } else {
        throw apiErr;
      }
    }

    return JSON.parse(response.text.trim()) as Partial<AnalysisParams>;
};

export const performFullAnalysis = async (
    imageBase64: string, 
    params: AnalysisParams, 
    roi: { x: number; y: number; width: number; height: number; } | null,
    scale: Scale | null,
    measurements: Measurement[],
    manualStats: { mean: number; stdDev: number; } | null,
    baselineImageBase64?: string | null
): Promise<AnalysisReportData> => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaPerformFullAnalysis(
        config.ollamaHost,
        config.ollamaVisionModel || 'llama3.2-vision:11b',
        imageBase64,
        params,
        roi,
        scale,
        measurements,
        manualStats,
        baselineImageBase64
      );
    }

    if (config.provider !== 'gemini') {
      return externalPerformFullAnalysis(
        config,
        imageBase64,
        params,
        scale,
        measurements,
        manualStats,
        baselineImageBase64
      );
    }

    const ai = getAi(config.geminiApiKey);
    const targetModel = config.geminiModel || FLASH_MODEL;
    const imagePart = base64ToGenerativePart(imageBase64, 'image/jpeg');
    
    const stageStr = params.imageStage === 'before'
      ? `BEFORE USE (Pristine material, e.g., before application/adsorption/photocatalysis). Details: ${params.imageStageDetails || 'None'}`
      : params.imageStage === 'after'
        ? `AFTER USE (Spent material, e.g., post-reaction/post-adsorption/post-application). Details: ${params.imageStageDetails || 'None'}`
        : `Unspecified Material Stage`;

    let prompt = `
      EXPERIMENTAL CHARACTERIZATION TASK:
      Analyze this ${params.microscopyType} image for Sample: ${params.nanoparticleName || 'Unnamed'}.
      XRD: ${params.crystalStructure || 'Unknown'}. EDX: ${params.edxData || 'None'}.
      Synthesis: ${params.synthesisMethod}.
      Precursors: ${params.startingMaterials?.join(', ') || 'Not explicitly specified'}.
      Reducing/Stabilizing Agent: ${params.reducingStabilizingAgent || 'None specified'}.
      Extraction Route: ${params.extractionMethod || 'N/A'}.
      Biomass Organ / Plant Part: ${params.plantPart || 'N/A'}.
      
      MATERIAL LIFECYCLE STAGE CONTEXT:
      This sample is currently in the following stage: ${stageStr}.

      STRICT CHARACTERIZATION RULES:
      1. NEVER say "Not applicable". Use visual evidence to infer shape, facets, and surface texture.
      2. HELP THE BEGINNER: Describe the shapes clearly.
      3. LINK METADATA & PHYTOCHEMICAL REDUCTION: 
         - Connect the visual facets to the provided XRD crystal structure and precursors.
         - If a plant or reducing/stabilizing agent is provided (${params.reducingStabilizingAgent || 'None'}), discuss the biochemical reduction and bio-capping mechanism: how phytochemicals (polyphenols, flavonoids, terpenoids, alkaloids, or capping functional groups) stabilize crystal planes, prevent agglomeration, and dictate particle size and morphology.
      4. CORE CONTEXT INTERPRETATION: Take into account the material lifecycle stage context (${stageStr}) when generating your report.
         - If it is 'BEFORE USE', assess the pristine surface, well-defined facets, active sites, crystal planes, and state of dispersion.
         - If it is 'AFTER USE', analyze potential signs of degradation, particle sintering, collapse of porous structure, amorphous layer coating (from adsorbate / dye), cluster aggregation, or facet reconstruction that may have occurred during the reaction or adsorption process. Mention this explicitly in the summary and the contextual interpretation.
      
      5. STRICT INSTRUMENT LOCK-IN (CRITICAL):
         - The chosen instrument is: **${params.microscopyType}**.
         - If the instrument is SEM, you MUST analyze and write the entire report strictly for SEM. Do NOT mention TEM, transmission mode, electron diffraction, lattice fringes, TEM modes, or talk about "electrons passing through the sample" or "HRTEM". Focus purely on surface topography, morphological roughness, cluster structure, secondary electron/backscattered electron imaging, and 3D-like depth of field. Set "temAnalysis.isApplicable" to false in the JSON.
         - If the instrument is TEM, you MUST analyze and write the entire report strictly for TEM. Do NOT mention SEM-specific secondary electron detector details, or describe the analysis in SEM terms. Focus purely on electron transmission, bright-field/dark-field characteristics, internal density, crystalline facets, structural lattice margins, and diffraction contrast. Set "semAnalysis.isApplicable" to false in the JSON.
         - Ensure that no part of your text or final summary mixes up the terminology (e.g., if SEM is selected, never use the acronym "TEM" or write "TEM analysis").

      6. COMPARATIVE MORPHOLOGY STUDY (FOR 'AFTER USE' / spent stage):
         - If params.imageStage is 'after', please generate a rich, comprehensive paragraph for "comparisonAnalysis" comparing this spent material with the pristine expectations (or with the secondary baseline image if provided).
         - Discuss: sintering & agglomeration, structural/facet wear or degradation, surface coating/adsorption layers, and changes in the dispersion profile.
         - If params.imageStage is NOT 'after', "comparisonAnalysis" should be a simple statement stating that comparison is not applicable for a pristine sample.
    `;

    if (baselineImageBase64) {
      prompt += `
      
      COMPARISON & BASELINE IMAGE PROVIDED:
      You have also been provided with a baseline/secondary image showing the pristine/before-use state of this exact material.
      You now have TWO images to compare:
      1. Primary image: the current AFTER-USE (spent) state of the material.
      2. Secondary baseline image: the BEFORE-USE (pristine/as-synthesized) state of the material.
      
      Please perform a side-by-side comparative morphology study for "comparisonAnalysis":
      - Sintering & Aggregation: Has there been any fusion, sintering, or cluster growth in the after-use state compared to the pristine state?
      - Surface Coatings / Adsorbates: Is there any visual evidence of adsorbed species (e.g., thicker amorphous layers, filled micropores, or changed edge contrasts) in the after-use image?
      - Structural & Facet Degradation: Have active facets or high-energy crystal planes resolved in the pristine image been worn down, reconstructed, or collapsed after reaction?
      - State of Dispersion: Compare how the particle density and agglomeration degree differ between before and after use.
      Include these direct visual comparison insights extensively in your summary, comparisonAnalysis, contextualInterpretation, and comprehensiveInterpretation!
      `;
    }

    prompt += `
      Return JSON.
    `;
    
    const analysisSchema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING },
            temAnalysis: {
                type: Type.OBJECT,
                properties: {
                    isApplicable: { type: Type.BOOLEAN },
                    averageSizeNm: { type: Type.NUMBER },
                    shapeAnalysis: { type: Type.STRING },
                    geometryDetails: { type: Type.STRING },
                    topographyDetails: { type: Type.STRING }
                },
            },
            semAnalysis: {
                type: Type.OBJECT,
                properties: {
                    isApplicable: { type: Type.BOOLEAN },
                    surfaceRoughness: { type: Type.STRING },
                    morphology: { type: Type.STRING },
                }
            },
            aggregation: { type: Type.STRING },
            contextualInterpretation: { type: Type.STRING },
            comprehensiveInterpretation: { type: Type.STRING },
            comparisonAnalysis: { type: Type.STRING }
        },
        required: [
            "summary", 
            "temAnalysis", 
            "semAnalysis", 
            "aggregation", 
            "contextualInterpretation", 
            "comprehensiveInterpretation", 
            "comparisonAnalysis"
        ]
    };

    const parts: any[] = [];
    if (baselineImageBase64) {
      parts.push(base64ToGenerativePart(baselineImageBase64, 'image/jpeg'));
    }
    parts.push(imagePart);
    parts.push({ text: prompt });

    const activeModel = normalizeGeminiModel(config.geminiModel, FLASH_MODEL);

    let response;
    try {
      response = await ai.models.generateContent({
        model: activeModel,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: analysisSchema
        }
      });
    } catch (apiErr: any) {
      const errStr = apiErr?.message || String(apiErr);
      if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not found')) {
        console.warn(`Model ${activeModel} produced 404 NOT_FOUND. Attempting fallback chain (gemini-3.8-flash -> gemini-flash-latest -> gemini-2.5-flash)...`);
        
        const candidateFallbacks = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter(m => m !== activeModel);
        let succeeded = false;

        for (const fallbackModel of candidateFallbacks) {
          try {
            response = await ai.models.generateContent({
              model: fallbackModel,
              contents: { parts },
              config: {
                responseMimeType: 'application/json',
                responseSchema: analysisSchema
              }
            });
            succeeded = true;
            break;
          } catch {
            // Continue to next fallback candidate
          }
        }

        if (!succeeded) {
          throw new Error(
            `Gemini API returned 404 NOT_FOUND for model "${activeModel}". ` +
            `This occurs when the API key's Google Cloud project does not have the "Generative Language API" enabled or the model is not accessible with that key. ` +
            `Please check your model in Settings (top right) or verify your key at https://aistudio.google.com/app/apikey.`
          );
        }
      } else {
        throw apiErr;
      }
    }

    return JSON.parse(response.text.trim()) as AnalysisReportData;
};

export const performLiteratureReview = async (query: string, more = false): Promise<LiteratureItem[]> => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaPerformLiteratureReview(
        config.ollamaHost,
        config.ollamaTextModel || config.ollamaVisionModel || 'llama3.2-vision:11b',
        query
      );
    }

    if (config.provider !== 'gemini') {
      return externalPerformLiteratureReview(config, query);
    }

    const ai = getAi(config.geminiApiKey);
    const targetModel = normalizeGeminiModel(config.geminiModel, PRO_MODEL);
    const prompt = `Search for peer-reviewed papers for: ${query}. 
    
    CRITICAL QUALITY RULES:
    1. DOI EXTRACTION: For every paper, find and return the exact DOI string. If you cannot find a valid DOI, find the official publisher link.
    2. LINK VALIDATION: Links must be direct to Google Scholar, Semantic Scholar, or the DOI resolver. 
    3. CITATION: Provide full IEEE/APA citations.
    
    Return JSON array.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                authors: { type: Type.STRING },
                year: { type: Type.STRING },
                journal: { type: Type.STRING },
                keyFindings: { type: Type.STRING },
                comparison: { type: Type.STRING },
                url: { type: Type.STRING },
                doi: { type: Type.STRING },
                fullCitation: { type: Type.STRING }
              },
              required: ["title", "year", "url", "fullCitation", "doi"]
            }
          }
        }
      });
    } catch (e: any) {
      const errStr = e?.message || String(e);
      if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not found')) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: 'application/json',
            }
          });
        } catch {
          response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            }
          });
        }
      } else {
        // Fallback to open scholarly repositories (OpenAlex / CrossRef) if Gemini tools fail
        const fallbackPapers = await searchOpenScholarlyRepositories(query, 5);
        if (fallbackPapers && fallbackPapers.length > 0) {
          return fallbackPapers;
        }
        throw e;
      }
    }

    try {
        const parsed = JSON.parse(response.text.trim()) as LiteratureItem[];
        if (parsed && parsed.length > 0) return parsed;
        return await searchOpenScholarlyRepositories(query, 5);
    } catch(e) {
        console.warn("Lit review parse error, using OpenAlex/CrossRef fallback...", e);
        return await searchOpenScholarlyRepositories(query, 5);
    }
};

export const generateFinalSynthesis = async (
    report: AnalysisReportData, 
    params: AnalysisParams, 
    literature: LiteratureItem[],
    manualStats?: { count: number; mean: number; stdDev: number; min: number; max: number } | null
): Promise<string> => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaGenerateFinalSynthesis(
        config.ollamaHost,
        config.ollamaTextModel || config.ollamaVisionModel || 'llama3.2-vision:11b',
        report,
        params,
        literature,
        manualStats
      );
    }

    if (config.provider !== 'gemini') {
      return externalGenerateFinalSynthesis(config, report, params, literature, manualStats);
    }

    const ai = getAi(config.geminiApiKey);
    const targetModel = normalizeGeminiModel(config.geminiModel, PRO_MODEL);
    const stageStr = params.imageStage === 'before'
      ? `Before Use (Pristine material, e.g., before application/adsorption/photocatalysis). Details: ${params.imageStageDetails || 'None'}`
      : params.imageStage === 'after'
        ? `After Use (Spent material, e.g., post-reaction/post-adsorption/post-application). Details: ${params.imageStageDetails || 'None'}`
        : 'Unspecified Stage';

    const visualMorphology = params.microscopyType === 'SEM'
      ? (report.semAnalysis.morphology || 'N/A')
      : (report.temAnalysis.shapeAnalysis || 'N/A');
    const visualGeometry = report.temAnalysis.geometryDetails || 'N/A';
    const visualContrastOrRoughness = params.microscopyType === 'SEM'
      ? (report.semAnalysis.surfaceRoughness || 'N/A')
      : (report.temAnalysis.topographyDetails || 'N/A');
    const caliperStatsStr = manualStats
      ? `Calibrated caliper dataset: N=${manualStats.count} particles, Mean diameter = ${manualStats.mean.toFixed(2)} nm, Std Dev = ±${manualStats.stdDev.toFixed(2)} nm, Size Range = [${manualStats.min.toFixed(1)} - ${manualStats.max.toFixed(1)} nm]`
      : `Model-estimated mean: ${report.temAnalysis.averageSizeNm || 'N/A'} nm (Distribution: ${report.temAnalysis.sizeDistribution || 'N/A'}, Count: ~${report.temAnalysis.particleCount || 'N/A'})`;

    const prompt = `
      TASK: GENERATE FINAL MANUSCRIPT-READY INTEGRATED MATERIALS SCIENCE INTERPRETATION.
      
      COMPREHENSIVE EXPERIMENTAL & VISION CONTEXT:
      1. EXACT MICROGRAPH VISION MODEL OBSERVATIONS:
         - Instrument Type: ${params.microscopyType} (Lock in exclusively to ${params.microscopyType}. SEM = surface topography/roughness/depth; TEM = transmission/electron density/bright-field/lattice contrast).
         - Visual Morphology & Shapes: ${visualMorphology}
         - Edge Definition & Geometric Boundaries: ${visualGeometry}
         - Internal Contrast & Surface Texture: ${visualContrastOrRoughness}
         - Aggregation & Spatial Dispersion: ${report.aggregation}
         - Measured Particle Sizing: ${caliperStatsStr}
         - Overall Vision Summary: ${report.summary}
         - Vision Model Mechanistic Interpretation: ${report.contextualInterpretation}
         - Spent / After-Use Degradation Analysis: ${report.comparisonAnalysis || 'N/A'}

      2. PRECURSOR CHEMISTRY & SYNTHESIS:
         - Precursor Starting Materials: ${params.startingMaterials?.join(', ') || 'Not specified'}
         - Synthesis Route / Methodology: ${params.synthesisMethod || 'Standard synthesis'}

      3. REDUCING / STABILIZING AGENT & EXTRACTION:
         - Reducing / Capping Agent: ${params.reducingStabilizingAgent || 'None specified'}
         - Extraction Protocol: ${params.extractionMethod || 'N/A'}
         - Plant Biomass Organ: ${params.plantPart || 'N/A'}

      4. CRYSTALLOGRAPHY & ELEMENTAL DATA:
         - XRD Crystal Structure / Phase: ${params.crystalStructure || 'Not specified'}
         - EDX Elemental Composition: ${params.edxData || 'Not specified'}
         - Material Lifecycle Stage: ${stageStr}

      5. GROUNDED PEER-REVIEWED LITERATURE:
         ${literature.map((l, i) => `[${i+1}] ${l.authors || 'Authors'} (${l.year}). "${l.title}". ${l.journal || ''}. Key Findings: ${l.keyFindings}. DOI: ${l.doi || l.url}`).join('\n         ')}

      MANDATORY MANUSCRIPT REQUIREMENTS:
      1. FORMAT & LENGTH: Extensive Scientific Manuscript Results & Discussion section (1000+ words).
      2. ACTIVE IEEE NUMERIC CITATIONS: Cite every retrieved paper as [1], [2], [3] throughout the narrative where discussing reduction kinetics, facet capping, XRD diffraction planes, and particle size comparisons.
      3. INTEGRATED COHESIVE NARRATIVE:
         - Section 1: Precursor Chemistry & Bio-Reduction Reaction Mechanism:
           * Detail how the reducing agent (${params.reducingStabilizingAgent || 'reducing agent'}) extracted via ${params.extractionMethod || 'extraction route'} donates electrons to reduce ${params.startingMaterials?.join(', ') || 'metal ions'}.
           * Discuss specific active phytochemical classes (phenolic hydroxyls, flavonoids, terpenoids, reducing sugars) or reducing molecules.
           * CRITICAL: Provide the balanced chemical reaction equations in clean LaTeX display math blocks:
             $$ \\text{R-OH (Polyphenol)} + \\text{Ag}^+ \\longrightarrow \\text{R=O (Quinone intermediate)} + \\text{Ag}^0 + \\text{H}^+ $$
         - Section 2: Phytochemical Capping, Facet-Directed Growth & XRD Phase:
           * Link the precursor reduction and capping directly to the XRD crystal structure (${params.crystalStructure || 'crystal phase'}).
           * Explain how biomolecules passivate specific Miller indices (e.g., (111) vs (200)/(220)/(311) planes in FCC crystals), retarding perpendicular growth and stabilizing the exact morphology observed in the micrograph (${visualMorphology}).
         - Section 3: Micrograph Visual Findings & Sizing Grounding:
           * Directly address what the vision model observed: the boundary definition (${visualGeometry}), contrast (${visualContrastOrRoughness}), dispersion (${report.aggregation}), and particle diameter (${caliperStatsStr}).
           * Correlate these visual findings with literature benchmarks [1], [2].
         - Section 4: Lifecycle / Stability / Comparative Analysis:
           * If imageStage is 'after', thoroughly analyze the degradation/spent findings: "${report.comparisonAnalysis || ''}".
         - Section 5: Grounded References List:
           * Provide full IEEE references with DOIs at the end.

      MATHEMATICAL & CHEMICAL FORMATTING RULES:
      - Display equations MUST be wrapped in double dollar signs: $$ ... $$
      - Inline math, Miller indices, and ion charges MUST use single dollar signs: $ \\text{Ag}^+ $, $ \\text{Ag}^0 $, $ (111) $, $ \\lambda = 1.5406 \\text{ \\AA} $.

      Return clean, publication-grade Markdown text.
    `;

    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt
      });
      return response.text || '';
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not found')) {
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt
        });
        return fallbackRes.text || '';
      }
      throw err;
    }
};

export const processAIAction = async (action: 'explain' | 'expand' | 'summarize', context: string) => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaProcessAIAction(
        config.ollamaHost,
        config.ollamaTextModel || config.ollamaVisionModel || 'llama3.2-vision:11b',
        action,
        context
      );
    }

    if (config.provider !== 'gemini') {
      return externalProcessAIAction(config, action, context);
    }

    const ai = getAi(config.geminiApiKey);
    const targetModel = normalizeGeminiModel(config.geminiModel, FLASH_MODEL);
    let prompt = "";
    if (action === 'explain') prompt = `Explain the educational principles of this microscopy data for a student: ${context}`;
    if (action === 'expand') prompt = `Expand this into a 1500-word comprehensive manuscript discussion: ${context}`;
    if (action === 'summarize') prompt = `Summarize into a concise abstract: ${context}`;

    try {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt
      });
      return response.text || '';
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not found')) {
        const fallbackRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt
        });
        return fallbackRes.text || '';
      }
      throw err;
    }
};

export const regenerateInterpretation = async (
    baseInterpretation: string,
    report: AnalysisReportData,
    params: AnalysisParams,
    tone: string
): Promise<string> => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaRegenerateInterpretation(
        config.ollamaHost,
        config.ollamaTextModel || config.ollamaVisionModel || 'llama3.2-vision:11b',
        baseInterpretation,
        report,
        params,
        tone
      );
    }

    if (config.provider !== 'gemini') {
      return externalRegenerateInterpretation(config, baseInterpretation, report, params, tone);
    }

    const ai = getAi(config.geminiApiKey);
    const targetModel = normalizeGeminiModel(config.geminiModel, FLASH_MODEL);
    const prompt = `Rewrite this interpretation for publication in "${tone}" style. Ensure it is extensive and educational. Original: "${baseInterpretation}"`;
    try {
      const response = await ai.models.generateContent({ model: targetModel, contents: prompt });
      return response.text || '';
    } catch (err: any) {
      const errStr = err?.message || String(err);
      if (errStr.includes('404') || errStr.includes('NOT_FOUND') || errStr.includes('not found')) {
        const fallbackRes = await ai.models.generateContent({ model: 'gemini-3.8-flash', contents: prompt });
        return fallbackRes.text || '';
      }
      throw err;
    }
};

let chatInstance: Chat | null = null;
export const resetChat = () => { chatInstance = null; }
const getChatInstance = (analysisContext: string, apiKey?: string, modelName?: string): Chat => {
    if (!chatInstance) {
        const ai = getAi(apiKey);
        const resolvedModel = normalizeGeminiModel(modelName, FLASH_MODEL);
        chatInstance = ai.chats.create({
            model: resolvedModel,
            config: {
                systemInstruction: `You are a specialist in material science. Help users link their image findings to literature and metadata. Use context: ${analysisContext}.`,
                tools: [{ googleSearch: {} }]
            }
        });
    }
    return chatInstance;
};

export const streamChatResponse = async (history: ChatMessage[], context: string) => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaStreamChatResponse(
        config.ollamaHost,
        config.ollamaVisionModel || config.ollamaTextModel || 'llama3.2-vision:11b',
        history,
        context
      );
    }

    if (config.provider !== 'gemini') {
      return externalStreamChatResponse(config, history, context);
    }

    const chat = getChatInstance(context, config.geminiApiKey, config.geminiModel);
    return chat.sendMessageStream({ message: history[history.length - 1].content });
};
