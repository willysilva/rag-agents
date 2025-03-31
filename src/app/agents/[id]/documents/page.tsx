import AgentDocumentManager from '@/components/AgentDocumentManager';

export const metadata = {
  title: 'Documentos do Agente - RAG App',
  description: 'Gerencie os documentos de um agente de IA',
};

export default function AgentDocumentsPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Documentos do Agente</h1>
      <AgentDocumentManager agentId={params.id} />
    </div>
  );
} 