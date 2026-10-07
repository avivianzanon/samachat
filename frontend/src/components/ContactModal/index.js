import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import TagSelect from "../TagSelect";

// Cores vem do tema (claro/escuro): nada fixo aqui.
const useStyles = makeStyles(theme => ({
	dialogTitle: {
		fontWeight: 700,
		fontSize: "1.05rem",
	},
	dialogContent: {
		display: "flex",
		flexDirection: "column",
		gap: theme.spacing(0.5),
	},
	row: {
		display: "flex",
		gap: theme.spacing(1.5),
		flexWrap: "wrap",
		"& > *": {
			flex: "1 1 220px",
		},
	},
	extraAttr: {
		display: "flex",
		alignItems: "flex-start",
		gap: theme.spacing(1),
	},
	sectionTitle: {
		fontWeight: 700,
		marginTop: theme.spacing(1.5),
	},
	sectionHint: {
		color: theme.palette.text.secondary,
		fontSize: "0.8125rem",
		marginBottom: theme.spacing(0.5),
	},
	dialogActions: {
		padding: theme.spacing(2),
	},
	btnWrapper: {
		position: "relative",
	},
	primaryButton: {
		borderRadius: 4,
		textTransform: "none",
		fontWeight: 600,
		boxShadow: "none",
		backgroundColor: "#FF1919",
		color: "#FFFFFF",
		"&:hover": {
			backgroundColor: "#E11414",
			boxShadow: "none",
		},
	},
	secondaryButton: {
		borderRadius: 4,
		textTransform: "none",
		fontWeight: 500,
	},
	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
}));

const ContactSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
	number: Yup.string().min(8, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email"),
});

const ContactModal = ({ open, onClose, contactId, initialValues, onSave }) => {
	const classes = useStyles();
	const isMounted = useRef(true);

	const initialState = {
		name: "",
		number: "",
		email: "",
		tagIds: [],
	};

	const [contact, setContact] = useState(initialState);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	useEffect(() => {
		const fetchContact = async () => {
			if (initialValues) {
				setContact(prevState => {
					return { ...prevState, ...initialValues };
				});
			}

			if (!contactId) return;

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact({
						...data,
						tagIds: data?.tags ? data.tags.map(tag => tag.id) : [],
					});
				}
			} catch (err) {
				toastError(err);
			}
		};

		fetchContact();
	}, [contactId, open, initialValues]);

	const handleClose = () => {
		onClose();
		setContact(initialState);
	};

	const handleSaveContact = async values => {
		try {
			if (contactId) {
				await api.put(`/contacts/${contactId}`, values);
				handleClose();
			} else {
				const { data } = await api.post("/contacts", values);
				if (onSave) {
					onSave(data);
				}
				handleClose();
			}
			toast.success(i18n.t("contactModal.success"));
		} catch (err) {
			toastError(err);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="sm"
			fullWidth
			scroll="paper"
		>
			<DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
				{contactId
					? `${i18n.t("contactModal.title.edit")}`
					: `${i18n.t("contactModal.title.add")}`}
			</DialogTitle>
			<Formik
				initialValues={contact}
				enableReinitialize={true}
				validationSchema={ContactSchema}
				onSubmit={(values, actions) => {
					handleSaveContact(values).finally(() => actions.setSubmitting(false));
				}}
			>
				{({ values, errors, touched, isSubmitting, setFieldValue }) => (
					<Form>
						<DialogContent dividers className={classes.dialogContent}>
							<Typography variant="subtitle1" className={classes.sectionTitle} style={{ marginTop: 0 }}>
								{i18n.t("contactModal.form.mainInfo")}
							</Typography>
							<div className={classes.row}>
								<Field
									as={TextField}
									label={i18n.t("contactModal.form.name")}
									name="name"
									autoFocus
									error={touched.name && Boolean(errors.name)}
									helperText={
										touched.name && errors.name
											? errors.name
											: i18n.t("contactModal.form.nameHelper")
									}
									variant="outlined"
									margin="dense"
								/>
								<Field
									as={TextField}
									label={i18n.t("contactModal.form.number")}
									name="number"
									error={touched.number && Boolean(errors.number)}
									helperText={
										touched.number && errors.number
											? errors.number
											: i18n.t("contactModal.form.numberHelper")
									}
									placeholder="5513912344321"
									variant="outlined"
									margin="dense"
								/>
							</div>
							<Field
								as={TextField}
								label={i18n.t("contactModal.form.email")}
								name="email"
								error={touched.email && Boolean(errors.email)}
								helperText={
									touched.email && errors.email
										? errors.email
										: i18n.t("contactModal.form.emailHelper")
								}
								fullWidth
								margin="dense"
								variant="outlined"
							/>

							<Typography variant="subtitle1" className={classes.sectionTitle}>
								{i18n.t("contactModal.form.tags")}
							</Typography>
							<TagSelect
								selectedTagIds={values.tagIds || []}
								onChange={ids => setFieldValue("tagIds", ids)}
								label={i18n.t("contactModal.form.tagsPlaceholder")}
							/>

							<Typography variant="subtitle1" className={classes.sectionTitle}>
								{i18n.t("contactModal.form.extraInfo")}
							</Typography>
							<FieldArray name="extraInfo">
								{({ push, remove }) => (
									<>
										{values.extraInfo &&
											values.extraInfo.length > 0 &&
											values.extraInfo.map((info, index) => (
												<div className={classes.extraAttr} key={`${index}-info`}>
													<Field
														as={TextField}
														label={i18n.t("contactModal.form.extraName")}
														name={`extraInfo[${index}].name`}
														variant="outlined"
														margin="dense"
														style={{ flex: 1 }}
													/>
													<Field
														as={TextField}
														label={i18n.t("contactModal.form.extraValue")}
														name={`extraInfo[${index}].value`}
														variant="outlined"
														margin="dense"
														style={{ flex: 1 }}
													/>
													<IconButton
														size="small"
														style={{ marginTop: 14 }}
														onClick={() => remove(index)}
													>
														<DeleteOutlineIcon />
													</IconButton>
												</div>
											))}
										<div>
											<Button
												variant="outlined"
												color="primary"
												className={classes.secondaryButton}
												onClick={() => push({ name: "", value: "" })}
											>
												{`+ ${i18n.t("contactModal.buttons.addExtraInfo")}`}
											</Button>
										</div>
									</>
								)}
							</FieldArray>
						</DialogContent>
						<DialogActions className={classes.dialogActions}>
							<Button
								onClick={handleClose}
								color="secondary"
								disabled={isSubmitting}
								variant="outlined"
								className={classes.secondaryButton}
							>
								{i18n.t("contactModal.buttons.cancel")}
							</Button>
							<Button
								type="submit"
								color="primary"
								disabled={isSubmitting}
								variant="contained"
								className={`${classes.btnWrapper} ${classes.primaryButton}`}
							>
								{contactId
									? `${i18n.t("contactModal.buttons.okEdit")}`
									: `${i18n.t("contactModal.buttons.okAdd")}`}
								{isSubmitting && (
									<CircularProgress size={24} className={classes.buttonProgress} />
								)}
							</Button>
						</DialogActions>
					</Form>
				)}
			</Formik>
		</Dialog>
	);
};

export default ContactModal;
