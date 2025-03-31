# RAG App

Aplicação de Retrieval Augmented Generation (RAG) que permite criar agentes de IA com base em documentos personalizados.

## Configuração do MongoDB com Docker

A aplicação utiliza MongoDB como banco de dados. Para facilitar o desenvolvimento, incluímos um arquivo `docker-compose.yml` que configura um ambiente MongoDB pronto para uso.

### Pré-requisitos

- [Docker](https://www.docker.com/get-started) 
- [Docker Compose](https://docs.docker.com/compose/install/)

### Executando o MongoDB

1. Na raiz do projeto, execute o comando:

```bash
docker-compose up -d
```

Isso iniciará:
- Um container MongoDB na porta 27017
- Um container Mongo Express (interface web para gerenciar o MongoDB) na porta 8081

### Acessando o MongoDB via Mongo Express

- URL: http://localhost:8081
- Usuário: admin
- Senha: senha123

### Configurando a aplicação para usar o MongoDB Docker

No arquivo `.env.local` da aplicação, configure a variável de ambiente:

```
MONGODB_URI=mongodb://localhost:27017/rag-agents
```

## Executando a aplicação

1. Instale as dependências:

```bash
cd rag-app
npm install
```

2. Configure as variáveis de ambiente:
   Copie o arquivo `.env.local.example` para `.env.local` e configure as variáveis de ambiente:

```
OPENAI_API_KEY=sua-chave-api-openai
MONGODB_URI=mongodb://localhost:27017/rag-agents
```

3. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

4. Acesse a aplicação em http://localhost:3000

## Funcionalidades

- **Chat**: Interaja com agentes de IA usando a interface de chat
- **Documentos**: Gerencie os documentos de base de conhecimento
- **Agentes**: Crie e configure agentes personalizados com documentos específicos 