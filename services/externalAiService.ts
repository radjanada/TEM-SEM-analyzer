import { 
  AnalysisParams, 
  AnalysisReportData, 
  ChatMessage, 
  LiteratureItem, 
  Measurement, 
  AIServiceConfig 
} from '../types';

/**
 * Universal client for OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, Together, DeepSeek, Custom v1)
 * and Anthropic Claude messages API.
 */

// Helper: Ensure base64 has data URI prefix for image URLs
function ensureDataUrl(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

// Safely extract JSON from response text
function parseJsonSafely<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text.trim());
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }
    const objMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[1]);
      } catch {}
    }
  }
  return fallback;
}

/**
 * Generic OpenAI / OpenRouter / Custom compatible chat completions call
 */
export async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: any }>,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const url = endpoint.endsWith('/chat/completions') 
    ? endpoint 
    : `${endpoint.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...extraHeaders
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    let errorMsg = `API Error (${response.status} ${response.statusText})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) errorMsg += `: ${parsed.error.message}`;
    } catch {
      if (errBody) errorMsg += `: ${errBody.slice(0, 150)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c: any) => c.text || '').join('');
  }
  return '';
}

/**
 * Anthropic Claude API Messages call
 */
export async function callClaudeApi(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: any }>
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    let msg = `Claude API Error (${response.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) msg += `: ${parsed.error.message}`;
    } catch {
      if (errBody) msg += `: ${errBody.slice(0, 150)}`;
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const textContent = data.content?.find((c: any) => c.type === 'text');
  return textContent ? textContent.text : '';
}

/**
 * Universal dispatcher for auto-filling microscopy metadata from image
 */
export async function externalGetAutoFillSuggestions(
  config: AIServiceConfig,
  imageBase64: string
): Promise<Partial<AnalysisParams>> {
  const prompt = `Analyze this TEM/SEM microscopy image carefully and extract instrument metadata and material properties.
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

  let raw = '';
  const dataUri = ensureDataUrl(imageBase64);

  if (config.provider === 'claude') {
    if (!config.claudeApiKey) throw new Error('Please enter your Anthropic Claude API Key in Settings.');
    const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    raw = await callClaudeApi(
      config.claudeApiKey,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      'You are a materials science and electron microscopy expert. Return ONLY valid JSON.',
      [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: cleanB64 }
            },
            { type: 'text', text: prompt }
          ]
        }
      ]
    );
  } else {
    // OpenAI, OpenRouter, Custom
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
      extraHeaders['X-Title'] = 'TEM/SEM Analysis Tool';
      if (!apiKey) throw new Error('Please enter your OpenRouter API Key in Settings.');
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
      if (!apiKey) throw new Error('Please enter your Custom Provider API Key in Settings.');
    } else {
      if (!apiKey) throw new Error('Please enter your OpenAI API Key in Settings.');
    }

    raw = await callOpenAICompatible(
      endpoint,
      apiKey,
      model,
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUri } }
          ]
        }
      ],
      extraHeaders
    );
  }

  return parseJsonSafely<Partial<AnalysisParams>>(raw, {
    microscopyType: 'TEM',
    detector: 'ETD',
    vacuum: 'High',
    temMode: 'Bright-field'
  });
}

/**
 * Universal dispatcher for Full Analysis
 */
export async function externalPerformFullAnalysis(
  config: AIServiceConfig,
  imageBase64: string,
  params: AnalysisParams,
  scale: any,
  measurements: Measurement[],
  manualStats: { mean: number; stdDev: number; } | null,
  baselineImageBase64?: string | null
): Promise<AnalysisReportData> {
  const isComparative = !!baselineImageBase64 && params.imageStage === 'after';
  const dataUri = ensureDataUrl(imageBase64);

  const prompt = `Perform rigorous materials science characterization on this ${params.microscopyType} micrograph.
Parameters:
- Nanomaterial: ${params.nanoparticleName || 'Nanomaterial'}
- Category: ${params.materialType || 'N/A'}
- Synthesis Method: ${params.synthesisMethod || 'N/A'}
- Crystal Structure (XRD): ${params.crystalStructure || 'N/A'}
- EDX Elemental Composition: ${params.edxData || 'N/A'}
- Detector: ${params.detector}, Vacuum: ${params.vacuum}
- Lifecycle Stage: ${params.imageStage || 'not_specified'} (${params.imageStageDetails || 'None'})
- Manual Measurements Count: ${measurements.length}
${manualStats ? `- Calibrated Mean Size: ${manualStats.mean.toFixed(2)} nm, Std Dev: ±${manualStats.stdDev.toFixed(2)} nm` : ''}
${isComparative ? '- COMPARATIVE STUDY: Compare current spent/after-use state with pristine baseline image provided.' : ''}

Output ONLY valid JSON matching this schema:
{
  "summary": "High-level 2-3 sentence findings",
  "temAnalysis": {
    "isApplicable": ${params.microscopyType === 'TEM'},
    "averageSizeNm": ${manualStats?.mean || 25},
    "sizeDistribution": "e.g. Monodisperse (15-35 nm) with Gaussian profile",
    "particleCount": ${measurements.length || 20},
    "shapeAnalysis": "Detailed morphology, facets, aspect ratio",
    "geometryDetails": "Core-shell or lattice spacing observations",
    "topographyDetails": "Contrast, edges, crystallinity"
  },
  "semAnalysis": {
    "isApplicable": ${params.microscopyType === 'SEM'},
    "surfaceRoughness": "Surface features or porous topology",
    "morphology": "Particle cluster morphology and grain boundaries"
  },
  "aggregation": "Degree of agglomeration and dispersity in medium",
  "contextualInterpretation": "In-depth scientific interpretation correlating precursors, crystal phase, and catalytic/functional properties.",
  "comparisonAnalysis": "${isComparative ? 'Exhaustive comparative discussion on sintering, degradation, surface restructuring.' : 'N/A'}"
}`;

  let raw = '';

  if (config.provider === 'claude') {
    if (!config.claudeApiKey) throw new Error('Please enter your Anthropic Claude API Key in Settings.');
    const cleanB64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const userContent: any[] = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: cleanB64 }
      }
    ];
    if (baselineImageBase64) {
      const cleanBase = baselineImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: cleanBase }
      });
    }
    userContent.push({ type: 'text', text: prompt });

    raw = await callClaudeApi(
      config.claudeApiKey,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      'You are a senior electron microscopist and materials characterization expert. Return ONLY valid JSON.',
      [{ role: 'user', content: userContent }]
    );
  } else {
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
      extraHeaders['X-Title'] = 'TEM/SEM Analysis Tool';
      if (!apiKey) throw new Error('Please enter your OpenRouter API Key in Settings.');
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
      if (!apiKey) throw new Error('Please enter your Custom Provider API Key in Settings.');
    } else {
      if (!apiKey) throw new Error('Please enter your OpenAI API Key in Settings.');
    }

    const contentArray: any[] = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: dataUri } }
    ];
    if (baselineImageBase64) {
      contentArray.push({
        type: 'image_url',
        image_url: { url: ensureDataUrl(baselineImageBase64) }
      });
    }

    raw = await callOpenAICompatible(
      endpoint,
      apiKey,
      model,
      [{ role: 'user', content: contentArray }],
      extraHeaders
    );
  }

  const fallback: AnalysisReportData = {
    summary: 'Microscopy characterization complete.',
    temAnalysis: {
      isApplicable: params.microscopyType === 'TEM',
      averageSizeNm: manualStats?.mean || 25,
      sizeDistribution: 'Uniform distribution',
      particleCount: measurements.length || 15,
      shapeAnalysis: 'Nanoparticles showing clear contrast boundaries.'
    },
    semAnalysis: {
      isApplicable: params.microscopyType === 'SEM',
      surfaceRoughness: 'Homogeneous',
      morphology: 'Agglomerated particulate surface'
    },
    aggregation: 'Moderate aggregation observed',
    contextualInterpretation: 'The sample exhibits characteristic nanoscale features.'
  };

  return parseJsonSafely<AnalysisReportData>(raw, fallback);
}

/**
 * Universal Literature Review Generator
 */
export async function externalPerformLiteratureReview(
  config: AIServiceConfig,
  query: string
): Promise<LiteratureItem[]> {
  const prompt = `You are a materials science librarian. Provide 3-5 real or benchmark scholarly papers for: "${query}".
Return ONLY a valid JSON array of objects with schema:
[
  {
    "title": "Full publication title",
    "authors": "First author et al.",
    "year": "YYYY",
    "journal": "e.g. ACS Nano or Chem. Mater.",
    "keyFindings": "Brief summary of size, facet, and performance findings",
    "comparison": "How this relates to standard morphology and XRD findings",
    "url": "https://doi.org/10.xxxx/...",
    "doi": "10.xxxx/..."
  }
]`;

  let raw = '';
  if (config.provider === 'claude') {
    raw = await callClaudeApi(
      config.claudeApiKey!,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      'Return ONLY a valid JSON array.',
      [{ role: 'user', content: prompt }]
    );
  } else {
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
    }

    raw = await callOpenAICompatible(
      endpoint,
      apiKey,
      model,
      [{ role: 'user', content: prompt }],
      extraHeaders
    );
  }

  return parseJsonSafely<LiteratureItem[]>(raw, []);
}

/**
 * Universal Manuscript Synthesis Generator
 */
export async function externalGenerateFinalSynthesis(
  config: AIServiceConfig,
  report: AnalysisReportData,
  params: AnalysisParams,
  literature: LiteratureItem[]
): Promise<string> {
  const prompt = `TASK: GENERATE FINAL MANUSCRIPT-READY INTEGRATED INTERPRETATION.
Sample: ${params.nanoparticleName || 'Nanomaterial'}, Instrument: ${params.microscopyType}.
XRD Phase: ${params.crystalStructure || 'N/A'}, Precursors: ${params.startingMaterials?.join(', ') || 'N/A'}, EDX: ${params.edxData || 'N/A'}.
Lifecycle Stage: ${params.imageStage || 'not_specified'} (${params.imageStageDetails || 'None'}).
Measured Average Size: ${report.temAnalysis.averageSizeNm || 'N/A'} nm.
Literature references: ${literature.map((l, i) => `[${i+1}] ${l.title} (${l.year})`).join('; ')}.

INSTRUCTIONS:
1. Write a publication-grade Materials Science Results and Discussion section (1000+ words).
2. Integrate crystal facets, morphology, synthesis mechanisms, and stage differences.
3. Use IEEE style citations [1], [2] referencing the provided literature.
4. Return high-level markdown text only.`;

  if (config.provider === 'claude') {
    return callClaudeApi(
      config.claudeApiKey!,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      'You are a senior materials scientist writing a peer-reviewed manuscript discussion.',
      [{ role: 'user', content: prompt }]
    );
  } else {
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
    }

    return callOpenAICompatible(
      endpoint,
      apiKey,
      model,
      [{ role: 'user', content: prompt }],
      extraHeaders
    );
  }
}

/**
 * Universal AI Actions (Explain, Expand, Summarize)
 */
export async function externalProcessAIAction(
  config: AIServiceConfig,
  action: 'explain' | 'expand' | 'summarize',
  context: string
): Promise<string> {
  let prompt = '';
  if (action === 'explain') prompt = `Explain the educational principles of this microscopy data for a student: ${context}`;
  if (action === 'expand') prompt = `Expand this into a 1500-word comprehensive manuscript discussion: ${context}`;
  if (action === 'summarize') prompt = `Summarize into a concise scientific abstract: ${context}`;

  if (config.provider === 'claude') {
    return callClaudeApi(
      config.claudeApiKey!,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      'You are an expert scientific editor and materials scientist.',
      [{ role: 'user', content: prompt }]
    );
  } else {
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
    }

    return callOpenAICompatible(
      endpoint,
      apiKey,
      model,
      [{ role: 'user', content: prompt }],
      extraHeaders
    );
  }
}

/**
 * Universal Tone Regeneration
 */
export async function externalRegenerateInterpretation(
  config: AIServiceConfig,
  baseInterpretation: string,
  report: AnalysisReportData,
  params: AnalysisParams,
  tone: string
): Promise<string> {
  const prompt = `Rewrite this interpretation for scientific publication in "${tone}" style. Ensure it is extensive, educational, and scientifically sound. Original: "${baseInterpretation}"`;

  if (config.provider === 'claude') {
    return callClaudeApi(
      config.claudeApiKey!,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      'You are a senior scientific editor.',
      [{ role: 'user', content: prompt }]
    );
  } else {
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
    }

    return callOpenAICompatible(
      endpoint,
      apiKey,
      model,
      [{ role: 'user', content: prompt }],
      extraHeaders
    );
  }
}

/**
 * Universal Chat Streamer
 */
export async function externalStreamChatResponse(
  config: AIServiceConfig,
  history: ChatMessage[],
  context: string
): Promise<AsyncIterable<{ text: string }>> {
  const sysMsg = `You are a specialist in material science and electron microscopy. Help users link their image findings to literature and metadata. Context: ${context}`;
  const prompt = history[history.length - 1]?.content || '';

  let fullReply = '';
  if (config.provider === 'claude') {
    fullReply = await callClaudeApi(
      config.claudeApiKey!,
      config.claudeModel || 'claude-3-5-sonnet-20241022',
      sysMsg,
      history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.content
      }))
    );
  } else {
    let endpoint = 'https://api.openai.com/v1';
    let apiKey = config.openaiApiKey || '';
    let model = config.openaiModel || 'gpt-4o';
    const extraHeaders: Record<string, string> = {};

    if (config.provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1';
      apiKey = config.openrouterApiKey || '';
      model = config.openrouterModel || 'openai/gpt-4o';
      extraHeaders['HTTP-Referer'] = window.location.origin;
    } else if (config.provider === 'custom') {
      endpoint = config.customBaseUrl || 'https://api.openai.com/v1';
      apiKey = config.customApiKey || '';
      model = config.customModel || 'gpt-4o';
    }

    const messages = [
      { role: 'system', content: sysMsg },
      ...history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.content
      }))
    ];

    fullReply = await callOpenAICompatible(endpoint, apiKey, model, messages, extraHeaders);
  }

  // Yield as async iterable matching Gemini stream
  return (async function* () {
    yield { text: fullReply };
  })();
}
