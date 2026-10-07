import React, { useEffect, useState } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField
} from "@material-ui/core";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const ColumnSchema = Yup.object().shape({
  name: Yup.string().min(2, "Too Short!").max(60, "Too Long!").required("Required")
});

// Quando o cliente entra sozinho nesta coluna.
const AUTO_OPTIONS = [
  { value: "", label: "Nunca (só movo manualmente)" },
  { value: "ai", label: "Quando a IA atender o cliente" },
  { value: "human", label: "Quando um humano assumir o cliente" }
];

const KanbanColumnModal = ({ open, onClose, column }) => {
  const initialState = {
    name: "",
    isActive: true,
    autoRule: ""
  };

  const [formData, setFormData] = useState(initialState);

  useEffect(() => {
    if (!column) {
      setFormData(initialState);
      return;
    }

    setFormData({
      name: column.name || "",
      isActive: column.isActive !== false,
      autoRule: column.autoRule || ""
    });
  }, [column, open]);

  const handleClose = result => {
    onClose(result);
    setFormData(initialState);
  };

  const handleSave = async values => {
    const payload = {
      name: values.name,
      autoRule: values.autoRule || null
    };

    try {
      if (column?.id) {
        await api.put(`/kanban/columns/${column.id}`, payload);
      } else {
        await api.post("/kanban/columns", payload);
      }
      toast.success(i18n.t("kanban.columnModal.success"));
      handleClose({ saved: true, created: !column?.id });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={() => handleClose()} maxWidth="sm" fullWidth>
      <DialogTitle>
        {column?.id
          ? `${i18n.t("kanban.columnModal.title.edit")}`
          : `${i18n.t("kanban.columnModal.title.add")}`}
      </DialogTitle>
      <Formik
        initialValues={formData}
        enableReinitialize
        validationSchema={ColumnSchema}
        onSubmit={(values, actions) => {
          handleSave(values).finally(() => actions.setSubmitting(false));
        }}
      >
        {({ values, touched, errors, setFieldValue, isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Field
                as={TextField}
                label={i18n.t("kanban.columnModal.form.name")}
                name="name"
                fullWidth
                autoFocus
                error={touched.name && Boolean(errors.name)}
                helperText={
                  touched.name && errors.name
                    ? errors.name
                    : i18n.t("kanban.columnModal.form.nameHelper")
                }
                variant="outlined"
                margin="dense"
              />
              <TextField
                select
                fullWidth
                variant="outlined"
                margin="dense"
                label="Mover clientes para cá automaticamente"
                value={values.autoRule}
                onChange={event => setFieldValue("autoRule", event.target.value)}
                helperText="Se escolher uma opção, o cliente entra nesta coluna sozinho. Você ainda pode arrastar para outra coluna quando quiser."
              >
                {AUTO_OPTIONS.map(option => (
                  <MenuItem key={option.value || "none"} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleClose()} color="secondary" variant="outlined">
                {i18n.t("kanban.columnModal.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={isSubmitting}
                variant="contained"
              >
                {column?.id
                  ? `${i18n.t("kanban.columnModal.buttons.okEdit")}`
                  : `${i18n.t("kanban.columnModal.buttons.okAdd")}`}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default KanbanColumnModal;
