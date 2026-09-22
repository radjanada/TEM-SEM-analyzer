import { LiteratureItem } from '../types';

/**
 * Helper to reconstruct text from OpenAlex inverted index abstract
 */
function reconstructAbstract(invertedIndex?: Record<string, number[]>): string {
  if (!invertedIndex) return '';
  const entries: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      entries.push([word, pos]);
    }
  }
  entries.sort((a, b) => a[1] - b[1]);
  const text = entries.map(e => e[0]).join(' ');
  return text.slice(0, 300) + (text.length > 300 ? '...' : '');
}

/**
 * Searches real scholarly papers from OpenAlex (free, CORS-enabled, 250M+ scientific articles)
 */
export async function searchOpenAlex(query: string, limit = 5): Promise<LiteratureItem[]> {
  try {
    const cleanQuery = query.replace(/[^\w\s-]/g, ' ').trim();
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&per-page=${limit}&sort=relevance_score:desc`;
    
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`OpenAlex HTTP ${res.status}`);
    }

    const data = await res.json();
    const results = data.results || [];

    return results.map((work: any): LiteratureItem => {
      const doiUrl = work.doi || work.primary_location?.landing_page_url || '';
      const cleanDoi = doiUrl.replace(/^https?:\/\/doi\.org\//i, '');
      const authorsList = (work.authorships || [])
        .slice(0, 3)
        .map((a: any) => a.author?.display_name)
        .filter(Boolean);
      const authorsStr = authorsList.length > 0 
        ? `${authorsList.join(', ')}${(work.authorships || []).length > 3 ? ' et al.' : ''}`
        : 'Scholarly Authors';
      
      const journalName = work.primary_location?.source?.display_name || work.host_venue?.display_name || 'Academic Journal';
      const year = String(work.publication_year || new Date().getFullYear());
      const abstractText = reconstructAbstract(work.abstract_inverted_index);

      const title = work.title || 'Scholarly Publication';
      const directUrl = doiUrl.startsWith('http') ? doiUrl : `https://doi.org/${cleanDoi}`;

      return {
        title,
        authors: authorsStr,
        year,
        journal: journalName,
        keyFindings: abstractText || `Microscopy and materials study examining ${cleanQuery}.`,
        comparison: `Benchmark paper reporting structural morphology and synthesis characteristics in ${journalName} (${year}).`,
        url: directUrl || `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`,
        doi: cleanDoi || undefined,
        fullCitation: `${authorsStr}, "${title}," ${journalName}, vol. ${work.biblio?.volume || ''}, pp. ${work.biblio?.first_page || ''}, ${year}. DOI: ${cleanDoi}`
      };
    });
  } catch (err) {
    console.warn('OpenAlex search failed, attempting CrossRef fallback...', err);
    return [];
  }
}

/**
 * Searches real scholarly papers from CrossRef (official DOI agency, free, CORS-enabled)
 */
export async function searchCrossRef(query: string, limit = 5): Promise<LiteratureItem[]> {
  try {
    const cleanQuery = query.replace(/[^\w\s-]/g, ' ').trim();
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(cleanQuery)}&rows=${limit}&sort=relevance`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`CrossRef HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data.message?.items || [];

    return items.map((item: any): LiteratureItem => {
      const title = Array.isArray(item.title) ? item.title[0] : (item.title || 'Materials Characterization Article');
      const doi = item.DOI || '';
      const authors = (item.author || [])
        .slice(0, 3)
        .map((a: any) => `${a.given || ''} ${a.family || ''}`.trim())
        .filter(Boolean);
      const authorsStr = authors.length > 0 
        ? `${authors.join(', ')}${(item.author || []).length > 3 ? ' et al.' : ''}`
        : 'Research Team';
      
      const year = String(item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || '2023');
      const journal = Array.isArray(item['container-title']) ? item['container-title'][0] : (item['container-title'] || 'Peer-Reviewed Journal');
      const targetUrl = item.URL || (doi ? `https://doi.org/${doi}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`);

      return {
        title,
        authors: authorsStr,
        year,
        journal,
        keyFindings: `Peer-reviewed investigation on ${cleanQuery}, detailing morphology, synthesis parameters, and characterization data.`,
        comparison: `Reference dataset from ${journal} (${year}) for validating grain boundaries, particle size, and crystalline structure.`,
        url: targetUrl,
        doi,
        fullCitation: `${authorsStr}, "${title}," ${journal}, ${year}. DOI: ${doi}`
      };
    });
  } catch (err) {
    console.warn('CrossRef search failed:', err);
    return [];
  }
}

