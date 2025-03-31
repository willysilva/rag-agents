import AgentForm from '@/components/AgentForm';

export const metadata = {
  title: 'Novo Agente - RAG App',
  description: 'Adicione um novo agente de IA',
};

export default function NewAgentPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Novo Agente</h1>
      <AgentForm />
    </div>
  );
} 