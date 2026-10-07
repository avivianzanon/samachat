# BIA SDR no SamaChat — Guia de uso

Este guia é para quem opera o sistema (administradores e atendentes). Para alterar ou manter o código, veja [MANUTENCAO.md](MANUTENCAO.md).

## O que foi adicionado

| Área | Onde fica no menu | Para quê |
|---|---|---|
| Pipeline | Pipeline | Quadro Kanban de atendimentos, com colunas que movem os cards sozinhas |
| Treinamento da IA | Treinamento da IA | Configura o agente SDR: prompt, base de conhecimento, horários, handoff |
| Configurações > Geral | Configurações | Ajustes gerais do sistema |
| Configurações > WhatsApp | Configurações | Escolha do canal (Evolution ou Meta oficial) e gestão de instâncias |
| Configurações > APIs | Configurações | Motor de IA (Claude, OpenAI ou Gemini) e ElevenLabs |
| Configurações > Webhooks | Configurações | Webhooks |
| Contatos | Contatos | Ações em massa e seleção de tags |

## Primeiro uso (ordem recomendada)

1. **Configurações > APIs**: cadastre a chave de **um** motor de IA e ative-o.
2. **Configurações > WhatsApp**: cadastre a URL e a chave da Evolution API, ative, e crie uma instância.
3. **Treinamento da IA**: gere ou cole o prompt mestre, ative o agente.
4. **Pipeline**: confira as colunas e suas regras (IA / humano).
5. Conecte o número lendo o QR Code da instância e envie uma mensagem de teste.

## Regras que o sistema impõe

- **Evolution e Meta oficial são excludentes.** Só um canal ativo por vez. O outro fica bloqueado com o motivo escrito.
- **Só um motor de IA ativo.** Claude, OpenAI e Gemini não rodam juntos. Para trocar, desative o atual.
- **Só ativa com credencial.** O interruptor fica bloqueado enquanto não houver chave.
- **Chaves nunca aparecem depois de salvas.** A tela mostra apenas o status em tempo real (conectada, chave inválida, etc.). Para trocar, digite a nova chave por cima.
- **O agente só responde** com agente ligado, prompt mestre criado e motor de IA ativo. Sem isso, o botão de passar a conversa para a IA avisa o que falta.

## Configurações > WhatsApp: instâncias

Uma instância é um número de WhatsApp conectado pela Evolution.

- **Criar**: informe o nome técnico (3 a 40 caracteres: letras, números, `-` e `_`) e um nome amigável. A primeira instância vira a padrão.
- **Conectar**: clique em QR Code e leia pelo WhatsApp (Aparelhos conectados).
- **Padrão**: a instância usada por padrão nos envios. Excluir a padrão limpa essa marcação.
- **Desconectar** encerra a sessão do número; **Excluir** remove a instância na Evolution.

## Pipeline

Cada coluna tem uma regra:

| Regra | Efeito |
|---|---|
| IA | Cards entram aqui quando o atendimento está com a IA |
| Humano | Cards entram aqui quando um atendente assume |
| Nenhuma | Coluna manual |

Ao passar uma conversa para IA ou Humano (botões no chat), o card muda de coluna sozinho. Colunas podem ser criadas, editadas e excluídas pela tela.

## Chat: botões IA / Humano

Os dois botões de ícone no topo da conversa alternam quem responde. Não há mais "devolver para a IA".

## Contatos

Selecione contatos para abrir o menu de **Ações** (adicionar tags etc.). Contato pode ser salvo sem WhatsApp padrão configurado.

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Interruptor da API bloqueado | Sem chave cadastrada | Salve a chave primeiro |
| Não consigo ativar Meta | Evolution ativa | Desative a Evolution |
| Não consigo ativar um motor de IA | Outro motor ativo | Desative o outro |
| "Chave inválida" no status | Chave errada ou revogada | Cadastre outra |
| IA não responde | Agente desligado, sem prompt ou sem motor | Veja Treinamento da IA e APIs |
| Card duplicado no Pipeline | Dados antigos | A migração de índice único já remove duplicatas |

## Limitações conhecidas

- Evolution e Meta ainda **não enviam nem recebem mensagens do chat** (falta ligar webhooks e envio). A gestão de instâncias e o status funcionam.
- Fluxos com serviços reais (WhatsApp, Gemini, Claude, OpenAI, Whisper, ElevenLabs, Meta, Google Calendar) **não foram testados de ponta a ponta**; a Evolution foi testada apenas contra um servidor simulado.
- Chaves ficam gravadas em texto no banco (mascaradas só na API/tela). Recomenda-se criptografar antes de produção.
