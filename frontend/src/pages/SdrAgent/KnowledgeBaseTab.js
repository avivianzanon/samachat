import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import {
  Button,
  CircularProgress,
  IconButton,
  Paper,
  TextField,
  Typography
} from "@material-ui/core";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import api from "../../services/api";
import friendlyError from "./friendlyError";

const formatDate = value => {
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch (err) {
    return "";
  }
};

const KnowledgeBaseTab = ({ classes }) => {
  const [files, setFiles] = useState([]);
  const [maxChars, setMaxChars] = useState(90000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const fileInput = useRef(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/sdr-agent/knowledge");
      setFiles(data.files);
      setMaxChars(data.maxChars);
    } catch (err) {
      friendlyError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setSaving(true);
    try {
      await api.post("/sdr-agent/knowledge", { name, content });
      toast.success("Documento adicionado a base.");
      setName("");
      setContent("");
      await load();
    } catch (err) {
      friendlyError(err);
    }
    setSaving(false);
  };

  const pickFile = event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setName(prev => prev || file.name);
      setContent(String(reader.result || ""));
    };
    reader.onerror = () => toast.error("Nao consegui ler o arquivo.");
    reader.readAsText(file, "UTF-8");
  };

  const remove = async file => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remover "${file.name}" da base de conhecimento?`)) return;
    try {
      await api.delete(`/sdr-agent/knowledge/${file.id}`);
      toast.success("Documento removido.");
      await load();
    } catch (err) {
      friendlyError(err);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.post("/sdr-agent/knowledge/search", { query });
      setHits(data.hits);
    } catch (err) {
      friendlyError(err);
    }
    setSearching(false);
  };

  const tooLarge = content.length > maxChars;
  const canAdd = name.trim() && content.trim() && !tooLarge && !saving;

  return (
    <>
      <Typography className={classes.hint}>
        Coloque aqui o que o agente precisa saber para responder bem: planos e
        precos, cases, perguntas frequentes, regras, politicas. A cada mensagem
        do lead, o agente consulta a base e usa so os trechos relacionados.
        Ele nao inventa o que nao estiver aqui nem no prompt.
      </Typography>

      <Paper className={classes.card} variant="outlined">
        <Typography className={classes.cardTitle}>Adicionar documento</Typography>
        <Typography className={classes.hint}>
          Cole o texto ou envie um arquivo de texto (.txt, .md, .csv, .json).
          Para PDF ou Word, copie o conteudo e cole aqui.
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          label="Nome do documento (ex.: Planos e precos)"
          value={name}
          onChange={event => setName(event.target.value)}
          style={{ marginBottom: 12 }}
        />
        <TextField
          fullWidth
          multiline
          rows={8}
          variant="outlined"
          label="Conteudo"
          value={content}
          onChange={event => setContent(event.target.value)}
          error={tooLarge}
          helperText={`${content.length.toLocaleString("pt-BR")} / ${maxChars.toLocaleString(
            "pt-BR"
          )} caracteres${tooLarge ? " (grande demais: divida em partes)" : ""}`}
        />
        <div className={classes.row} style={{ marginTop: 12 }}>
          <Button variant="contained" color="primary" onClick={add} disabled={!canAdd}>
            {saving ? "Adicionando..." : "Adicionar a base"}
          </Button>
          <Button variant="outlined" onClick={() => fileInput.current.click()}>
            Enviar arquivo de texto
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.md,.csv,.json,text/plain"
            style={{ display: "none" }}
            onChange={pickFile}
          />
        </div>
      </Paper>

      <Paper className={classes.card} variant="outlined">
        <Typography className={classes.cardTitle}>
          Documentos na base ({files.length})
        </Typography>
        {loading && <CircularProgress size={20} />}
        {!loading && files.length === 0 && (
          <Typography className={classes.hint}>
            Nenhum documento ainda. O agente esta usando so o prompt.
          </Typography>
        )}
        {files.map(file => (
          <div
            key={file.id}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography style={{ fontWeight: 600 }} noWrap>
                {file.name}
              </Typography>
              <Typography className={classes.hint} style={{ margin: 0 }}>
                {file.charCount.toLocaleString("pt-BR")} caracteres,{" "}
                {file.chunkCount} trecho(s), adicionado em {formatDate(file.createdAt)}
              </Typography>
            </div>
            <IconButton size="small" onClick={() => remove(file)} title="Remover">
              <DeleteOutlineIcon />
            </IconButton>
          </div>
        ))}
      </Paper>

      <Paper className={classes.card} variant="outlined">
        <Typography className={classes.cardTitle}>Testar a busca</Typography>
        <Typography className={classes.hint}>
          Digite uma pergunta de lead e veja quais trechos o agente receberia.
        </Typography>
        <div className={classes.row}>
          <TextField
            className={classes.grow}
            variant="outlined"
            size="small"
            placeholder="Ex.: quanto custa? tem garantia?"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => event.key === "Enter" && search()}
          />
          <Button
            variant="outlined"
            onClick={search}
            disabled={searching || !query.trim() || files.length === 0}
          >
            {searching ? "Buscando..." : "Buscar"}
          </Button>
        </div>
        {hits && hits.length === 0 && (
          <Typography className={classes.hint} style={{ marginTop: 12 }}>
            Nenhum trecho relacionado. O agente responderia so com o prompt.
          </Typography>
        )}
        {hits &&
          hits.map((hit, index) => (
            <Paper
              key={index}
              variant="outlined"
              style={{ padding: 12, marginTop: 12 }}
            >
              <Typography className={classes.hint} style={{ margin: 0 }}>
                {hit.fileName} (relevancia {Math.round(hit.score * 100)}%)
              </Typography>
              <Typography style={{ whiteSpace: "pre-wrap", fontSize: "0.875rem" }}>
                {hit.content}
              </Typography>
            </Paper>
          ))}
      </Paper>
    </>
  );
};

export default KnowledgeBaseTab;
