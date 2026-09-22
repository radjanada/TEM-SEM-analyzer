import { GoogleGenAI, Type, Chat } from "@google/genai";
import { AnalysisParams, AnalysisReportData, ChatMessage, Scale, Measurement, LiteratureItem } from '../types';
import { loadAIServiceConfig } from './aiConfig';
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
      
      MATERIAL LIFECYCLE STAGE CONTEXT:
      This sample is currently in the following stage: ${stageStr}.

      STRICT CHARACTERIZATION RULES:
      1. NEVER say "Not applicable". Use visual evidence to infer shape, facets, and surface texture.
      2. HELP THE BEGINNER: Describe the shapes clearly.
      3. LINK METADATA: Connect the visual facets to the provided XRD crystal structure.
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
        throw e;
      }
    }

    try {
        return JSON.parse(response.text.trim()) as LiteratureItem[];
    } catch(e) {
        console.error("Lit review parse error", e);
        return [];
    }
};

export const generateFinalSynthesis = async (
    report: AnalysisReportData, 
    params: AnalysisParams, 
    literature: LiteratureItem[]
): Promise<string> => {
    const config = loadAIServiceConfig();
    if (config.provider === 'ollama') {
      return ollamaGenerateFinalSynthesis(
        config.ollamaHost,
        config.ollamaTextModel || config.ollamaVisionModel || 'llama3.2-vision:11b',
        report,
        params,
        literature
      );
    }

    if (config.provider !== 'gemini') {
      return externalGenerateFinalSynthesis(config, report, params, literature);
    }

    const ai = getAi(config.geminiApiKey);
    const targetModel = normalizeGeminiModel(config.geminiModel, PRO_MODEL);
    const stageStr = params.imageStage === 'before'
      ? `Before Use (Pristine material, e.g., before application/adsorption/photocatalysis). Details: ${params.imageStageDetails || 'None'}`
      : params.imageStage === 'after'
        ? `After Use (Spent material, e.g., post-reaction/post-adsorption/post-application). Details: ${params.imageStageDetails || 'None'}`
        : 'Unspecified Stage';

    const prompt = `
      TASK: GENERATE FINAL MANUSCRIPT-READY INTEGRATED INTERPRETATION.
      
      INPUT DATA:
      - Microscopy Instrument Type: ${params.microscopyType} (CRITICAL: You must write exclusively for ${params.microscopyType}. If SEM, do not mention TEM transmission/lattice features or bright-field mode. If TEM, do not mention secondary electron surface roughness detectors).
      - Visual Analysis: Shape/Morphology = ${params.microscopyType === 'SEM' ? report.semAnalysis.morphology : report.temAnalysis.shapeAnalysis}, Geometry = ${report.temAnalysis.geometryDetails || 'N/A'}, Surface Roughness = ${report.semAnalysis.surfaceRoughness || 'N/A'}.
      - Metadata: Synthesis=${params.synthesisMethod}, XRD=${params.crystalStructure}, EDX=${params.edxData}.
      - Material Lifecycle Stage: ${stageStr}.
      - Measurements: ${report.temAnalysis.averageSizeNm} nm mean.
      - Comparative Study Findings (For spent/after-use state): ${report.comparisonAnalysis || 'N/A'}
      - Literature to cite: ${literature.map((l, i) => `[${i+1}] ${l.title} (${l.year})`).join('; ')}.

      INSTRUCTIONS:
      1. Format: Extensive Scientific Manuscript Discussion (1000+ words).
      2. Style: IEEE numeric in-text citations [1], [2], etc.
      3. Content: Link everything. Explain how the synthesis precursors (starting materials) and method resulted in the observed ${params.crystalStructure} phase and how that phase manifests in the facets/surface features seen in the image.
      4. Life Cycle / Stage & Comparison Analysis:
         - Discuss the significance of the image being taken ${params.imageStage === 'before' ? 'before use' : params.imageStage === 'after' ? 'after use' : 'at an unspecified stage'}.
         - If params.imageStage is 'after', you MUST dedicate a major, highly integrated subsection of your discussion to compare the post-reaction/spent state to the pristine state using these exact comparison study findings: "${report.comparisonAnalysis || ''}". Discuss the physical/chemical mechanisms of degradation, sintering, active site blockage, or surface morphology restructuring observed.
      5. Instrument Specifics: Lock in tightly to **${params.microscopyType}**. Do not mix SEM and TEM terminology or mention unselected modes.
      6. Educational: Explain concepts like "diffraction contrast", "stochastic growth", or "Scherrer broadening" if applicable (only if relevant to the chosen ${params.microscopyType} mode) so a beginner learns as they read.
      7. Convincing: Be precise. Avoid vague terms. If EDX mapping confirms stoichiometry, use that to justify the phase identification.
      8. IEEE numeric style only.
      
      Return text only.
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
