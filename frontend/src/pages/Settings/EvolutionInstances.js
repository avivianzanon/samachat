import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography
} from "@material-ui/core";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";

const STATE_LABEL = {
  connected: "Conectado",
  connecting: "Aguardando leitura do QR",
  disconnected: "Desconectado"
};
const STATE_COLOR = { connected: "#10B981", connecting: "#F59E0B", disconnected: "#EF4444" };

const ERRORS = {
  ERR_EVOLUTION_NOT_CONFIGURED: "Cadastre o endereço e a chave da Evolution acima para criar e gerir instâncias.",
  ERR_EVOLUTION_UNAUTHORIZED: "A Evolution recusou a chave. Confira e salve de novo.",
  ERR_EVOLUTION_UNREACHABLE: "Não consegui falar com a Evolution. Confira o endereço.",
  ERR_EVOLUTION_REQUEST_FAILED: "A Evolution respondeu com erro. Tente de novo."
};

const STEPS = ["Configurar", "Criando", "QR Code"];

const QR_REFRESH_MS = 20000; // o QR da Evolution expira em cerca de 40 s
const QR_MAX_MS = 120000; // para de renovar depois de ~2 min (evita QR morto para sempre)
const STATE_POLL_MS = 3000;
const LIST_REFRESH_MS = 15000;

