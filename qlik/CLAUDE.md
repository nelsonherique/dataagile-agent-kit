# Qlik Plugin — Claude Code

Plugin que expõe um MCP server local (`qlik-cloud`) para consultar a API REST do
Qlik Sense Cloud do tenant PrioriSA (`https://priorisa.us.qlikcloud.com`).

## Configuração obrigatória (uma vez)

1. No Qlik Cloud, acesse **Console de administração → Integrações → Chaves de API**
2. Gere uma API Key e copie o valor (só é exibido uma vez)
3. Exporte as variáveis de ambiente antes de abrir o Claude Code:

```bash
export QLIK_TENANT_URL="https://priorisa.us.qlikcloud.com"
export QLIK_API_KEY="<sua-api-key>"
```

No Windows (PowerShell):

```powershell
$env:QLIK_TENANT_URL = "https://priorisa.us.qlikcloud.com"
$env:QLIK_API_KEY = "<sua-api-key>"
```

Nunca commitar a API Key no repositório. Se precisar persistir localmente, use um
`.env` fora do controle de versão ou o gerenciador de segredos do SO.

## Tools MCP disponíveis

| Tool | Uso |
|------|-----|
| `qlik_connection_status` | Testa a conexão (chama `/api/v1/users/me`) — rodar primeiro sempre que algo falhar |
| `qlik_search_catalog` | Busca apps/sheets no catálogo por texto, tipo ou espaço |
| `qlik_get_app` | Metadados de um app específico (nome, owner, espaço, datas) |
| `qlik_list_spaces` | Lista os espaços (spaces) do tenant |
| `qlik_api_request` | Escape hatch: chama qualquer endpoint `/api/v1/...` não coberto pelas tools acima |

## Limitações da v1

- Cobre apenas a **REST API** do Qlik Cloud (catálogo, apps, espaços, escape hatch genérico).
- **Não** cobre a Engine API (WebSocket/QIX) usada para rodar hypercubes e extrair dados de
  dentro de um app (ex: valores de uma tabela/gráfico). Se precisar disso, avise — é um
  protocolo mais complexo (sessão WebSocket com objeto de app aberto) e entra como v2.
- `qlik_api_request` com métodos `POST/PUT/PATCH/DELETE` pode alterar dados reais no tenant —
  use com cuidado, especialmente em produção.

## Diagnóstico

Se qualquer tool retornar erro de configuração, confirme que `QLIK_TENANT_URL` e
`QLIK_API_KEY` estão exportadas na sessão do terminal que abriu o Claude Code (o MCP
server é um processo filho e herda o ambiente do processo pai).
