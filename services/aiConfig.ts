import { AIServiceConfig, OllamaModelInfo } from '../types';
import { DEFAULT_OLLAMA_HOST, PROXY_OLLAMA_HOST } from './ollamaService';

const STORAGE_KEY = 'tem_sem_ai_config';

const defaultConfig: AIServiceConfig = {
  provider: 'gemini',
  geminiModel: 'gemini-3.8-flash',
  openaiModel: 'gpt-4o',
  claudeModel: 'claude-3-5-sonnet-20241022',
  openrouterModel: 'google/gemini-2.5-flash',
  ollamaHost: PROXY_OLLAMA_HOST,
  ollamaVisionModel: 'llama3.2-vision:11b',
  ollamaTextModel: 'llama3.2-vision:11b'
};

export function loadAIServiceConfig(): AIServiceConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-migrate deprecated or failing model names like gemini-2.5-flash to default gemini-3.8-flash
      if (parsed.geminiModel === 'gemini-2.5-flash' || parsed.geminiModel === 'gemini-1.5-flash' || parsed.geminiModel === 'gemini-2.0-flash') {
        parsed.geminiModel = 'gemini-3.8-flash';
      }
      return {
        ...defaultConfig,
        ...parsed
      };
    }
  } catch (e) {
    console.warn('Could not read AI service config from localStorage:', e);
  }
  return { ...defaultConfig };
}

export function saveAIServiceConfig(config: Partial<AIServiceConfig>): AIServiceConfig {
  const current = loadAIServiceConfig();
  const updated: AIServiceConfig = {
    ...current,
    ...config
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('ai-config-changed', { detail: updated }));
  } catch (e) {
    console.warn('Could not save AI service config to localStorage:', e);
  }
  return updated;
}
