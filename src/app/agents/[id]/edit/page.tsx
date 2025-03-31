import AgentForm from '@/components/AgentForm';

export const metadata = {
  title: 'Editar Agente - RAG App',
  description: 'Edite um agente de IA existente',
};

export default function EditAgentPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Editar Agente</h1>
      <AgentForm agentId={params.id} />
    </div>
  );
} 