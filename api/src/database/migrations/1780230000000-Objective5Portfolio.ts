import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Objetivo 5 - Portafolio de proyectos estudiantiles (RF13 a RF16).
 *
 *  - projects.visibility: nivel de visibilidad que pide RF13 y del que depende
 *    la consulta docente de RF15. Las filas existentes quedan en 'profile', que
 *    es exactamente el comportamiento que ya tenian: aparecen en el perfil del
 *    estudiante y no se exponen mas alla de eso.
 *  - project_invitations: RF14 exige que el invitado acepte antes de quedar
 *    asociado. La pertenencia deja de insertarse directamente.
 *  - project_feedback: RF16, retroalimentacion academica basica del docente.
 *
 * PRESERVACION: no se toca project_members. Los integrantes que ya existan se
 * conservan tal cual y se consideran pertenencias aceptadas heredadas de la
 * version anterior; no se fabrica historial de invitaciones para ellos.
 */
export class Objective5Portfolio1780230000000 implements MigrationInterface {
  name = 'Objective5Portfolio1780230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ------------------------------------------------------------------
    // RF13 · Nivel de visibilidad del proyecto
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."projects_visibility_enum" AS ENUM('private', 'profile', 'teachers')
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD "visibility" "public"."projects_visibility_enum" NOT NULL DEFAULT 'profile'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_visibility" ON "projects" ("visibility")`,
    );

    // ------------------------------------------------------------------
    // RF14 · Invitaciones a integrar un proyecto
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE "public"."project_invitations_status_enum"
        AS ENUM('pending', 'accepted', 'rejected', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TABLE "project_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "invited_profile_id" uuid NOT NULL,
        "proposed_role" character varying(80) NOT NULL,
        "status" "public"."project_invitations_status_enum" NOT NULL DEFAULT 'pending',
        "invited_by" uuid,
        "responded_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_invitations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_invitation_project" ON "project_invitations" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invitation_invited" ON "project_invitations" ("invited_profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invitation_status" ON "project_invitations" ("status")`,
    );
    // Una sola invitacion pendiente por estudiante y proyecto. Indice parcial:
    // tras rechazar, el responsable puede volver a invitar.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_pending_invitation"
        ON "project_invitations" ("project_id", "invited_profile_id")
        WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      ALTER TABLE "project_invitations"
        ADD CONSTRAINT "FK_invitation_project"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "project_invitations"
        ADD CONSTRAINT "FK_invitation_invited_profile"
        FOREIGN KEY ("invited_profile_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "project_invitations"
        ADD CONSTRAINT "FK_invitation_invited_by"
        FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    // ------------------------------------------------------------------
    // RF16 · Retroalimentacion docente
    // ------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "project_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "teacher_user_id" uuid NOT NULL,
        "comment" character varying(1000) NOT NULL,
        "edited_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "chk_feedback_comment" CHECK (length(btrim("comment")) >= 10),
        CONSTRAINT "PK_project_feedback" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_feedback_project" ON "project_feedback" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_feedback_teacher" ON "project_feedback" ("teacher_user_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "project_feedback"
        ADD CONSTRAINT "FK_feedback_project"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    // RESTRICT: la retroalimentacion es historia academica; borrar al docente
    // debe fallar de forma visible en lugar de dejarla huerfana.
    await queryRunner.query(`
      ALTER TABLE "project_feedback"
        ADD CONSTRAINT "FK_feedback_teacher"
        FOREIGN KEY ("teacher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_feedback" DROP CONSTRAINT "FK_feedback_teacher"`);
    await queryRunner.query(`ALTER TABLE "project_feedback" DROP CONSTRAINT "FK_feedback_project"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_feedback_teacher"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_feedback_project"`);
    await queryRunner.query(`DROP TABLE "project_feedback"`);

    await queryRunner.query(
      `ALTER TABLE "project_invitations" DROP CONSTRAINT "FK_invitation_invited_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_invitations" DROP CONSTRAINT "FK_invitation_invited_profile"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_invitations" DROP CONSTRAINT "FK_invitation_project"`,
    );
    await queryRunner.query(`DROP INDEX "public"."uq_pending_invitation"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invitation_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invitation_invited"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invitation_project"`);
    await queryRunner.query(`DROP TABLE "project_invitations"`);
    await queryRunner.query(`DROP TYPE "public"."project_invitations_status_enum"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_projects_visibility"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "visibility"`);
    await queryRunner.query(`DROP TYPE "public"."projects_visibility_enum"`);
  }
}
