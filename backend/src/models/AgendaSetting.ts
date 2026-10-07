import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  Default
} from "sequelize-typescript";

// Linha unica (id=1) com a configuracao da agenda.
@Table
class AgendaSetting extends Model<AgendaSetting> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Default("internal")
  @Column
  provider: string; // "internal" | "google"

  @Default("America/Sao_Paulo")
  @Column
  timezone: string;

  @Default(30)
  @Column
  slotMinutes: number;

  @Default(30)
  @Column
  minLeadMinutes: number;

  @Default(60)
  @Column
  defaultDurationMinutes: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AgendaSetting;
