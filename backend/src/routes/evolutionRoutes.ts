import express from "express";
import isAuth from "../middleware/isAuth";
import checkSectorPermission from "../middleware/checkSectorPermission";

import * as EvolutionInstanceController from "../controllers/EvolutionInstanceController";

const evolutionRoutes = express.Router();

const view = [isAuth, checkSectorPermission("settings.view")];
const manage = [isAuth, checkSectorPermission("settings.update")];

evolutionRoutes.get("/evolution/instances", ...view, EvolutionInstanceController.index);
evolutionRoutes.post("/evolution/instances", ...manage, EvolutionInstanceController.store);
evolutionRoutes.get(
  "/evolution/instances/:name/qrcode",
  ...manage,
  EvolutionInstanceController.qrcode
);
evolutionRoutes.get(
  "/evolution/instances/:name/state",
  ...view,
  EvolutionInstanceController.state
);
evolutionRoutes.put(
  "/evolution/instances/:name/default",
  ...manage,
  EvolutionInstanceController.makeDefault
);
evolutionRoutes.post(
  "/evolution/instances/:name/logout",
  ...manage,
  EvolutionInstanceController.logout
);
evolutionRoutes.delete(
  "/evolution/instances/:name",
  ...manage,
  EvolutionInstanceController.remove
);

export default evolutionRoutes;
