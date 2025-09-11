'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2, AlertCircle, Check, Package } from 'lucide-react';
import { ragChat } from '@/app/actions/ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: Date;
  loading?: boolean;
}

export default function RAGChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I can help you classify hazardous materials. Try asking me about:\n\n• Chemical classifications (e.g., "What is the UN number for sulfuric acid 98%?")\n• Shipping requirements (e.g., "How to ship hydrochloric acid?")\n• Safety information (e.g., "Is sodium hydroxide 50% hazardous?")',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: Date.now().toString() + '-loading',
      role: 'assistant',
      content: 'Searching database...',
      timestamp: new Date(),
      loading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Call RAG server action
      const result = await ragChat({ query: input });

      // Remove loading message and add response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, {
          id: Date.now().toString(),
          role: 'assistant',
          content: formatResponse(result),
          data: result,
          timestamp: new Date()
        }];
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.loading);
        return [...filtered, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        }];
      });
    } finally {
      setLoading(false);
    }
  };

  const formatResponse = (data: any) => {
    if (!data.success) {
      return data.error || 'Unable to process your request.';
    }

    if (data.classification) {
      const c = data.classification;
      let response = '';
      
      if (c.un_number) {
        response = `**${c.un_number}** - ${c.proper_shipping_name || 'Chemical substance'}\n\n`;
        response += `• **Hazard Class:** ${c.hazard_class}\n`;
        if (c.packing_group) {
          response += `• **Packing Group:** ${c.packing_group}\n`;
        }
        if (c.labels) {
          response += `• **Labels Required:** ${c.labels}\n`;
        }
        if (c.erg_guide) {
          response += `• **ERG Guide:** ${c.erg_guide}\n`;
        }
        response += `\n*Confidence: ${Math.round((c.confidence || 0) * 100)}%*`;
      } else {
        response = '✅ **Non-Regulated Material**\n\n';
        if (c.exemption_reason) {
          response += c.exemption_reason;
        } else {
          response += 'This material is not classified as dangerous goods.';
        }
      }
      
      return response;
    }

    if (data.results && data.results.length > 0) {
      let response = `Found ${data.results.length} relevant result(s):\n\n`;
      data.results.slice(0, 3).forEach((r: any, i: number) => {
        response += `${i + 1}. **${r.text}**\n`;
        if (r.metadata?.unNumber) {
          response += `   UN: ${r.metadata.unNumber}, Class: ${r.metadata.hazardClass || 'N/A'}\n`;
        }
        response += '\n';
      });
      return response;
    }

    return data.message || 'No results found.';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Example queries
  const exampleQueries = [
    'Sulfuric acid 98%',
    'Sodium hydroxide 50%',
    'Is acetone hazardous?',
    'UN1830 shipping requirements'
  ];

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Open RAG Chat"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Package size={20} />
              Hazmat Classification Assistant
            </h3>
            <p className="text-sm opacity-90">Powered by Database RAG</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      <span>{message.content}</span>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      {message.content.split('\n').map((line, i) => {
                        // Convert markdown-like formatting
                        let formatted = line;
                        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
                        formatted = formatted.replace(/^• (.*)/, '• $1');
                        
                        return (
                          <div key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
                        );
                      })}
                    </div>
                  )}
                  {message.data?.classification?.confidence && (
                    <div className="mt-2 flex items-center gap-1 text-xs opacity-75">
                      <Check size={12} />
                      <span>{Math.round(message.data.classification.confidence * 100)}% confidence</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Example Queries */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-500 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((query) => (
                  <button
                    key={query}
                    onClick={() => setInput(query)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded transition-colors"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about chemical classifications..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}