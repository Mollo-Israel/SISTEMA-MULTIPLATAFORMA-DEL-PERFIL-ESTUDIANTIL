import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  InterestSource,
  OnboardingQuestionType,
  OnboardingRunStatus,
} from '@perfil/shared';
import { AcademicArea } from '../entities/academic-area.entity';
import { OnboardingAnswer, OnboardingRun } from '../entities/onboarding-run.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuditEventType, AuditService } from '../audit/audit.service';
import {
  AREA_SYNONYMS,
  AreaTag,
  buildQuestionnaire,
  DEEP_DIVES,
  MIN_ANSWERS,
  QUESTION_BY_CODE,
  QUESTIONNAIRE_VERSION,
} from './questionnaire';
import { SubmitOnboardingDto, ConfirmOnboardingDto } from './dto/onboarding.dto';

/** Cuántas áreas se sugieren como máximo. Más que esto deja de orientar. */
const MAX_SUGGESTED = 5;

/** Prioridad con la que entran los intereses confirmados (§18: 1 es la mayor). */
const CONFIRMED_BASE_PRIORITY = 1;

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(OnboardingRun) private readonly runs: Repository<OnboardingRun>,
    @InjectRepository(OnboardingAnswer) private readonly answers: Repository<OnboardingAnswer>,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * El cuestionario tal cual se presenta (§16).
   *
   * Público para el estudiante autenticado: no hay nada sensible en las
   * preguntas, y devolverlas desde el servidor evita que web y móvil
   * mantengan cada uno su copia y acaben divergiendo.
   */
  async questionnaire(userId: string) {
    const { tags, nombres } = await this.declaredTags(userId);
    const preguntas = buildQuestionnaire(tags);
    return {
      version: QUESTIONNAIRE_VERSION,
      totalQuestions: preguntas.length,
      /** Mínimo de respuestas para calcular sugerencias. */
      minAnswers: MIN_ANSWERS,
      /** Las áreas declaradas que dieron pie a preguntas propias. */
      basedOn: tags.map((t) => nombres.get(t)!).filter(Boolean),
      questions: preguntas.map((q) => ({
        code: q.code,
        text: q.text.replace('{area}', nombres.get(this.tagDe(q.code) as AreaTag) ?? 'esa área'),
        help: q.help ?? null,
        type: q.type,
        maxChoices: q.maxChoices ?? null,
        options: q.options.map((o) => ({ code: o.code, label: o.label })),
      })),
    };
  }

  /**
   * Las áreas que el estudiante ya declaró, traducidas a etiquetas del
   * cuestionario: primero sus intereses por prioridad, luego sus áreas de
   * mejora. Sin perfil, ninguna: recibe el cuestionario general.
   */
  private async declaredTags(
    userId: string,
  ): Promise<{ tags: AreaTag[]; nombres: Map<AreaTag, string> }> {
    const profile = await this.profiles.findOne({ where: { userId } });
    const nombres = new Map<AreaTag, string>();
    if (!profile) return { tags: [], nombres };

    const intereses = await this.interests.find({
      where: { studentProfileId: profile.id },
      order: { priority: 'ASC' },
    });
    const declaradas = [
      ...intereses.map((i) => i.academicAreaId),
      ...(profile.improvementAreaIds ?? []),
    ];
    if (declaradas.length === 0) return { tags: [], nombres };

    // Se mira cada área que declaró, no «la primera del catálogo que coincide
    // con cada etiqueta»: con dos áreas parecidas (dos de robótica, por
    // ejemplo) la segunda se quedaba sin pregunta propia.
    const catalogo = await this.areas.find({ where: { isActive: true } });
    const porId = new Map(catalogo.map((a) => [a.id, a]));
    const tags: AreaTag[] = [];
    for (const id of declaradas) {
      const area = porId.get(id);
      const tag = area ? this.tagOfArea(area) : null;
      if (!tag || tags.includes(tag)) continue;
      tags.push(tag);
      nombres.set(tag, area!.name);
    }
    return { tags, nombres };
  }

  /** La etiqueta del cuestionario que corresponde a un área del catálogo. */
  private tagOfArea(area: AcademicArea): AreaTag | null {
    const todas = Object.keys(DEEP_DIVES) as AreaTag[];
    const sin = (t: AreaTag) => AREA_SYNONYMS[t].map((s) => this.normalize(s));
    const etiquetas = (area.tags ?? []).map((t) => this.normalize(t));
    const nombre = this.normalize(area.name);
    // Mismo orden de señales que matchArea: etiquetas del catálogo, nombre
    // exacto y, por último, nombre que contiene un sinónimo largo.
    return (
      todas.find((t) => sin(t).some((s) => etiquetas.includes(s)))
      ?? todas.find((t) => sin(t).includes(nombre))
      ?? todas.find((t) => sin(t).some((s) => s.length >= 5 && nombre.includes(s)))
      ?? null
    );
  }

  /** «dd_desarrollo_web» → «desarrollo-web». Solo para las de profundización. */
  private tagDe(code: string): string | null {
    return code.startsWith('dd_') ? code.slice(3).replace(/_/g, '-') : null;
  }

  /** La ejecución vigente del estudiante, si respondió alguna vez. */
  async current(userId: string) {
    // Sin perfil todavía no hay nada que mostrar, y no es un error: la
    // pantalla del cuestionario no debe romperse por eso.
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) return { run: null, pendingConfirmation: false };
    const run = await this.runs.findOne({
      where: { studentProfileId: profile.id, status: In([
        OnboardingRunStatus.COMPLETED,
        OnboardingRunStatus.CONFIRMED,
      ]) },
      order: { createdAt: 'DESC' },
    });
    if (!run) return { run: null, pendingConfirmation: false };

    const answers = await this.answers.find({
      where: { runId: run.id },
      order: { questionCode: 'ASC' },
    });
    return {
      run: this.toPublic(run, answers),
      pendingConfirmation: run.status === OnboardingRunStatus.COMPLETED,
    };
  }

  /** Historial completo, incluidas las repeticiones (§16). */
  async history(userId: string) {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) return [];
    const runs = await this.runs.find({
      where: { studentProfileId: profile.id },
      order: { createdAt: 'DESC' },
    });
    return runs.map((r) => ({
      id: r.id,
      version: r.questionnaireVersion,
      status: r.status,
      suggestedAreas: r.suggestedAreas,
      confirmedAreaIds: r.confirmedAreaIds ?? [],
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt,
    }));
  }

  /**
   * Registra una pasada del cuestionario y calcula las áreas sugeridas.
   *
   * No crea ningún interés: §16 es explícito en que solo la confirmación
   * produce intereses efectivos. Lo que sale de aquí es una propuesta.
   */
  async submit(userId: string, dto: SubmitOnboardingDto) {
    const profile = await this.ownProfile(userId);
    this.validateAnswers(dto);

    const suggested = await this.computeSuggestions(dto);

    const run = await this.dataSource.transaction(async (manager) => {
      // El cuestionario puede repetirse; la pasada anterior deja de estar
      // vigente pero se conserva, porque §16 pide guardar el historial.
      await manager.update(
        OnboardingRun,
        { studentProfileId: profile.id, status: OnboardingRunStatus.COMPLETED },
        { status: OnboardingRunStatus.SUPERSEDED },
      );
      await manager.update(
        OnboardingRun,
        { studentProfileId: profile.id, status: OnboardingRunStatus.CONFIRMED },
        { status: OnboardingRunStatus.SUPERSEDED },
      );

      const saved = await manager.save(
        manager.create(OnboardingRun, {
          studentProfileId: profile.id,
          questionnaireVersion: QUESTIONNAIRE_VERSION,
          status: OnboardingRunStatus.COMPLETED,
          suggestedAreas: suggested,
          confirmedAreaIds: null,
          confirmedAt: null,
        }),
      );

      await manager.save(
        dto.answers.map((a) =>
          manager.create(OnboardingAnswer, {
            runId: saved.id,
            questionCode: a.questionCode,
            optionCodes: a.optionCodes,
          }),
        ),
      );
      return saved;
    });

    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.ONBOARDING_COMPLETED,
      entityType: 'onboarding_run',
      entityId: run.id,
      metadata: {
        version: QUESTIONNAIRE_VERSION,
        answered: dto.answers.length,
        suggested: suggested.length,
      },
    });

    const answers = await this.answers.find({ where: { runId: run.id } });
    return {
      ...this.toPublic(run, answers),
      message:
        suggested.length > 0
          ? 'Estas son las áreas que sugiere tu cuestionario. Elige cuáles quieres incorporar como intereses.'
          : 'El cuestionario no encontró áreas que sugerirte. Puedes elegir tus intereses directamente del catálogo.',
    };
  }

  /**
   * Incorpora como intereses las áreas que el estudiante eligió (§16, §18).
   *
   * Solo se aceptan áreas que la ejecución haya sugerido: confirmar no es una
   * vía alternativa para añadir cualquier área, es aceptar una propuesta.
   * Quien quiera otra cosa tiene el catálogo.
   *
   * Confirmar con la lista vacía es una respuesta válida —«ninguna de estas»—
   * y cierra la ejecución igual.
   */
  async confirm(userId: string, runId: string, dto: ConfirmOnboardingDto) {
    const profile = await this.ownProfile(userId);
    const run = await this.runs.findOne({ where: { id: runId } });
    if (!run || run.studentProfileId !== profile.id) {
      throw new NotFoundException('Cuestionario no encontrado.');
    }
    if (run.status === OnboardingRunStatus.CONFIRMED) {
      throw new BadRequestException('Este cuestionario ya se confirmó.');
    }
    if (run.status === OnboardingRunStatus.SUPERSEDED) {
      throw new BadRequestException(
        'Este cuestionario quedó sustituido por uno más reciente. Confirma el último.',
      );
    }

    const sugeridas = new Set(run.suggestedAreas.map((a) => a.academicAreaId));
    const elegidas = [...new Set(dto.academicAreaIds ?? [])];
    const intrusas = elegidas.filter((id) => !sugeridas.has(id));
    if (intrusas.length > 0) {
      throw new BadRequestException(
        'Solo puedes confirmar áreas que el cuestionario te haya sugerido. '
        + 'Para añadir otras, usa el catálogo de áreas de preferencia.',
      );
    }

    // Orden de sugerencia = orden de prioridad. El área con mayor puntaje
    // entra como prioridad 1, que §18 define como la más alta.
    const porPuntaje = run.suggestedAreas
      .filter((a) => elegidas.includes(a.academicAreaId))
      .map((a) => a.academicAreaId);

    await this.dataSource.transaction(async (manager) => {
      const existentes = await manager.find(StudentInterest, {
        where: { studentProfileId: profile.id },
      });
      const yaTiene = new Map(existentes.map((i) => [i.academicAreaId, i]));

      for (let i = 0; i < porPuntaje.length; i += 1) {
        const areaId = porPuntaje[i];
        const prioridad = Math.min(CONFIRMED_BASE_PRIORITY + i, 5);
        const existente = yaTiene.get(areaId);
        if (existente) {
          // Ya lo tenia del catalogo: se respeta su prioridad, solo se anota
          // que el cuestionario tambien lo sugirio.
          existente.source = InterestSource.ONBOARDING;
          await manager.save(existente);
        } else {
          await manager.save(
            manager.create(StudentInterest, {
              studentProfileId: profile.id,
              academicAreaId: areaId,
              priority: prioridad,
              source: InterestSource.ONBOARDING,
            }),
          );
        }
      }

      await manager.update(
        OnboardingRun,
        { id: run.id },
        {
          status: OnboardingRunStatus.CONFIRMED,
          confirmedAreaIds: porPuntaje,
          confirmedAt: new Date(),
        },
      );
    });

    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.ONBOARDING_CONFIRMED,
      entityType: 'onboarding_run',
      entityId: run.id,
      metadata: { confirmed: porPuntaje.length, suggested: run.suggestedAreas.length },
    });

    return {
      runId: run.id,
      confirmedAreaIds: porPuntaje,
      message:
        porPuntaje.length > 0
          ? `Se incorporaron ${porPuntaje.length} área(s) a tus intereses.`
          : 'No se incorporó ninguna área. Puedes elegir tus intereses del catálogo cuando quieras.',
    };
  }

  // ======================================================================
  //  Interno
  // ======================================================================

  /**
   * Comprueba que las respuestas correspondan al cuestionario.
   *
   * Se rechaza una pregunta inventada o una opción que no existe: sin esto,
   * un cliente podría fabricar respuestas para forzar las áreas sugeridas.
   */
  private validateAnswers(dto: SubmitOnboardingDto) {
    const vistas = new Set<string>();
    for (const answer of dto.answers) {
      const pregunta = QUESTION_BY_CODE.get(answer.questionCode);
      if (!pregunta) {
        throw new BadRequestException(`La pregunta «${answer.questionCode}» no existe.`);
      }
      if (vistas.has(answer.questionCode)) {
        throw new BadRequestException(`La pregunta «${answer.questionCode}» viene repetida.`);
      }
      vistas.add(answer.questionCode);

      if (answer.optionCodes.length === 0) {
        throw new BadRequestException(`La pregunta «${answer.questionCode}» no tiene respuesta.`);
      }
      if (pregunta.type === OnboardingQuestionType.SINGLE && answer.optionCodes.length > 1) {
        throw new BadRequestException(
          `La pregunta «${answer.questionCode}» admite una sola opción.`,
        );
      }
      const tope = pregunta.maxChoices ?? pregunta.options.length;
      if (answer.optionCodes.length > tope) {
        throw new BadRequestException(
          `La pregunta «${answer.questionCode}» admite como máximo ${tope} opciones.`,
        );
      }
      if (new Set(answer.optionCodes).size !== answer.optionCodes.length) {
        throw new BadRequestException(
          `La pregunta «${answer.questionCode}» tiene opciones repetidas.`,
        );
      }
      const validas = new Set(pregunta.options.map((o) => o.code));
      const invalida = answer.optionCodes.find((c) => !validas.has(c));
      if (invalida) {
        throw new BadRequestException(
          `La opción «${invalida}» no pertenece a la pregunta «${answer.questionCode}».`,
        );
      }
    }

    // Se aceptan respuestas parciales: el cuestionario es opcional y quien lo
    // deja a medias tiene derecho a aprovechar lo que contestó. Pero por debajo
    // de un mínimo el resultado orientaría mal, y entonces se dice.
    if (vistas.size < MIN_ANSWERS) {
      throw new BadRequestException(
        `Responde al menos ${MIN_ANSWERS} preguntas para que las sugerencias tengan sentido `
        + `(llevas ${vistas.size}). Puedes dejar el resto en blanco.`,
      );
    }
  }

  /**
   * Suma los pesos de cada opción elegida y los traduce a áreas del catálogo.
   *
   * El cuestionario razona con etiquetas, no con UUID, así que aquí se
   * resuelven contra el catálogo real. Una etiqueta sin área correspondiente
   * no sugiere nada: es preferible sugerir de menos que inventar un área que
   * la carrera no ofrece.
   */
  private async computeSuggestions(dto: SubmitOnboardingDto) {
    const puntajePorEtiqueta = new Map<AreaTag, number>();
    for (const answer of dto.answers) {
      const pregunta = QUESTION_BY_CODE.get(answer.questionCode)!;
      for (const code of answer.optionCodes) {
        const opcion = pregunta.options.find((o) => o.code === code)!;
        for (const { tag, weight } of opcion.areas) {
          puntajePorEtiqueta.set(tag, (puntajePorEtiqueta.get(tag) ?? 0) + weight);
        }
      }
    }

    const catalogo = await this.areas.find({ where: { isActive: true } });
    const resueltas = new Map<string, { name: string; score: number }>();

    for (const [tag, score] of puntajePorEtiqueta) {
      if (score <= 0) continue;
      const area = this.matchArea(tag, catalogo);
      if (!area) continue;
      const previo = resueltas.get(area.id);
      // Dos etiquetas pueden caer en la misma area del catalogo; se queda la
      // suma, no la ultima.
      resueltas.set(area.id, {
        name: area.name,
        score: (previo?.score ?? 0) + score,
      });
    }

    return [...resueltas.entries()]
      .map(([academicAreaId, v]) => ({ academicAreaId, name: v.name, score: v.score }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, MAX_SUGGESTED);
  }

  /** Busca el área del catálogo que corresponde a una etiqueta. */
  private matchArea(tag: AreaTag, catalogo: AcademicArea[]): AcademicArea | null {
    const sinonimos = AREA_SYNONYMS[tag].map((s) => this.normalize(s));

    // Primero por etiqueta declarada en el catalogo, que es la senal mas
    // explicita que la carrera puede dar.
    const porTag = catalogo.find((a) =>
      (a.tags ?? []).some((t) => sinonimos.includes(this.normalize(t))));
    if (porTag) return porTag;

    const porNombre = catalogo.find((a) => sinonimos.includes(this.normalize(a.name)));
    if (porNombre) return porNombre;

    // Ultimo recurso: que el nombre del area contenga un sinonimo suficiente-
    // mente especifico. Se exige longitud para no emparejar por 'ia' o 'ux'.
    return (
      catalogo.find((a) => {
        const nombre = this.normalize(a.name);
        return sinonimos.some((s) => s.length >= 5 && nombre.includes(s));
      }) ?? null
    );
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  private toPublic(run: OnboardingRun, answers: OnboardingAnswer[]) {
    return {
      id: run.id,
      version: run.questionnaireVersion,
      status: run.status,
      suggestedAreas: run.suggestedAreas,
      confirmedAreaIds: run.confirmedAreaIds ?? [],
      answers: answers.map((a) => ({
        questionCode: a.questionCode,
        optionCodes: a.optionCodes,
      })),
      createdAt: run.createdAt,
      confirmedAt: run.confirmedAt,
    };
  }

  private async ownProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        'Todavía no tienes perfil. Créalo antes de responder el cuestionario.',
      );
    }
    return profile;
  }
}
