import React, { useState, useEffect } from "react";
import { Link, useHistory, useLocation } from "react-router-dom";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Select from "@material-ui/core/Select";
import Button from "@material-ui/core/Button";
import PillTabs from "../../components/PillTabs";
import CodeIcon from "@material-ui/icons/Code";
import LinkIcon from "@material-ui/icons/Link";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import TuneIcon from "@material-ui/icons/Tune";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import OpenAI from "../OpenAI";
import ApiAdmin from "../ApiAdmin";
import Integrations from "../Integrations";
import IntegrationForm from "./IntegrationForm";
import EvolutionInstances from "./EvolutionInstances";

const VOICES = [
  { value: "33B4UnXyTNbgLmdEDh5P", label: "Keren — feminina, brasileira (padrão)" },
  { value: "9BWtsMINqrJLrRacOk9x", label: "Aria — feminina, natural" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — feminina, suave" },
  { value: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — feminina, expressiva" },
  { value: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — feminina, calorosa" },
  { value: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger — masculina, confiante" },
  { value: "IKne3meq5aSn9XLyUdCD", label: "Charlie — masculina, casual" },
  { value: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — masculina, articulada" },
  { value: "bIHbv24MWmeRgasZH58o", label: "Will — masculina, amigável" },
  { value: "nPczCjzI2devNBz1zQrb", label: "Brian — masculina, profunda" }
];

const VOICE_MODELS = [
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 (recomendado)" },
  { value: "eleven_turbo_v2", label: "Turbo v2" },
  { value: "eleven_multilingual_v2", label: "Multilingual v2" }
];

const ELEVENLABS_FIELDS = [
  { key: "apiKey", type: "secret", label: "Chave da API da ElevenLabs", full: true, required: true },
  { key: "voiceId", type: "select", label: "Voz", options: VOICES },
  { key: "model", type: "select", label: "Modelo", options: VOICE_MODELS },
  {
    key: "audioReply",
    type: "switch",
    label: "Responder em áudio quando o cliente mandar áudio",
    helper:
      "O agente entende o áudio (precisa da OpenAI ativa) e responde falando. Se a voz falhar, ele responde por texto."
  },
  { key: "stability", type: "slider", label: "Estabilidade", helper: "Mais alto = voz mais constante." },
  { key: "similarityBoost", type: "slider", label: "Semelhança com a voz original" },
  { key: "style", type: "slider", label: "Expressividade" },
  { key: "speakerBoost", type: "switch", label: "Reforçar a clareza da voz" }
];

const GEMINI_FIELDS = [
  { key: "apiKey", type: "secret", label: "Chave da API do Google (Gemini)", full: true, required: true },
  {
    key: "model",
    type: "select",
    label: "Modelo",
    full: true,
    options: [
      { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash — rápido e econômico (recomendado)" },
      { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro — respostas mais elaboradas" }
    ]
  }
];

const CLAUDE_FIELDS = [
  { key: "apiKey", type: "secret", label: "Chave da API da Anthropic (Claude)", full: true, required: true },
  {
    key: "model",
    type: "select",
    label: "Modelo",
    full: true,
    options: [
      { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — equilíbrio entre qualidade e custo (recomendado)" },
      { value: "claude-opus-5-5", label: "Claude Opus 5.5 — o mais capaz" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — rápido e econômico" }
    ]
  }
];

const EVOLUTION_FIELDS = [
  {
    key: "apiUrl",
    type: "text",
    label: "Endereço da Evolution API",
    placeholder: "https://evolution.suaempresa.com",
    full: true,
    required: true
  },
  { key: "apiKey", type: "secret", label: "Chave da API (apikey)", full: true, required: true }
];

const META_FIELDS = [
  { key: "accessToken", type: "secret", label: "Token de acesso permanente", full: true, required: true },
  { key: "phoneNumberId", type: "text", label: "ID do número de telefone", required: true },
  { key: "businessAccountId", type: "text", label: "ID da conta do WhatsApp Business" },
  {
    key: "verifyToken",
    type: "secret",
    label: "Token de verificação do webhook",
    helper: "Você inventa este texto e cola o mesmo na Meta."
  },
  { key: "appSecret", type: "secret", label: "Segredo do app (App Secret)" }
];

const SECTIONS = [
  { id: "geral", label: "Geral", icon: <TuneIcon fontSize="small" /> },
  { id: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon fontSize="small" /> },
  { id: "apis", label: "APIs", icon: <CodeIcon fontSize="small" /> },
  { id: "webhooks", label: "Webhooks", icon: <LinkIcon fontSize="small" /> }
];

const useStyles = makeStyles(theme => ({
  headerBlock: {
    flex: "1 1 100%",
    minWidth: 0,
    marginRight: "auto"
  },
  pageHeader: {
    marginBottom: theme.spacing(2)
  },
  pageSubtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.9375rem",
    fontWeight: 300,
    lineHeight: 1.6
  },
  layout: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(0, 2, 2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0, 1, 1)
    }
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    width: "100%"
  },
  section: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: "none",
    boxShadow: "none",
    width: "100%",
    boxSizing: "border-box"
  },
  sectionHeader: {
    marginBottom: theme.spacing(2)
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: "1.0625rem"
  },
  sectionText: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
    fontWeight: 300,
    lineHeight: 1.5
  },
  note: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
    lineHeight: 1.5
  },
  settingRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap"
  },
  settingMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: "1 1 240px"
  },
  settingOption: {
    marginLeft: "auto"
  },
  divider: {
    height: 1,
    backgroundColor: theme.palette.divider,
    margin: theme.spacing(2.5, 0)
  }
}));

const Section = ({ classes, title, description, children }) => (
  <Paper className={classes.section} variant="outlined">
    {(title || description) && (
      <div className={classes.sectionHeader}>
        {title && <Typography className={classes.sectionTitle}>{title}</Typography>}
        {description && (
          <Typography className={classes.sectionText}>{description}</Typography>
        )}
      </div>
    )}
    {children}
  </Paper>
);

const Settings = () => {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();

  const requested = new URLSearchParams(location.search).get("secao");
  const active = SECTIONS.some(s => s.id === requested) ? requested : "geral";

  const [settings, setSettings] = useState([]);
  // Muda quando um canal de WhatsApp e salvo: recarrega os dois (so um fica ativo).
  const [channelVersion, setChannelVersion] = useState(0);
  // Idem para as IAs (Claude, OpenAI, Gemini): so uma conversa com os leads.
  const [engineVersion, setEngineVersion] = useState(0);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await api.get("/settings");
        setSettings(data);
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("settings", data => {
      if (data.action === "update") {
        setSettings(prevState => {
          const aux = [...prevState];
          const settingIndex = aux.findIndex(s => s.key === data.setting.key);
          if (settingIndex !== -1) aux[settingIndex].value = data.setting.value;
          return aux;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const go = id => history.replace(`/settings?secao=${id}`);

  const handleChangeSetting = async e => {
    const selectedValue = e.target.value;
    const settingKey = e.target.name;

    try {
      await api.put(`/settings/${settingKey}`, {
        value: selectedValue
      });
      toast.success(i18n.t("settings.success"));
    } catch (err) {
      toastError(err);
    }
  };

  const getSettingValue = key => {
    const found = settings.find(s => s.key === key);
    return found ? found.value : "enabled";
  };

  return (
    <MainContainer>
      <MainHeader>
        <div className={classes.headerBlock}>
          <div className={classes.pageHeader}>
            <Title>{i18n.t("settings.title")}</Title>
            <Typography variant="body2" className={classes.pageSubtitle}>
              Preferências do sistema e conexão com outros serviços.
            </Typography>
          </div>
        </div>
        <div />
      </MainHeader>

      <div className={classes.layout}>
        <PillTabs tabs={SECTIONS} value={active} onChange={go} />

        <div className={classes.content}>
          {active === "geral" && (
            <Section
              classes={classes}
              title="Geral"
              description="Regras básicas de acesso ao sistema."
            >
              <div className={classes.settingRow}>
                <div className={classes.settingMeta}>
                  <Typography variant="body1">
                    {i18n.t("settings.settings.userCreation.name")}
                  </Typography>
                  <Typography variant="caption" className={classes.pageSubtitle}>
                    {i18n.t("settings.settings.userCreation.description")}
                  </Typography>
                </div>
                <Select
                  margin="dense"
                  variant="outlined"
                  native
                  id="userCreation-setting"
                  name="userCreation"
                  value={settings.length > 0 ? getSettingValue("userCreation") : "enabled"}
                  className={classes.settingOption}
                  onChange={handleChangeSetting}
                >
                  <option value="enabled">
                    {i18n.t("settings.settings.userCreation.options.enabled")}
                  </option>
                  <option value="disabled">
                    {i18n.t("settings.settings.userCreation.options.disabled")}
                  </option>
                </Select>
              </div>
            </Section>
          )}

          {active === "apis" && (
            <>
              <div className={classes.note}>
                <strong>IA que conversa com os leads:</strong> escolha <strong>uma</strong> entre Claude,
                OpenAI e Gemini. Só uma fica ativa por vez; para trocar, desative a atual e ative a outra.
                A chave da OpenAI também é usada para entender áudios e na base de conhecimento, mesmo
                quando outra IA está ativa.
              </div>
              <Section
                classes={classes}
                title="Claude (Anthropic)"
                description="A IA da Anthropic. Gere a chave em console.anthropic.com."
              >
                <IntegrationForm
                  key={`claude-${engineVersion}`}
                  provider="claude"
                  title="Status"
                  fields={CLAUDE_FIELDS}
                  engine
                  activeLabel="Usar o Claude para conversar com os leads"
                  testLabel="Testar conexão"
                  onSaved={() => setEngineVersion(v => v + 1)}
                />
              </Section>
              <Section
                classes={classes}
                title="OpenAI"
                description="A IA da OpenAI. O prompt, a base de conhecimento e o modo teste ficam em Treinamento da IA."
              >
                <OpenAI
                  key={`openai-${engineVersion}`}
                  embedded
                  simple
                  onSaved={() => setEngineVersion(v => v + 1)}
                />
                <div className={classes.divider} />
                <Button
                  component={Link}
                  to="/sdr-agent"
                  variant="outlined"
                  color="primary"
                  style={{ textTransform: "none", fontWeight: 600 }}
                >
                  Ir para o Treinamento da IA
                </Button>
              </Section>
              <Section
                classes={classes}
                title="Gemini (Google)"
                description="A IA do Google, a mesma que a BIA usa. Gere a chave no Google AI Studio (aistudio.google.com)."
              >
                <IntegrationForm
                  key={`gemini-${engineVersion}`}
                  provider="gemini"
                  title="Status"
                  fields={GEMINI_FIELDS}
                  engine
                  activeLabel="Usar o Gemini para conversar com os leads"
                  testLabel="Testar conexão"
                  onSaved={() => setEngineVersion(v => v + 1)}
                />
              </Section>
              <Section
                classes={classes}
                title="ElevenLabs (voz)"
                description="Voz que o agente usa para responder em áudio, como na BIA."
              >
                <IntegrationForm
                  provider="elevenlabs"
                  title="Status"
                  fields={ELEVENLABS_FIELDS}
                  activeLabel="Usar a ElevenLabs"
                  testLabel="Testar voz"
                />
              </Section>
            </>
          )}

          {active === "whatsapp" && (
            <>
              <div className={classes.note}>
                A conexão por <strong>QR code</strong> continua no menu <strong>Conexões</strong>. Aqui
                ficam as credenciais dos outros serviços. O botão de teste confere a conexão de verdade,
                mas o envio e o recebimento de mensagens pela Evolution e pela API oficial da Meta ainda{" "}
                <strong>não estão ligados ao chat</strong>.
              </div>
              <Section
                classes={classes}
                title="Evolution API"
                description="Conecta números de WhatsApp pela Evolution, como na BIA."
              >
                <IntegrationForm
                  key={`evolution-${channelVersion}`}
                  provider="evolution"
                  title="Status"
                  fields={EVOLUTION_FIELDS}
                  activeLabel="Usar a Evolution API"
                  exclusiveWith="meta"
                  exclusiveLabel="a API oficial da Meta"
                  activeHelper="Só um canal de WhatsApp fica ativo por vez."
                  onSaved={() => setChannelVersion(v => v + 1)}
                />
                <div className={classes.divider} />
                <EvolutionInstances refreshKey={channelVersion} />
              </Section>
              <Section
                classes={classes}
                title="WhatsApp oficial (Meta)"
                description="Cloud API oficial do WhatsApp Business, como na BIA."
              >
                <IntegrationForm
                  key={`meta-${channelVersion}`}
                  provider="meta"
                  title="Status"
                  fields={META_FIELDS}
                  activeLabel="Usar a API oficial"
                  exclusiveWith="evolution"
                  exclusiveLabel="a Evolution API"
                  activeHelper="Só um canal de WhatsApp fica ativo por vez."
                  onSaved={() => setChannelVersion(v => v + 1)}
                />
              </Section>
            </>
          )}

          {active === "webhooks" && (
            <>
              <Section
                classes={classes}
                title="Acesso à API do SamaChat"
                description="Outros sistemas usam este token para ler os dados do SamaChat. Somente leitura."
              >
                <ApiAdmin embedded />
              </Section>
              <Section
                classes={classes}
                title="Avisos para outros sistemas"
                description="O SamaChat avisa CRM, Make, n8n e similares quando algo acontece no chat."
              >
                <Integrations embedded />
              </Section>
            </>
          )}
        </div>
      </div>
    </MainContainer>
  );
};

export default Settings;
