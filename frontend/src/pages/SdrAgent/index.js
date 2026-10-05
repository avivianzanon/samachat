import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  makeStyles,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography
} from "@material-ui/core";
import SendRoundedIcon from "@material-ui/icons/SendRounded";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import KnowledgeBaseTab from "./KnowledgeBaseTab";

// Textos da tela (portugues). Mantidos aqui para a tela ficar em um arquivo so.
const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

const TOOL_LABELS = {
  check_availability: "Consultou a agenda",
  create_appointment: "Agendou reuniao",
  reschedule_appointment: "Remarcou reuniao",
  cancel_appointment: "Cancelou reuniao",
  transfer_to_human: "Passou para humano"
};

const useStyles = makeStyles(theme => ({
  paper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto"
  },
  card: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`
  },
  cardTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(0.5)
  },
  hint: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
    fontSize: "0.875rem"
  },
  row: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap"
  },
  grow: {
    flex: "1 1 220px"
  },
  promptField: {
    "& textarea": {
      fontFamily: "monospace",
      fontSize: "0.8125rem",
      lineHeight: 1.5
    }
  },
  variables: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: theme.spacing(1)
  },
  warn: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    borderRadius: 8,
    border: `1px solid ${theme.palette.warning.main}`,
    color: theme.palette.text.primary
  },
  chatBox: {
    height: "55vh",
    minHeight: 320,
    overflowY: "auto",
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5)
  },
  bubbleLead: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    padding: theme.spacing(1, 1.5),
    borderRadius: 12,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    whiteSpace: "pre-wrap"
  },
  bubbleAgent: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    padding: theme.spacing(1, 1.5),
    borderRadius: 12,
    backgroundColor: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    whiteSpace: "pre-wrap"
  },
  toolChips: {
    alignSelf: "flex-start",
    display: "flex",
    gap: 6,
    flexWrap: "wrap"
  },
  composer: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    alignItems: "center"
  },
  empty: {
    margin: "auto",
    textAlign: "center",
    color: theme.palette.text.secondary
  }
}));

const emptyForm = {
  isEnabled: false,
  autoEnableForNewTickets: false,
  allowedNumbers: "",
  agentName: "Bia",
  companyName: "ARKOM",
  systemPrompt: "",
  model: "",
  temperature: "",
  maxHistoryMessages: 30,
  maxToolRounds: 5,
  replyDelaySeconds: 5
};

const toForm = data => ({
  isEnabled: Boolean(data.isEnabled),
  autoEnableForNewTickets: Boolean(data.autoEnableForNewTickets),
  allowedNumbers: data.allowedNumbers || "",
  agentName: data.agentName || "",
  companyName: data.companyName || "",
  // vazio = usa o prompt padrao da ARKOM
  systemPrompt: data.systemPrompt || "",
  model: data.model || "",
  temperature:
    data.temperature === null || data.temperature === undefined
      ? ""
      : String(data.temperature),
  maxHistoryMessages: data.maxHistoryMessages,
  maxToolRounds: data.maxToolRounds,
  replyDelaySeconds: data.replyDelaySeconds
});

const toPayload = form => ({
  isEnabled: form.isEnabled,
  autoEnableForNewTickets: form.autoEnableForNewTickets,
  allowedNumbers: form.allowedNumbers,
  agentName: form.agentName,
  companyName: form.companyName,
  systemPrompt: form.systemPrompt,
  model: form.model || null,
  temperature: form.temperature === "" ? null : Number(form.temperature),
  maxHistoryMessages: Number(form.maxHistoryMessages),
  maxToolRounds: Number(form.maxToolRounds),
  replyDelaySeconds: Number(form.replyDelaySeconds)
});

const describeTool = call => {
  const label = TOOL_LABELS[call.name] || call.name;
  const appointment = call.result && call.result.appointment;
  if (appointment) {
    return `${label}: ${appointment.date} ${appointment.time}`;
  }
  if (call.name === "check_availability" && call.result) {
    const n = (call.result.available_slots || []).length;
    return `${label}: ${n} horario(s) livre(s)`;
  }
  return label;
};

const SdrAgent = () => {
  const classes = useStyles();

  const [tab, setTab] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [dirty, setDirty] = useState(false);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [leadName, setLeadName] = useState("Maria Souza");
  const chatEnd = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/sdr-agent/settings");
        setForm(toForm(data));
        setDefaultPrompt(data.defaultPrompt || "");
      } catch (err) {
        toastError(err);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (chatEnd.current) chatEnd.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const change = field => event => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/sdr-agent/settings", toPayload(form));
      setForm(toForm(data));
      setDirty(false);
      toast.success("Configuracao do agente salva.");
      return true;
    } catch (err) {
      toastError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [form]);

  const restorePrompt = () => {
    setForm(prev => ({ ...prev, systemPrompt: "" }));
    setDirty(true);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    // O simulador usa a configuracao SALVA: salva antes se houver mudancas.
    if (dirty && !(await save())) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);

    try {
      const { data } = await api.post("/sdr-agent/simulate", {
        messages: next.map(m => ({ role: m.role, content: m.content })),
        contactName: leadName || undefined
      });
      const extra = [];
      if (data.toolCalls && data.toolCalls.length) {
        extra.push({ role: "tools", calls: data.toolCalls });
      }
      if (data.transfers && data.transfers.length) {
        extra.push({
          role: "tools",
          calls: data.transfers.map(t => ({
            name: "transfer_to_human",
            result: { reason: t.reason }
          }))
        });
      }
      setMessages([
        ...next,
        ...extra,
        { role: "assistant", content: data.reply || "(sem resposta)" }
      ]);
    } catch (err) {
      toastError(err);
      setMessages(next);
    }
    setSending(false);
  };

  const onKey = event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>Treinamento da IA (SDR)</Title>
        </MainHeader>
        <Paper className={classes.paper} variant="outlined">
          <CircularProgress />
        </Paper>
      </MainContainer>
    );
  }

  const modelOptions = form.model && !MODELS.includes(form.model) ? [form.model, ...MODELS] : MODELS;

  return (
    <MainContainer>
      <MainHeader>
        <Title>Treinamento da IA (SDR)</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? "Salvando..." : dirty ? "Salvar alteracoes" : "Salvo"}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.paper} variant="outlined">
        <Tabs
          value={tab}
          onChange={(e, value) => setTab(value)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="agent" label="Agente" />
          <Tab value="test" label="Testar conversa" />
          <Tab value="knowledge" label="Base de conhecimento" />
        </Tabs>

        <div style={{ height: 16 }} />

        {tab === "agent" && (
          <>
            <Paper className={classes.card} variant="outlined">
              <Typography className={classes.cardTitle}>Ligar o agente</Typography>
              <Typography className={classes.hint}>
                Desligado, o chat funciona exatamente como antes. Ligado, o agente
                responde so aos atendimentos marcados para ele (ou a todos, se a
                opcao automatica estiver ativa) e sai da conversa quando um
                atendente humano assume.
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={form.isEnabled}
                    onChange={change("isEnabled")}
                  />
                }
                label={form.isEnabled ? "Agente LIGADO" : "Agente desligado"}
              />
              <br />
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={form.autoEnableForNewTickets}
                    onChange={change("autoEnableForNewTickets")}
                  />
                }
                label="Atender automaticamente novos atendimentos (sem precisar marcar um a um)"
              />
            </Paper>

            <Paper className={classes.card} variant="outlined">
              <Typography className={classes.cardTitle}>
                Modo teste: quem o agente pode atender
              </Typography>
              <Typography className={classes.hint}>
                Informe os telefones (com DDD), um por linha ou separados por
                virgula. Preenchido, o agente <b>so responde a esses numeros</b>.
                Deixe vazio para liberar todos. Em testes, use sempre a lista.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder={"11 99999-8888\n5521988887777"}
                value={form.allowedNumbers}
                onChange={change("allowedNumbers")}
              />
              {!form.allowedNumbers.trim() && form.isEnabled && (
                <Typography className={classes.hint} style={{ marginTop: 8 }}>
                  Atencao: lista vazia, o agente pode responder a qualquer
                  atendimento liberado.
                </Typography>
              )}
            </Paper>

            <Paper className={classes.card} variant="outlined">
              <Typography className={classes.cardTitle}>Identidade</Typography>
              <div className={classes.row}>
                <TextField
                  className={classes.grow}
                  label="Nome do agente"
                  variant="outlined"
                  value={form.agentName}
                  onChange={change("agentName")}
                />
                <TextField
                  className={classes.grow}
                  label="Nome da empresa"
                  variant="outlined"
                  value={form.companyName}
                  onChange={change("companyName")}
                  helperText="Usado na variavel {{ empresa }} do prompt"
                />
              </div>
            </Paper>

            <Paper className={classes.card} variant="outlined">
              <Typography className={classes.cardTitle}>
                Prompt (instrucoes do agente)
              </Typography>
              <Typography className={classes.hint}>
                E aqui que voce treina o jeito de falar, o diagnostico e as
                regras. {form.systemPrompt.trim()
                  ? "Voce esta usando um prompt personalizado."
                  : "Campo vazio: usando o prompt padrao da ARKOM (mostrado abaixo)."}
              </Typography>
              <TextField
                className={classes.promptField}
                fullWidth
                multiline
                rows={18}
                variant="outlined"
                value={form.systemPrompt.trim() ? form.systemPrompt : defaultPrompt}
                onChange={change("systemPrompt")}
              />
              <div className={classes.variables}>
                {[
                  "{{ data_hora }}",
                  "{{ data }}",
                  "{{ hora }}",
                  "{{ dia_semana }}",
                  "{{ cliente_nome }}",
                  "{{ cliente_telefone }}",
                  "{{ empresa }}"
                ].map(v => (
                  <Chip key={v} size="small" variant="outlined" label={v} />
                ))}
              </div>
              <Typography className={classes.hint} style={{ marginTop: 8 }}>
                As variaveis acima sao preenchidas automaticamente a cada conversa.
              </Typography>
              <Button
                variant="outlined"
                onClick={restorePrompt}
                disabled={!form.systemPrompt.trim()}
              >
                Restaurar prompt padrao
              </Button>
            </Paper>

            <Paper className={classes.card} variant="outlined">
              <Typography className={classes.cardTitle}>Modelo de IA</Typography>
              <Typography className={classes.hint}>
                Modelos maiores erram menos em contas e seguem melhor o prompt,
                mas custam mais por resposta. Vazio = usa o modelo da tela de
                configuracao da OpenAI.
              </Typography>
              <div className={classes.row}>
                <TextField
                  select
                  className={classes.grow}
                  label="Modelo"
                  variant="outlined"
                  value={form.model}
                  onChange={change("model")}
                >
                  <MenuItem value="">Padrao da configuracao da OpenAI</MenuItem>
                  {modelOptions.map(m => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  className={classes.grow}
                  label="Criatividade (0 a 2)"
                  variant="outlined"
                  type="number"
                  inputProps={{ min: 0, max: 2, step: 0.1 }}
                  value={form.temperature}
                  onChange={change("temperature")}
                  helperText="Vazio = padrao. Menor = mais previsivel"
                />
              </div>
            </Paper>

            <Paper className={classes.card} variant="outlined">
              <Typography className={classes.cardTitle}>Avancado</Typography>
              <div className={classes.row}>
                <TextField
                  className={classes.grow}
                  label="Espera antes de responder (segundos)"
                  variant="outlined"
                  type="number"
                  inputProps={{ min: 0, max: 60 }}
                  value={form.replyDelaySeconds}
                  onChange={change("replyDelaySeconds")}
                  helperText="Junta mensagens picadas do lead em uma resposta so"
                />
                <TextField
                  className={classes.grow}
                  label="Mensagens lembradas"
                  variant="outlined"
                  type="number"
                  inputProps={{ min: 2, max: 100 }}
                  value={form.maxHistoryMessages}
                  onChange={change("maxHistoryMessages")}
                  helperText="Quantas mensagens anteriores a IA le"
                />
                <TextField
                  className={classes.grow}
                  label="Maximo de consultas por resposta"
                  variant="outlined"
                  type="number"
                  inputProps={{ min: 1, max: 10 }}
                  value={form.maxToolRounds}
                  onChange={change("maxToolRounds")}
                  helperText="Quantas vezes pode usar a agenda antes de responder"
                />
              </div>
            </Paper>
          </>
        )}

        {tab === "test" && (
          <>
            <Typography className={classes.hint}>
              Converse com o agente aqui, <b>sem WhatsApp</b>: nada e enviado a
              ninguem. As consultas e os agendamentos usam a agenda de verdade
              (o contato aparece como [SIMULACAO]). A configuracao do agente
              nao precisa estar ligada para testar.
            </Typography>
            <div className={classes.row} style={{ marginBottom: 12 }}>
              <TextField
                className={classes.grow}
                label="Nome do lead (para o teste)"
                variant="outlined"
                size="small"
                value={leadName}
                onChange={event => setLeadName(event.target.value)}
              />
              <Button
                variant="outlined"
                onClick={() => setMessages([])}
                disabled={sending || messages.length === 0}
              >
                Nova conversa
              </Button>
            </div>

            <div className={classes.chatBox}>
              {messages.length === 0 && (
                <div className={classes.empty}>
                  <Typography>Escreva como se fosse o lead.</Typography>
                  <Typography variant="body2">
                    Ex.: "Oi, vim pelo Instagram"
                  </Typography>
                </div>
              )}
              {messages.map((m, index) => {
                if (m.role === "tools") {
                  return (
                    <div key={index} className={classes.toolChips}>
                      {m.calls.map((call, i) => (
                        <Chip
                          key={i}
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={describeTool(call)}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <div
                    key={index}
                    className={m.role === "user" ? classes.bubbleLead : classes.bubbleAgent}
                  >
                    {m.content}
                  </div>
                );
              })}
              {sending && (
                <div className={classes.bubbleAgent}>
                  <CircularProgress size={16} /> &nbsp;{form.agentName || "Agente"} esta escrevendo...
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            <div className={classes.composer}>
              <TextField
                fullWidth
                multiline
                rowsMax={4}
                variant="outlined"
                placeholder="Mensagem do lead (Enter envia)"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={onKey}
                disabled={sending}
              />
              <IconButton
                color="primary"
                onClick={sendMessage}
                disabled={sending || !draft.trim()}
              >
                <SendRoundedIcon />
              </IconButton>
            </div>
          </>
        )}

        {tab === "knowledge" && <KnowledgeBaseTab classes={classes} />}
      </Paper>
    </MainContainer>
  );
};

export default SdrAgent;
