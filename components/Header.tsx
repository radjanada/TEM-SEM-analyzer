import React from 'react';
import { MicroscopeIcon, CogIcon, SparklesIcon, RobotIcon } from './icons';
import { AIServiceConfig } from '../types';

interface HeaderProps {
  aiConfig?: AIServiceConfig;
  onOpenSettings?: () => void;
}

const Header: React.FC<HeaderProps> = ({ aiConfig, onOpenSettings }) => {
  const provider = aiConfig?.provider || 'gemini';
  const isOllama = provider === 'ollama';

  const getProviderLabel = () => {
    switch (provider) {
      case 'openai':
        return `OpenAI: ${aiConfig?.openaiModel || 'gpt-4o'}`;
      case 'claude':
        return `Claude: ${aiConfig?.claudeModel?.includes('sonnet') ? 'Sonnet' : 'Claude'}`;
      case 'openrouter':
        return `OpenRouter: ${aiConfig?.openrouterModel?.split('/')?.[1] || 'Multi'}`;
      case 'custom':
        return `Custom API: ${aiConfig?.customModel || 'v1'}`;
      case 'ollama':
        return `Ollama: ${aiConfig?.ollamaVisionModel || 'Local'}`;
      case 'gemini':
      default:
        return aiConfig?.geminiApiKey ? 'Gemini (BYO Key)' : 'Engine: Gemini';
    }
  };

  const getBadgeClasses = () => {
    switch (provider) {
      case 'openai':
        return 'bg-emerald-950/40 border-emerald-700/70 text-emerald-200 hover:bg-emerald-900/50';
      case 'claude':
        return 'bg-amber-950/40 border-amber-700/70 text-amber-200 hover:bg-amber-900/50';
      case 'openrouter':
        return 'bg-purple-950/40 border-purple-700/70 text-purple-200 hover:bg-purple-900/50';
      case 'custom':
        return 'bg-blue-950/40 border-blue-700/70 text-blue-200 hover:bg-blue-900/50';
      case 'ollama':
        return 'bg-teal-950/40 border-teal-700/70 text-teal-200 hover:bg-teal-900/50';
      default:
        return 'bg-cyan-950/40 border-cyan-700/70 text-cyan-200 hover:bg-cyan-900/50';
    }
  };

  const getPingColor = () => {
    switch (provider) {
      case 'openai': return 'bg-emerald-400';
      case 'claude': return 'bg-amber-400';
      case 'openrouter': return 'bg-purple-400';
      case 'custom': return 'bg-blue-400';
      case 'ollama': return 'bg-teal-400';
      default: return 'bg-cyan-400';
    }
  };

  return (
    <header className="p-4 rounded-xl bg-gray-800/80 border border-gray-700/80 backdrop-blur shadow-lg">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="p-2.5 bg-cyan-950/60 rounded-xl border border-cyan-800/50 shadow-inner flex-shrink-0">
            <MicroscopeIcon className="w-10 h-10 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              TEM/SEM Image Analysis Tool
            </h1>
            <p className="mt-1 text-sm text-gray-300">
              AI-powered nanoparticle, crystal facet, and morphology interpretation from microscopy images.
            </p>
          </div>
        </div>

        {/* AI Engine & Settings Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSettings}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2.5 transition-all shadow-sm ${getBadgeClasses()}`}
            title="Configure AI Engine (Gemini, OpenAI, Claude, OpenRouter, Custom, or Local Ollama)"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getPingColor()}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${getPingColor()}`}></span>
            </span>

            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              {isOllama ? (
                <RobotIcon className="w-4 h-4 text-teal-400" />
              ) : (
                <SparklesIcon className="w-4 h-4 text-cyan-400" />
              )}
              <span>{getProviderLabel()}</span>
            </span>

            <span className="h-3 w-px bg-gray-600 mx-0.5"></span>
            
            <span className="flex items-center gap-1 text-gray-300 hover:text-white">
              <CogIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
