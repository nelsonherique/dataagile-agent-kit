---
name: qlik
description: Consulta o catálogo, apps e espaços do Qlik Sense Cloud (tenant PrioriSA) via MCP local que fala com a API REST do Qlik Cloud. Use quando o pedido envolver Qlik, dashboards, apps de BI ou dados do tenant priorisa.us.qlikcloud.com.
---

# Skill: Qlik Sense Cloud

## Quando ativar

- Pedidos para listar, buscar ou inspecionar apps/dashboards do Qlik
- Perguntas sobre espaços (spaces), donos de app, datas de atualização
- Qualquer necessidade de chamar a API REST do Qlik Cloud que ainda não tem tool dedicada

## Pré-requisito

`QLIK_TENANT_URL` e `QLIK_API_KEY` precisam estar exportadas no ambiente (ver `CLAUDE.md`
deste plugin). Se uma tool falhar com erro de configuração, é isso — não tente adivinhar
ou inventar uma chave.

## Fluxo recomendado

1. **Sempre que uma sessão nova começar a usar Qlik**, rode `qlik_connection_status` primeiro
   para confirmar que a conexão está OK antes de prosseguir.
2. Para achar um app pelo nome: `qlik_search_catalog` com `text` e opcionalmente
   `resourceType: "app"`.
3. Com o `appId` em mãos, use `qlik_get_app` para metadados completos.
4. Para organização por área/departamento: `qlik_list_spaces`.
5. Para qualquer endpoint REST do Qlik Cloud não coberto (ex: `/api/v1/reload-tasks`,
   `/api/v1/data-connections`), use `qlik_api_request` com `method` e `path`.

## Limitação conhecida

Estas tools cobrem a REST API (catálogo/metadados). Elas **não** extraem dados de dentro
de um app (valores de tabelas/gráficos) — isso exige a Engine API via WebSocket (QIX
protocol), que não está implementada nesta v1. Se o pedido for "traga os números de
vendas do app X", explique essa limitação em vez de simular um retorno.
