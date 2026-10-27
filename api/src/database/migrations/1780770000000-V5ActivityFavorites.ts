import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V5 BATCH 3 · Favoritos de actividades (V5-01, §14.1).
 *
 * Aditiva: una tabla de marcadores personales para el acceso rápido (sobre
 * todo del docente, que consulta la oferta de la carrera). Un favorito
 * organiza: no alimenta el recomendador, ni la afinidad, ni los puntos, ni
 * reserva un lugar. Se borra con la persona o con la actividad.
 */
export class V5ActivityFavorites1780770000000 implements MigrationInterface {
  name = 'V5ActivityFavorites1780770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "activity_favorites" (
        "user_id" uuid NOT NULL,
        "activity_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_favorites" PRIMARY KEY ("user_id", "activity_id"),
        CONSTRAINT "FK_activity_favorites_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_activity_favorites_activity" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_favorites_activity" ON "activity_favorites" ("activity_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_favorites"`);
  }
}
