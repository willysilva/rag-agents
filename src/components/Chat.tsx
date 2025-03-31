"use client";

import { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

interface Agent {
  _id: string;
  name: string;
  description: string;
  avatarUrl?: string;
}

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carregar a lista de agentes disponíveis
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setAgentsLoading(true);
        const res = await fetch('/api/agents');
        
        if (!res.ok) {
          throw new Error('Falha ao carregar agentes');
        }
        
        const data = await res.json();
        setAgents(data.data || []);
        
        // Selecionar o primeiro agente por padrão se existir
        if (data.data && data.data.length > 0) {
          setSelectedAgent(data.data[0]._id);
        }
      } catch (err) {
        console.error('Erro ao buscar agentes:', err);
      } finally {
        setAgentsLoading(false);
      }
    };
    
    fetchAgents();
  }, []);

  // Rolar para o final da lista de mensagens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Foco no input quando o agente é selecionado
  useEffect(() => {
    if (selectedAgent && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedAgent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;
    
    if (!selectedAgent) {
      alert('Por favor, selecione um agente para conversar.');
      return;
    }

    const userMessage = input;
    setInput('');
    
    // Adicionar mensagem do usuário
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    
    setLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          agentId: selectedAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao obter resposta.');
      }

      const data = await response.json();
      
      // Adicionar mensagem do assistente
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response || 'Desculpe, não consegui processar sua pergunta.' },
      ]);
    } catch (error) {
      console.error('Erro ao processar pergunta:', error);
      
      // Adicionar mensagem de erro
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.' },
      ]);
    } finally {
      setLoading(false);
      // Focar no input após enviar a mensagem
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  // Obter o agente selecionado
  const getSelectedAgentName = () => {
    if (!selectedAgent) return 'Selecione um agente';
    const agent = agents.find(a => a._id === selectedAgent);
    return agent ? agent.name : 'Agente não encontrado';
  };

  // Obter informações do agente selecionado
  const getSelectedAgentInfo = () => {
    if (!selectedAgent) return null;
    return agents.find(a => a._id === selectedAgent);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg h-[calc(100vh-180px)] flex flex-col overflow-hidden border border-gray-200">
      {/* Header do chat com seleção de agente */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center">
          <ChatBubbleLeftIcon className="h-5 w-5 mr-2" />
          Assistente IA
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-white/90">Agente:</span>
          <select
            className="bg-white/10 border border-white/20 rounded-md text-sm py-1 px-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer backdrop-blur-sm"
            value={selectedAgent || ''}
            onChange={(e) => setSelectedAgent(e.target.value)}
            disabled={agentsLoading}
          >
            {agentsLoading ? (
              <option>Carregando agentes...</option>
            ) : agents.length === 0 ? (
              <option value="">Nenhum agente disponível</option>
            ) : (
              <>
                <option value="">Selecione um agente</option>
                {agents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>
      
      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md p-6 bg-white rounded-xl shadow-sm border border-gray-100">
              {selectedAgent ? (
                <>
                  <div className="bg-blue-100 rounded-full p-3 inline-flex mb-3">
                    <ChatBubbleLeftIcon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    Converse com {getSelectedAgentName()}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {getSelectedAgentInfo()?.description || 'Faça perguntas com base nos documentos do agente.'}
                  </p>
                  <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded-lg">
                    As respostas serão baseadas exclusivamente nos documentos fornecidos ao agente.
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-100 rounded-full p-3 inline-flex mb-3">
                    <UserCircleIcon className="h-6 w-6 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    Selecione um agente para começar
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    Escolha um dos agentes disponíveis para iniciar uma conversa.
                  </p>
                  <div className="text-xs bg-amber-50 text-amber-600 p-2 rounded-lg">
                    Cada agente é especializado em um conjunto específico de documentos.
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-white text-gray-800 border border-gray-200 shadow-sm">
              <div className="flex space-x-2 items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input para digitar mensagem */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 bg-white">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder={agents.length === 0 ? "Você precisa criar agentes primeiro" : selectedAgent ? `Pergunte ao ${getSelectedAgentName()}...` : "Selecione um agente para conversar..."}
            disabled={loading || !selectedAgent || agents.length === 0}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-lg px-4 py-2.5 font-medium focus:outline-none hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center"
            disabled={loading || !input.trim() || !selectedAgent || agents.length === 0}
          >
            <PaperAirplaneIcon className="h-5 w-5 mr-1" />
            <span>Enviar</span>
          </button>
        </div>
      </form>
    </div>
  );
} 