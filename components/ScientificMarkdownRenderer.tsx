import React, { useMemo } from 'react';
import { marked } from 'marked';
import katex from 'katex';

interface ScientificMarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Fallback cleaner for chemical/mathematical LaTeX if KaTeX encountered an unhandled token
 */
function cleanLatexFallback(latex: string): string {
  return latex
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\longrightarrow|\\rightarrow/g, ' ⟶ ')
    .replace(/\\longleftarrow|\\leftarrow/g, ' ⟵ ')
    .replace(/\\rightleftharpoons/g, ' ⇌ ')
    .replace(/\\quad/g, '   ')
    .replace(/\\qquad/g, '      ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\times/g, ' × ')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\degree/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\^\{\+\}|\^\+/g, '⁺')
    .replace(/\^\{-\}|\^\-/g, '⁻')
    .replace(/\^0|\^\{0\}/g, '⁰')
    .replace(/\^2|\^\{2\}/g, '²')
    .replace(/\^3|\^\{3\}/g, '³')
    .replace(/_2|_\{2\}/g, '₂')
    .replace(/_3|_\{3\}/g, '₃')
    .replace(/_4|_\{4\}/g, '₄')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .trim();
}

/**
 * Safely renders LaTeX via KaTeX with visual fallback
 */
function renderKatex(latex: string, displayMode: boolean): string {
  const trimmed = latex.trim();
  try {
    return katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
  } catch (err) {
    console.warn('KaTeX render warning:', err);
    const fallbackText = cleanLatexFallback(trimmed);
    if (displayMode) {
      return `<div class="font-mono text-emerald-300 text-sm sm:text-base py-1">${fallbackText}</div>`;
    }
    return `<span class="font-mono text-cyan-300 text-xs sm:text-sm">${fallbackText}</span>`;
  }
}

export const ScientificMarkdownRenderer: React.FC<ScientificMarkdownRendererProps> = ({
  content,
  className = ''
}) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    const mathBlocks: string[] = [];
    const mathInlines: string[] = [];

    // Step 1: Normalize any bare chemical equations that start with \text or have \longrightarrow without $$
    let processed = content.replace(/(?:^|\n)(\s*\\text\{[^\n]+\\longrightarrow[^\n]+)(?=\n|$)/g, (_match, eq) => {
      return `\n\n$$${eq.trim()}$$\n\n`;
    });

    // Step 2: Extract Block Math ($$ ... $$) or (\[ ... \])
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula) => {
      const index = mathBlocks.length;
      mathBlocks.push(formula.trim());
      return `\n\n%%MATH_BLOCK_${index}%%\n\n`;
    });

    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => {
      const index = mathBlocks.length;
      mathBlocks.push(formula.trim());
      return `\n\n%%MATH_BLOCK_${index}%%\n\n`;
    });

    // Step 3: Extract Inline Math ($ ... $) or (\( ... \))
    // Negative lookbehind / lookahead so we don't match currency like "$50"
    processed = processed.replace(/(?<![\$\w])\$([^\$\n]+?)\$(?![\$\w\d])/g, (_match, formula) => {
      // Ignore if it looks like currency ($10, $5.00)
      if (/^\s*\d+(?:\.\d+)?\s*$/.test(formula)) {
        return _match;
      }
      const index = mathInlines.length;
      mathInlines.push(formula.trim());
      return `%%MATH_INLINE_${index}%%`;
    });

    processed = processed.replace(/\\\((.+?)\\\)/g, (_match, formula) => {
      const index = mathInlines.length;
      mathInlines.push(formula.trim());
      return `%%MATH_INLINE_${index}%%`;
    });

    // Step 4: Parse Markdown via marked
    let html = marked.parse(processed, {
      breaks: true,
      gfm: true,
    }) as string;

    // Step 5: Replace Block Math Placeholders with KaTeX rendered cards
    mathBlocks.forEach((latex, idx) => {
      const placeholder = `<p>%%MATH_BLOCK_${idx}%%</p>`;
      const placeholderAlt = `%%MATH_BLOCK_${idx}%%`;
      const isChemical = latex.includes('longrightarrow') || latex.includes('rightarrow') || latex.includes('R-OH') || latex.includes('Ag') || latex.includes('Au') || latex.includes('Fe') || latex.includes('Ti');
      
      const katexHtml = renderKatex(latex, true);
      const cardHtml = `
        <div class="my-5 p-4 rounded-xl bg-gray-950/90 border border-emerald-500/40 shadow-lg text-center relative group">
          <div class="flex items-center justify-between border-b border-gray-800/80 pb-2 mb-3 text-[10px] text-gray-400">
            <span class="flex items-center gap-1.5 font-bold uppercase tracking-wider ${isChemical ? 'text-emerald-400' : 'text-cyan-400'}">
              <span class="text-xs">${isChemical ? '⚗️' : '📐'}</span>
              ${isChemical ? 'Chemical Reaction Mechanism' : 'Mathematical Formulation'}
            </span>
            <span class="text-[9px] text-gray-500 font-mono uppercase bg-gray-900 px-2 py-0.5 rounded border border-gray-800">LaTeX Model</span>
          </div>
          <div class="overflow-x-auto py-2 text-gray-100 flex justify-center items-center">
            ${katexHtml}
          </div>
        </div>
      `;

      if (html.includes(placeholder)) {
        html = html.replace(placeholder, cardHtml);
      } else {
        html = html.replace(placeholderAlt, cardHtml);
      }
    });

    // Step 6: Replace Inline Math Placeholders
    mathInlines.forEach((latex, idx) => {
      const placeholder = `%%MATH_INLINE_${idx}%%`;
      const katexHtml = renderKatex(latex, false);
      const inlineWrapper = `<span class="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-gray-800/90 text-cyan-200 border border-gray-700/60 font-mono text-xs">${katexHtml}</span>`;
      html = html.replaceAll(placeholder, inlineWrapper);
    });

    // Step 7: Style Citation Badges like [1], [2], [1, 2], [1-3]
    html = html.replace(/\[(\d+(?:\s*[,-]\s*\d+)*)\](?!\()/g, (_match, citeNum) => {
      return `<span class="inline-flex items-center text-[10px] font-bold text-cyan-300 bg-cyan-950/90 border border-cyan-700/60 px-1.5 py-0.2 rounded mx-0.5 font-mono shadow-sm hover:border-cyan-400 transition-colors" title="Literature Reference [${citeNum}]">[${citeNum}]</span>`;
    });

    return html;
  }, [content]);

  return (
    <div
      className={`prose prose-sm prose-invert max-w-none text-gray-200 leading-relaxed font-sans ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