// "WhatsApp Vendas" -> "whatsapp-vendas" (nome tecnico aceito pela Evolution).
export const slugify = text =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const useStyles = makeStyles(theme => ({
  head: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  primary: {
    textTransform: "none",
    fontWeight: 600,
    backgroundColor: "#FF1919",
    color: "#FFFFFF",
    boxShadow: "none",
    "&:hover": { backgroundColor: "#E11414", boxShadow: "none" },
    "&.Mui-disabled": { opacity: 0.5, color: "#FFFFFF" }
  },
  outlined: { textTransform: "none", fontWeight: 600 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    marginTop: theme.spacing(1)
  },
  names: { minWidth: 170, flex: "1 1 170px" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.75rem",
    fontWeight: 600,
    borderRadius: 10,
    padding: "1px 10px",
    border: "1px solid"
  },
  defaultChip: {
    fontSize: "0.6875rem",
    fontWeight: 700,
    borderRadius: 8,
    padding: "1px 8px",
    backgroundColor: theme.palette.action.selected,
    marginLeft: theme.spacing(1)
  },
  dot: { width: 7, height: 7, borderRadius: "50%" },
  info: { flex: "1 1 150px", color: theme.palette.text.secondary, fontSize: "0.8125rem" },
  steps: { display: "flex", gap: theme.spacing(1), marginBottom: theme.spacing(2), flexWrap: "wrap" },
  step: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.text.secondary
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${theme.palette.divider}`,
    fontSize: "0.6875rem"
  },
  stepActive: { color: theme.palette.text.primary },
  stepNumberActive: { backgroundColor: "#FF1919", borderColor: "#FF1919", color: "#FFFFFF" },
  qrBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1)
  },
  qrImg: {
    width: 260,
    height: 260,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 8,
    objectFit: "contain"
  },
  note: { color: theme.palette.text.secondary, fontSize: "0.8125rem", lineHeight: 1.5 }
}));

const EvolutionInstances = ({ refreshKey = 0 }) => {
  const classes = useStyles();

  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);

  // Assistente "Nova instancia" / conexao por QR: um dialogo so, em passos.
  const [dialog, setDialog] = useState(null); // null | { step, name }
  const [label, setLabel] = useState("");
  const [technical, setTechnical] = useState("");
  const [technicalTouched, setTechnicalTouched] = useState(false);
  const [makeDefault, setMakeDefault] = useState(false);
  const [qr, setQr] = useState({ img: null, pairingCode: null, loading: false, expired: false });

  const [menu, setMenu] = useState({ anchor: null, name: null });
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(null);

  const dialogNameRef = useRef(null);
  dialogNameRef.current = dialog && dialog.step === "qr" ? dialog.name : null;
  const qrStartedAt = useRef(0);

  const notConfigured = errorCode === "ERR_EVOLUTION_NOT_CONFIGURED";

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/evolution/instances");
      setInstances(Array.isArray(data) ? data : []);
      setErrorCode(null);
    } catch (err) {
      setInstances([]);
      setErrorCode(err?.response?.data?.error || "ERR_EVOLUTION_UNREACHABLE");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const closeDialog = () => setDialog(null);

  const fetchQr = useCallback(
    async name => {
      setQr(prev => ({ ...prev, loading: true, expired: false }));
      try {
        const { data } = await api.get(`/evolution/instances/${encodeURIComponent(name)}/qrcode`);
        if (dialogNameRef.current !== name) return;
        if (data.connected) {
          toast.success("Número conectado!");
          setDialog(null);
          load();
          return;
        }
        setQr({ img: data.qr, pairingCode: data.pairingCode, loading: false, expired: false });
      } catch (err) {
        setQr(prev => ({ ...prev, loading: false }));
        toastError(err);
      }
    },
    [load]
  );

  // Passo "QR Code": renova a imagem, confere se o celular ja leu e desiste depois de ~2 min.
  const qrName = dialog && dialog.step === "qr" ? dialog.name : null;
  useEffect(() => {
    if (!qrName) return undefined;
    const name = qrName;
    qrStartedAt.current = Date.now();

    const refresh = setInterval(() => {
      if (Date.now() - qrStartedAt.current > QR_MAX_MS) {
        setQr(prev => ({ ...prev, expired: true }));
        return;
      }
      fetchQr(name);
    }, QR_REFRESH_MS);

    const poll = setInterval(async () => {
      try {
        const { data } = await api.get(`/evolution/instances/${encodeURIComponent(name)}/state`);
        if (data.state === "connected" && dialogNameRef.current === name) {
          toast.success("Número conectado!");
          setDialog(null);
          load();
        }
      } catch (err) {
        /* tenta de novo no proximo ciclo */
      }
    }, STATE_POLL_MS);

    return () => {
      clearInterval(refresh);
      clearInterval(poll);
    };
  }, [qrName, fetchQr, load]);

  const openCreate = () => {
    setLabel("");
    setTechnical("");
    setTechnicalTouched(false);
    setMakeDefault(instances.length === 0);
    setQr({ img: null, pairingCode: null, loading: false, expired: false });
    setDialog({ step: "form", name: null });
  };

  const openQr = name => {
    setQr({ img: null, pairingCode: null, loading: true, expired: false });
    setDialog({ step: "qr", name });
    fetchQr(name);
  };

  const create = async () => {
    const name = technical.trim();
    if (name.length < 3) return;
    setDialog({ step: "creating", name });
    try {
      const { data } = await api.post("/evolution/instances", {
        name,
        label: label.trim() || undefined,
        isDefault: makeDefault
      });
      toast.success(`Instância "${label.trim() || name}" criada.`);
      setQr({ img: data.qr, pairingCode: data.pairingCode, loading: !data.qr, expired: false });
      setDialog({ step: "qr", name });
      if (!data.qr) fetchQr(name);
      load();
    } catch (err) {
      toastError(err);
      setDialog({ step: "form", name: null });
    }
  };

  const setDefault = async name => {
    setBusy(name);
    try {
      await api.put(`/evolution/instances/${encodeURIComponent(name)}/default`);
      toast.success("Instância padrão atualizada.");
      load();
    } catch (err) {
      toastError(err);
    }
    setBusy(null);
  };

  const logout = async name => {
    setBusy(name);
    try {
      await api.post(`/evolution/instances/${encodeURIComponent(name)}/logout`);
      toast.success("Número desconectado.");
      load();
    } catch (err) {
      toastError(err);
    }
    setBusy(null);
  };

  const remove = async () => {
    const name = toDelete;
    setToDelete(null);
    setBusy(name);
    try {
      await api.delete(`/evolution/instances/${encodeURIComponent(name)}`);
      toast.success("Instância excluída.");
      load();
    } catch (err) {
      toastError(err);
    }
    setBusy(null);
  };

  const refreshOne = async () => {
    setLoading(true);
    await load();
    toast.info("Status atualizado.");
  };

  const closeMenu = () => setMenu({ anchor: null, name: null });
  const menuInstance = instances.find(i => i.name === menu.name);

  const stepIndex = !dialog ? 0 : dialog.step === "form" ? 0 : dialog.step === "creating" ? 1 : 2;

  return (
    <div>
      <div className={classes.head}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Typography style={{ fontWeight: 700 }}>Números conectados (instâncias)</Typography>
          {loading && <CircularProgress size={16} />}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="outlined"
            size="small"
            className={classes.outlined}
            onClick={refreshOne}
            disabled={loading}
          >
            Atualizar status
          </Button>
          <Button
            variant="contained"
            size="small"
            className={classes.primary}
            onClick={openCreate}
            disabled={notConfigured || Boolean(errorCode)}
            title={notConfigured ? "Cadastre o endereço e a chave da Evolution primeiro" : undefined}
          >
            + Adicionar instância
          </Button>
        </div>
      </div>
      <Typography className={classes.note}>
        Cada instância é um número de WhatsApp ligado pela Evolution. Adicione uma instância, leia o QR
        code com o celular (WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho) e o número fica
        conectado. A instância marcada como <strong>Padrão</strong> é a que o chat usa.
      </Typography>

      {errorCode && (
        <Typography
          className={classes.note}
          style={{ marginTop: 8, color: notConfigured ? undefined : "#EF4444" }}
        >
          {ERRORS[errorCode] || "Não foi possível carregar as instâncias."}
        </Typography>
      )}

      {!loading && !errorCode && instances.length === 0 && (
        <Typography className={classes.note} style={{ marginTop: 12 }}>
          Nenhuma instância ainda. Clique em <strong>Adicionar instância</strong>.
        </Typography>
      )}

      {instances.map(inst => (
        <div key={inst.name} className={classes.row}>
          <div className={classes.names}>
            <Typography style={{ fontWeight: 700 }}>
              {inst.label || inst.name}
              {inst.isDefault && <span className={classes.defaultChip}>Padrão</span>}
            </Typography>
            {inst.label && <Typography className={classes.note}>{inst.name}</Typography>}
          </div>
          <span
            className={classes.chip}
            style={{ color: STATE_COLOR[inst.state], borderColor: STATE_COLOR[inst.state] }}
          >
            <span className={classes.dot} style={{ backgroundColor: STATE_COLOR[inst.state] }} />
            {STATE_LABEL[inst.state]}
          </span>
          <span className={classes.info}>
            {inst.number ? `+${inst.number}` : "Sem número conectado"}
            {inst.profileName ? ` · ${inst.profileName}` : ""}
          </span>
          <IconButton
            size="small"
            aria-label={`Ações da instância ${inst.name}`}
            disabled={busy === inst.name}
            onClick={event => setMenu({ anchor: event.currentTarget, name: inst.name })}
          >
            <MoreVertIcon />
          </IconButton>
        </div>
      ))}

      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={closeMenu}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ style: { marginTop: 6, borderRadius: 10, minWidth: 210 } }}
      >
        {menuInstance && menuInstance.state !== "connected" && (
          <MenuItem
            onClick={() => {
              closeMenu();
              openQr(menuInstance.name);
            }}
          >
            Conectar via QR code
          </MenuItem>
        )}
        {menuInstance && !menuInstance.isDefault && (
          <MenuItem
            onClick={() => {
              closeMenu();
              setDefault(menuInstance.name);
            }}
          >
            Definir como padrão
          </MenuItem>
        )}
        {menuInstance && menuInstance.state === "connected" && (
          <MenuItem
            onClick={() => {
              closeMenu();
              logout(menuInstance.name);
            }}
          >
            Desconectar o número
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            closeMenu();
            refreshOne();
          }}
        >
          Atualizar status
        </MenuItem>
        <MenuItem
          onClick={() => {
            const name = menu.name;
            closeMenu();
            setToDelete(name);
          }}
          style={{ color: "#EF4444" }}
        >
          Excluir instância
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(dialog)}
        onClose={dialog && dialog.step === "creating" ? undefined : closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{dialog && dialog.step === "qr" && !dialog.fromCreate ? `Conectar ${dialog.name}` : "Nova instância WhatsApp"}</DialogTitle>
        <DialogContent>
          <div className={classes.steps}>
            {STEPS.map((s, i) => (
              <span key={s} className={`${classes.step} ${i <= stepIndex ? classes.stepActive : ""}`}>
                <span className={`${classes.stepNumber} ${i <= stepIndex ? classes.stepNumberActive : ""}`}>
                  {i + 1}
                </span>
                {s}
              </span>
            ))}
          </div>

          {dialog && dialog.step === "form" && (
            <div>
              <TextField
                fullWidth
                autoFocus
                size="small"
                variant="outlined"
                margin="dense"
                label="Nome da conexão"
                placeholder="ex.: WhatsApp Vendas"
                value={label}
                onChange={e => {
                  const value = e.target.value;
                  setLabel(value);
                  if (!technicalTouched) setTechnical(slugify(value));
                }}
                inputProps={{ maxLength: 60, autoComplete: "off" }}
              />
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                margin="dense"
                label="Nome técnico"
                placeholder="ex.: whatsapp-vendas"
                value={technical}
                onChange={e => {
                  setTechnicalTouched(true);
                  setTechnical(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""));
                }}
                onKeyDown={e => e.key === "Enter" && create()}
                helperText="Identificador na Evolution. 3 a 40 caracteres: letras, números, - e _. Não dá para mudar depois."
                inputProps={{ maxLength: 40, autoComplete: "off" }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    color="primary"
                    checked={makeDefault}
                    onChange={e => setMakeDefault(e.target.checked)}
                  />
                }
                label="Definir como instância padrão do chat"
              />
            </div>
          )}

          {dialog && dialog.step === "creating" && (
            <div className={classes.qrBox}>
              <CircularProgress />
              <Typography className={classes.note}>Criando a instância na Evolution...</Typography>
            </div>
          )}

          {dialog && dialog.step === "qr" && (
            <div className={classes.qrBox}>
              {qr.expired ? (
                <Typography className={classes.note} align="center">
                  O QR expirou. Clique em <strong>Gerar novo QR</strong>.
                </Typography>
              ) : qr.img ? (
                <img className={classes.qrImg} src={qr.img} alt="QR code do WhatsApp" />
              ) : (
                <CircularProgress />
              )}
              {qr.pairingCode && (
                <Typography>
                  Ou digite o código no celular: <strong>{qr.pairingCode}</strong>
                </Typography>
              )}
              <Typography className={classes.note} align="center">
                No celular: WhatsApp &gt; <strong>Aparelhos conectados</strong> &gt;{" "}
                <strong>Conectar um aparelho</strong> e aponte para o QR code. Esta janela fecha sozinha
                quando o número conectar. O QR é renovado a cada 20 segundos.
              </Typography>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          {dialog && dialog.step === "form" && (
            <>
              <Button onClick={closeDialog} className={classes.outlined}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                className={classes.primary}
                onClick={create}
                disabled={technical.trim().length < 3}
              >
                Criar e gerar QR code
              </Button>
            </>
          )}
          {dialog && dialog.step === "qr" && (
            <>
              <Button
                onClick={() => {
                  qrStartedAt.current = Date.now();
                  fetchQr(dialog.name);
                }}
                disabled={qr.loading}
                className={classes.outlined}
              >
                Gerar novo QR
              </Button>
              <Button onClick={closeDialog} className={classes.outlined}>
                Fechar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        title={toDelete ? `Excluir a instância "${toDelete}"?` : ""}
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
      >
        O número será desconectado e a instância apagada na Evolution. Isso não pode ser desfeito.
      </ConfirmationModal>
    </div>
  );
};

export default EvolutionInstances;
