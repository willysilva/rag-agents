'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlusIcon, TrashIcon, PencilIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

// Interface para o tipo de agente
interface Agent {
  _id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const router = useRouter();

  // Carregar a lista de agentes
  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/agents?showInactive=${showInactive}`);
      
      if (!res.ok) {
        throw new Error('Falha ao carregar agentes');
      }
      
      const data = await res.json();
      setAgents(data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar agentes');
      console.error('Erro ao buscar agentes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar agentes ao montar o componente
  useEffect(() => {
    fetchAgents();
  }, [showInactive]);

  // Função para excluir um agente
  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente? Todos os seus documentos também serão excluídos.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error('Falha ao excluir o agente');
      }
      
      // Atualizar a lista após exclusão
      fetchAgents();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir o agente');
      console.error('Erro ao excluir agente:', err);
    }
  };

  // Função para alternar o status do agente (ativar/desativar)
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      
      if (!res.ok) {
        throw new Error('Falha ao atualizar o status do agente');
      }
      
      // Atualizar a lista após a alteração
      fetchAgents();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar o status do agente');
      console.error('Erro ao atualizar status do agente:', err);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Agentes</h2>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={() => setShowInactive(!showInactive)}
              className="mr-2 h-4 w-4 text-blue-600"
            />
            <span>Mostrar inativos</span>
          </label>
          <Link
            href="/agents/new"
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Novo Agente
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Carregando agentes...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">Nenhum agente encontrado.</p>
          <p className="mt-2">
            <Link href="/agents/new" className="text-blue-600 hover:underline">
              Crie seu primeiro agente
            </Link>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent._id} className={!agent.isActive ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {agent.avatarUrl ? (
                        <img
                          className="h-10 w-10 rounded-full mr-3"
                          src={agent.avatarUrl}
                          alt={agent.name}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <span className="text-blue-600 font-medium text-lg">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{agent.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 line-clamp-2">
                      {agent.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleStatus(agent._id, agent.isActive)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        agent.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2 justify-end">
                      <Link
                        href={`/agents/${agent._id}/documents`}
                        className="text-indigo-600 hover:text-indigo-900 p-1"
                        title="Gerenciar Documentos"
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                      </Link>
                      <Link
                        href={`/agents/${agent._id}/edit`}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Editar Agente"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </Link>
                      <button
                        onClick={() => handleDeleteAgent(agent._id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Excluir Agente"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}