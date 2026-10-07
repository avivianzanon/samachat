import React, { useEffect, useRef, useState } from "react";

import {
  Button,
  Chip,
  CircularProgress,
  IconButton,
  TextField,
  Typography
} from "@material-ui/core";
import SendRoundedIcon from "@material-ui/icons/SendRounded";

import api from "../../services/api";
import friendlyError from "./friendlyError";

const TOOL_LABELS = {
  check_availability: "Consultou a agenda",
  create_appointment: "Agendou reuniao",
  reschedule_appointment: "Remarcou reuniao",
  cancel_appointment: "Cancelou reuniao",
  transfer_to_human: "Passou para humano"
};

const describeTool = call => {
  if (call.name === "knowledge") {
    return `Consultou a base: ${call.file} (${Math.round(call.score * 100)}%)`;
  }
  const label = TOOL_LABELS[call.name] || call.name;
  const appointment = call.result && call.result.appointment;
  if (appointment) return `${label}: ${appointment.date} ${appointment.time}`;
  if (call.name === "check_availability" && call.result) {
    const n = (call.result.available_slots || []).length;
    return `${label}: ${n} horario(s) livre(s)`;
  }
  return label;
};

// Conversa de teste com o agente, sem WhatsApp. Usa a configuracao SALVA: se
// houver mudancas nao salvas, `onBeforeSend` salva antes de enviar.
const SimulatorPanel = ({ classes, agentName, ready, notReadyText, dirty, onBeforeSend }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [leadName, setLeadName] = useState("Maria Souza");
  const chatEnd = useRef(null);

  useEffect(() => {
    if (chatEnd.current) chatEnd.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !ready) return;
    if (dirty && !(await onBeforeSend())) return;

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
      const calls = [
        ...(data.knowledge || []).map(k => ({ name: "knowledge", file: k.fileName, score: k.score })),
        ...(data.toolCalls || []),
        ...(data.transfers || []).map(t => ({ name: "transfer_to_human", result: t }))
      ];
      if (calls.length) extra.push({ role: "tools", calls });

      setMessages([...next, ...extra, { role: "assistant", content: data.reply || "(sem resposta)" }]);
    } catch (err) {
      friendlyError(err);
      setMessages(next);
    }
    setSending(false);
  };

  const onKey = event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <>
      <Typography className={classes.hint}>
        Converse como se fosse um cliente. <b>Nada e enviado pelo WhatsApp.</b> As
        consultas e os agendamentos usam a agenda de verdade (o contato aparece
        como [SIMULACAO]).
      </Typography>

      {!ready && <div className={classes.warnBox}>{notReadyText}</div>}

      <div className={classes.row} style={{ margin: "12px 0" }}>
        <TextField
          className={classes.grow}
          label="Nome do cliente (para o teste)"
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
            <Typography>Escreva a primeira mensagem do cliente.</Typography>
            <Typography variant="body2">Ex.: "Oi, vim pelo Instagram"</Typography>
          </div>
        )}
        {messages.map((m, index) =>
          m.role === "tools" ? (
            <div key={index} className={classes.toolChips}>
              {m.calls.map((call, i) => (
                <Chip key={i} size="small" color="primary" variant="outlined" label={describeTool(call)} />
              ))}
            </div>
          ) : (
            <div key={index} className={m.role === "user" ? classes.bubbleLead : classes.bubbleAgent}>
              {m.content}
            </div>
          )
        )}
        {sending && (
          <div className={classes.bubbleAgent}>
            <CircularProgress size={16} /> &nbsp;{agentName || "O agente"} esta escrevendo...
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
          placeholder="Mensagem do cliente (Enter envia)"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKey}
          disabled={sending || !ready}
        />
        <IconButton color="primary" onClick={send} disabled={sending || !ready || !draft.trim()}>
          <SendRoundedIcon />
        </IconButton>
      </div>
    </>
  );
};

export default SimulatorPanel;
