import React, { useContext, useEffect, useState } from "react";

import IconButton from "@material-ui/core/IconButton";
import { makeStyles } from "@material-ui/core/styles";
import AndroidIcon from "@material-ui/icons/Android";
import PersonIcon from "@material-ui/icons/Person";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import useSdrStatus, { invalidateSdrStatus } from "../../hooks/useSdrStatus";
import effectiveSdrMode from "../../utils/sdrMode";
import ConfirmationModal from "../ConfirmationModal";

const useStyles = makeStyles(theme => ({
	root: {
		display: "inline-flex",
		alignItems: "center",
		gap: 4,
		flex: "none",
	},
	button: {
		padding: 6,
		backgroundColor: theme.custom ? theme.custom.softBackground : "transparent",
		border: `1px solid ${theme.palette.divider}`,
		color: theme.palette.text.secondary,
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
	},
	ai: {
		backgroundColor: "#FF1919 !important",
		borderColor: "#FF1919 !important",
		color: "#FFFFFF !important",
	},
	human: {
		backgroundColor: "#2563EB !important",
		borderColor: "#2563EB !important",
		color: "#FFFFFF !important",
	},
	disabled: {
		opacity: 0.4,
	},
}));

// Dois botoes so de icone: robo (IA atende) e pessoa (humano atende). O botao
// do lado que esta atendendo fica colorido. Clicar no outro passa a conversa:
// - Humano: voce assume na hora (ja pode responder; nao ha "aceitar").
// - IA: devolve a conversa para o agente.
const SdrHandoffButtons = ({ ticket }) => {
	const classes = useStyles();
	const { user } = useContext(AuthContext);
	const status = useSdrStatus();
	const [busy, setBusy] = useState(false);
	const [override, setOverride] = useState(null);
	const [confirmOpen, setConfirmOpen] = useState(false);

	// Quando a conversa muda de verdade (socket), vale o que veio do servidor.
	useEffect(() => {
		setOverride(null);
	}, [ticket.status, ticket.userId, ticket.sdrAgentEnabled]);

	if (ticket.status === "closed") return null;

	const aiAvailable = Boolean(status && status.isEnabled && status.hasPrompt);
	const computed = effectiveSdrMode(ticket, status);
	const mode = override || computed || (ticket.userId ? "human" : null);
	const mine = ticket.status === "open" && ticket.userId === user?.id;

	const change = async next => {
		setBusy(true);
		try {
			await api.put(`/tickets/${ticket.id}/sdr-agent`, { mode: next });
			setOverride(next);
			invalidateSdrStatus();
			toast.success(
				next === "ai"
					? "A IA voltou a atender esta conversa."
					: "Voce assumiu a conversa. A IA parou de responder."
			);
		} catch (err) {
			toastError(err);
		}
		setBusy(false);
	};

	const onAi = e => {
		e.stopPropagation();
		if (!aiAvailable || mode === "ai" || busy) return;
		if (ticket.userId) setConfirmOpen(true);
		else change("ai");
	};

	const onHuman = e => {
		e.stopPropagation();
		if (busy || (mode === "human" && mine)) return;
		change("human");
	};

	const aiTitle = !aiAvailable
		? "IA indisponivel: ligue o agente e crie o prompt em Treinamento da IA"
		: mode === "ai"
		? "A IA esta atendendo esta conversa"
		: "Passar a conversa para a IA";
	const humanTitle = mine
		? "Voce esta atendendo esta conversa"
		: mode === "human"
		? "Um atendente esta com esta conversa. Clique para assumir"
		: "Assumir a conversa (a IA para)";

	return (
		<span className={classes.root} onClick={e => e.stopPropagation()}>
			<span title={aiTitle}>
				<IconButton
					size="small"
					className={`${classes.button} ${mode === "ai" ? classes.ai : ""} ${!aiAvailable ? classes.disabled : ""}`}
					onClick={onAi}
					disabled={busy}
					aria-label="IA"
				>
					<AndroidIcon fontSize="small" />
				</IconButton>
			</span>
			<span title={humanTitle}>
				<IconButton
					size="small"
					className={`${classes.button} ${mode === "human" ? classes.human : ""}`}
					onClick={onHuman}
					disabled={busy}
					aria-label="Humano"
				>
					<PersonIcon fontSize="small" />
				</IconButton>
			</span>

			<ConfirmationModal
				title="Devolver a conversa para a IA?"
				open={confirmOpen}
				onClose={setConfirmOpen}
				onConfirm={() => change("ai")}
			>
				A IA volta a responder este cliente e a conversa sai do nome do atendente.
			</ConfirmationModal>
		</span>
	);
};

export default SdrHandoffButtons;
