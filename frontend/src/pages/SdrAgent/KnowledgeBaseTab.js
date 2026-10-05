import React from "react";
import { Paper, Typography } from "@material-ui/core";

// Espaco reservado: a base de conhecimento entra na proxima etapa.
const KnowledgeBaseTab = ({ classes }) => (
  <Paper className={classes.card} variant="outlined">
    <Typography className={classes.cardTitle}>Base de conhecimento</Typography>
    <Typography className={classes.hint}>
      Em construcao: aqui voce vai enviar textos e documentos (precos, cases,
      perguntas frequentes) para o agente consultar nas respostas.
    </Typography>
  </Paper>
);

export default KnowledgeBaseTab;
