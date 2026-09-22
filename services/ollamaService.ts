import { 
  AnalysisParams, 
  AnalysisReportData, 
  ChatMessage, 
  LiteratureItem, 
  OllamaModelInfo, 
  Scale, 
  Measurement 
} from '../types';

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
export const PROXY_OLLAMA_HOST = '/ollama';

export const cleanBase64 = (b64: string): string => {
  return b64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
};

export const normalizeHost = (host: string): string => {
  let h = (host || '').trim();
  if (!h) return DEFAULT_OLLAMA_HOST;
  // Remove trailing slashes
  h = h.replace(/\/+$/, '');
  return h;
};

// Known vision model name patterns and families
const VISION_KEYWORDS = [
  'vision',
  'llava',
  'bakllava',
  'qwen2.5-vl',
  'qwen2-vl',
  'qwen-vl',
  'vl',
  'minicpm-v',
  'moondream',
  'cogvlm',
  'internvl',
  'deepseek-vl',
  'florence'
];

const VISION_FAMILIES = ['mllama', 'clip', 'qwen2vl', 'llava', 'minicpmv'];

export const isVisionModel = (name: string, families?: string[], family?: string): boolean => {
  const lowerName = (name || '').toLowerCase();
  if (VISION_KEYWORDS.some(k => lowerName.includes(k))) return true;
  if (family && VISION_FAMILIES.includes(family.toLowerCase())) return true;
  if (families && families.some(f => VISION_FAMILIES.includes(f.toLowerCase()))) return true;
  return false;
};

