'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, TrashIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface AgentDocumentManagerProps {
  agentId: string;
}

interface AgentDocument {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  metadata?: {
    source?: string;
  };
}

interface Agent {
  _id: string;
  name: string;
}

export default function AgentDocumentManager({ agentId }: AgentDocumentManagerProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<AgentDocument[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    metadata: {
      source: ''
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar dados do agente
  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        
        if (!res.ok) {
          throw new Error('Falha ao carregar dados do agente');
        }
        
        const { data } = await res.json();
        setAgent({
          _id: data._id,
          name: data.name
        });
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do agente');
        console.error('Erro ao buscar agente:', err);
      }
    };
    
    fetchAgent();
  }, [agentId]);

  // Carregar documentos do agente
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/agents/${agentId}/documents`);
      
      if (!res.ok) {
        throw new Error('Falha ao carregar documentos');
      }
      
      const data = await res.json();
      setDocuments(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar documentos');
      console.error('Erro ao buscar documentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [agentId]);

  // Manipular mudanças no formulário
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Enviar o formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha ao adicionar documento');
      }
      
      // Limpar formulário e atualizar lista
      setFormData({ 
        title: '', 
        content: '', 
        metadata: { source: '' } 
      });
      setAddOpen(false);
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Erro ao adicionar documento');
      console.error('Erro ao adicionar documento:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Excluir um documento
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/agents/${agentId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Falha ao excluir o documento');
      }
      
      // Atualizar a lista após exclusão
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir o documento');
      console.error('Erro ao excluir documento:', err);
    }
  };

  // Limpar todos os documentos
  const handleClearDocuments = async () => {
    if (!confirm('Tem certeza que deseja excluir TODOS os documentos deste agente? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      setClearLoading(true);
      const res = await fetch(`/api/agents/${agentId}/documents`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Falha ao limpar os documentos');
      }
      
      // Atualizar a lista após limpeza
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Erro ao limpar os documentos');
      console.error('Erro ao limpar documentos:', err);
    } finally {
      setClearLoading(false);
    }
  };

  // Processar upload de arquivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setError(null);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Verificar tamanho
      if (file.size > 1024 * 1024 * 5) { // 5MB
        setError('Arquivo muito grande. O tamanho máximo é 5MB.');
        continue;
      }
      
      try {
        const text = await readFileAsText(file);
        
        // Adicionar documento
        const document = {
          title: file.name,
          content: text,
          metadata: {
            source: `Arquivo: ${file.name}`,
            uploadDate: new Date().toISOString()
          }
        };
        
        setSubmitting(true);
        
        const res = await fetch(`/api/agents/${agentId}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(document),
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Falha ao adicionar o arquivo ${file.name}`);
        }
      } catch (err: any) {
        setError(err.message || `Erro ao processar o arquivo ${file.name}`);
        console.error(`Erro ao processar arquivo ${file.name}:`, err);
      }
    }
    
    // Limpar input de arquivo e atualizar lista
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    fetchDocuments();
    setSubmitting(false);
  };

  // Função auxiliar para ler um arquivo como texto
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Falha ao ler o arquivo'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };
      
      reader.readAsText(file);
    });
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documentos{agent ? ` do ${agent.name}` : ''}
          </h2>
          <p className="text-gray-500 text-sm mt-1 ml-7">
            Gerencie os documentos usados por este agente para responder perguntas
          </p>
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt,.md,.html,.json,.csv,.xml,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.rb"
              multiple
              className="sr-only"
              id="fileUpload"
            />
            <label 
              htmlFor="fileUpload"
              className="cursor-pointer flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-md hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 shadow-sm transition-all duration-200"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
              <span>Upload de Arquivo</span>
            </label>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all duration-200"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            <span>Adicionar</span>
          </button>
          <button
            onClick={handleClearDocuments}
            disabled={clearLoading || documents.length === 0}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md hover:from-red-700 hover:to-red-800 disabled:opacity-50 shadow-sm transition-all duration-200"
          >
            <TrashIcon className="h-4 w-4 mr-1.5" />
            <span>Limpar Tudo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-lg border border-red-200 flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
          </svg>
          <div>{error}</div>
        </div>
      )}

      {/* Formulário para adicionar documento */}
      {addOpen && (
        <div className="border rounded-lg p-5 mb-6 bg-gray-50 shadow-inner">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <PlusIcon className="h-5 w-5 text-blue-600 mr-1.5" />
              Adicionar Documento
            </h3>
            <button
              onClick={() => setAddOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="Título do documento"
                />
              </div>
              
              <div>
                <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
                  Fonte / Referência
                </label>
                <input
                  type="text"
                  id="source"
                  name="metadata.source"
                  value={formData.metadata.source}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      metadata: {
                        ...formData.metadata,
                        source: e.target.value
                      }
                    });
                  }}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="URL ou referência da origem do documento (opcional)"
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" />
                  </svg>
                  A fonte será incluída nas citações nas respostas do agente
                </p>
              </div>
              
              <div>
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                  Conteúdo <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="content"
                  name="content"
                  value={formData.content}
                  onChange={handleChange}
                  required
                  rows={10}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm transition-colors"
                  placeholder="Conteúdo do documento"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Lista de documentos */}
      {loading ? (
        <div className="text-center py-10">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-3 text-gray-600">Carregando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 mb-3">Nenhum documento encontrado para este agente.</p>
          <button 
            onClick={() => setAddOpen(true)} 
            className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Adicione seu primeiro documento
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Título
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prévia
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fonte
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((doc) => (
                <tr key={doc._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 truncate max-w-md">
                      {doc.content.substring(0, 100)}{doc.content.length > 100 ? '...' : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      {doc.metadata?.source ? (
                        <span className="text-blue-600 font-medium">{doc.metadata.source}</span>
                      ) : (
                        <span className="text-gray-400">Não informada</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteDocument(doc._id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Excluir documento"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-6 flex justify-end">
        <Link
          href="/agents"
          className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Voltar para agentes
        </Link>
      </div>
    </div>
  );
} 