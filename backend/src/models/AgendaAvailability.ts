import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";

import AgendaCloser from "./AgendaCloser";

// Janela de expediente de um closer em um dia da semana (0=domingo).
@Table
class AgendaAvailability extends Model<AgendaAvailability> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @ForeignKey(() => AgendaCloser)
  @Column
  closerId: number;

  @BelongsTo(() => AgendaCloser)
  closer: AgendaCloser;

  @AllowNull(false)
  @Column
  weekday: number;

  @AllowNull(false)
  @Column
  startTime: string; // HH:mm no fuso da agenda

  @AllowNull(false)
  @Column
  endTime: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AgendaAvailability;
