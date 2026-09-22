import React, { useState, useEffect } from 'react';
import { AIServiceConfig, OllamaModelInfo, AIProvider } from '../types';
import { loadAIServiceConfig, saveAIServiceConfig } from '../services/aiConfig';
import { 
  fetchOllamaModels, 
  testOllamaConnection, 
  DEFAULT_OLLAMA_HOST, 
  PROXY_OLLAMA_HOST 
} from '../services/ollamaService';
import { 
  ServerIcon, 
  RefreshIcon, 
  CheckCircleIcon, 
  EyeIcon, 
  XMarkIcon, 
  SparklesIcon, 
  ClipboardIcon,
  RobotIcon
} from './icons';

interface OllamaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: (config: AIServiceConfig) => void;
}

export const OllamaSettingsModal: React.FC<OllamaSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated
}) => {
  const [config, setConfig] = useState<AIServiceConfig>(loadAIServiceConfig());
  const [hostInput, setHostInput] = useState<string>(config.ollamaHost || PROXY_OLLAMA_HOST);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    ok: boolean;
    version?: string;
    error?: string;
  }>({ tested: false, ok: false });

  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);
  const [showKeyToggle, setShowKeyToggle] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      const current = loadAIServiceConfig();
      setConfig(current);
      setHostInput(current.ollamaHost || PROXY_OLLAMA_HOST);
      if (current.provider === 'ollama') {
        handleScanModels(current.ollamaHost || PROXY_OLLAMA_HOST);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowKey = (id: string) => {
    setShowKeyToggle(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleScanModels = async (targetHost: string) => {
    setIsScanning(true);
    setConnectionStatus({ tested: false, ok: false });
    try {
      const conn = await testOllamaConnection(targetHost);
      if (!conn.ok) {
        throw new Error(conn.error || 'Cannot reach Ollama on the specified address.');
      }

      setConnectionStatus({ tested: true, ok: true, version: conn.version });
      const fetchedModels = await fetchOllamaModels(targetHost);
      setModels(fetchedModels);

      setConfig(prev => {
        const modelNames = fetchedModels.map(m => m.name);
        const hasCurrentVision = modelNames.includes(prev.ollamaVisionModel);
        const hasCurrentText = modelNames.includes(prev.ollamaTextModel);

        const visionList = fetchedModels.filter(m => m.isVision);
        const preferredVision = visionList.find(m => !m.name.toLowerCase().includes('lfm'))?.name 
          || visionList[0]?.name 
          || fetchedModels[0]?.name 
          || '';

        const nextVision = hasCurrentVision ? prev.ollamaVisionModel : preferredVision;
        const nextText = hasCurrentText ? prev.ollamaTextModel : (prev.ollamaVisionModel && hasCurrentVision ? prev.ollamaVisionModel : (fetchedModels[0]?.name || ''));

        return {
          ...prev,
          ollamaVisionModel: nextVision,
          ollamaTextModel: nextText
        };
      });
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        ok: false,
        error: err.message || 'Connection failed'
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = () => {
    const toSave: AIServiceConfig = {
      ...config,
      ollamaHost: hostInput.trim() || DEFAULT_OLLAMA_HOST
    };
    const saved = saveAIServiceConfig(toSave);
    setConfig(saved);
    if (onConfigUpdated) {
      onConfigUpdated(saved);
    }
    setSaveFeedback(true);
    setTimeout(() => {
      setSaveFeedback(false);
      onClose();
    }, 600);
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const formatSize = (bytes: number): string => {
    if (!bytes) return 'Unknown size';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const providersList: Array<{
    id: AIProvider;
    name: string;
    badge: string;
    description: string;
    color: string;
  }> = [
    {
      id: 'gemini',
      name: 'Google Gemini',
      badge: 'BYO Key or Cloud',
      description: 'Supports search grounding. Enter your own API key if cloud quota is limited.',
      color: 'cyan'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      badge: 'GPT-4o / GPT-4o-mini',
      description: 'Industry standard vision & reasoning. Supply your OpenAI API key.',
      color: 'emerald'
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      badge: 'Claude 3.5 Sonnet',
      description: 'Exceptional scientific reasoning and deep manuscript discussion.',
      color: 'amber'
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      badge: 'Unified Multi-Model',
      description: 'Access 200+ models (DeepSeek, Llama 3, Claude, Gemini) with one key.',
      color: 'purple'
    },
    {
      id: 'custom',
      name: 'Custom OpenAI-Compatible',
      badge: 'v1 / Groq / Together',
      description: 'Connect any OpenAI v1 compatible proxy, Groq, Mistral, or self-hosted vLLM.',
      color: 'blue'
    },
    {
      id: 'ollama',
      name: 'Local Ollama',
      badge: '100% Offline / Private',
      description: 'Run completely offline on your own GPU/CPU with no API keys.',
      color: 'teal'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-700 text-cyan-400">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">AI Engine & API Key Configuration</h3>
              <p className="text-xs text-gray-400">Choose your preferred engine and enter your own API key or run locally</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm text-gray-300">
          
          {/* Provider Selection Grid */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Select AI Engine / Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {providersList.map((p) => {
                const isSelected = config.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setConfig(prev => ({ ...prev, provider: p.id }));
                      if (p.id === 'ollama' && models.length === 0) {
                        handleScanModels(hostInput);
                      }
                    }}
                    className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-md'
                        : 'border-gray-800 bg-gray-850/60 hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{p.name}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                        )}
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                        {p.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Form based on Active Provider */}
          
          {/* 1. Google Gemini Provider Settings */}
          {config.provider === 'gemini' && (
            <div className="p-4 bg-gray-850 rounded-lg border border-cyan-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-cyan-400" />
                  Google Gemini Configuration
                </h4>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  Get a Free Gemini Key →
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Your Gemini API Key
                </label>
                <div className="relative">
                  <input
                    type={showKeyToggle['gemini'] ? 'text' : 'password'}
                    value={config.geminiApiKey || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, geminiApiKey: e.target.value.trim() }))}
                    placeholder="Enter your AI Studio API key (AIzaSy...)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white font-mono text-xs focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="absolute right-2 top-2 text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700"
                  >
                    {showKeyToggle['gemini'] ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Your key is saved locally in your browser. Leave empty to use system default.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Model Name
                </label>
                <select
                  value={config.geminiModel || 'gemini-3.8-flash'}
                  onChange={(e) => setConfig(prev => ({ ...prev, geminiModel: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (AI Studio Default, Fast & Multimodal)</option>
                  <option value="gemini-flash-latest">gemini-flash-latest (Always Points to Latest Flash)</option>
                  <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Advanced STEM Reasoning)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra Lightweight)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </select>
              </div>

              {/* Troubleshooting Note for 404 NOT_FOUND */}
              <div className="p-2.5 bg-gray-900/80 rounded-lg border border-gray-700/80 text-[11px] text-gray-300 space-y-1">
                <span className="font-semibold text-cyan-400 flex items-center gap-1">
                  ℹ️ Google AI Studio Default Models
                </span>
                <p className="text-gray-400 leading-relaxed">
                  The default model is <strong className="text-cyan-300 font-mono">gemini-3.8-flash</strong> (with automatic fallback to <strong className="text-cyan-300 font-mono">gemini-flash-latest</strong>), matching current Google AI Studio standards.
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-400">
                  <li>If your custom API key returns <code className="text-amber-400">404 NOT_FOUND</code>, verify that the <strong className="text-gray-200">Generative Language API</strong> is turned ON for your Google Cloud project.</li>
                  <li>Alternatively, generate a free direct AI Studio API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 underline">aistudio.google.com/app/apikey</a>.</li>
                  <li>You can also leave the API key blank to use the application environment default, or switch providers to <strong className="text-gray-200">OpenAI, Claude, or Ollama</strong> above.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 2. OpenAI Provider Settings */}
          {config.provider === 'openai' && (
            <div className="p-4 bg-gray-850 rounded-lg border border-emerald-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <RobotIcon className="w-4 h-4 text-emerald-400" />
                  OpenAI Configuration
                </h4>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  Get OpenAI Key →
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  OpenAI API Key <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeyToggle['openai'] ? 'text' : 'password'}
                    value={config.openaiApiKey || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                    placeholder="sk-proj-..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-2 top-2 text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700"
                  >
                    {showKeyToggle['openai'] ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  OpenAI Model
                </label>
                <select
                  value={config.openaiModel || 'gpt-4o'}
                  onChange={(e) => setConfig(prev => ({ ...prev, openaiModel: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                >
                  <option value="gpt-4o">gpt-4o (Multimodal Vision & High Accuracy)</option>
                  <option value="gpt-4o-mini">gpt-4o-mini (Lightweight & Economical)</option>
                  <option value="chatgpt-4o-latest">chatgpt-4o-latest</option>
                  <option value="o1">o1 (Deep Reasoning)</option>
                </select>
              </div>
            </div>
          )}

          {/* 3. Anthropic Claude Settings */}
          {config.provider === 'claude' && (
            <div className="p-4 bg-gray-850 rounded-lg border border-amber-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                  Anthropic Claude Configuration
                </h4>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-400 hover:underline"
                >
                  Get Claude Key →
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Anthropic API Key <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeyToggle['claude'] ? 'text' : 'password'}
                    value={config.claudeApiKey || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, claudeApiKey: e.target.value }))}
                    placeholder="sk-ant-api03-..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white font-mono text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('claude')}
                    className="absolute right-2 top-2 text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700"
                  >
                    {showKeyToggle['claude'] ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Claude Model
                </label>
                <select
                  value={config.claudeModel || 'claude-3-5-sonnet-20241022'}
                  onChange={(e) => setConfig(prev => ({ ...prev, claudeModel: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                >
                  <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 (State of the Art Vision)</option>
                  <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 (Super Fast)</option>
                  <option value="claude-3-opus-20240229">claude-3-opus-20240229 (Complex Theory)</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. OpenRouter Settings */}
          {config.provider === 'openrouter' && (
            <div className="p-4 bg-gray-850 rounded-lg border border-purple-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ServerIcon className="w-4 h-4 text-purple-400" />
                  OpenRouter Multi-Model Configuration
                </h4>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-purple-400 hover:underline"
                >
                  Get OpenRouter Key →
                </a>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  OpenRouter API Key <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeyToggle['openrouter'] ? 'text' : 'password'}
                    value={config.openrouterApiKey || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openrouter')}
                    className="absolute right-2 top-2 text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700"
                  >
                    {showKeyToggle['openrouter'] ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Model ID (any vision-capable model on OpenRouter)
                </label>
                <input
                  type="text"
                  value={config.openrouterModel || 'openai/gpt-4o'}
                  onChange={(e) => setConfig(prev => ({ ...prev, openrouterModel: e.target.value }))}
                  placeholder="e.g. openai/gpt-4o, anthropic/claude-3.5-sonnet, google/gemini-2.5-flash"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* 5. Custom OpenAI-Compatible Base URL */}
          {config.provider === 'custom' && (
            <div className="p-4 bg-gray-850 rounded-lg border border-blue-900/60 space-y-4">
              <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <ServerIcon className="w-4 h-4 text-blue-400" />
                Custom OpenAI-Compatible Endpoint (Groq, Together, vLLM, DeepSeek)
              </h4>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Base URL Endpoint <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={config.customBaseUrl || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, customBaseUrl: e.target.value }))}
                  placeholder="e.g. https://api.groq.com/openai/v1 or https://api.together.xyz/v1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  API Key / Token <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showKeyToggle['custom'] ? 'text' : 'password'}
                    value={config.customApiKey || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                    placeholder="Enter your API token"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16 text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('custom')}
                    className="absolute right-2 top-2 text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded bg-gray-700"
                  >
                    {showKeyToggle['custom'] ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={config.customModel || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, customModel: e.target.value }))}
                  placeholder="e.g. llama-3.2-11b-vision-preview or qwen-vl-max"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* 6. Local Ollama Settings */}
          {config.provider === 'ollama' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-850 rounded-lg border border-emerald-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ServerIcon className="w-4 h-4 text-emerald-400" />
                    Ollama Server Endpoint
                  </h4>
                  <span className="text-xs text-gray-400">Port 11434</span>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={hostInput}
                      onChange={(e) => setHostInput(e.target.value)}
                      placeholder="e.g. http://localhost:11434 or /ollama"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleScanModels(hostInput)}
                      disabled={isScanning || !hostInput.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <RefreshIcon className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? 'Scanning...' : 'Scan Models'}
                    </button>
                  </div>

                  {connectionStatus.tested && (
                    <div className="flex items-center gap-2 pt-1">
                      {connectionStatus.ok ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircleIcon className="w-4 h-4" />
                          <span>Connected to Ollama {connectionStatus.version ? `v${connectionStatus.version}` : ''}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-rose-400">
                          <span>Connection Error: {connectionStatus.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Models List for Ollama */}
              {models.length > 0 && (
                <div className="p-4 bg-gray-850 rounded-lg border border-gray-800 space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Model Assignment ({models.length} installed models detected)
                  </h4>

                  <div>
                    <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <EyeIcon className="w-4 h-4 text-cyan-400" />
                      Vision Model (for Micrograph Analysis)
                    </label>
                    <select
                      value={config.ollamaVisionModel || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, ollamaVisionModel: e.target.value }))}
                      className="w-full bg-gray-800 border-2 border-cyan-500/60 rounded-lg p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                    >
                      <option value="" disabled>-- Select a model --</option>
                      {models.map(m => (
                        <option key={m.name} value={m.name}>
                          {m.name} {m.isVision ? '👁️ [Vision Tagged]' : '[Text/General]'} — {formatSize(m.size)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <RobotIcon className="w-4 h-4 text-emerald-400" />
                      Text / Manuscript Model
                    </label>
                    <select
                      value={config.ollamaTextModel || config.ollamaVisionModel || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, ollamaTextModel: e.target.value }))}
                      className="w-full bg-gray-800 border-2 border-emerald-500/60 rounded-lg p-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                    >
                      <option value="" disabled>-- Select a model --</option>
                      {models.map(m => (
                        <option key={m.name} value={m.name}>
                          {m.name} {m.isVision ? '👁️ [Vision & Text]' : '[Text Only]'} — {formatSize(m.size)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-850 flex items-center justify-between">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span>Current: <strong className="text-white uppercase font-mono">{config.provider}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-gray-950 transition-colors flex items-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              {saveFeedback ? (
                <>
                  <CheckCircleIcon className="w-4 h-4 text-gray-950" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Apply Engine & Keys</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OllamaSettingsModal;
