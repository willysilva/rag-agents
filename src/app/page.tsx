import Chat from "@/components/Chat";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-6rem)] flex-col p-4 md:p-6 bg-gray-50">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
        </header>
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <Chat />
        </div>
      </div>
    </main>
  );
}
