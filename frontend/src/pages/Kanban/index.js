import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import {
  Button,
  IconButton,
  InputAdornment,
  makeStyles,
  Paper,
  TextField,
  Typography,
  FormControl,
  MenuItem,
  Select
} from "@material-ui/core";
import { Add, DeleteOutline, Edit, Search } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import QueueSelect from "../../components/QueueSelect";
import TagSelect from "../../components/TagSelect";
import KanbanColumnModal from "../../components/KanbanColumnModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const AUTO_LABELS = {
  ai: "Auto: IA atendeu",
  human: "Auto: humano atende"
};

const REFRESH_MS = 10000;

const useStyles = makeStyles(theme => ({
  headerTitle: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: theme.spacing(0.5)
  },
  pageSubtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.9375rem",
    fontWeight: 300,
    lineHeight: 1.6
  },
  headerTopRow: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    flexWrap: "wrap"
  },
  filtersRow: {
    width: "100%",
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginTop: theme.spacing(1)
  },
  searchField: {
    width: 240,
    flex: "0 0 240px",
    margin: 0,
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      flexBasis: "100%"
    }
  },
  // Setores, Tags e Atendente: mesma largura e mesma linha (cada seletor trazia
  // uma margem diferente, deixando um mais baixo que o outro).
  filterField: {
    width: 180,
    minWidth: 180,
    flex: "0 0 180px",
    "& > div": { marginTop: "0 !important", marginBottom: "0 !important" },
    "& .MuiFormControl-root": { margin: 0 },
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      minWidth: "100%",
      flexBasis: "100%"
    }
  },
  userFilter: {
    width: 180,
    minWidth: 180,
    flex: "0 0 180px",
    margin: 0
  },
  actionButton: {
    borderRadius: 4,
    textTransform: "none",
    fontWeight: 600,
    boxShadow: "none !important",
    backgroundImage: "none !important",
    backgroundColor: "#FF1919 !important",
    color: "#FFFFFF !important",
    "&:hover": {
      backgroundColor: "#E11414 !important",
      boxShadow: "none !important"
    }
  },
  board: {
    display: "flex",
    gap: theme.spacing(2),
    overflowX: "auto",
    padding: theme.spacing(1),
    flex: 1,
    alignItems: "flex-start"
  },
  column: {
    flex: "0 0 280px",
    width: 280,
    background: theme.palette.background.paper,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 260px)"
  },
  columnHeader: {
    padding: theme.spacing(1.25, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1)
  },
  columnTitleBlock: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2
  },
  columnTitle: {
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  columnName: {
    lineHeight: 1.25,
    wordBreak: "break-word"
  },
  columnCount: {
    background: theme.palette.action.selected,
    color: theme.palette.text.primary,
    borderRadius: 12,
    padding: "1px 8px",
    fontSize: "0.75rem",
    fontWeight: 600,
    flex: "none"
  },
  autoTag: {
    alignSelf: "flex-start",
    fontSize: "0.6875rem",
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: "0 7px"
  },
  columnBody: {
    padding: theme.spacing(1),
    overflowY: "auto",
    flex: 1
  },
  card: {
    padding: theme.spacing(1.2),
    marginBottom: theme.spacing(1),
    cursor: "grab",
    border: `1px solid ${theme.palette.divider}`
  },
  cardTitle: {
    fontWeight: 600
  },
  cardMeta: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary
  },
  emptyColumn: {
    padding: theme.spacing(1),
    color: theme.palette.text.secondary,
    textAlign: "center"
  },
  columnActions: {
    display: "flex",
    alignItems: "center",
    flex: "none"
  }
}));

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();

  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [queueIds, setQueueIds] = useState([]);
  const [tagIds, setTagIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");

  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [columnToDelete, setColumnToDelete] = useState(null);

  const boardRef = useRef(null);
  const scrollToEndRef = useRef(false);
  const draggingRef = useRef(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/users", {
        params: { searchParam: "", pageNumber: 1 }
      });
      setUsers(data?.users || []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const fetchBoard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get("/kanban", {
          params: {
            searchParam,
            queueIds: JSON.stringify(queueIds || []),
            userId: userId || undefined,
            tagIds: JSON.stringify(tagIds || [])
          }
        });
        setColumns(data || []);
        setLoading(false);
      } catch (err) {
        if (!silent) toastError(err);
        setLoading(false);
      }
    },
    [searchParam, queueIds, userId, tagIds]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Atualiza sozinho: quando a IA responde ou alguem assume uma conversa, o
  // cliente muda de coluna no servidor e o quadro acompanha.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!draggingRef.current && !document.hidden) fetchBoard(true);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchBoard]);

  // Depois de criar uma coluna, rola o quadro ate ela (ela nasce no fim e
  // ficava escondida fora da tela).
  useEffect(() => {
    if (scrollToEndRef.current && boardRef.current) {
      scrollToEndRef.current = false;
      boardRef.current.scrollTo({
        left: boardRef.current.scrollWidth,
        behavior: "smooth"
      });
    }
  }, [columns]);

  const handleOpenColumnModal = column => {
    setSelectedColumn(column || null);
    setColumnModalOpen(true);
  };

  const handleCloseColumnModal = result => {
    setColumnModalOpen(false);
    setSelectedColumn(null);
    if (result && result.created) scrollToEndRef.current = true;
    fetchBoard(true);
  };

  const handleDeleteColumn = async () => {
    if (!columnToDelete) return;
    try {
      await api.delete(`/kanban/columns/${columnToDelete.id}`);
      toast.success("Coluna excluída.");
      setColumnToDelete(null);
      fetchBoard(true);
    } catch (err) {
      setColumnToDelete(null);
      toastError(err);
    }
  };

  const handleCardClick = ticketId => {
    history.push(`/tickets/${ticketId}`);
  };

  const resolveCardTitle = ticket => {
    if (ticket.contact?.name) {
      return ticket.contact.name;
    }

    return ticket.contact?.number || `#${ticket.id}`;
  };

  const buildMovePayload = useCallback(
    (nextColumns, ticketId, targetColumnId) => {
      const targetColumn = nextColumns.find(c => c.id === targetColumnId);
      const orderedTicketIds = targetColumn
        ? targetColumn.cards.map(card => card.ticket.id)
        : [];

      return { orderedTicketIds, ticketId, columnId: targetColumnId };
    },
    []
  );

  const applyMove = useCallback(
    (ticketId, sourceColumnId, targetColumnId, targetIndex) => {
      const nextColumns = columns.map(column => ({
        ...column,
        cards: [...column.cards]
      }));

      const sourceColumn = nextColumns.find(column => column.id === sourceColumnId);
      const targetColumn = nextColumns.find(column => column.id === targetColumnId);

      if (!sourceColumn || !targetColumn) {
        return null;
      }

      const cardIndex = sourceColumn.cards.findIndex(
        card => card.ticket.id === ticketId
      );
      if (cardIndex === -1) {
        return null;
      }

      const [card] = sourceColumn.cards.splice(cardIndex, 1);

      if (typeof targetIndex !== "number" || targetIndex < 0) {
        targetColumn.cards.push(card);
      } else {
        targetColumn.cards.splice(targetIndex, 0, card);
      }

      return nextColumns;
    },
    [columns]
  );

  const handleDrop = async (event, targetColumnId, targetIndex) => {
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = false;
    const raw = event.dataTransfer.getData("text/plain");

    if (!raw) {
      return;
    }

    const payload = JSON.parse(raw);
    const ticketId = Number(payload.ticketId);
    const sourceColumnId = Number(payload.columnId);

    if (!ticketId || !sourceColumnId || !targetColumnId) {
      return;
    }

    const nextColumns = applyMove(
      ticketId,
      sourceColumnId,
      targetColumnId,
      targetIndex
    );

    if (!nextColumns) {
      return;
    }

    setColumns(nextColumns);

    const movePayload = buildMovePayload(nextColumns, ticketId, targetColumnId);

    try {
      await api.post("/kanban/move", movePayload);
    } catch (err) {
      toastError(err);
    }
  };

  const handleDragStart = (event, ticketId, columnId) => {
    draggingRef.current = true;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ ticketId, columnId })
    );
  };

  const handleDragEnd = () => {
    draggingRef.current = false;
  };

  const handleDragOver = event => {
    event.preventDefault();
  };

  const renderCard = (card, columnId, index) => (
    <Paper
      key={card.ticket.id}
      className={classes.card}
      elevation={1}
      draggable
      onDragStart={event => handleDragStart(event, card.ticket.id, columnId)}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={event => handleDrop(event, columnId, index)}
      onClick={() => handleCardClick(card.ticket.id)}
    >
      <Typography className={classes.cardTitle}>{resolveCardTitle(card.ticket)}</Typography>
      <Typography className={classes.cardMeta}>
        {card.ticket.queue?.name || i18n.t("kanban.card.noQueue")}
      </Typography>
      <Typography className={classes.cardMeta}>
        {card.ticket.user?.name || i18n.t("kanban.card.noUser")}
      </Typography>
      <Typography className={classes.cardMeta}>
        {card.ticket.lastMessage || "-"}
      </Typography>
    </Paper>
  );

  const columnsWithCounts = useMemo(
    () =>
      columns.map(column => ({
        ...column,
        count: column.cards?.length || 0
      })),
    [columns]
  );

  return (
    <MainContainer>
      <KanbanColumnModal
        open={columnModalOpen}
        onClose={handleCloseColumnModal}
        column={selectedColumn}
      />
      <ConfirmationModal
        title={columnToDelete ? `Excluir a coluna "${columnToDelete.name}"?` : ""}
        open={Boolean(columnToDelete)}
        onClose={() => setColumnToDelete(null)}
        onConfirm={handleDeleteColumn}
      >
        Os clientes dessa coluna não são apagados: eles voltam para a coluna que
        combina com a situação deles.
      </ConfirmationModal>
      <MainHeader>
        <div className={classes.headerTopRow}>
          <div className={classes.headerTitle}>
            <Title>{i18n.t("kanban.title")}</Title>
            <Typography className={classes.pageSubtitle}>{i18n.t("kanban.subtitle")}</Typography>
          </div>
          <Button
            variant="contained"
            color="primary"
            className={classes.actionButton}
            startIcon={<Add />}
            onClick={() => handleOpenColumnModal(null)}
          >
            {i18n.t("kanban.buttons.addColumn")}
          </Button>
        </div>
        <div className={classes.filtersRow}>
          <TextField
            className={classes.searchField}
            placeholder={i18n.t("kanban.searchPlaceholder")}
            type="search"
            variant="outlined"
            margin="dense"
            value={searchParam}
            onChange={event => setSearchParam(event.target.value.toLowerCase())}
            inputProps={{ autoComplete: "off", name: "pipeline-search" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" color="disabled" />
                </InputAdornment>
              )
            }}
          />
          <div className={classes.filterField}>
            <QueueSelect selectedQueueIds={queueIds} onChange={setQueueIds} />
          </div>
          <div className={classes.filterField}>
            <TagSelect selectedTagIds={tagIds} onChange={setTagIds} />
          </div>
          <FormControl variant="outlined" margin="dense" className={classes.userFilter}>
            <Select
              value={userId}
              onChange={event => setUserId(event.target.value)}
              MenuProps={{
                anchorOrigin: { vertical: "bottom", horizontal: "left" },
                transformOrigin: { vertical: "top", horizontal: "left" },
                getContentAnchorEl: null,
                PaperProps: { style: { marginTop: 6, borderRadius: 10, minWidth: 180 } }
              }}
              displayEmpty
              renderValue={selected => {
                if (!selected) {
                  return i18n.t("kanban.filters.user");
                }

                const selectedUser = users.find(user => user.id === selected);
                return selectedUser?.name || i18n.t("kanban.filters.user");
              }}
            >
              <MenuItem value="">{i18n.t("kanban.filters.allUsers")}</MenuItem>
              {users.map(user => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </MainHeader>
      <div className={classes.board} ref={boardRef}>
        {loading && (
          <Typography color="textSecondary">{i18n.t("kanban.loading")}</Typography>
        )}
        {!loading &&
          columnsWithCounts.map(column => (
            <div
              key={column.id}
              className={classes.column}
              onDragOver={handleDragOver}
              onDrop={event => handleDrop(event, column.id)}
            >
              <div className={classes.columnHeader}>
                <div className={classes.columnTitleBlock}>
                  <div className={classes.columnTitle}>
                    <Typography variant="subtitle1" className={classes.columnName}>
                      {column.name}
                    </Typography>
                    <span className={classes.columnCount}>{column.count}</span>
                  </div>
                  {column.autoRule && AUTO_LABELS[column.autoRule] && (
                    <span className={classes.autoTag}>{AUTO_LABELS[column.autoRule]}</span>
                  )}
                </div>
                <div className={classes.columnActions}>
                  <IconButton
                    size="small"
                    title="Editar coluna"
                    onClick={() => handleOpenColumnModal(column)}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    title="Excluir coluna"
                    onClick={() => setColumnToDelete(column)}
                  >
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </div>
              </div>
              <div className={classes.columnBody}>
                {column.cards?.length === 0 && (
                  <div className={classes.emptyColumn}>
                    {i18n.t("kanban.emptyColumn")}
                  </div>
                )}
                {column.cards?.map((card, index) =>
                  renderCard(card, column.id, index)
                )}
              </div>
            </div>
          ))}
      </div>
    </MainContainer>
  );
};

export default Kanban;
