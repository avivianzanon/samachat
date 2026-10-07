import express from "express";
import isAuth from "../middleware/isAuth";
import checkSectorPermission from "../middleware/checkSectorPermission";

import * as IntegrationSettingsController from "../controllers/IntegrationSettingsController";

const integrationSettingsRoutes = express.Router();

// Qual IA esta conversando com os leads (qualquer usuario logado consulta).
integrationSettingsRoutes.get("/ai-engine", isAuth, IntegrationSettingsController.engines);

integrationSettingsRoutes.get(
  "/integration-settings/:provider",
  isAuth,
  checkSectorPermission("settings.view"),
  IntegrationSettingsController.show
);

integrationSettingsRoutes.get(
  "/integration-settings/:provider/status",
  isAuth,
  checkSectorPermission("settings.view"),
  IntegrationSettingsController.status
);

integrationSettingsRoutes.put(
  "/integration-settings/:provider",
  isAuth,
  checkSectorPermission("settings.update"),
  IntegrationSettingsController.update
);

integrationSettingsRoutes.post(
  "/integration-settings/:provider/test",
  isAuth,
  checkSectorPermission("settings.update"),
  IntegrationSettingsController.test
);

export default integrationSettingsRoutes;