export async function testOllamaConnection(host: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  const target = normalizeHost(host);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${target}/api/version`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { ok: true, version: data.version || 'running' };
  } catch (err: any) {
    const msg = err.name === 'AbortError' 
      ? 'Connection timed out (verify host address and check if Ollama is running)'
      : err.message || 'Cannot reach Ollama';
    return { ok: false, error: msg };
  }
}

export async function fetchOllamaModels(host: string): Promise<OllamaModelInfo[]> {
  const target = normalizeHost(host);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${target}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to fetch models: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawModels = data.models || [];

    return rawModels.map((m: any) => {
      const families = m.details?.families || [];
      const family = m.details?.family || '';
      const isVision = isVisionModel(m.name, families, family);

      return {
        name: m.name,
        model: m.model || m.name,
        size: m.size || 0,
        digest: m.digest || '',
        modified_at: m.modified_at,
        details: m.details,
        isVision
      };
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Safely extract JSON from LLM response
const parseJsonSafely = <T>(text: string, fallback: T): T => {
  try {
    // 1. Direct parse
    return JSON.parse(text.trim());
  } catch {
    // 2. Extract markdown ```json ... ``` block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }
    // 3. Extract bracketed object or array
    const objMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[1]);
      } catch {}
    }
  }
  return fallback;
};

export async function ollamaGetAutoFillSuggestions(
  host: string,
  model: string,
  imageBase64: string
): Promise<Partial<AnalysisParams>> {
  const target = normalizeHost(host);
  const cleanImg = cleanBase64(imageBase64);

  const prompt = `You are an expert materials scientist and electron microscopist.
Analyze this TEM/SEM microscopy image carefully and extract instrument metadata and material properties.
Return ONLY valid JSON with this exact structure:
{
  "microscopyType": "TEM" or "SEM",
  "detector": "ETD" or "CBS" or "LFD" or "BED-C" or "LED" or "STEM",
  "vacuum": "High" or "Low" or "Unknown",
  "magnification": "e.g. 50,000x or 100 nm scale",
  "materialType": "inferred material category (e.g. Metallic Nanoparticles, Metal Oxide, Carbon Nanomaterial, Nanocomposite)",
  "synthesisMethod": "inferred or typical synthesis (e.g. Hydrothermal, Chemical Reduction, Sol-Gel, Solvothermal)",
  "temMode": "Bright-field" or "Dark-field",
  "additionalContext": "brief observations on particle morphology, contrast, and scale bar"
}`;

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [cleanImg]
        }
      ],
      format: 'json',
      stream: false
    })
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Ollama AutoFill error (HTTP ${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  const rawText = data.message?.content || '';
  const parsed = parseJsonSafely<Partial<AnalysisParams>>(rawText, {
    microscopyType: 'TEM',
    detector: 'ETD',
    vacuum: 'High'
  });

  // Ensure valid enum values
  if (parsed.microscopyType !== 'TEM' && parsed.microscopyType !== 'SEM') {
    parsed.microscopyType = rawText.toLowerCase().includes('sem') ? 'SEM' : 'TEM';
  }
  return parsed;
}

export async function ollamaPerformFullAnalysis(
  host: string,
  model: string,
  imageBase64: string,
  params: AnalysisParams,
  roi: { x: number; y: number; width: number; height: number; } | null,
  scale: Scale | null,
  measurements: Measurement[],
  manualStats: { mean: number; stdDev: number; } | null,
  baselineImageBase64?: string | null
): Promise<AnalysisReportData> {
  const target = normalizeHost(host);
  const images = [cleanBase64(imageBase64)];
  if (baselineImageBase64) {
    images.push(cleanBase64(baselineImageBase64));
  }

  const stageStr = params.imageStage === 'before'
    ? `BEFORE USE (Pristine material). Details: ${params.imageStageDetails || 'None'}`
    : params.imageStage === 'after'
      ? `AFTER USE (Spent material, post-reaction). Details: ${params.imageStageDetails || 'None'}`
      : `Unspecified Material Stage`;

  const measurementsContext = manualStats
    ? `User Manual Measurements: ${measurements.length} particles measured. Mean: ${manualStats.mean.toFixed(2)} nm, StdDev: ${manualStats.stdDev.toFixed(2)} nm.`
    : `Scale bar: ${scale ? `${scale.knownLength} ${scale.unit}` : 'Not calibrated'}.`;

  const isSem = params.microscopyType === 'SEM';

  const prompt = `EXPERIMENTAL CHARACTERIZATION TASK:
You are an expert materials characterization scientist. Analyze this ${params.microscopyType} micrograph for sample: ${params.nanoparticleName || 'Nanomaterial'}.
Metadata:
- Synthesis Method: ${params.synthesisMethod || 'Standard synthesis'}
- Crystal Structure / XRD: ${params.crystalStructure || 'Not specified'}
- EDX Data: ${params.edxData || 'None'}
- Material Lifecycle Stage: ${stageStr}
- Detector: ${params.detector}, Vacuum: ${params.vacuum}
${measurementsContext}
${baselineImageBase64 ? 'Note: A secondary baseline image (Image 2) is provided showing the pristine BEFORE-USE state for side-by-side comparison.' : ''}

STRICT INSTRUMENT REQUIREMENTS:
- Chosen instrument is ${params.microscopyType}.
- If SEM: Focus purely on surface topography, morphological roughness, cluster structure, secondary electron imaging, and 3D depth of field. Set "temAnalysis.isApplicable" to false and "semAnalysis.isApplicable" to true.
- If TEM: Focus purely on electron transmission, bright/dark-field characteristics, crystalline facets, internal density, and contrast. Set "semAnalysis.isApplicable" to false and "temAnalysis.isApplicable" to true.

Output ONLY valid JSON matching this schema:
{
  "summary": "Concise 2-4 sentence executive overview of particle morphology, sizing, and dispersion quality.",
  "temAnalysis": {
    "isApplicable": ${!isSem},
    "averageSizeNm": ${manualStats ? Math.round(manualStats.mean) : 25},
    "shapeAnalysis": "Detailed visual description of particle geometry (e.g. spherical, cuboidal, rod-like, facets, aspect ratio).",
    "geometryDetails": "Crystallographic facets or perimeter geometry description.",
    "topographyDetails": "Transmission contrast and density distribution observations."
  },
  "semAnalysis": {
    "isApplicable": ${isSem},
    "surfaceRoughness": "Roughness scale (e.g., Smooth, Nanotextured, Porous, Agglomerated).",
    "morphology": "Surface texture and 3D cluster morphology analysis."
  },
  "aggregation": "Degree and state of agglomeration/dispersion (e.g., Well-dispersed, Moderate agglomerates, Dense sintered clusters).",
  "contextualInterpretation": "Comprehensive scientific interpretation linking the observed morphology to the synthesis method (${params.synthesisMethod || 'synthesis'}), precursors, and crystal phase (${params.crystalStructure || 'structure'}).",
  "comprehensiveInterpretation": "Extended academic discussion (3-5 detailed paragraphs) evaluating nucleation/growth kinetics, surface energy, and application suitability (${params.application || 'nanotechnology'}).",
  "comparisonAnalysis": "${params.imageStage === 'after' ? 'Detailed comparative analysis of post-reaction degradation, sintering, or adsorption layers compared to pristine state.' : 'Pristine sample; baseline comparison not required.'}"
}`;

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
          images
        }
      ],
      format: 'json',
      stream: false
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama Analysis error (HTTP ${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const rawText = data.message?.content || '';

  const defaultReport: AnalysisReportData = {
    summary: 'Microscopy image analyzed with local Ollama vision model.',
    temAnalysis: {
      isApplicable: !isSem,
      averageSizeNm: manualStats?.mean || 25,
      shapeAnalysis: 'Nanoparticles exhibiting characteristic morphology.',
      geometryDetails: 'Uniform perimeter contours.',
      topographyDetails: 'Electron density contrast observed.'
    },
    semAnalysis: {
      isApplicable: isSem,
      surfaceRoughness: 'Micro-textured particulate surface',
      morphology: 'Cluster agglomerates with granular texture'
    },
    aggregation: 'Moderate cluster aggregation with discernible primary particles',
    contextualInterpretation: 'The micrograph demonstrates particle formation consistent with the synthesis conditions.',
    comprehensiveInterpretation: 'Comprehensive analysis from local Ollama model.'
  };

  const parsed = parseJsonSafely<AnalysisReportData>(rawText, defaultReport);

  // Guarantee required fields
  if (!parsed.summary) parsed.summary = defaultReport.summary;
  if (!parsed.temAnalysis) parsed.temAnalysis = defaultReport.temAnalysis;
  if (!parsed.semAnalysis) parsed.semAnalysis = defaultReport.semAnalysis;
  if (!parsed.aggregation) parsed.aggregation = defaultReport.aggregation;
  if (!parsed.contextualInterpretation) parsed.contextualInterpretation = defaultReport.contextualInterpretation;
  if (!parsed.comprehensiveInterpretation) parsed.comprehensiveInterpretation = parsed.contextualInterpretation;

  return parsed;
}

export async function ollamaPerformLiteratureReview(
  host: string,
  model: string,
  query: string
): Promise<LiteratureItem[]> {
  const target = normalizeHost(host);
  const prompt = `You are a materials science research librarian. Provide 3-5 relevant published scholarly peer-reviewed papers for: "${query}".
Return ONLY a valid JSON array of objects with this schema:
[
  {
    "title": "Full Paper Title",
    "authors": "First Author et al.",
    "year": "2023",
    "journal": "e.g. ACS Nano or Journal of Materials Chemistry A",
    "keyFindings": "Key finding relating to morphology, sizing, and synthesis",
    "comparison": "How this relates to similar nanoparticle systems",
    "url": "https://doi.org/10.xxxx/xxxxx or publisher URL",
    "doi": "10.xxxx/xxxxx",
    "fullCitation": "IEEE citation format"
  }
]`;

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      format: 'json',
      stream: false
    })
  });

  if (!res.ok) return [];
  const data = await res.json();
  const rawText = data.message?.content || '[]';
  return parseJsonSafely<LiteratureItem[]>(rawText, []);
}

export async function ollamaGenerateFinalSynthesis(
  host: string,
  model: string,
  report: AnalysisReportData,
  params: AnalysisParams,
  literature: LiteratureItem[]
): Promise<string> {
  const target = normalizeHost(host);
  const prompt = `TASK: GENERATE FINAL MANUSCRIPT-READY INTEGRATED INTERPRETATION.
Sample: ${params.nanoparticleName || 'Nanomaterial'}, Instrument: ${params.microscopyType}.
Synthesis: ${params.synthesisMethod}, XRD Phase: ${params.crystalStructure}.
Visual Morphology: ${params.microscopyType === 'SEM' ? report.semAnalysis.morphology : report.temAnalysis.shapeAnalysis}.
Aggregation: ${report.aggregation}.
Lifecycle Stage: ${params.imageStage}.
Literature: ${literature.map((l, i) => `[${i+1}] ${l.title} (${l.year})`).join('; ')}.

INSTRUCTIONS:
Write an extensive scientific manuscript discussion (800+ words) using IEEE numeric citations [1], [2], etc.
Synthesize the synthesis mechanism, precursor chemistry, resulting crystal phase, facet development, and microscopy morphology.
Return clean text in Markdown format.`;

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    })
  });

  if (!res.ok) throw new Error(`Ollama synthesis failed: ${res.statusText}`);
  const data = await res.json();
  return data.message?.content || '';
}

export async function ollamaProcessAIAction(
  host: string,
  model: string,
  action: 'explain' | 'expand' | 'summarize',
  context: string
): Promise<string> {
  const target = normalizeHost(host);
  let prompt = '';
  if (action === 'explain') prompt = `Explain the educational principles of this microscopy interpretation for a student:\n\n${context}`;
  if (action === 'expand') prompt = `Expand this into an exhaustive manuscript discussion with deeper mechanistic depth:\n\n${context}`;
  if (action === 'summarize') prompt = `Summarize this into a concise publication abstract:\n\n${context}`;

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    })
  });

  if (!res.ok) throw new Error(`Ollama text processing failed: ${res.statusText}`);
  const data = await res.json();
  return data.message?.content || '';
}

export async function ollamaRegenerateInterpretation(
  host: string,
  model: string,
  baseInterpretation: string,
  report: AnalysisReportData,
  params: AnalysisParams,
  tone: string
): Promise<string> {
  const target = normalizeHost(host);
  const prompt = `Rewrite this scientific interpretation for publication in a "${tone}" tone. Ensure it remains rigorous, grounded in ${params.microscopyType} microscopy evidence, and thoroughly articulated.\n\nOriginal Text:\n${baseInterpretation}`;

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    })
  });

  if (!res.ok) throw new Error(`Ollama rewrite failed: ${res.statusText}`);
  const data = await res.json();
  return data.message?.content || '';
}

// Async generator for streaming chat messages from Ollama
export async function* ollamaStreamChatResponse(
  host: string,
  model: string,
  history: ChatMessage[],
  context: string
): AsyncGenerator<{ text: string }> {
  const target = normalizeHost(host);

  const messages = [
    {
      role: 'system',
      content: `You are an expert specialist in materials science and electron microscopy (TEM & SEM). Help users analyze microscopy images, explain crystal facets, synthesis pathways, and morphology. Use this analysis report context: ${context}`
    },
    ...history.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const res = await fetch(`${target}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama chat stream failed: HTTP ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          const chunkText = parsed.message?.content || '';
          if (chunkText) {
            yield { text: chunkText };
          }
        } catch {}
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        const chunkText = parsed.message?.content || '';
        if (chunkText) {
          yield { text: chunkText };
        }
      } catch {}
    }
  } finally {
    reader.releaseLock();
  }
}
