'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  HiPaperAirplane, HiSparkles, HiBeaker, HiTruck, HiExclamation, 
  HiInformationCircle, HiDownload, HiBookmark, HiMicrophone,
  HiOutlineClipboardCopy, HiOutlineMoon, HiOutlineSun,
  HiOutlineTrash, HiOutlineRefresh, HiChevronDown, HiChevronUp,
  HiOutlineSearch, HiLightningBolt, HiOutlineBookOpen
} from 'react-icons/hi';

interface Source {
  source: string;
  score: string;
  snippet?: string;
  metadata?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Source[];
  usage?: any;
  timestamp: Date;
  isBookmarked?: boolean;
  rating?: 'good' | 'bad' | null;
}

interface QuickAction {
  icon: React.ElementType;
  label: string;
  prompt: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    icon: HiExclamation,
    label: 'Emergency Response',
    prompt: 'What is the emergency response procedure for a chemical spill?',
    color: 'red'
  },
  {
    icon: HiTruck,
    label: 'Shipping Requirements',
    prompt: 'What are the DOT shipping requirements for Class 8 corrosive materials?',
    color: 'blue'
  },
  {
    icon: HiBeaker,
    label: 'UN Classification',
    prompt: 'How do I determine the UN number for a chemical product?',
    color: 'green'
  },
  {
    icon: HiBookmark,
    label: 'Packaging Groups',
    prompt: 'Explain the differences between Packing Groups I, II, and III',
    color: 'purple'
  },
  {
    icon: HiLightningBolt,
    label: 'Placarding Rules',
    prompt: 'What placards are required for a mixed load of hazmat?',
    color: 'yellow'
  }
];

