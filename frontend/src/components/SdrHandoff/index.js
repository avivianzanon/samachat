import React, { useCallback, useContext, useEffect, useState } from "react";

import { Button, Tooltip, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
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
	agente_desligado: "O agente de IA esta desligado (Treinamento da IA).",
	sem_prompt: "O agente ainda nao tem prompt (Treinamento da IA).",
	atendente_humano: "Um atendente esta com esta conversa.",
	desligado_no_ticket: "A equipe esta com esta conversa. A IA nao responde.",
	ticket_nao_marcado: "A equipe atende primeiro. Clique em IA para a IA assumir.",
	modo_teste_numero_nao_listado: "Modo teste: este numero nao esta na lista da IA.",
};

// Barra "IA | Humano" da conversa: mostra quem esta respondendo e deixa trocar
// com um clique. "Humano" assume a conversa para voce (ja pode responder; nao
// existe mais o passo de "aceitar"). "IA" devolve a conversa para o agente.
const SdrHandoff = ({ ticket }) => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);
	const [info, setInfo] = useState(null);
	const [busy, setBusy] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const load = useCallback(async () => {
		try {
			const { data } = await api.get(`/tickets/${ticket.id}/sdr-agent`);
			setInfo(data);
		} catch (err) {
			setInfo(null);
		}
	}, [ticket.id]);

	useEffect(() => {
		load();
	}, [load, ticket.status, ticket.userId, ticket.sdrAgentEnabled]);

	if (!info || ticket.status === "closed") return null;

	const aiAvailable = info.agentEnabled && info.hasPrompt;
	const mine = ticket.status === "open" && ticket.userId === user?.id;
	const unassigned = ticket.status === "pending" || !ticket.userId;

	const change = async mode => {
		setBusy(true);
		try {
			const { data } = await api.put(`/tickets/${ticket.id}/sdr-agent`, { mode });
			setInfo(data);
			toast.success(
				mode === "ai"
					? "A IA voltou a atender esta conversa."
					: "Voce assumiu a conversa. A IA parou de responder."
			);
		} catch (err) {
			toastError(err);
		}
		setBusy(false);
	};

	const onAi = () => {
		if (!aiAvailable || info.mode === "ai" || busy) return;
		// Se um atendente esta com a conversa, avisa que ela sai do nome dele.
		if (ticket.userId) setConfirmOpen(true);
		else change("ai");
	};

	// Assumir tambem vale para conversa sem dono (ex.: agente desligado).
	const onHuman = () => {
		if (busy || (info.mode === "human" && mine)) return;
		change("human");
	};

	let caption;
	if (info.mode === "ai") {
		caption = "A IA esta respondendo este cliente. Clique em Humano para assumir.";
	} else if (mine) {
		caption = "Voce esta atendendo esta conversa.";
	} else if (unassigned) {
		caption = aiAvailable
			? "Ninguem assumiu ainda. Clique em Humano para responder, ou em IA para a IA atender."
			: `${REASONS[info.reason] || "A equipe esta atendendo."} Clique em Humano para responder.`;
	} else {
		caption = REASONS[info.reason] || "A equipe esta atendendo.";
	}

	return (
		<div className={classes.root}>
			<div className={classes.texts}>
				<span className={classes.label}>Quem esta atendendo esta conversa</span>
				<Typography className={classes.caption}>{caption}</Typography>
			</div>
			<div className={classes.group}>
				<span className={classes.segment}>
					<Tooltip
						title={
							aiAvailable
								? "A IA responde o cliente automaticamente"
								: "Ligue o agente e crie o prompt em Treinamento da IA"
						}
					>
						<span>
							<Button
								size="small"
								className={`${classes.option} ${info.mode === "ai" ? classes.optionAi : ""}`}
								onClick={onAi}
								disabled={busy || !aiAvailable}
							>
								IA
							</Button>
						</span>
					</Tooltip>
					<Tooltip title="Voce assume a conversa e a IA para">
						<span>
							<Button
								size="small"
								className={`${classes.option} ${mine || (info.mode === "human" && !unassigned) ? classes.optionHuman : ""}`}
								onClick={onHuman}
								disabled={busy}
							>
								Humano
							</Button>
						</span>
					</Tooltip>
				</span>
			</div>

			<ConfirmationModal
				title="Devolver a conversa para a IA?"
				open={confirmOpen}
				onClose={setConfirmOpen}
				onConfirm={() => change("ai")}
			>
				A IA volta a responder este cliente e a conversa sai do nome do atendente.
			</ConfirmationModal>
		</div>
	);
};

export default SdrHandoff;
