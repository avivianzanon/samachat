import React, { useEffect, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  chips: {
    display: "flex",
    flexWrap: "wrap"
  },
  chip: {
    margin: 2
  },
  emptyOption: {
    whiteSpace: "normal",
    opacity: 1,
    color: theme.palette.text.secondary,
    maxWidth: 260
  }
}));

const TagSelect = ({ selectedTagIds = [], onChange, label, style }) => {
  const classes = useStyles();
  const [tags, setTags] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/tags");
        setTags(Array.isArray(data) ? data : data?.tags || []);
      } catch (err) {
        toastError(err);
      }
      setLoaded(true);
    })();
  }, []);

  const handleChange = event => {
    if (typeof onChange === "function") {
      onChange(event.target.value);
    }
  };

  return (
    <div style={style}>
      <FormControl fullWidth margin="dense" variant="outlined">
        <InputLabel>{label || i18n.t("tags.inputLabel")}</InputLabel>
        <Select
          multiple
          label={label || i18n.t("tags.inputLabel")}
          value={selectedTagIds}
          onChange={handleChange}
          MenuProps={{
            anchorOrigin: {
              vertical: "bottom",
              horizontal: "left"
            },
            transformOrigin: {
              vertical: "top",
              horizontal: "left"
            },
            getContentAnchorEl: null,
            PaperProps: { style: { marginTop: 6, borderRadius: 10, minWidth: 180 } }
          }}
          renderValue={selected => (
            <div className={classes.chips}>
              {selected?.length > 0 &&
                selected.map(id => {
                  const tag = tags.find(item => item.id === id);
                  return tag ? (
                    <Chip
                      key={id}
                      style={{ backgroundColor: tag.color, color: "#ffffff" }}
                      variant="outlined"
                      label={tag.name}
                      className={classes.chip}
                    />
                  ) : null;
                })}
            </div>
          )}
        >
          {loaded && tags.length === 0 && (
            <MenuItem disabled className={classes.emptyOption}>
              <Typography variant="body2" color="inherit">
                Nenhuma tag cadastrada ainda. Crie tags no menu Tags.
              </Typography>
            </MenuItem>
          )}
          {tags.map(tag => (
            <MenuItem key={tag.id} value={tag.id}>
              {tag.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default TagSelect;
