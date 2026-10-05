import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";

import AgendaCloser from "./AgendaCloser";
import Contact from "./Contact";
import Ticket from "./Ticket";

export type AgendaAppointmentStatus =
  | "scheduled"
  | "cancelled"
  | "completed"
  | "no_show";

@Table
class AgendaAppointment extends Model<AgendaAppointment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => AgendaCloser)
  @Column
  closerId: number;

  @BelongsTo(() => AgendaCloser)
  closer: AgendaCloser;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @AllowNull(false)
  @Column
  title: string;

  @Column(DataType.TEXT)
  description: string;

  @Default("meeting")
  @Column
  type: string; // demo | meeting | support | followup

  @AllowNull(false)
  @Column(DataType.DATE)
  startsAt: Date; // sempre UTC

  @AllowNull(false)
  @Column(DataType.DATE)
  endsAt: Date;

  @AllowNull(false)
  @Column
  durationMinutes: number;

  @Default("scheduled")
  @Column
  status: AgendaAppointmentStatus;

  @Default("internal")
  @Column
  provider: string;

  // Id do evento no provedor externo (Google), quando houver.
  @Column
  externalId: string;

  @Column(DataType.STRING(1024))
  meetingUrl: string;

  @Column
  attendeeEmail: string;

  @Column(DataType.TEXT)
  cancelReason: string;

  // JSON em texto: origem, motivo de reagendamento, etc.
  @Column(DataType.TEXT)
  metadata: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AgendaAppointment;
