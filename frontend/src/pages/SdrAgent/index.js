import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import { Button, CircularProgress, Paper, Tab, Tabs } from "@material-ui/core";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import AgentTab from "./AgentTab";
import friendlyError from "./friendlyError";
import KnowledgeBaseTab from "./KnowledgeBaseTab";
import useStyles from "./styles";

const emptyForm = {
  isEnabled: false,
  autoEnableForNewTickets: false,
  testMode: false,
  allowedNumbers: "",
  agentName: "",
  companyName: "",
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
  testMode: Boolean(data.testMode),
  allowedNumbers: data.allowedNumbers || "",
  agentName: data.agentName || "",
  companyName: data.companyName || "",
  systemPrompt: data.systemPrompt || "",
  model: data.model || "",
  temperature: data.temperature === null || data.temperature === undefined ? "" : String(data.temperature),
  maxHistoryMessages: data.maxHistoryMessages,
  maxToolRounds: data.maxToolRounds,
  replyDelaySeconds: data.replyDelaySeconds
});

const toPayload = form => ({
  isEnabled: form.isEnabled,
  autoEnableForNewTickets: form.autoEnableForNewTickets,
  testMode: form.testMode,
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

const SdrAgent = () => {
  const classes = useStyles();

  const [tab, setTab] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [openai, setOpenai] = useState({ connected: false, hasKey: false });
  const [closersCount, setClosersCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/sdr-agent/settings");
        setForm(toForm(data));
      } catch (err) {
        friendlyError(err);
      }

      // Status da OpenAI e da agenda: so informam o "o que falta para ligar".
      try {
        const { data } = await api.get("/openai/settings");
        setOpenai({ connected: Boolean(data.isActive && data.apiKey), hasKey: Boolean(data.apiKey) });
      } catch (err) {
        /* sem permissao de ver: segue sem o status */
      }
      try {
        const { data } = await api.get("/agenda/closers");
        setClosersCount(data.filter(c => c.isActive && (c.availabilities || []).length > 0).length);
      } catch (err) {
        /* idem */
      }
      setLoading(false);
    })();
  }, []);

  const setField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const change = field => event => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setField(field, value);
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
      friendlyError(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [form]);

  const header = (
    <MainHeader>
      <Title>Treinamento da IA (SDR)</Title>
      <MainHeaderButtonsWrapper>
        <Button variant="contained" color="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Salvando..." : dirty ? "Salvar alteracoes" : "Tudo salvo"}
        </Button>
      </MainHeaderButtonsWrapper>
    </MainHeader>
  );

  if (loading) {
    return (
      <MainContainer>
        {header}
        <Paper className={classes.paper} variant="outlined">
          <CircularProgress />
        </Paper>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      {header}
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
          <Tab value="knowledge" label="Base de conhecimento" />
        </Tabs>

        <div style={{ height: 16 }} />

        {tab === "agent" && (
          <AgentTab
            classes={classes}
            form={form}
            setField={setField}
            change={change}
            openai={openai}
            closersCount={closersCount}
            dirty={dirty}
            save={save}
          />
        )}

        {tab === "knowledge" && <KnowledgeBaseTab classes={classes} />}
      </Paper>
    </MainContainer>
  );
};

export default SdrAgent;
