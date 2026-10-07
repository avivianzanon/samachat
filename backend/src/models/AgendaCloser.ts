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
  HasMany,
  DataType
} from "sequelize-typescript";

import User from "./User";
import AgendaAvailability from "./AgendaAvailability";
import AgendaAppointment from "./AgendaAppointment";

@Table
class AgendaCloser extends Model<AgendaCloser> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Column
  email: string;

  @Column
  phone: string;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @Default(true)
  @Column
  isActive: boolean;

  @Default(true)
  @Column
  receivesMeetings: boolean;

  // Agenda do Google deste closer (so usada quando o provedor e "google").
  @Column
  googleCalendarId: string;

  // Base do rodizio: quem recebeu ha mais tempo (ou nunca) e o proximo.
  @Column(DataType.DATE)
  lastAssignedAt: Date | null;

  @HasMany(() => AgendaAvailability)
  availabilities: AgendaAvailability[];

  @HasMany(() => AgendaAppointment)
  appointments: AgendaAppointment[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AgendaCloser;
