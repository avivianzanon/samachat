import express from "express";
import isAuth from "../middleware/isAuth";
import checkSectorPermission from "../middleware/checkSectorPermission";

import * as AgendaController from "../controllers/AgendaController";

const agendaRoutes = express.Router();

const view = [isAuth, checkSectorPermission("agenda.view")];
const manage = [isAuth, checkSectorPermission("agenda.manage")];

agendaRoutes.get("/agenda/config", ...view, AgendaController.showConfig);
agendaRoutes.put("/agenda/config", ...manage, AgendaController.updateConfig);

agendaRoutes.get("/agenda/closers", ...view, AgendaController.indexClosers);
agendaRoutes.get("/agenda/closers/:id", ...view, AgendaController.showOneCloser);
agendaRoutes.post("/agenda/closers", ...manage, AgendaController.storeCloser);
agendaRoutes.put("/agenda/closers/:id", ...manage, AgendaController.updateOneCloser);
agendaRoutes.delete("/agenda/closers/:id", ...manage, AgendaController.removeOneCloser);
agendaRoutes.put("/agenda/closers/:id/availability", ...manage, AgendaController.putAvailability);

agendaRoutes.get("/agenda/slots", ...view, AgendaController.slots);

agendaRoutes.get("/agenda/appointments", ...view, AgendaController.indexAppointments);
agendaRoutes.post("/agenda/appointments", ...manage, AgendaController.storeAppointment);
agendaRoutes.put("/agenda/appointments/:id/reschedule", ...manage, AgendaController.reschedule);
agendaRoutes.put("/agenda/appointments/:id/cancel", ...manage, AgendaController.cancel);

export default agendaRoutes;
