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

import AgendaCloser from "./AgendaCloser";

@Table
class AgendaGoogleToken extends Model<AgendaGoogleToken> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Unique
  @ForeignKey(() => AgendaCloser)
  @Column
  closerId: number;

  @BelongsTo(() => AgendaCloser)
  closer: AgendaCloser;

  // Nunca em texto puro: ver google/tokenCrypto.ts
  @AllowNull(false)
  @Column(DataType.TEXT)
  refreshTokenEnc: string;

  @Column(DataType.TEXT)
  scope: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default AgendaGoogleToken;
