'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HiPaperAirplane, HiSparkles, HiBeaker, HiTruck, HiExclamation, HiInformationCircle } from 'react-icons/hi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
  usage?: any;
  timestamp: Date;
}

export default function HazmatChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          })),
          ragLimit: 5
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
        usage: data.usage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQuestions = [
    "What are the shipping requirements for UN1830?",
    "How do I package corrosive liquids?",
    "What's the emergency response for sulfuric acid spills?",
    "What placards do I need for Class 8 materials?",
    "What are the highway transportation rules for hazmat?"
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-4">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HiBeaker className="text-blue-500" />
                Hazmat Assistant
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Powered by GPT-5 nano + RAG with CFR regulations, HMT, and ERG guides
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800">
                <HiSparkles className="mr-1 h-3 w-3" />
                GPT-5 nano
              </Badge>
              <Badge variant="default" className="bg-blue-100 text-blue-800">
                3,474 docs
              </Badge>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Messages */}
        <Card className="mb-4 h-[500px] overflow-hidden flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <HiTruck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Ask me about hazmat shipping
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  I can help with regulations, classifications, emergency response, and more
                </p>
                <div className="space-y-2">
                  {exampleQuestions.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(question)}
                      className="block w-full text-left px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      
                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs font-medium mb-2 opacity-70">Sources:</p>
                          <div className="space-y-1">
                            {message.sources.slice(0, 3).map((source, j) => (
                              <div key={j} className="text-xs opacity-60">
                                <Badge variant="secondary" className="mr-1 text-xs">
                                  {source.source}
                                </Badge>
                                {source.metadata?.section && (
                                  <span>§{source.metadata.section}</span>
                                )}
                                <span className="ml-1">({source.score})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Usage */}
                      {message.usage && (
                        <div className="mt-2 text-xs opacity-60">
                          {message.usage.totalTokens} tokens • {message.usage.estimatedCost}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                      <Spinner size="sm" />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </CardContent>
          
          {/* Input */}
          <div className="border-t p-4">
            {error && (
              <Alert className="mb-2 border-red-500 bg-red-50">
                <HiExclamation className="h-4 w-4 text-red-600" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about hazmat shipping, regulations, emergency response..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                variant="default"
              >
                <HiPaperAirplane className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Info */}
        <Alert className="border-blue-500 bg-blue-50">
          <HiInformationCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="text-sm">
              <strong>Knowledge Base:</strong> CFR Title 49 (539 sections) • HMT (2,470 entries) • ERG guides • Your products
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
