import React, { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import TagSelect from "../TagSelect";

const COLORS = ["#FF1919", "#F59E0B", "#10B981", "#2563EB", "#8B5CF6", "#6B7280"];

const TicketTagsModal = ({ open, onClose, ticketId, initialTagIds = [] }) => {
  const [selectedTagIds, setSelectedTagIds] = useState(initialTagIds);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [creating, setCreating] = useState(false);
  // muda quando uma etiqueta nova e criada: recarrega a lista de etiquetas
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setSelectedTagIds(initialTagIds || []);
  }, [initialTagIds, open]);

  const handleSave = async () => {
    try {
      await api.put(`/tickets/${ticketId}`, {
        tagIds: selectedTagIds
      });
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  // Cria a etiqueta na hora e ja marca nesta conversa.
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post("/tags", { name, color: newColor });
      setSelectedTagIds(prev => [...prev, data.id]);
      setRefreshKey(key => key + 1);
      setNewName("");
      toast.success(`Etiqueta "${name}" criada.`);
    } catch (err) {
      toastError(err);
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("ticketTagsModal.title")}</DialogTitle>
      <DialogContent dividers>
        <TagSelect
          key={refreshKey}
          selectedTagIds={selectedTagIds}
          onChange={setSelectedTagIds}
          label={i18n.t("ticketTagsModal.inputLabel")}
        />

        <Typography variant="body2" style={{ marginTop: 20, fontWeight: 700 }}>
          Criar nova etiqueta
        </Typography>
        <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
          Ela e criada agora e ja fica marcada nesta conversa.
        </Typography>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            size="small"
            variant="outlined"
            label="Nome da etiqueta"
            value={newName}
            onChange={event => setNewName(event.target.value)}
            onKeyDown={event => event.key === "Enter" && (event.preventDefault(), handleCreate())}
            style={{ flex: "1 1 160px" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Cor ${color}`}
                onClick={() => setNewColor(color)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  backgroundColor: color,
                  cursor: "pointer",
                  border: newColor === color ? "3px solid #ffffff" : "2px solid transparent",
                  boxShadow: newColor === color ? `0 0 0 2px ${color}` : "none",
                  padding: 0
                }}
              />
            ))}
          </div>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
          >
            Criar
          </Button>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary" variant="outlined">
          {i18n.t("ticketTagsModal.buttons.cancel")}
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {i18n.t("ticketTagsModal.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TicketTagsModal;
