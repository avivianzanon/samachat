import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  ForeignKey,
  BelongsTo,
  DataType
} from "sequelize-typescript";

import AgendaAppointment from "./AgendaAppointment";

@Table
class AgendaEvent extends Model<AgendaEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Unique
  @Column
  eventId: string;

  @AllowNull(false)
  @Column
  type: string;

  @ForeignKey(() => AgendaAppointment)
  @Column
  appointmentId: number;

  @BelongsTo(() => AgendaAppointment)
  appointment: AgendaAppointment;

  @AllowNull(false)
  @Column
  status: string; // processed | ignored

  @Column(DataType.TEXT)
  note: string;

  @Column(DataType.TEXT)
  payload: string;

  @Column(DataType.DATE)
  occurredAt: Date;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AgendaEvent;
