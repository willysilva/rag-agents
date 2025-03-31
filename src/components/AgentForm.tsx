'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Eye, X, Plus, Trash2, Edit3, Check, AlertTriangle } from 'lucide-react';
import AgentApiDocs from './AgentApiDocs';

interface ApiTokenInfo {
  _id: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

interface AgentFormData {
  name: string;
  description: string;
  avatarUrl: string;
  systemPrompt: string;
  isActive: boolean;
  apiKey: string;
  temperature: number;
  rateLimit: {
    requests: number | string;
    windowSeconds: number | string;
  };
}

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 relative" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">{title}</h2>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default function AgentForm({ agentId }: AgentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenList, setTokenList] = useState<ApiTokenInfo[]>([]);
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [showNewTokenInput, setShowNewTokenInput] = useState(false);
  const [lastGeneratedToken, setLastGeneratedToken] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [apiUrlBase, setApiUrlBase] = useState('');
  
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    description: '',
    avatarUrl: '',
    systemPrompt: `Você é um assistente útil e amigável. Seu objetivo é fornecer respostas precisas baseadas nas informações disponíveis.

Contexto:
{context}

Pergunta do usuário: {question}

Ao fornecer sua resposta, considere o seguinte:
1. Responda usando apenas informações do contexto fornecido.
2. Se a informação no contexto não for suficiente, diga que você não tem informações suficientes.
3. Seja conciso e direto em suas respostas.
4. Não invente informações que não estejam no contexto.
5. Forneça uma resposta completa com todos os detalhes relevantes do documento.
6. Não trunce nem abrevie sua resposta, desenvolva-a completamente.
7. IMPORTANTE: Cite as fontes de informação incluindo os números dos documentos entre colchetes [Doc X] ao final de cada afirmação relevante da sua resposta.

Resposta:`,
    isActive: true,
    apiKey: '',
    temperature: 0.7,
    rateLimit: {
      requests: '',
      windowSeconds: '',
    },
  });

  const isEditing = !!agentId;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setApiUrlBase(window.location.origin);
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    if (!isEditing) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/tokens`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha ao carregar tokens');
      }
      const { data } = await res.json();
      setTokenList(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar tokens:", err);
      setTokenError(err.message || 'Erro ao carregar tokens.');
      setTokenList([]);
    } finally {
      setTokenLoading(false);
    }
  }, [agentId, isEditing]);

  useEffect(() => {
    const fetchAgentData = async () => {
      setFetchLoading(true);
      try {
        const res = await fetch(`/api/agents/${agentId}/edit-details`);
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Falha ao carregar dados do agente');
        }
        
        const { data } = await res.json();
        
        setFormData({
          name: data.name || '',
          description: data.description || '',
          avatarUrl: data.avatarUrl || '',
          systemPrompt: data.systemPrompt || formData.systemPrompt,
          isActive: data.isActive !== false,
          apiKey: data.apiKey || '',
          temperature: data.temperature ?? 0.7,
          rateLimit: {
            requests: data.rateLimit?.requests ?? '',
            windowSeconds: data.rateLimit?.windowSeconds ?? '',
          },
        });
        fetchTokens();
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados');
        console.error('Erro ao buscar agente:', err);
      } finally {
        setFetchLoading(false);
      }
    };

    if (isEditing) {
      fetchAgentData();
    }
  }, [agentId, isEditing, fetchTokens]);

  const handleNestedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const [parent, child] = name.split('.');
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev as any)[parent],
        [child]: value === '' ? '' : Number(value)
      }
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.includes('.')) {
      handleNestedChange(e as React.ChangeEvent<HTMLInputElement>);
      return;
    }
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      });
    } else if (type === 'range' || type === 'number') {
       setFormData({
        ...formData,
        [name]: value === '' ? '' : Number(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleGenerateToken = async () => {
    if (!newTokenLabel.trim() || !agentId) return;
    setTokenLoading(true);
    setTokenError(null);
    setLastGeneratedToken(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newTokenLabel.trim() })
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Falha ao gerar token');
      }
      setLastGeneratedToken(result.data.token);
      fetchTokens();
      setNewTokenLabel('');
      setShowNewTokenInput(false);
    } catch (err: any) {
      console.error("Erro ao gerar token:", err);
      setTokenError(err.message || 'Erro ao gerar token.');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!agentId || !confirm('Tem certeza que deseja revogar este token? Esta ação não pode ser desfeita.')) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/tokens/${tokenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      });
       const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Falha ao revogar token');
      }
      fetchTokens();
    } catch (err: any) {
      console.error(`Erro ao revogar token ${tokenId}:`, err);
      setTokenError(err.message || 'Erro ao revogar token.');
    } finally {
      setTokenLoading(false);
    }
  };
  
  const handleEditLabel = (token: ApiTokenInfo) => {
    setEditingTokenId(token._id);
    setEditingLabel(token.label);
  };

  const handleCancelEditLabel = () => {
    setEditingTokenId(null);
    setEditingLabel('');
  };

  const handleSaveLabel = async (tokenId: string) => {
    if (!agentId || !editingLabel.trim()) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
       const res = await fetch(`/api/agents/${agentId}/tokens/${tokenId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editingLabel.trim() })
      });
       const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Falha ao salvar label');
      }
      fetchTokens();
      handleCancelEditLabel();
    } catch (err: any) {
      console.error(`Erro ao salvar label do token ${tokenId}:`, err);
      setTokenError(err.message || 'Erro ao salvar label.');
    } finally {
      setTokenLoading(false);
    }
  };
  
  const handleCopyLastToken = () => {
    if (lastGeneratedToken) {
      navigator.clipboard.writeText(lastGeneratedToken);
      setCopiedTokenId('last_generated');
      setTimeout(() => setCopiedTokenId(null), 2000);
    }
  };

  const handleShowDocs = () => {
    setShowDocsModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Start with core formData fields
    const baseDataToSend: Omit<AgentFormData, 'rateLimit'> = {
      name: formData.name,
      description: formData.description,
      avatarUrl: formData.avatarUrl,
      systemPrompt: formData.systemPrompt,
      isActive: formData.isActive,
      apiKey: formData.apiKey,
      temperature: Number(formData.temperature),
    };

    // Prepare rateLimit configuration separately
    const rateLimitConfig: { requests?: number; windowSeconds?: number } = {};
    const reqNum = Number(formData.rateLimit.requests);
    const winSecNum = Number(formData.rateLimit.windowSeconds);

    if (!isNaN(reqNum) && reqNum > 0) {
        rateLimitConfig.requests = reqNum;
    }
    if (!isNaN(winSecNum) && winSecNum > 0) {
        rateLimitConfig.windowSeconds = winSecNum;
    }

    // Conditionally add rateLimit to the final payload
    // Use 'any' temporarily for the payload to allow adding rateLimit conditionally
    let finalPayload: any = { ...baseDataToSend }; 
    if (Object.keys(rateLimitConfig).length > 0) {
        finalPayload.rateLimit = rateLimitConfig;
    } 
    // Now finalPayload has the correct structure, either with or without rateLimit.
    // No need for delete operator here.

    try {
      const url = isEditing ? `/api/agents/${agentId}` : '/api/agents';
      const method = isEditing ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        // Send the constructed payload
        body: JSON.stringify(finalPayload), 
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha ao salvar agente');
      }
      
      router.push('/agents'); // Redirect on success
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar agente');
      console.error('Erro ao salvar agente:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
      if (!dateString) return '-';
      try {
          return new Date(dateString).toLocaleString('pt-BR');
      } catch { return 'Data inválida'; }
  };

  if (fetchLoading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-2">Carregando dados do agente...</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-6">
        {isEditing ? 'Editar Agente' : 'Novo Agente'}
      </h2>
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-1">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nome *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Nome do agente"
            />
          </div>
          
          <div className="md:col-span-1">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Descrição *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Descreva a função deste agente"
            />
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="avatarUrl" className="block text-sm font-medium text-gray-700">
              URL do Avatar (opcional)
            </label>
            <input
              type="url"
              id="avatarUrl"
              name="avatarUrl"
              value={formData.avatarUrl}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="https://exemplo.com/avatar.png"
            />
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700">
              Prompt do Sistema
            </label>
            <textarea
              id="systemPrompt"
              name="systemPrompt"
              value={formData.systemPrompt}
              onChange={handleChange}
              rows={8}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-sm text-gray-500">
              Use {'{context}'} para inserir os documentos recuperados e {'{question}'} para a pergunta do usuário.
            </p>
          </div>
          
          <div className="md:col-span-2 flex items-center">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
              Ativo
            </label>
          </div>

          <div className="md:col-span-2 border-t pt-6 mt-6">
             <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Configurações Avançadas</h3>
          
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="md:col-span-2">
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                    Chave de API Externa (opcional)
                  </label>
                  <input
                    type="password"
                    id="apiKey"
                    name="apiKey"
                    value={formData.apiKey}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="sk-... ou outra chave necessária pelo agente"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Se o agente precisar chamar APIs externas (ex: OpenAI, Google), insira a chave aqui.
                  </p>
                </div>

                <div>
                  <label htmlFor="temperature" className="block text-sm font-medium text-gray-700">
                    Temperatura ({formData.temperature.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    id="temperature"
                    name="temperature"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={handleChange}
                    className="mt-1 block w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                   <p className="mt-1 text-sm text-gray-500">
                    Controla a aleatoriedade da resposta (0=determinístico, 2=mais criativo).
                  </p>
                </div>

                <div className="md:col-span-2 border-t pt-4 mt-4">
                   <p className="text-sm font-medium text-gray-700 mb-2">Limite de Taxa (Opcional)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rateLimit.requests" className="block text-xs text-gray-600">Requisições</label>
                        <input
                          type="number"
                          id="rateLimit.requests"
                          name="rateLimit.requests"
                          value={formData.rateLimit.requests}
                          onChange={handleNestedChange}
                          min="1"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                          placeholder="Ex: 100"
                        />
                      </div>
                      <div>
                        <label htmlFor="rateLimit.windowSeconds" className="block text-xs text-gray-600">Janela (segundos)</label>
                        <input
                          type="number"
                          id="rateLimit.windowSeconds"
                          name="rateLimit.windowSeconds"
                          value={formData.rateLimit.windowSeconds}
                          onChange={handleNestedChange}
                           min="1"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-sm"
                          placeholder="Ex: 60"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Define quantas requisições são permitidas em um determinado período de tempo.</p>
                 </div>

             </div>
          </div>

          {isEditing && (
            <div className="border-t pt-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Gerenciar Tokens de API</h3>
                    <button 
                      type="button"
                      onClick={() => setShowNewTokenInput(true)}
                      disabled={tokenLoading || showNewTokenInput}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        <Plus size={16} className="-ml-1 mr-2" />
                        Gerar Novo Token
                    </button>
                </div>

                {tokenError && (
                    <div className="p-3 mb-4 bg-red-100 text-red-700 rounded text-sm">
                        {tokenError}
                    </div>
                )}
                
                {showNewTokenInput && (
                    <div className="flex items-center space-x-2 mb-4 p-3 bg-gray-50 rounded-md border">
                        <input 
                            type="text"
                            value={newTokenLabel}
                            onChange={(e) => setNewTokenLabel(e.target.value)}
                            placeholder="Digite um nome (label) para o novo token"
                            className="flex-grow block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            disabled={tokenLoading}
                        />
                        <button 
                            type="button" 
                            onClick={handleGenerateToken}
                            disabled={!newTokenLabel.trim() || tokenLoading}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                            {tokenLoading ? 'Gerando...' : 'Gerar'}
                        </button>
                         <button 
                            type="button" 
                            onClick={() => { setShowNewTokenInput(false); setNewTokenLabel(''); }}
                            disabled={tokenLoading}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <X size={18}/>
                        </button>
                    </div>
                )}
                
                 {lastGeneratedToken && (
                    <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md text-sm">
                        <p className="font-medium text-green-800 mb-1">Token gerado com sucesso! Copie-o agora, ele não será mostrado novamente:</p>
                        <div className="flex items-center space-x-2 bg-white p-2 rounded border">
                            <input 
                                type="text"
                                readOnly
                                value={lastGeneratedToken}
                                className="flex-grow font-mono text-xs bg-transparent border-none p-0"
                            />
                            <button
                                type="button"
                                onClick={handleCopyLastToken}
                                className="text-blue-600 hover:text-blue-800 flex items-center text-xs"
                             >
                                 <Copy size={14} className="mr-1" />
                                 {copiedTokenId === 'last_generated' ? 'Copiado!' : 'Copiar'}
                            </button>
                        </div>
                    </div>
                 )}

                {tokenLoading && !tokenList.length && <p className="text-sm text-gray-500 text-center py-4">Carregando tokens...</p>}
                {!tokenLoading && !tokenList.length && !showNewTokenInput && <p className="text-sm text-gray-500 text-center py-4">Nenhum token de API gerado para este agente.</p>}
                
                {tokenList.length > 0 && (
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Uso</th>
                                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {tokenList.map((token) => (
                                    <tr key={token._id}>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {editingTokenId === token._id ? (
                                                <input 
                                                    type="text" 
                                                    value={editingLabel}
                                                    onChange={(e) => setEditingLabel(e.target.value)}
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-1"
                                                    disabled={tokenLoading}
                                                />
                                            ) : (
                                                token.label
                                            )}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {token.isActive ? 
                                                (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ativo</span>) : 
                                                (<span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Revogado</span>)
                                            }
                                            {token.revokedAt && <span className="ml-1 text-xs text-gray-500">({formatDate(token.revokedAt)})</span>}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{formatDate(token.createdAt)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{formatDate(token.lastUsedAt)}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-center text-sm font-medium">
                                            {editingTokenId === token._id ? (
                                                 <div className="flex items-center justify-center space-x-2">
                                                    <button type="button" onClick={() => handleSaveLabel(token._id)} title="Salvar Label" className="text-green-600 hover:text-green-800 disabled:opacity-50" disabled={!editingLabel.trim() || tokenLoading}>
                                                        <Check size={16} />
                                                    </button>
                                                     <button type="button" onClick={handleCancelEditLabel} title="Cancelar Edição" className="text-gray-500 hover:text-gray-700 disabled:opacity-50" disabled={tokenLoading}>
                                                        <X size={16} />
                                                    </button>
                                                 </div>
                                            ) : (
                                                 <div className="flex items-center justify-center space-x-3">
                                                    {token.isActive && (
                                                         <button type="button" onClick={() => handleEditLabel(token)} title="Editar Label" className="text-blue-600 hover:text-blue-800 disabled:opacity-50" disabled={tokenLoading}>
                                                            <Edit3 size={16} />
                                                        </button>
                                                    )}
                                                    {token.isActive && (
                                                        <button type="button" onClick={() => handleRevokeToken(token._id)} title="Revogar Token" className="text-red-600 hover:text-red-800 disabled:opacity-50" disabled={tokenLoading}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                    {!token.isActive && <span className="text-xs text-gray-400 italic">Revogado</span>}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                 <div className="mt-6 text-center">
                     <button 
                        type="button"
                        onClick={handleShowDocs}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center"
                    >
                        <Eye size={14} className="mr-1" />
                        Ver Documentação Genérica da API
                    </button>
                 </div>
            </div>
         )}

          <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={() => router.push('/agents')}
              className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>

      <Modal 
        isOpen={showDocsModal} 
        onClose={() => setShowDocsModal(false)} 
        title={`Documentação da API de Agentes`}
      >
        <AgentApiDocs 
          apiToken={"{seu_token_aqui}"}
          agentName={formData.name || "Agente"}
          apiUrlBase={apiUrlBase} 
        />
      </Modal>
    </div>
  );
}

interface AgentFormProps {
  agentId?: string;
} 