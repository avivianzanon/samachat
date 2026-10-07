import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
	createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ContactModal from "../ContactModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const filter = createFilterOptions({
	trim: true,
});

const NewTicketModal = ({ modalOpen, onClose }) => {
	const history = useHistory();

	const [options, setOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [selectedContact, setSelectedContact] = useState(null);
	const [newContact, setNewContact] = useState({});
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const { user } = useContext(AuthContext);

	// Ao digitar (ou abrir), volta para a primeira pagina.
	useEffect(() => {
		setPage(1);
	}, [searchParam, modalOpen]);

	// Ao abrir ja mostra TODOS os contatos (20 por vez, em ordem alfabetica; ao rolar
	// ate o fim carrega mais). Digitar filtra a lista, com qualquer quantidade de letras.
	useEffect(() => {
		if (!modalOpen) {
			setLoading(false);
			return undefined;
		}
		let cancelled = false;
		setLoading(true);
		const delayDebounceFn = setTimeout(
			() => {
				const fetchContacts = async () => {
					try {
						const { data } = await api.get("contacts", {
							params: { searchParam, pageNumber: page },
						});
						if (cancelled) return;
						setOptions(prev => (page === 1 ? data.contacts : [...prev, ...data.contacts]));
						setHasMore(Boolean(data.hasMore));
						setLoading(false);
					} catch (err) {
						if (cancelled) return;
						setLoading(false);
						toastError(err);
					}
				};

				fetchContacts();
			},
			searchParam && page === 1 ? 200 : 0
		);
		return () => {
			cancelled = true;
			clearTimeout(delayDebounceFn);
		};
	}, [searchParam, modalOpen, page]);

	const handleListScroll = event => {
		const el = event.currentTarget;
		if (hasMore && !loading && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
			setPage(current => current + 1);
		}
	};

	const handleClose = () => {
		onClose();
		setSearchParam("");
		setSelectedContact(null);
	};

	const handleSaveTicket = async contactId => {
		if (!contactId) return;
		setLoading(true);
		try {
			const { data: ticket } = await api.post("/tickets", {
				contactId: contactId,
				userId: user.id,
				status: "open",
			});
			history.push(`/tickets/${ticket.id}`);
		} catch (err) {
			toastError(err);
		}
		setLoading(false);
		handleClose();
	};

	const handleSelectOption = (e, newValue) => {
		if (newValue?.number) {
			// Clicou no contato: abre a conversa na hora (a pessoa envia a 1a mensagem la).
			setSelectedContact(newValue);
			handleSaveTicket(newValue.id);
		} else if (newValue?.name) {
			openNewContact(newValue.name);
		}
	};

	// "Adicionar novo contato": se o que foi digitado parece numero, ja preenche o telefone.
	const openNewContact = typed => {
		const text = String(typed || "").trim();
		const digits = text.replace(/\D/g, "");
		const looksLikeNumber = digits.length >= 8 && /^[\d\s()+-]+$/.test(text);
		setNewContact(looksLikeNumber ? { number: digits } : text ? { name: text } : {});
		setContactModalOpen(true);
	};

	const handleCloseContactModal = () => {
		setContactModalOpen(false);
	};

	const handleAddNewContactTicket = contact => {
		handleSaveTicket(contact.id);
	};

	const createAddContactOption = (filterOptions, params) => {
		const filtered = filter(filterOptions, params);

		if (params.inputValue !== "" && !loading) {
			filtered.push({
				name: `${params.inputValue}`,
			});
		}

		return filtered;
	};

	const renderOption = option => {
		if (option.number) {
			return `${option.name} - ${option.number}`;
		} else {
			return `${i18n.t("newTicketModal.add")} ${option.name}`;
		}
	};

	const renderOptionLabel = option => {
		if (option.number) {
			return `${option.name} - ${option.number}`;
		} else {
			return `${option.name}`;
		}
	};

	return (
		<>
			<ContactModal
				open={contactModalOpen}
				initialValues={newContact}
				onClose={handleCloseContactModal}
				onSave={handleAddNewContactTicket}
			></ContactModal>
			<Dialog open={modalOpen} onClose={handleClose}>
				<DialogTitle id="form-dialog-title">
					{i18n.t("newTicketModal.title")}
				</DialogTitle>
				<DialogContent dividers>
					<Autocomplete
						options={options}
						loading={loading}
						style={{ width: 380 }}
						ListboxProps={{ onScroll: handleListScroll, style: { maxHeight: 320 } }}
						clearOnBlur
						autoHighlight

						openOnFocus
						freeSolo
						clearOnEscape
						getOptionLabel={renderOptionLabel}
						renderOption={renderOption}
						filterOptions={createAddContactOption}
						onChange={(e, newValue) => handleSelectOption(e, newValue)}
						renderInput={params => (
							<TextField
								{...params}
								label={i18n.t("newTicketModal.fieldLabel")}
								variant="outlined"
								autoFocus
								onChange={e => setSearchParam(e.target.value)}
								InputProps={{
									...params.InputProps,
									endAdornment: (
										<React.Fragment>
											{loading ? (
												<CircularProgress color="inherit" size={20} />
											) : null}
											{params.InputProps.endAdornment}
										</React.Fragment>
									),
								}}
							/>
						)}
					/>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => openNewContact(searchParam)}
						color="primary"
						variant="contained"
						disabled={loading}
						style={{ marginRight: "auto" }}
					>
						+ Adicionar novo contato
					</Button>
					<Button
						onClick={handleClose}
						color="secondary"
						disabled={loading}
						variant="outlined"
					>
						{i18n.t("newTicketModal.buttons.cancel")}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
};

export default NewTicketModal;
