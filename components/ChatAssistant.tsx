
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { streamChatResponse } from '../services/geminiService';
import { SendIcon, UserIcon, RobotIcon } from './icons';
import { ScientificMarkdownRenderer } from './ScientificMarkdownRenderer';

interface ChatAssistantProps {
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  analysisContext: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ chatHistory, setChatHistory, analysisContext }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);
  
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const newUserMessage: ChatMessage = { role: 'user', content: input };
    const updatedHistory = [...chatHistory, newUserMessage];
    setChatHistory(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
        const stream = await streamChatResponse(updatedHistory, analysisContext);
        let fullResponse = '';
        setChatHistory(prev => [...prev, { role: 'model', content: '' }]);

        for await (const chunk of stream) {
            const chunkText = chunk.text;
            fullResponse += chunkText;
            setChatHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1].content = fullResponse;
                return newHistory;
            });
        }
    } catch (error) {
        console.error('Chat error:', error);
        const errorMessage: ChatMessage = { role: 'model', content: 'Sorry, I encountered an error. Please try again.' };
        setChatHistory(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg flex flex-col h-[40rem]">
      <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'model' && <RobotIcon className="w-8 h-8 flex-shrink-0 text-cyan-400 mt-1" />}
            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-cyan-800 text-white' : 'bg-gray-700 text-gray-200'}`}>
               <ScientificMarkdownRenderer content={msg.content} />
               {isLoading && msg.role === 'model' && index === chatHistory.length - 1 && <span className="inline-block w-2 h-2 ml-2 bg-white rounded-full animate-pulse"></span>}
            </div>
            {msg.role === 'user' && <UserIcon className="w-8 h-8 flex-shrink-0 text-cyan-400 mt-1" />}
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about the report..."
            disabled={isLoading}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold p-2 rounded-md transition-colors duration-300"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
