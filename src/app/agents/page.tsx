import AgentList from '@/components/AgentList';

export const metadata = {
  title: 'Gerenciar Agentes - RAG App',
  description: 'Gerencie seus agentes de IA e seus documentos',
};

export default function AgentsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Gerenciar Agentes</h1>
      <AgentList />
    </div>
  );
} 