/**
 * Universal Open Scholarly Search:
 * Tries OpenAlex first; if empty or failed, falls back to CrossRef.
 */
export async function searchOpenScholarlyRepositories(query: string, limit = 5): Promise<LiteratureItem[]> {
  const openAlexResults = await searchOpenAlex(query, limit);
  if (openAlexResults.length > 0) {
    return openAlexResults;
  }
  return await searchCrossRef(query, limit);
}

/**
 * Constructs an optimized, grounded peer-reviewed literature search query
 * specifically prioritizing:
 * 1. Crystal Structure / XRD phase (e.g. "FCC (111)", "Anatase", "Zinc Blende")
 * 2. Plant extract or chemical reducing agent (e.g. "Azadirachta indica", "Neem leaf", "Sodium citrate")
 * 3. Extraction method (if green synthesis)
 * 4. Precursor salts and target nanoparticle name
 * 5. Microscopy and diffraction terms (TEM/SEM, XRD)
 */
export function buildLiteratureSearchQuery(params: any): string {
  const parts: string[] = [];

  // 1. XRD Phase / Crystal Structure (HIGHEST PRIORITY for crystal facets)
  if (params.crystalStructure && params.crystalStructure.trim()) {
    parts.push(params.crystalStructure.trim());
  }

  // 2. Reducing / Stabilizing Agent / Plant species (HIGHEST PRIORITY)
  if (params.reducingStabilizingAgent && params.reducingStabilizingAgent.trim()) {
    parts.push(params.reducingStabilizingAgent.trim());
  }

  // 3. Extraction Protocol if specified
  if (params.extractionMethod && !params.extractionMethod.includes('Standard Chemical')) {
    const cleanExtract = params.extractionMethod
      .split('/')[0]
      .replace(/\([^)]*\)/g, '')
      .trim();
    if (cleanExtract) {
      parts.push(cleanExtract);
    }
  }

  // 4. Plant biomass organ
  if (params.plantPart && params.plantPart !== 'N/A' && !params.plantPart.includes('Not Applicable')) {
    parts.push(params.plantPart.split('/')[0].trim());
  }

  // 5. Precursors / Metal salts
  if (params.startingMaterials && params.startingMaterials.length > 0) {
    const precursors = params.startingMaterials
      .map((p: string) => p.split('(')[0].trim())
      .filter(Boolean);
    if (precursors.length > 0) {
      parts.push(precursors.join(' '));
    }
  }

  // 6. Nanoparticle Name or Material Type
  if (params.nanoparticleName && params.nanoparticleName.trim()) {
    parts.push(params.nanoparticleName.trim());
  } else if (params.materialType && params.materialType.trim()) {
    parts.push(params.materialType.trim());
  }

  // 7. Synthesis Method
  if (params.synthesisMethod && params.synthesisMethod.trim()) {
    parts.push(params.synthesisMethod.trim());
  }

  // 8. Core characterization terms
  parts.push(params.microscopyType || 'TEM');
  parts.push('XRD');
  parts.push('characterization');

  // De-duplicate words while keeping order
  const seen = new Set<string>();
  const filteredWords: string[] = [];
  for (const part of parts) {
    const words = part.split(/\s+/);
    for (const w of words) {
      const lower = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower && !seen.has(lower)) {
        seen.add(lower);
        filteredWords.push(w);
      }
    }
  }

  return filteredWords.join(' ');
}