export default function HazmatChatworldPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSources, setShowSources] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load saved conversations from localStorage
    const saved = localStorage.getItem('hazmat-chatworld-messages');
    if (saved) {
      const parsed = JSON.parse(saved);
      setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('hazmat-chatworld-theme');
    setIsDarkMode(savedTheme === 'dark');
  }, []);

  useEffect(() => {
    // Save messages to localStorage
    if (messages.length > 0) {
      localStorage.setItem('hazmat-chatworld-messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    // Apply theme
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hazmat-chatworld-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hazmat-chatworld-theme', 'light');
    }
  }, [isDarkMode]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    if (!messageText) setInput('');
    setError(null);

    // Add user message
    const newUserMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/hazmat-chatworld/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          })),
          model: process.env.NEXT_PUBLIC_LLM_MODEL || 'gpt-5-nano-2025-08-07'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}-ai`,
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const toggleBookmark = (messageId: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, isBookmarked: !m.isBookmarked } : m
    ));
  };

  const rateMessage = (messageId: string, rating: 'good' | 'bad') => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, rating: m.rating === rating ? null : rating } : m
    ));
  };

  const exportConversation = () => {
    const dataStr = JSON.stringify(messages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `hazmat-chat-${new Date().toISOString()}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearConversation = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      setMessages([]);
      localStorage.removeItem('hazmat-chatworld-messages');
    }
  };

  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const bookmarkedMessages = messages.filter(m => m.isBookmarked);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'} p-4 transition-all duration-300`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-0 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <HiBeaker className="text-blue-500" />
                Hazmat Chatworld
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Powered by GPT-5 nano (2025-08-07) • World-class hazmat assistance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="success" size="sm" className="px-3 py-1">
                <HiSparkles className="mr-1 h-3 w-3" />
                GPT-5 nano
              </Badge>
              <Badge color="info" size="sm" className="px-3 py-1">
                400K context
              </Badge>
              <Button
                size="xs"
                color="gray"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2"
              >
                {isDarkMode ? <HiOutlineSun className="h-4 w-4" /> : <HiOutlineMoon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              size="xs"
              color={action.color as any}
              onClick={() => sendMessage(action.prompt)}
              disabled={isLoading}
              className="flex-shrink-0 transition-transform hover:scale-105"
            >
              <action.icon className="mr-1 h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="h-[600px] overflow-hidden flex flex-col bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-0 shadow-xl">
              {/* Chat Toolbar */}
              <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <Button size="xs" color="gray" onClick={() => setShowSearch(!showSearch)}>
                    <HiOutlineSearch className="h-4 w-4" />
                  </Button>
                  <Button size="xs" color="gray" onClick={exportConversation}>
                    <HiDownload className="h-4 w-4" />
                  </Button>
                  <Button size="xs" color="gray" onClick={clearConversation}>
                    <HiOutlineTrash className="h-4 w-4" />
                  </Button>
                </div>
                {showSearch && (
                  <Input
                    type="text"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 h-8"
                  />
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="relative mx-auto w-32 h-32 mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse opacity-20"></div>
                      <HiTruck className="relative mx-auto h-32 w-32 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Welcome to Hazmat Chatworld
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Your AI-powered assistant for hazardous materials shipping, regulations, and emergency response
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                      {[
                        "What are the shipping requirements for UN1830?",
                        "How do I package corrosive liquids?",
                        "Emergency response for sulfuric acid spills",
                        "What placards do I need for Class 8?"
                      ].map((q, i) => (
                        <button
                          key={i}
                          onClick={() => setInput(q)}
                          className="text-left px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg hover:shadow-md transition-all text-sm"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {filteredMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-4 shadow-lg transition-all hover:shadow-xl ${
                            message.role === 'user'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          {/* Message Actions */}
                          {message.role === 'assistant' && (
                            <div className="flex items-center justify-end gap-2 mb-2">
                              <button
                                onClick={() => copyToClipboard(message.content)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                              >
                                <HiOutlineClipboardCopy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => toggleBookmark(message.id)}
                                className={`p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded ${
                                  message.isBookmarked ? 'text-yellow-500' : ''
                                }`}
                              >
                                <HiBookmark className="h-4 w-4" />
                              </button>
                            </div>
                          )}

                          <div className="whitespace-pre-wrap">{message.content}</div>
                          
                          {/* Sources */}
                          {message.sources && message.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <button
                                onClick={() => setShowSources(prev => ({
                                  ...prev,
                                  [message.id]: !prev[message.id]
                                }))}
                                className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100"
                              >
                                {showSources[message.id] ? <HiChevronUp /> : <HiChevronDown />}
                                Sources ({message.sources.length})
                              </button>
                              {showSources[message.id] && (
                                <div className="mt-2 space-y-1">
                                  {message.sources.map((source, j) => (
                                    <div key={j} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                      <Badge color="gray" size="xs" className="mr-2">
                                        {source.source}
                                      </Badge>
                                      {source.metadata?.section && (
                                        <span className="font-mono">§{source.metadata.section}</span>
                                      )}
                                      <span className="ml-2 text-gray-500">Score: {source.score}</span>
                                      {source.snippet && (
                                        <p className="mt-1 text-gray-600 dark:text-gray-400">{source.snippet}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Usage Stats */}
                          {message.usage && (
                            <div className="mt-2 text-xs opacity-60">
                              {message.usage.totalTokens} tokens • {message.usage.estimatedCost}
                            </div>
                          )}

                          {/* Timestamp */}
                          <div className="mt-2 text-xs opacity-50">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white dark:bg-gray-700 rounded-2xl p-4 shadow-lg">
                          <div className="flex items-center gap-2">
                            <Spinner size="sm" />
                            <span className="text-gray-600 dark:text-gray-400">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="border-t dark:border-gray-700 p-4">
                {error && (
                  <Alert color="failure" className="mb-3">
                    <HiExclamation className="mr-2 h-4 w-4" />
                    {error}
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
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isLoading}
                    color="blue"
                    className="transition-transform hover:scale-105"
                  >
                    <HiPaperAirplane className="h-5 w-5" />
                  </Button>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Press Enter to send • Shift+Enter for new line
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Model Info */}
            <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-0 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <HiSparkles className="text-yellow-500" />
                Model Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Model</span>
                  <span className="font-mono">gpt-5-nano</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Context</span>
                  <span>400K tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Max Output</span>
                  <span>128K tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Input Cost</span>
                  <span className="text-green-600">$0.05/1M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Output Cost</span>
                  <span className="text-blue-600">$0.40/1M</span>
                </div>
              </div>
            </Card>

            {/* Bookmarks */}
            {bookmarkedMessages.length > 0 && (
              <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-0 shadow-xl">
                <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <HiBookmark className="text-yellow-500" />
                  Bookmarks
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {bookmarkedMessages.map((msg) => (
                    <div key={msg.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                      <p className="truncate">{msg.content}</p>
                      <span className="text-xs text-gray-500">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Knowledge Base */}
            <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-0 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <HiOutlineBookOpen className="text-blue-500" />
                Knowledge Base
              </h3>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <strong>CFR Title 49</strong>
                  <span className="text-xs text-gray-600 dark:text-gray-400 block">539 sections</span>
                </div>
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <strong>HMT Database</strong>
                  <span className="text-xs text-gray-600 dark:text-gray-400 block">2,470 entries</span>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                  <strong>ERG Guides</strong>
                  <span className="text-xs text-gray-600 dark:text-gray-400 block">Complete 2024 edition</span>
                </div>
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                  <strong>Your Products</strong>
                  <span className="text-xs text-gray-600 dark:text-gray-400 block">Custom classifications</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer Info */}
        <Alert color="info" icon={HiInformationCircle} className="mt-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg">
          <div className="text-sm">
            <strong>GPT-5 nano (2025-08-07)</strong> • 80% cheaper than GPT-4o-mini • 400K context window • May 31, 2024 knowledge cutoff
          </div>
        </Alert>
      </div>
    </div>
  );
}