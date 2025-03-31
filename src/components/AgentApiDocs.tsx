'use client';

import React from 'react';
import { Copy } from 'lucide-react';

interface AgentApiDocsProps {
  agentName: string;
  apiUrlBase: string; // ex: https://your-app.com
}

// Função auxiliar para copiar texto
const copyToClipboard = (text: string, callback?: () => void) => {
  navigator.clipboard.writeText(text).then(() => {
    if (callback) callback();
  }).catch(err => {
    console.error('Falha ao copiar:', err);
  });
};

// Componente auxiliar para blocos de código com botão de copiar
const CodeBlock: React.FC<{ children: React.ReactNode, code: string }> = ({ children, code }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    copyToClipboard(code, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative bg-gray-800 text-white p-4 rounded-md my-4 font-mono text-sm overflow-x-auto">
      <button 
        onClick={handleCopy}
        className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded flex items-center transition-colors"
      >
        <Copy size={12} className="mr-1" />
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
      <pre><code>{children}</code></pre>
    </div>
  );
};

export default function AgentApiDocs({ agentName, apiUrlBase }: Omit<AgentApiDocsProps, 'apiToken'>) {
  const endpointUrl = `${apiUrlBase}/api/invoke`;
  const curlExample = `curl -X POST \
  ${endpointUrl} \
  -H 'Authorization: Bearer <seu-token-aqui>' \
  -H 'Content-Type: application/json' \
  -d '{ "message": "Qual o status do projeto Alpha?" }'`;

  const requestBodyExample = `{ 
  "message": "Sua pergunta aqui" 
}`;

  const successResponseExample = `{ 
  "success": true, 
  "response": "Resposta do agente...", 
  "agentId": "..." 
}`;

  return (
    <div className="prose prose-sm max-w-none text-gray-700">
      <h2 className="text-xl font-semibold mb-4">Documentação da API - Agente: {agentName}</h2>
      <p>
        Esta documentação descreve como interagir com o agente <strong>{agentName}</strong> através da API REST.
      </p>

      <h3 className="text-lg font-medium mt-6 mb-2">Endpoint Principal</h3>
      <p>Para enviar uma mensagem a um agente e receber sua resposta, use o seguinte endpoint:</p>
      <CodeBlock code={endpointUrl}>
        POST {endpointUrl}
      </CodeBlock>

      <h3 className="text-lg font-medium mt-6 mb-2">Autenticação</h3>
      <p>
        A autenticação é feita enviando o <strong>Token de Acesso da API</strong> (obtido na seção "Gerenciar Tokens" deste agente) como um Bearer Token no cabeçalho <code>Authorization</code>.
      </p>
      <CodeBlock code="Authorization: Bearer <seu-token-aqui>">
        Authorization: Bearer &lt;seu-token-aqui&gt;
      </CodeBlock>

      <h3 className="text-lg font-medium mt-6 mb-2">Corpo da Requisição</h3>
      <p>A requisição deve ser do tipo `POST` e conter um corpo JSON com a mensagem do usuário:</p>
      <CodeBlock code={requestBodyExample}>{requestBodyExample}</CodeBlock>
      <p><strong>Campos:</strong></p>
      <ul className="list-disc list-inside">
        <li><code>message</code> (string, obrigatório): A pergunta ou instrução para o agente.</li>
      </ul>

      <h3 className="text-lg font-medium mt-6 mb-2">Respostas</h3>

      <h4 className="font-medium mt-4 mb-1">Resposta de Sucesso (`200 OK`)</h4>
      <p>Se a requisição for bem-sucedida:</p>
      <CodeBlock code={successResponseExample}>{successResponseExample}</CodeBlock>
      <p><strong>Campos:</strong></p>
      <ul className="list-disc list-inside">
        <li><code>success</code> (boolean): `true`.</li>
        <li><code>response</code> (string): A resposta gerada pelo agente.</li>
        <li><code>agentId</code> (string): O ID interno do agente.</li>
      </ul>

      <h4 className="font-medium mt-4 mb-1">Respostas de Erro</h4>
      <p>A API retornará um corpo JSON com `success: false` e uma mensagem de `error` em caso de falha:</p>
      <ul className="list-disc list-inside space-y-1 text-sm">
        <li><strong>`400 Bad Request`</strong>: Corpo inválido ou campo `message` ausente/inválido.</li>
        <li><strong>`401 Unauthorized`</strong>: Cabeçalho `Authorization` ausente ou mal formatado (sem `Bearer` ou token).</li>
        <li><strong>`403 Forbidden`</strong>: O agente está desativado.</li>
        <li><strong>`404 Not Found`</strong>: Token inválido ou revogado.</li>
        <li><strong>`429 Too Many Requests`</strong>: Limite de taxa (rate limit) excedido.</li>
        <li><strong>`500 Internal Server Error`</strong>: Erro interno no servidor.</li>
      </ul>

       <h4 className="font-medium mt-4 mb-1">Rate Limiting (Limite de Taxa)</h4>
        <p className="text-sm">
            Se configurado, a API retornará os cabeçalhos `X-RateLimit-Limit`, `X-RateLimit-Remaining`, e `X-RateLimit-Reset` em cada resposta.
        </p>

      <h3 className="text-lg font-medium mt-6 mb-2">Exemplo de Uso com `curl`</h3>
      <p>Exemplo prático para chamar a API:</p>
      <CodeBlock code={curlExample}>{curlExample}</CodeBlock>
      <p className="text-xs text-gray-500">Substitua <code>&lt;seu-token-aqui&gt;</code> pelo valor real do token gerado.</p>

    </div>
  );
} 