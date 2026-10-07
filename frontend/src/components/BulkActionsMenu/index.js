import React, { useState } from "react";

import Button from "@material-ui/core/Button";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import Typography from "@material-ui/core/Typography";
import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";

// Menu "Ações" das listas: so aparece quando ha itens marcados. Mostra quantos
// estao selecionados e o que da para fazer com eles em lote.
//   actions: [{ label, onClick, disabled }]
const BulkActionsMenu = ({ count, actions = [], onClear }) => {
	const [anchorEl, setAnchorEl] = useState(null);

	if (!count) return null;

	const close = () => setAnchorEl(null);

	return (
		<>
			<Typography
				variant="body2"
				color="textSecondary"
				style={{ fontWeight: 600 }}
			>
				{count} selecionado(s)
			</Typography>
			<Button
				variant="outlined"
				color="primary"
				endIcon={<ArrowDropDownIcon />}
				onClick={event => setAnchorEl(event.currentTarget)}
				style={{ textTransform: "none", fontWeight: 600 }}
			>
				Ações
			</Button>
			<Menu
				anchorEl={anchorEl}
				open={Boolean(anchorEl)}
				onClose={close}
				getContentAnchorEl={null}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
				transformOrigin={{ vertical: "top", horizontal: "left" }}
			>
				{actions.map(action => (
					<MenuItem
						key={action.label}
						disabled={action.disabled}
						onClick={() => {
							close();
							action.onClick();
						}}
					>
						{action.label}
					</MenuItem>
				))}
				{onClear && (
					<MenuItem
						onClick={() => {
							close();
							onClear();
						}}
					>
						Limpar seleção
					</MenuItem>
				)}
			</Menu>
		</>
	);
};

export default BulkActionsMenu;
