#!/usr/bin/env node
/**
 * qlik-cloud MCP server — expõe a API REST do Qlik Sense Cloud como tools MCP.
 *
 * Config via variáveis de ambiente:
 *   QLIK_TENANT_URL  — ex: https://priorisa.us.qlikcloud.com (obrigatória)
 *   QLIK_API_KEY     — API Key gerada em Console de administração > Chaves de API (obrigatória)
 *
 * As variáveis são lidas em tempo de chamada (não no boot), então o servidor
 * sempre sobe e cada tool retorna um erro claro se a config estiver faltando.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

function log(msg) {
  process.stderr.write(`[qlik-cloud] ${msg}\n`);
}

function getConfig() {
  const tenantUrl = process.env.QLIK_TENANT_URL;
  const apiKey = process.env.QLIK_API_KEY;
  const missing = [];
  if (!tenantUrl) missing.push('QLIK_TENANT_URL');
  if (!apiKey) missing.push('QLIK_API_KEY');
  if (missing.length > 0) {
    throw new Error(
      `Configuração ausente: ${missing.join(', ')}. ` +
      `Gere a API Key em <tenant>/console > Integrações > Chaves de API e exporte as variáveis de ambiente antes de usar este MCP.`
    );
  }
  return { tenantUrl: tenantUrl.replace(/\/+$/, ''), apiKey };
}

async function qlikFetch(path, { method = 'GET', query, body } = {}) {
  const { tenantUrl, apiKey } = getConfig();
  const url = new URL(tenantUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    const err = new Error(`Qlik API respondeu ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }

  return parsed;
}

const tools = [
  {
    name: 'qlik_connection_status',
    description: 'Verifica se QLIK_TENANT_URL e QLIK_API_KEY estão configuradas e válidas, chamando /api/v1/users/me. Use antes de qualquer outra tool para diagnosticar problemas de conexão.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'qlik_search_catalog',
    description: 'Busca itens no catálogo do tenant (apps, sheets, dashboards, etc) via GET /api/v1/items. Use para descobrir o appId de um app pelo nome antes de consultar detalhes.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto de busca livre (nome do app/sheet)' },
        resourceType: { type: 'string', description: 'Filtra por tipo: app, qvapp, genericlink, etc' },
        spaceId: { type: 'string', description: 'Filtra por espaço (space) específico' },
        limit: { type: 'number', description: 'Máximo de resultados (default 20)' },
      },
    },
  },
  {
    name: 'qlik_get_app',
    description: 'Retorna metadados de um app específico via GET /api/v1/apps/{appId} (nome, owner, espaço, datas, tamanho).',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'ID do app (obtido via qlik_search_catalog)' },
      },
      required: ['appId'],
    },
  },
  {
    name: 'qlik_list_spaces',
    description: 'Lista os espaços (spaces) do tenant via GET /api/v1/spaces.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Máximo de resultados (default 20)' },
      },
    },
  },
  {
    name: 'qlik_api_request',
    description: 'Escape hatch genérico: chama qualquer endpoint da API REST do Qlik Cloud (https://<tenant>/api/v1/...). Use para endpoints ainda não cobertos pelas tools específicas. CUIDADO com métodos POST/PUT/DELETE — podem alterar dados reais no tenant.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', description: 'HTTP method (default GET)', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        path: { type: 'string', description: 'Caminho a partir de /api/v1, ex: /apps ou /items/{id}' },
        query: { type: 'object', description: 'Query params como objeto chave/valor' },
        body: { type: 'object', description: 'Corpo JSON da requisição (POST/PUT/PATCH)' },
      },
      required: ['path'],
    },
  },
];

function textResult(data, isError = false) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
    isError,
  };
}

async function handleCall(name, args = {}) {
  switch (name) {
    case 'qlik_connection_status': {
      try {
        const { tenantUrl } = getConfig();
        const me = await qlikFetch('/api/v1/users/me');
        return textResult({ status: 'connected', tenantUrl, user: me });
      } catch (err) {
        return textResult({ status: 'error', message: err.message, body: err.body }, true);
      }
    }
    case 'qlik_search_catalog': {
      const data = await qlikFetch('/api/v1/items', {
        query: {
          text: args.text,
          resourceType: args.resourceType,
          spaceId: args.spaceId,
          limit: args.limit ?? 20,
        },
      });
      return textResult(data);
    }
    case 'qlik_get_app': {
      if (!args.appId) throw new Error('appId é obrigatório');
      const data = await qlikFetch(`/api/v1/apps/${encodeURIComponent(args.appId)}`);
      return textResult(data);
    }
    case 'qlik_list_spaces': {
      const data = await qlikFetch('/api/v1/spaces', { query: { limit: args.limit ?? 20 } });
      return textResult(data);
    }
    case 'qlik_api_request': {
      if (!args.path) throw new Error('path é obrigatório');
      const normalizedPath = args.path.startsWith('/api/v1') ? args.path : `/api/v1${args.path.startsWith('/') ? '' : '/'}${args.path}`;
      const data = await qlikFetch(normalizedPath, {
        method: args.method || 'GET',
        query: args.query,
        body: args.body,
      });
      return textResult(data);
    }
    default:
      throw new Error(`Tool desconhecida: ${name}`);
  }
}

async function main() {
  const server = new Server(
    { name: 'qlik-cloud', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await handleCall(request.params.name, request.params.arguments);
    } catch (err) {
      log(`Erro em ${request.params.name}: ${err.message}`);
      return textResult({ error: err.message, body: err.body }, true);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('qlik-cloud MCP server ativo (stdio)');
}

main().catch((err) => {
  log(`Falha ao iniciar: ${err.message}`);
  process.exit(1);
});
