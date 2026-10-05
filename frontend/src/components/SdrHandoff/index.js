import React, { useCallback, useEffect, useState } from "react";

import { Button, Tooltip, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		flexWrap: "wrap",
		gap: theme.spacing(1),
		flex: "none",
		margin: theme.spacing(0.5, 0),
		padding: theme.spacing(1, 1.75),
		borderRadius: theme.shape.borderRadius + 6,
		border: `1px solid ${theme.palette.divider}`,
		backgroundColor: theme.palette.background.paper,
	},
	texts: {
		display: "flex",
		flexDirection: "column",
		minWidth: 0,
		flex: "1 1 240px",
	},
	group: {
		display: "inline-flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
	label: {
		fontSize: "0.75rem",
		fontWeight: 700,
		color: theme.palette.text.secondary,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	segment: {
		display: "inline-flex",
		borderRadius: 8,
		overflow: "hidden",
		border: `1px solid ${theme.palette.divider}`,
	},
	option: {
		textTransform: "none",
		fontWeight: 700,
		borderRadius: 0,
		minWidth: 76,
		boxShadow: "none !important",
		color: theme.palette.text.primary,
		backgroundColor: "transparent",
	},
	optionAi: {
		backgroundColor: "#FF1919 !important",
		color: "#FFFFFF !important",
	},
	optionHuman: {
		backgroundColor: "#2563EB !important",
		color: "#FFFFFF !important",
	},
	caption: {
		fontSize: "0.8125rem",
		color: theme.palette.text.secondary,
	},
}));

// Por que a conversa esta com a equipe, em linguagem simples.
const REASONS = {
	agente_desligado: "O agente esta desligado em Treinamento da IA.",
	sem_prompt: "O agente ainda nao tem prompt (Treinamento da IA).",
	atendente_humano: "Um atendente assumiu a conversa.",
	desligado_no_ticket: "Passada para a equipe. Aceite o atendimento para responder.",
	ticket_nao_marcado: "A equipe atende primeiro. Clique em IA para a IA assumir.",
	modo_teste_numero_nao_listado: "Modo teste: este numero nao esta na lista da IA.",
};

// Botao "IA | Humano" do atendimento: mostra quem esta respondendo esta
// conversa e deixa passar para a IA ou para a equipe com um clique.
const SdrHandoff = ({ ticket }) => {
	const classes = useStyles();
	const [info, setInfo] = useState(null);
	const [busy, setBusy] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const load = useCallback(async () => {
		try {
			const { data } = await api.get(`/tickets/${ticket.id}/sdr-agent`);
			setInfo(data);
		} catch (err) {
			setInfo(null); // sem permissao ou agente indisponivel: nao mostra nada
		}
	}, [ticket.id]);

	// Recarrega quando a conversa muda (aceitar, devolver, passar para IA...).
	useEffect(() => {
		load();
	}, [load, ticket.status, ticket.userId, ticket.sdrAgentEnabled]);

	if (!info || ticket.status === "closed") return null;
	// Agente nunca configurado e conversa sem marcacao: nao polui a tela.
	if (!info.agentEnabled && ticket.sdrAgentEnabled === null) return null;

	const change = async mode => {
		setBusy(true);
		try {
			const { data } = await api.put(`/tickets/${ticket.id}/sdr-agent`, { mode });
			setInfo(data);
			toast.success(
				mode === "ai"
					? "A IA voltou a atender esta conversa."
					: "Conversa passada para a equipe. Aceite o atendimento para responder."
			);
		} catch (err) {
			toastError(err);
		}
		setBusy(false);
	};

	const onAi = () => {
		if (info.mode === "ai" || busy) return;
		// Se um atendente esta com a conversa, avisa que ela sai do nome dele.
		if (ticket.status === "open") setConfirmOpen(true);
		else change("ai");
	};

	const onHuman = () => {
		if (info.mode === "human" || busy) return;
		change("human");
	};

	return (
		<div className={classes.root}>
			<div className={classes.texts}>
				<span className={classes.label}>Quem esta atendendo esta conversa</span>
				<Typography className={classes.caption}>
					{info.mode === "ai"
						? "A IA esta respondendo este cliente. Clique em Humano para a equipe assumir."
						: REASONS[info.reason] || "A equipe esta atendendo."}
				</Typography>
			</div>
			<div className={classes.group}>
				<span className={classes.segment}>
					<Tooltip title="A IA responde o cliente automaticamente">
						<Button
							size="small"
							className={`${classes.option} ${info.mode === "ai" ? classes.optionAi : ""}`}
							onClick={onAi}
							disabled={busy}
						>
							IA
						</Button>
					</Tooltip>
					<Tooltip title="A IA para e a equipe atende">
						<Button
							size="small"
							className={`${classes.option} ${info.mode === "human" ? classes.optionHuman : ""}`}
							onClick={onHuman}
							disabled={busy}
						>
							Humano
						</Button>
					</Tooltip>
				</span>
			</div>

			<ConfirmationModal
				title="Devolver a conversa para a IA?"
				open={confirmOpen}
				onClose={setConfirmOpen}
				onConfirm={() => change("ai")}
			>
				A IA volta a responder este cliente e a conversa sai do nome do atendente e volta para "Aguardando".
			</ConfirmationModal>
		</div>
	);
};

export default SdrHandoff;
