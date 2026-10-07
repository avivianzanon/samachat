# BIA SDR no SamaChat — Guia de alteração, manutenção e atualização

Para quem mexe no código. Uso diário: [GUIA-DE-USO.md](GUIA-DE-USO.md).

## Regra de escopo

Só alteramos o que é da camada BIA SDR. Funcionalidades nativas do SamaChat não devem ser alteradas sem pedido explícito. Os ajustes de UX em contatos/tags/filas foram pedidos explicitamente.

## Mapa do código (a partir da raiz do repositório)

### Backend (`backend/src`)

| Caminho | Responsabilidade |
|---|---|
| `models/IntegrationSetting.ts` | Tabela genérica de integrações (provider, isActive, config JSON) |
| `services/IntegrationSettingsServices/providers.ts` | **Catálogo** de provedores e campos (marca quais são secretos) |
| `.../IntegrationSettingsService.ts` | Leitura mascarada, gravação, regras de exclusividade |
| `.../IntegrationStatusService.ts` | Status ao vivo via chamada barata ao provedor |
| `.../TestIntegrationService.ts`, `elevenlabs.ts` | Teste de conexão e voz |
| `.../activeEngines.ts` | Qual motor de IA está ativo |
| `services/AiEngineServices/engines.ts` | `createEngineChat`: resolve o motor ativo a cada chamada (OpenAI, Gemini, Claude) |
| `.../claudeAdapter.ts` | Converte mensagens/tools no formato OpenAI para a API Messages da Anthropic |
| `services/EvolutionServices/EvolutionInstanceService.ts` | Criar/listar/QR/estado/logout/excluir/padrão de instâncias |
| `services/KanbanServices/KanbanAutoMoveService.ts` | Move card conforme `autoRule` da coluna |
| `services/SdrAgentServices/` | Agente: `RunSdrAgentService`, `HandleIncomingSdrMessageService`, `SdrHandoffService`, `audio.ts` (Whisper/TTS), `agentLoop.ts` |
| `controllers/` e `routes/` | `integrationSettingsRoutes`, `evolutionRoutes`, `openAIRoutes` (mantenha a caixa do nome), `kanbanRoutes` |

Rotas principais: `GET/PUT /integration-settings/:provider`, `/status`, `/test`, `GET /ai-engine`, `GET /openai/settings/status`, `/evolution/instances[/:name/qrcode|state|logout|default]`.

### Frontend (`frontend/src`)

| Caminho | Responsabilidade |
|---|---|
| `pages/Settings/index.js` | Abas Geral / WhatsApp / APIs / Webhooks |
| `pages/Settings/IntegrationForm.js` | Formulário genérico (envia só campos declarados) |
| `pages/Settings/EvolutionInstances.js` | Gestão de instâncias |
| `pages/Settings/LiveStatus.js` | Selo de status em tempo real |
| `components/PillTabs`, `components/BulkActionsMenu` | Componentes novos |
| `pages/Kanban`, `components/KanbanColumnModal` | Pipeline |
| `pages/SdrAgent/*` | Treinamento da IA |
| `translate/languages/pt.js` | Textos e códigos de erro (`ERR_*`) |

## Migrações

| Arquivo | O que faz |
|---|---|
| `20261007100000-kanban-auto-rules` | Coluna `autoRule` em KanbanColumns |
| `20261007100500-kanban-cards-unique-ticket` | Remove duplicatas e cria índice único em `KanbanCards.ticketId` |
| `20261007110000-create-integration-settings` | Tabela `IntegrationSettings` |

Aplicar: `cd backend && npm run build && npx sequelize db:migrate` (usa `dist`). Nunca edite migração já aplicada; crie outra.

## Rodar localmente

1. Backend: copie `backend/.env.example` para `backend/.env` e preencha banco, JWT e URLs. Suba MariaDB/MySQL e Redis.
2. `cd backend && npm install && npm run build && npx sequelize db:migrate && node dist/server.js` (porta 8080).
3. `cd frontend && npm install && npx vite` (porta 3000).

## Receitas de alteração

**Adicionar uma integração nova (ex.: outro provedor)**
1. Declare o provedor e seus campos em `providers.ts` (marque `secret: true` nas chaves).
2. Se for motor de IA, implemente em `engines.ts` e inclua em `activeEngines.ts`.
3. Se for excludente com outro, ajuste `EXCLUSIVE_GROUPS` em `IntegrationSettingsService.ts`.
4. Adicione os campos na aba em `pages/Settings/index.js` e os textos em `pt.js`.
5. Adicione um teste em `__tests__/unit/services/`.

**Adicionar um modelo de IA**: altere o `model` padrão/lista em `providers.ts`.

**Novo código de erro**: lance `AppError("ERR_...")` no backend e traduza em `pt.js`.

**Regra de coluna nova no Pipeline**: valores válidos de `autoRule` em `KanbanColumn.ts` e `KanbanAutoMoveService.ts`.

## Testes e verificação

- Tipos: `cd backend && npx tsc --noEmit`.
- Unitários: `cd backend && NODE_ENV=test npx jest`. Seis suítes nativas de User falham por plugin de autenticação do MariaDB local (ambiente, não código nosso). Há `bail` ativo no jest, que esconde falhas posteriores: rode suítes específicas.
- Frontend: `cd frontend && npx vite build`.
- Antes de qualquer PR: tipos, build do front e testes dos arquivos alterados.

## Boas práticas adotadas

- Commits convencionais (`feat(escopo): ...`) em português, um assunto por commit.
- Credenciais só no banco (integrações) ou `.env`; nunca no código. Respostas da API nunca devolvem segredos.
- Regras de negócio validadas **no servidor** e espelhadas na tela (nunca só no front).
- Para testes que gravam configuração, leia antes o que existe e **não sobrescreva credenciais reais**.
- Push apenas para o fork `origin` (`avivianzanon/samachat`); `upstream` é somente leitura.

## Atualizando do SamaChat original (upstream)

```
git fetch upstream
git checkout -b chore/sync-upstream feat/bia-sdr-20261002
git merge upstream/main     # resolva conflitos; os pontos mais prováveis estão abaixo
```

Arquivos nossos que tocam áreas nativas e podem conflitar: `routes/index.ts`, `database/index.ts`, `ContactController.ts`, `layout/MainListItems.js`, `layout/index.js`, `translate/languages/pt.js`, `pages/Settings/index.js`, `pages/Contacts/index.js`. Após o merge: `npm run build` no backend, `db:migrate`, `vite build`, e teste manual de Configurações, Pipeline e Treinamento da IA.

## Pendências e dívida técnica

- Criptografar chaves guardadas em `IntegrationSettings` e `OpenAISettings`.
- Chaves estrangeiras em `KanbanCards`.
- Registro de auditoria de quem alterou credenciais.
- Proteção contra SSRF na URL da Evolution.
- Cache de status ao vivo no servidor.
- Declarar `axios` no `package.json` do backend; unificar `ERR_OPENAI_*` e `ERR_AI_*`.
- Ligar envio/recebimento de mensagens pela Evolution e Meta (webhooks).
- Testes reais com WhatsApp, Gemini, Claude, OpenAI, Whisper, ElevenLabs.
- Código morto: simulador, endpoint de reordenação, busca de closers.
- Acessibilidade (aria-labels), cores fixas e i18n restante.
- Existem arquivos `.env` rastreados no repositório original: revisar e remover do versionamento com cuidado.
