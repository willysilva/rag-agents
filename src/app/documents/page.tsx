import { redirect } from 'next/navigation';

export default function DocumentsPage() {
  // Redirecionar para a página inicial
  redirect('/');
  
  // Este código nunca será executado devido ao redirecionamento
  return null;
} 