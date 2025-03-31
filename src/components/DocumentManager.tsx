"use client";

import { useState, FormEvent, useRef, useEffect } from "react";

interface Document {
  id: string;
  content: string;
}

export default function DocumentManager() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [newDocument, setNewDocument] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isFetching, setIsFetching] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Função para buscar documentos da API
  const fetchDocuments = async () => {
    try {
      setIsFetching(true);
      console.log("Buscando documentos da API...");
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        console.log(`Recebidos ${data.documents?.length || 0} documentos da API`);
        setDocuments(data.documents || []);
      } else {
        console.error("Erro ao buscar documentos. Status:", response.status);
        showMessage("Error fetching documents", "error");
      }
    } catch (error) {
      console.error("Erro ao buscar documentos:", error);
      showMessage("Error fetching documents", "error");
    } finally {
      setIsFetching(false);
    }
  };

  // Função para exibir mensagens
  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage("");
    }, 5000);
  };

  // Carregar documentos ao iniciar
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Função para adicionar diretamente um documento sem salvar no localStorage
  const addDocument = async (content: string) => {
    try {
      console.log(`Enviando documento para API: ${content.substring(0, 50)}...`);
      
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documents: [content] }),
      });
      
      const responseData = await response.json();
      console.log("Resposta da API de ingestão:", responseData);
      
      if (!response.ok) {
        throw new Error(responseData.error || "Unknown error");
      }
      
      // Recarregar documentos da API após ingestão
      await fetchDocuments();
      
      return responseData;
    } catch (error) {
      console.error("Erro ao enviar documento para a API:", error);
      throw error;
    }
  };

  const handleAddDocument = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!newDocument.trim()) return;
    
    setIsLoading(true);
    
    try {
      await addDocument(newDocument.trim());
      setNewDocument("");
      showMessage("Document added successfully!");
    } catch (error) {
      console.error("Erro ao adicionar documento:", error);
      showMessage("Error adding document", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      // Remover o documento da lista local
      const updatedDocs = documents.filter(doc => doc.id !== id);
      setDocuments(updatedDocs);
      
      // Atualizar o vetor com apenas os conteúdos dos documentos restantes
      const contents = updatedDocs.map(doc => doc.content);
      
      // Limpar todos os documentos e reinserir os restantes
      const clearResponse = await fetch("/api/documents/clear", {
        method: "POST",
      });
      
      if (!clearResponse.ok) {
        throw new Error("Failed to clear documents");
      }
      
      // Se não houver documentos restantes, não precisamos fazer mais nada
      if (contents.length === 0) {
        showMessage("Document removed successfully!");
        return;
      }
      
      // Reinserir os documentos restantes
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documents: contents }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update documents");
      }
      
      showMessage("Document removed successfully!");
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      showMessage("Error removing document", "error");
      
      // Recarregar documentos em caso de erro para garantir consistência
      await fetchDocuments();
    }
  };

  const handleClearAllDocuments = async () => {
    if (!confirm("Are you sure you want to remove all documents?")) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/documents/clear", {
        method: "POST",
      });
      
      if (response.ok) {
        // Limpar documentos locais
        setDocuments([]);
        localStorage.removeItem("ragDocuments");
        
        showMessage("All documents removed successfully!");
      } else {
        throw new Error("Failed to clear documents");
      }
    } catch (error) {
      console.error("Erro ao limpar documentos:", error);
      showMessage("Error clearing documents", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    showMessage("Processing file...");
    
    try {
      const file = files[0];
      const text = await file.text();
      
      if (!text.trim()) {
        throw new Error("The file is empty");
      }
      
      // Adicionar documento diretamente
      await addDocument(text.trim());
      
      showMessage(`File "${file.name}" processed successfully!`);
      
      // Limpar input de arquivo
      e.target.value = "";
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      showMessage("Error processing file", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upload Section */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-3">Add New Document</h2>
        <form onSubmit={handleAddDocument}>
          <div className="space-y-4">
            <textarea
              ref={textareaRef}
              value={newDocument}
              onChange={(e) => setNewDocument(e.target.value)}
              placeholder="Paste or type document content here..."
              className="w-full h-32 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={isLoading}
            />
            
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isLoading || !newDocument.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isLoading ? "Adding..." : "Add Document"}
              </button>
              
              <div className="relative">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".txt,.md,.json,.html,.csv"
                  disabled={isLoading}
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                  Upload File
                </label>
              </div>
              
              <button
                type="button"
                onClick={fetchDocuments}
                disabled={isLoading || isFetching}
                className="inline-flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                {isFetching ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </form>
        
        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${
            messageType === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message}
          </div>
        )}
      </section>
      
      {/* Documents Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-800">Documents ({documents.length})</h2>
          
          {documents.length > 0 && (
            <button
              onClick={handleClearAllDocuments}
              disabled={isLoading}
              className="inline-flex items-center text-red-600 hover:text-red-700 border border-red-200 px-3 py-1 rounded-md text-sm hover:bg-red-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear All
            </button>
          )}
        </div>
        
        {isFetching ? (
          <div className="py-12 flex justify-center items-center border border-gray-200 rounded-md bg-gray-50">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-gray-500 text-sm">Loading documents...</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-12 flex justify-center items-center border border-gray-200 rounded-md bg-gray-50">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-400 mb-3">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <p className="text-gray-500">No documents added yet</p>
              <p className="text-gray-400 text-sm mt-1">Add documents to start asking questions</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 border border-gray-200 rounded-md bg-white hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-4 overflow-hidden">
                    <p className="text-xs text-gray-400 mb-1 font-mono">{doc.id}</p>
                    <p className="text-sm text-gray-800 line-clamp-2">{doc.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                    title="Delete document"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
} 