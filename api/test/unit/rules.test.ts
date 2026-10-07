/**
 * Pruebas unitarias de reglas puras (V2 §86, BATCH 16).
 *
 * Complementan las suites e2e: aquí se prueban las reglas deterministas sin
 * base de datos ni servidor, con el runner nativo de Node.
 *
 *   npm --prefix api run test:unit
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AFFINITY_CAPS,
  AFFINITY_ENGINE_VERSION,
  AFFINITY_MAX_RAW,
  AFFINITY_POINTS_V3,
  AiTaskType,
  ContactChannelType,
  CvAssistMode,
  DIMINISHING,
  RolNombre,
  SEMESTER_ROLES,
  SUPPORT_CAPS,
  UNIVERSITY_CODE_PREFIX,
  diminishingFactor,
  normalizeUniversityCode,
  universityCodeProblem,
} from '@perfil/shared';
import { RULES, containsTerm, normalize } from '../../src/recommendations/recommendation.rules';
import { passwordPolicyError } from '../../src/common/validation';
import { checkTeamName, forbiddenTerms, normalizeWord } from '../../src/collaboration/team-name.rules';
import { checkContactChannel } from '../../src/collaboration/contact-channel.rules';
import { PROMPTS, VALIDATE, inputFingerprint, parseJsonLoose, sanitizeForAi } from '../../src/ai/ai-text';
import { helpVideo } from '../../src/help/help-video';
import { analyzeAreaTags, classifySkill, suggestFromCatalog } from '../../src/catalogs/skill-classification';
import { assertClientAllowsRole } from '../../src/auth/auth.service';
import { PDF_THEMES, PdfWriter } from '../../src/trajectory/pdf-writer';
import { storageDriverFactory } from '../../src/storage/storage-driver.factory';
import { parseAuthorizedSemesters } from '../../src/imports/teacher-import.service';
import { effectiveSemesters, inTeacherScope, scopeSql } from '../../src/access/teacher-scope.service';

import { semestreElegible } from '../../src/collaboration/team-need.rules';
describe('Afinidad V3 (§45–§47)', () => {
  it('es la versión 4 del motor (V3.1 §35)', () => assert.equal(AFFINITY_ENGINE_VERSION, 4));

  it('lo declarado no suma; los topes directos suman 100', () => {
    assert.equal(AFFINITY_CAPS.PREFERENCE + AFFINITY_CAPS.INTEREST + AFFINITY_CAPS.SKILL, 0);
    assert.equal(AFFINITY_CAPS.ACTIVITY + AFFINITY_CAPS.PROJECT + AFFINITY_CAPS.CERTIFICATE, AFFINITY_MAX_RAW);
    assert.deepEqual([AFFINITY_CAPS.ACTIVITY, AFFINITY_CAPS.PROJECT, AFFINITY_CAPS.CERTIFICATE], [25, 50, 25]);
  });

  it('puntos por nivel de respaldo del proyecto: 0/10/18/22/0', () => {
    const p = AFFINITY_POINTS_V3;
    assert.deepEqual(
      [p.PROJECT_DECLARED, p.PROJECT_SUPPORTED, p.PROJECT_CORROBORATED, p.PROJECT_REVIEWED, p.PROJECT_FLAGGED],
      [0, 10, 18, 22, 0],
    );
    assert.deepEqual([p.CERTIFICATE_DECLARED, p.CERTIFICATE_SUPPORTED, p.CERTIFICATE_CORROBORATED], [0, 8, 15]);
  });

  it('rendimiento decreciente: la quinta actividad vale como la cuarta', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 9].map((i) => diminishingFactor(DIMINISHING.ACTIVITY, i)), [1, 0.7, 0.5, 0.3, 0.3, 0.3]);
    assert.deepEqual([0, 1, 2, 3, 7].map((i) => diminishingFactor(DIMINISHING.PROJECT, i)), [1, 0.75, 0.5, 0.25, 0.25]);
  });

  it('el respaldo suma exactamente 100', () => {
    assert.equal(SUPPORT_CAPS.ACTIVITY + SUPPORT_CAPS.PROJECT + SUPPORT_CAPS.CERTIFICATE + SUPPORT_CAPS.OTHER, 100);
  });

  it('la actividad satura en su tope: tres confirmadas no pasan de 25', () => {
    const puntos = [0, 1, 2, 3, 4].reduce((s, i) => s + AFFINITY_POINTS_V3.ACTIVITY_CONFIRMED * diminishingFactor(DIMINISHING.ACTIVITY, i), 0);
    assert.equal(Math.min(AFFINITY_CAPS.ACTIVITY, puntos), 25);
  });
});

describe('Recomendaciones (§54, §60)', () => {
  it('V3 §34: el reparto 40/30/15/10/5 suma 100 y no incluye la afinidad', () => {
    const r = RULES.ranking;
    assert.deepEqual([r.explicitInterest, r.improvementArea, r.skills, r.orientation, r.feedback], [40, 30, 15, 10, 5]);
    assert.equal(Object.values(r).reduce((s, v) => s + v, 0), 100);
    assert.equal('affinitySupport' in r, false);
  });

  it('coincide por palabra completa, sin tildes ni mayúsculas', () => {
    const texto = normalize('Taller de Programación Móvil con React Native');
    assert.equal(containsTerm(texto, normalize('react native')), true);
    assert.equal(containsTerm(texto, normalize('movil')), true);
    assert.equal(containsTerm(texto, 'act'), false);
  });
});

describe('Política de contraseña (§13)', () => {
  it('exige 12 caracteres y las cuatro clases', () => {
    assert.notEqual(passwordPolicyError('Corta1*'), null);
    assert.notEqual(passwordPolicyError('sinmayusculas123*'), null);
    assert.notEqual(passwordPolicyError('Sin simbolo 1234'), null);
    assert.equal(passwordPolicyError('Afinia2026Seg*'), null);
  });

  it('no puede contener el correo ni el código universitario', () => {
    assert.match(passwordPolicyError('Juanperez2026*', { email: 'juanperez@est.univalle.edu' }) ?? '', /correo/);
    assert.match(passwordPolicyError('Clave*A2026123456', { universityCode: '2026123456' }) ?? '', /código/);
  });
});

describe('Nombres de equipo (§44)', () => {
  const terms = forbiddenTerms('palabrota, frase prohibida');
  const code = (n: string) => {
    const r = checkTeamName(n, terms);
    return r.ok ? 'OK' : r.code;
  };

  it('acepta nombres normales y técnicos', () => {
    for (const n of ['Equipo Aurora', 'Computación Distribuida & IoT', 'C# y .NET (grupo 2)', 'ASP.NET Core']) {
      assert.equal(code(n), 'OK', n);
    }
  });

  it('bloquea términos prohibidos con números, letras sueltas o plural', () => {
    for (const n of ['Equipo pendejo', 'Los P3ND3J0S', 'p u t a s', 'Equipo palabrota', 'La frase prohibida']) {
      assert.equal(code(n), 'TEAM_NAME_FORBIDDEN', n);
    }
  });

  it('bloquea contacto, longitud, caracteres y repeticiones', () => {
    assert.equal(code('equipo@correo.com'), 'TEAM_NAME_CONTACT');
    assert.equal(code('visita equipo.com'), 'TEAM_NAME_CONTACT');
    assert.equal(code('Llama 7712 3456'), 'TEAM_NAME_CONTACT');
    assert.equal(code('AB'), 'TEAM_NAME_LENGTH');
    assert.equal(code('Equipo <b>'), 'TEAM_NAME_CHARACTERS');
    assert.equal(code('Holaaaaaa'), 'TEAM_NAME_REPEATED');
  });

  it('normaliza leet y repeticiones', () => assert.equal(normalizeWord('P3NNDD3J00'), 'pendejo'));
});

describe('Canales de contacto (§59)', () => {
  const c = (ch: ContactChannelType, v: string) => checkContactChannel(ch, v);
  it('normaliza y da un enlace seguro', () => {
    assert.deepEqual(c(ContactChannelType.WHATSAPP, '+591 712-34567'), { ok: true, value: '+59171234567', href: 'https://wa.me/59171234567' });
    const li = c(ContactChannelType.LINKEDIN, 'linkedin.com/in/ana-perez');
    assert.equal(li.ok && li.href, 'https://www.linkedin.com/in/ana-perez');
    const t = c(ContactChannelType.TEAMS, 'Ana@Est.Univalle.edu');
    assert.equal(t.ok && t.href, 'https://teams.microsoft.com/l/chat/0/0?users=ana%40est.univalle.edu');
    const e = c(ContactChannelType.EMAIL, 'Ana@Correo.com');
    assert.equal(e.ok && e.href, 'mailto:ana@correo.com');
  });
  it('rechaza lo inseguro o mal formado', () => {
    for (const [ch, v] of [
      [ContactChannelType.LINK, 'javascript:alert(1)'],
      [ContactChannelType.LINK, 'http://sitio.com'],
      [ContactChannelType.LINK, 'https://user:pass@sitio.com'],
      [ContactChannelType.LINKEDIN, 'https://evil.com/in/ana'],
      [ContactChannelType.WHATSAPP, '71234567'],
      [ContactChannelType.TEAMS, 'https://evil.com/chat'],
      [ContactChannelType.EMAIL, 'no-es-correo'],
    ] as const) {
      assert.equal(c(ch, v).ok, false, `${ch} ${v}`);
    }
  });
});

describe('Asistente de IA (§43, §61.3, §63)', () => {
  it('saca correos, teléfonos, tokens y parámetros de URL antes de enviar', () => {
    const s = sanitizeForAi('Soy ana@gmail.com, cel 77123456, Bearer abc.def.ghi y https://x.com/a?token=123 eyJhbGciOi.eyJzdWIi.sig', 4000);
    assert.doesNotMatch(s, /ana@gmail|77123456|abc\.def|token=123|eyJhbGci/);
    assert.match(s, /\[correo\]/);
    assert.match(s, /https:\/\/x\.com\/a/);
  });
  it('recorta al máximo configurado', () => assert.equal(sanitizeForAi('hola '.repeat(40), 10).length, 10));
  it('una cadena larga sin espacios se trata como posible clave', () => assert.equal(sanitizeForAi('a'.repeat(40), 100), '[clave]'));
  it('la huella es estable y depende de la tarea', () => {
    assert.equal(inputFingerprint(AiTaskType.CV_TEXT_ASSIST, 'x'), inputFingerprint(AiTaskType.CV_TEXT_ASSIST, 'x'));
    assert.notEqual(inputFingerprint(AiTaskType.CV_TEXT_ASSIST, 'x'), inputFingerprint(AiTaskType.TAG_SUGGESTION, 'x'));
    assert.match(inputFingerprint(AiTaskType.CV_TEXT_ASSIST, 'x'), /^[0-9a-f]{64}$/);
  });
  it('lee JSON aunque venga envuelto', () => {
    assert.deepEqual(parseJsonLoose('Claro:\n```json\n{"tags":["a"]}\n```'), { tags: ['a'] });
    assert.equal(parseJsonLoose('sin json'), null);
    assert.equal(parseJsonLoose('[1,2]'), null);
  });
  it('descarta texto de CV con cifras que el original no tenía', () => {
    const r = VALIDATE.cv({ texts: ['Trabajé 2 años en backend.', 'Trabajé en backend con NestJS.'] }, 'Trabajé en backend con NestJS.');
    assert.deepEqual(r, { texts: ['Trabajé en backend con NestJS.'], discarded: 1 });
    assert.equal(VALIDATE.cv({ texts: ['Lideré 40 personas.'] }, 'Trabajé en backend.'), null);
  });
  it('la narrativa solo puede citar cifras de los datos', () => {
    assert.equal(VALIDATE.narrative({ narrative: 'Hubo 12 proyectos.' }, '- React: 12'), 'Hubo 12 proyectos.');
    assert.equal(VALIDATE.narrative({ narrative: 'Hubo 99 proyectos.' }, '- React: 12'), null);
  });
  it('etiquetas en minúsculas, sin duplicados ni marcas', () => {
    assert.deepEqual(VALIDATE.tags({ tags: ['React', 'react', '<b>x</b>', 'a'] }), { tags: ['react'] });
  });
  it('las instrucciones del CV prohíben inventar', () => {
    assert.match(PROMPTS.cv('x', CvAssistMode.IMPROVE).system, /no inventes/i);
  });
});

describe('Video de ayuda (§65)', () => {
  it('YouTube se inserta sin cookies', () => {
    assert.equal(helpVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(helpVideo('https://youtu.be/dQw4w9WgXcQ')?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
  it('otros proveedores, como enlace; http o basura, nada', () => {
    assert.deepEqual(helpVideo('https://web.microsoftstream.com/video/abc'), { url: 'https://web.microsoftstream.com/video/abc', embedUrl: null });
    assert.equal(helpVideo('http://youtube.com/watch?v=dQw4w9WgXcQ'), null);
    assert.equal(helpVideo('no es url'), null);
    assert.equal(helpVideo(''), null);
  });
});

describe('Clasificación de habilidades (§23.3)', () => {
  const areas = [
    { id: 'm', name: 'Desarrollo Móvil', tags: ['desarrollo-movil'] },
    { id: 'w', name: 'Desarrollo Web', tags: ['desarrollo-web'] },
  ];
  it('React Native va a Móvil por regla canónica, también por alias', () => {
    const c = classifySkill('React Native', [], areas);
    assert.equal(c.rule, 'canonical');
    assert.deepEqual(c.areaIds, ['m']);
    assert.deepEqual(classifySkill('RN', ['react native'], areas).areaIds, ['m']);
  });
});

describe('App móvil solo Estudiante (§67)', () => {
  it('rechaza personal desde el móvil y deja pasar la web', () => {
    assert.throws(() => assertClientAllowsRole('mobile', RolNombre.TEACHER), /estudiantes/);
    assert.doesNotThrow(() => assertClientAllowsRole('mobile', RolNombre.STUDENT));
    assert.doesNotThrow(() => assertClientAllowsRole('web', RolNombre.ADMIN));
    assert.doesNotThrow(() => assertClientAllowsRole(undefined, RolNombre.ADMIN));
  });
});

describe('PDF del CV (§61)', () => {
  for (const [nombre, tema] of Object.entries(PDF_THEMES)) {
    it(`plantilla ${nombre}: PDF válido con tabla de referencias correcta`, () => {
      const pdf = new PdfWriter('Prueba', tema).title('Título (x)').section('Sección').paragraph('Texto').build();
      const s = pdf.toString('latin1');
      assert.ok(s.startsWith('%PDF-1.4'));
      assert.ok(s.trimEnd().endsWith('%%EOF'));
      assert.match(s, /\(Título \\\(x\\\)\) Tj/);
      // Cada entrada de la tabla xref apunta al inicio de su objeto.
      const xref = Number(/startxref\n(\d+)/.exec(s)![1]);
      assert.ok(s.slice(xref).startsWith('xref'));
      const offsets = s.slice(xref).split('\n').slice(3).filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
      offsets.forEach((o, i) => assert.ok(s.slice(o).startsWith(`${i + 1} 0 obj`), `objeto ${i + 1}`));
    });
  }
  it('la plantilla compacta usa Times y la moderna, color', () => {
    const compacta = new PdfWriter('x', PDF_THEMES.compact).section('A').build().toString('latin1');
    const moderna = new PdfWriter('x', PDF_THEMES.modern).section('A').build().toString('latin1');
    assert.match(compacta, /\/Times-Roman/);
    assert.match(moderna, / rg /);
  });
});

describe('Código universitario (§12)', () => {
  it('cada rol tiene su prefijo; Estudiante y Sociedad científica comparten EST', () => {
    assert.deepEqual(UNIVERSITY_CODE_PREFIX, {
      STUDENT: 'EST', SCIENTIFIC_SOCIETY: 'EST', TEACHER: 'DOC', CAREER_DIRECTOR: 'DIR', ADMIN: 'ADM',
    });
    assert.deepEqual([...SEMESTER_ROLES].sort(), [RolNombre.SCIENTIFIC_SOCIETY, RolNombre.STUDENT].sort());
  });
  it('acepta PREFIJO-XXXXXXX del rol y normaliza a mayúsculas', () => {
    assert.equal(universityCodeProblem('EST-38DJ1HA', RolNombre.STUDENT), null);
    assert.equal(universityCodeProblem(' est-38dj1ha ', RolNombre.SCIENTIFIC_SOCIETY), null);
    assert.equal(normalizeUniversityCode(' doc-ab12cd3 '), 'DOC-AB12CD3');
  });
  it('rechaza vacío, mal formato o el prefijo de otro rol', () => {
    assert.match(universityCodeProblem('', RolNombre.ADMIN) ?? '', /obligatorio/);
    assert.match(universityCodeProblem('DOC-12', RolNombre.TEACHER) ?? '', /Formato/);
    assert.match(universityCodeProblem('EST-38DJ1HAX', RolNombre.STUDENT) ?? '', /Formato/);
    assert.match(universityCodeProblem('EST-38DJ1HA', RolNombre.TEACHER) ?? '', /DOC-/);
    assert.match(universityCodeProblem('DIR-38DJ1HA', RolNombre.ADMIN) ?? '', /ADM-/);
  });
});

describe('Configuración (V3 BATCH 1)', () => {
  const conf = (v?: string) => ({ get: () => v }) as never;
  it('STORAGE_DRIVER local (o vacío) usa el disco', () => {
    assert.equal(storageDriverFactory(conf('local'), 'disco'), 'disco');
    assert.equal(storageDriverFactory(conf(undefined), 'disco'), 'disco');
  });
  it('un driver desconocido detiene el arranque', () => {
    assert.throws(() => storageDriverFactory(conf('s3'), 'disco'), /STORAGE_DRIVER=s3 no está soportado/);
  });
});

describe('Importación de docentes y alcance académico (V3 §7.1, §8)', () => {
  it('lee los semestres autorizados con ; | espacio o coma, sin repetidos', () => {
    assert.deepEqual(parseAuthorizedSemesters('5;1|5'), [1, 5]);
    assert.deepEqual(parseAuthorizedSemesters(' 2 3 '), [2, 3]);
    assert.deepEqual(parseAuthorizedSemesters('1,4'), [1, 4]);
    assert.deepEqual(parseAuthorizedSemesters(''), []);
  });
  it('rechaza semestres fuera de 1 a 8 o que no son números', () => {
    assert.match(String(parseAuthorizedSemesters('9')), /no válido/);
    assert.match(String(parseAuthorizedSemesters('1;dos')), /no válido/);
  });
  it('el alcance docente cuenta el semestre actual y los de arrastre', () => {
    const est = { semester: 2, academicScopeSemesters: [1] };
    assert.deepEqual(effectiveSemesters(est).sort(), [1, 2]);
    assert.equal(inTeacherScope(est, [1, 5]), true);
    assert.equal(inTeacherScope(est, [3, 4]), false);
    assert.equal(inTeacherScope({ semester: null, academicScopeSemesters: [] }, [1]), false);
  });
  it('la condición SQL combina semestre actual y arrastre', () => {
    assert.equal(
      scopeSql('p', 's'),
      '(p.semester IN (:...s) OR p.academic_scope_semesters && ARRAY[:...s]::smallint[])',
    );
  });
});

describe('Taxonomía dinámica (V3 §9.3, §9.4)', () => {
  const areas = [
    { id: 'web', name: 'Desarrollo Web', tags: ['frontend', 'html'] },
    { id: 'db', name: 'Bases de Datos', tags: ['sql', 'datos'] },
    { id: 'net', name: 'Redes', tags: ['routing', 'sistemas'] },
  ];
  const catalogo = [
    { name: 'React', aliases: ['ReactJS'], academicAreaId: 'web' },
    { name: 'PostgreSQL', aliases: ['Postgres'], academicAreaId: 'db' },
    { name: 'C', aliases: [], academicAreaId: 'net' },
  ];
  it('una tecnología nueva hereda el área de una ya clasificada que contiene', () => {
    const c = classifySkill('React Router', [], areas, catalogo);
    assert.equal(c.rule, 'suggested');
    assert.deepEqual(c.areaIds, ['web']);
    assert.match(c.reason ?? '', /habilidades ya clasificadas \(React en Desarrollo Web\)/);
  });
  it('también por alias, y por palabra completa (no «C» dentro de cualquier palabra)', () => {
    assert.deepEqual(classifySkill('Postgres 16', [], areas, catalogo).areaIds, ['db']);
    assert.equal(suggestFromCatalog(['Cassandra'], catalogo).size, 0);
  });
  it('sin catálogo ni etiquetas no sugiere nada', () => {
    assert.equal(classifySkill('Elixir', [], areas, catalogo).rule, 'none');
  });
  it('etiquetas: genéricas y compartidas con otras áreas, normalizadas', () => {
    const r = analyzeAreaTags(['  SQL ', 'Sistemas', 'big   data'], areas, 'web');
    assert.deepEqual(r.tags, ['sql', 'sistemas', 'big data']);
    assert.deepEqual(r.generic, ['sistemas']);
    assert.deepEqual(r.shared.map((s) => [s.tag, s.areas.map((a) => a.name)]), [
      ['sql', ['Bases de Datos']],
      ['sistemas', ['Redes']],
    ]);
  });
  it('al editar, el área no choca consigo misma', () => {
    assert.equal(analyzeAreaTags(['sql'], areas, 'db').shared.length, 0);
  });
});

// ---------------------------------------------------------------------------
//  V3 BATCH 8 · Elegibilidad de credenciales (§15, §14.2) y patrón (§17)
// ---------------------------------------------------------------------------
import { ActivityOrigin, ActivityOutcomePolicy, ActivityStatus, RegistrationStatus } from '@perfil/shared';
import { elegible, terminada } from '../../src/activities/credential-eligibility.rules';
import { CREDENTIAL_PATTERN_CHARS, credentialPatternToRegExp } from '../../src/activities/credential-pattern';

describe('V3 §15 elegibilidad para adjuntar credencial', () => {
  const ayer = new Date(Date.now() - 86_400_000);
  const manana = new Date(Date.now() + 86_400_000);
  const externa = {
    originType: ActivityOrigin.EXTERNAL,
    outcomePolicy: ActivityOutcomePolicy.EXTERNAL_CREDENTIAL_EXPECTED,
    status: ActivityStatus.OPEN,
    endAt: ayer,
    eventDate: null,
  };
  it('externa aceptada y terminada: elegible', () => {
    assert.equal(elegible(externa, RegistrationStatus.ACCEPTED), true);
  });
  it('aceptada pero en curso: todavía no (ACCEPTED ≠ CREDENTIAL_EARNED)', () => {
    assert.equal(elegible({ ...externa, endAt: manana }, RegistrationStatus.ACCEPTED), false);
  });
  it('solo inscrita: no', () => {
    assert.equal(elegible(externa, RegistrationStatus.REGISTERED), false);
  });
  it('dada por finalizada sin fecha: elegible; cancelada: nunca', () => {
    assert.equal(elegible({ ...externa, endAt: null, status: ActivityStatus.FINISHED }, RegistrationStatus.ACCEPTED), true);
    assert.equal(terminada({ ...externa, status: ActivityStatus.CANCELLED }), false);
  });
  it('interna con credencial de un tercero: confirmada y terminada (§14.2)', () => {
    const interna = { ...externa, originType: ActivityOrigin.INTERNAL };
    assert.equal(elegible(interna, RegistrationStatus.CONFIRMED), true);
    assert.equal(elegible(interna, RegistrationStatus.ACCEPTED), false);
  });
  it('interna sin credencial esperada: nunca', () => {
    const charla = { ...externa, originType: ActivityOrigin.INTERNAL, outcomePolicy: ActivityOutcomePolicy.NONE };
    assert.equal(elegible(charla, RegistrationStatus.CONFIRMED), false);
  });
});

describe('V3 §17 patrón del código de credencial', () => {
  it('# dígito, @ letra, * varios; el resto literal', () => {
    const re = credentialPatternToRegExp('NA-####-@@*');
    assert.equal(re.test('NA-2026-AB7X'), true);
    assert.equal(re.test('NA-2026-AB'), true);
    assert.equal(re.test('NA-26-AB'), false);
    assert.equal(re.test('XNA-2026-AB'), false);
  });
  it('los metacaracteres se toman literales', () => {
    assert.equal(credentialPatternToRegExp('A.B').test('AxB'), false);
    assert.equal(credentialPatternToRegExp('A.B').test('A.B'), true);
  });
  it('no admite expresiones libres', () => {
    assert.equal(CREDENTIAL_PATTERN_CHARS.test('(a+)+$'), false);
    assert.equal(CREDENTIAL_PATTERN_CHARS.test('NA-####-@@*'), true);
  });
});

// ---------------------------------------------------------------------------
//  V3 BATCH 9 · Validación escalonada de credenciales (§18–§20)
// ---------------------------------------------------------------------------
import { createHash } from 'node:crypto';
import { BackingTier, CredentialCheckStatus, IdentityMatchStatus, LinkCheckStatus } from '@perfil/shared';
import {
  comparePage,
  decideCredentialBacking,
  decideCredentialCheck,
  hostMatches,
  isOfficialUrl,
  officialDomainsFor,
  parseOpenBadge,
  readBakedBadge,
} from '../../src/validation/credential-check.rules';

describe('V3 §18.2 dominio oficial', () => {
  it('subdominio sí, subcadena no', () => {
    assert.equal(hostMatches('www.credly.com', 'credly.com'), true);
    assert.equal(hostMatches('evilcredly.com', 'credly.com'), false);
    assert.equal(hostMatches('credly.com.evil.io', 'credly.com'), false);
  });
  it('emisor conocido, oportunidad con dominios, o sin base para juzgar', () => {
    assert.ok(officialDomainsFor('Cisco Networking Academy')?.includes('netacad.com'));
    assert.ok(officialDomainsFor('Proveedor X', ['proveedorx.org'])?.includes('proveedorx.org'));
    assert.equal(officialDomainsFor('Academia Desconocida'), null);
    assert.equal(isOfficialUrl('https://cert.evil.io/x', officialDomainsFor('IBM')), false);
    assert.equal(isOfficialUrl('https://www.ibm.com/badge/x', officialDomainsFor('IBM')), true);
    assert.equal(isOfficialUrl('https://algo.org', null), null);
  });
});

describe('V3 §18.2 estado de la verificación', () => {
  const disponible = { status: LinkCheckStatus.AVAILABLE };
  const pagina = (o: Partial<{ credentialId: boolean; holder: boolean; course: boolean; issuer: boolean }>) =>
    ({ credentialId: false, holder: false, course: false, issuer: false, ...o });
  it('oficial, con el titular y el código: VERIFIED_MATCH', () => {
    assert.equal(
      decideCredentialCheck({ link: disponible, official: true, page: pagina({ holder: true, credentialId: true }), openBadge: null }),
      CredentialCheckStatus.VERIFIED_MATCH,
    );
  });
  it('el código de otra persona en su página oficial no basta sin el titular', () => {
    assert.equal(
      decideCredentialCheck({ link: disponible, official: true, page: pagina({ credentialId: true }), openBadge: null }),
      CredentialCheckStatus.REACHABLE_NO_STRUCTURED_PROOF,
    );
  });
  it('dominio desconocido nunca verifica, aunque la página coincida', () => {
    assert.equal(
      decideCredentialCheck({ link: disponible, official: null, page: pagina({ holder: true, credentialId: true }), openBadge: null }),
      CredentialCheckStatus.REACHABLE_NO_STRUCTURED_PROOF,
    );
  });
  it('dominio no permitido o bloqueado por SSRF: MISMATCH', () => {
    assert.equal(decideCredentialCheck({ link: disponible, official: false, page: null, openBadge: null }), CredentialCheckStatus.MISMATCH);
    assert.equal(
      decideCredentialCheck({ link: { status: LinkCheckStatus.BLOCKED }, official: null, page: null, openBadge: null }),
      CredentialCheckStatus.MISMATCH,
    );
  });
  it('proveedor caído: UNREACHABLE, no falso; verificador apagado: INCONCLUSIVE; sin URL: NO_VERIFIER', () => {
    assert.equal(
      decideCredentialCheck({ link: { status: LinkCheckStatus.UNAVAILABLE }, official: true, page: null, openBadge: null }),
      CredentialCheckStatus.UNREACHABLE,
    );
    assert.equal(
      decideCredentialCheck({ link: { status: LinkCheckStatus.UNVERIFIED }, official: true, page: null, openBadge: null }),
      CredentialCheckStatus.INCONCLUSIVE,
    );
    assert.equal(decideCredentialCheck({ link: null, official: null, page: null, openBadge: null }), CredentialCheckStatus.NO_VERIFIER);
  });
});

describe('V3 §19 respaldo determinista', () => {
  const base = {
    identity: IdentityMatchStatus.UNKNOWN,
    check: CredentialCheckStatus.NO_VERIFIER,
    metadataCoherent: false,
    opportunityContextMatch: false,
    officialReachable: false,
    contradictions: [] as never[],
  };
  it('FLAGGED gana a todo', () => {
    assert.equal(
      decideCredentialBacking({ ...base, check: CredentialCheckStatus.VERIFIED_MATCH, contradictions: ['holder_mismatch'] as never[] }),
      BackingTier.FLAGGED,
    );
  });
  it('CORROBORATED solo con señal verificable fuerte', () => {
    assert.equal(decideCredentialBacking({ ...base, check: CredentialCheckStatus.VERIFIED_MATCH }), BackingTier.CORROBORATED);
    assert.equal(decideCredentialBacking({ ...base, metadataCoherent: true, officialReachable: true }), BackingTier.SUPPORTED);
  });
  it('archivo legible coherente u oportunidad que coincide: SUPPORTED; nada: DECLARED', () => {
    assert.equal(decideCredentialBacking({ ...base, opportunityContextMatch: true }), BackingTier.SUPPORTED);
    assert.equal(decideCredentialBacking(base), BackingTier.DECLARED);
  });
});

describe('V3 §18.3 Open Badges', () => {
  const email = 'ana.perez@est.univalle.edu';
  const salt = 'sal123';
  const hash = createHash('sha256').update(email + salt).digest('hex');
  const asercion = (identity: string) => ({
    '@context': 'https://w3id.org/openbadges/v2',
    type: 'Assertion',
    id: 'https://badges.netacad.com/a/1',
    recipient: { type: 'email', hashed: true, salt, identity },
    verification: { type: 'hosted' },
    badge: { name: 'CCNA ITN', issuer: { name: 'Cisco' } },
  });
  const ctx = { fetchedUrl: 'https://badges.netacad.com/a/1', emails: [email], holderName: 'Ana Perez' };
  it('OB 2.0 hosted con destinatario propio', () => {
    const r = parseOpenBadge(asercion('sha256$' + hash), ctx);
    assert.equal(r?.recipientMatch, true);
    assert.equal(r?.hosted, true);
    assert.equal(
      decideCredentialCheck({ link: { status: LinkCheckStatus.AVAILABLE }, official: true, page: null, openBadge: r }),
      CredentialCheckStatus.VERIFIED_MATCH,
    );
  });
  it('destinatario de otra persona: MISMATCH', () => {
    const r = parseOpenBadge(asercion('sha256$00ff'), ctx);
    assert.equal(r?.recipientMatch, false);
    assert.equal(
      decideCredentialCheck({ link: { status: LinkCheckStatus.AVAILABLE }, official: true, page: null, openBadge: r }),
      CredentialCheckStatus.MISMATCH,
    );
  });
  it('insignia horneada en un PNG (bloque tEXt «openbadges»)', () => {
    const chunk = (tipo: string, datos: Buffer) => {
      const l = Buffer.alloc(4);
      l.writeUInt32BE(datos.length);
      return Buffer.concat([l, Buffer.from(tipo, 'latin1'), datos, Buffer.alloc(4)]);
    };
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('tEXt', Buffer.concat([Buffer.from('openbadges', 'latin1'), Buffer.from([0]), Buffer.from('https://badges.netacad.com/a/1', 'latin1')])),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    assert.deepEqual(readBakedBadge(png), { json: null, url: 'https://badges.netacad.com/a/1' });
  });
  it('compara la página oficial con lo declarado', () => {
    const c = comparePage('Credential AB-77 issued to Ana María Pérez for CCNA Introduction to Networks', {
      holderName: 'Ana María Pérez', credentialId: 'AB-77', course: 'CCNA Introduction to Networks', issuer: 'Cisco',
    });
    assert.deepEqual(c, { credentialId: true, holder: true, course: true, issuer: false });
  });
});

// ---------------------------------------------------------------------------
//  V3 BATCH 10 · Requisitos para activar un proyecto (§22)
// ---------------------------------------------------------------------------
import { isRepositoryUrl, projectReadiness } from '../../src/projects/project-readiness.rules';

describe('V3 §22 requisitos de ACTIVE', () => {
  const listo = {
    title: 'Plataforma de tutorías',
    areaCount: 1,
    skillCount: 2,
    repositoryUrl: 'https://github.com/ana/tutorias',
    repositoryCheck: LinkCheckStatus.AVAILABLE,
    members: [{ confirmed: true }],
    pendingInvitations: 0,
    ownContributionConfirmed: true,
    evidenceCount: 1,
    demoCheck: null,
  };
  const codigos = (i: Parameters<typeof projectReadiness>[0]) => projectReadiness(i).missing.map((m) => m.code);
  it('con todo, está listo', () => {
    assert.equal(projectReadiness(listo).ready, true);
  });
  it('cada requisito faltante se nombra', () => {
    assert.deepEqual(codigos({ ...listo, areaCount: 0, skillCount: 0 }), ['area', 'skill']);
    assert.deepEqual(codigos({ ...listo, repositoryUrl: null }), ['repository']);
    assert.deepEqual(codigos({ ...listo, pendingInvitations: 1 }), ['members_pending']);
    assert.deepEqual(codigos({ ...listo, members: [{ confirmed: false }] }), ['members_unconfirmed']);
  });
  it('repositorio: forma, público, y «no se pudo comprobar» no bloquea', () => {
    assert.equal(isRepositoryUrl('https://github.com/ana/tutorias'), true);
    assert.equal(isRepositoryUrl('https://gitlab.com/ana/tutorias.git'), true);
    assert.equal(isRepositoryUrl('https://example.com/ana'), false);
    assert.deepEqual(codigos({ ...listo, repositoryCheck: LinkCheckStatus.UNAVAILABLE }), ['repository_not_public']);
    const sinComprobar = projectReadiness({ ...listo, repositoryCheck: LinkCheckStatus.UNVERIFIED });
    assert.equal(sinComprobar.ready, true);
    assert.equal(sinComprobar.warnings.length, 1);
  });
  it('evidencia de funcionamiento, o una demo accesible en su lugar', () => {
    assert.deepEqual(codigos({ ...listo, evidenceCount: 0 }), ['evidence']);
    assert.equal(projectReadiness({ ...listo, evidenceCount: 0, demoCheck: LinkCheckStatus.AVAILABLE }).ready, true);
  });
});

// ---------------------------------------------------------------------------
//  V3 BATCH 11 · Mapeo determinista de manifiestos (§24.3)
// ---------------------------------------------------------------------------
import { signalsFromManifest } from '../../src/projects/dependency-map';

describe('V3 §24.3 dependencia → tecnología', () => {
  const tec = (f: string, t: string) => signalsFromManifest(f, t).map((s) => s.technology);
  it('package.json: react, @nestjs/core, pg', () => {
    const t = tec('package.json', JSON.stringify({ dependencies: { react: '1', '@nestjs/core': '1', pg: '1' } }));
    assert.ok(t.includes('React') && t.includes('NestJS') && t.includes('PostgreSQL'));
  });
  it('requirements.txt con versiones, comentarios y extras', () => {
    const t = tec('requirements.txt', 'FastAPI==0.1 # web\npsycopg2-binary>=2\n-r base.txt\nscikit_learn\n');
    assert.ok(t.includes('FastAPI') && t.includes('PostgreSQL') && t.includes('Scikit-learn'));
  });
  it('docker-compose: imagen postgres y redis', () => {
    const t = tec('docker-compose.yml', 'services:\n  db:\n    image: "postgres:16"\n  cache:\n    image: redis:7\n');
    assert.ok(t.includes('PostgreSQL') && t.includes('Redis') && t.includes('Docker'));
  });
  it('package-lock: solo dependencias directas, no transitivas', () => {
    const lock = { packages: { '': { dependencies: { react: '1' } }, 'node_modules/pg': { version: '8' } } };
    const t = tec('package-lock.json', JSON.stringify(lock));
    assert.ok(t.includes('React') && !t.includes('PostgreSQL'));
  });
  it('un manifiesto mal formado no aporta ni acusa', () => {
    assert.deepEqual(tec('package.json', '{ roto'), []);
  });
});

// ---------------------------------------------------------------------------
//  V3 BATCH 13 · Respaldo del proyecto (§28) y por tecnología (§24.4, §29)
// ---------------------------------------------------------------------------
import { ProjectBackingTier, ProjectSkillEvidenceStatus, TechnologyStatus } from '@perfil/shared';
import { decideProjectBacking, skillEvidenceFromSignal } from '../../src/projects/project-backing.rules';

describe('V3 §28 respaldo del proyecto', () => {
  const base = {
    repositoryAccessible: true, technicalCorroborations: 0, demoAccessible: false,
    confirmedMembers: 0, evidenceCount: 0, feedbackCount: 0, problems: [] as string[],
  };
  it('sin repositorio accesible: DECLARED, aunque haya evidencias', () => {
    assert.equal(decideProjectBacking({ ...base, repositoryAccessible: false, evidenceCount: 3 }), ProjectBackingTier.DECLARED);
  });
  it('repositorio + una señal: SUPPORTED', () => {
    assert.equal(decideProjectBacking({ ...base, evidenceCount: 1 }), ProjectBackingTier.SUPPORTED);
    assert.equal(decideProjectBacking({ ...base, technicalCorroborations: 2 }), ProjectBackingTier.SUPPORTED);
  });
  it('CORROBORATED exige corroboración técnica Y una señal independiente', () => {
    assert.equal(decideProjectBacking({ ...base, technicalCorroborations: 1, demoAccessible: true }), ProjectBackingTier.CORROBORATED);
    assert.equal(decideProjectBacking({ ...base, technicalCorroborations: 1, confirmedMembers: 1 }), ProjectBackingTier.CORROBORATED);
    assert.equal(decideProjectBacking({ ...base, demoAccessible: true, confirmedMembers: 2 }), ProjectBackingTier.SUPPORTED);
  });
  it('REVIEWED con retroalimentación; FLAGGED manda', () => {
    assert.equal(decideProjectBacking({ ...base, evidenceCount: 1, feedbackCount: 1 }), ProjectBackingTier.REVIEWED);
    assert.equal(decideProjectBacking({ ...base, technicalCorroborations: 3, demoAccessible: true, problems: ['x'] }), ProjectBackingTier.FLAGGED);
  });
  it('estado por tecnología: lenguaje, manifiesto, revisión docente o declarada', () => {
    assert.equal(skillEvidenceFromSignal({ status: TechnologyStatus.BOTH, source: 'languages' }, false).status, ProjectSkillEvidenceStatus.CORROBORATED_BY_GITHUB_LANGUAGE);
    assert.equal(skillEvidenceFromSignal({ status: TechnologyStatus.BOTH, source: 'package.json (react)' }, false).status, ProjectSkillEvidenceStatus.CORROBORATED_BY_MANIFEST);
    assert.equal(skillEvidenceFromSignal({ status: TechnologyStatus.DECLARED, source: null }, true).status, ProjectSkillEvidenceStatus.CORROBORATED_BY_ACADEMIC_REVIEW);
    assert.equal(skillEvidenceFromSignal(undefined, false).status, ProjectSkillEvidenceStatus.DECLARED);
  });
});

// ---------------------------------------------------------------------------
//  V3 BATCH 14 · Afinidad V4 (§35)
// ---------------------------------------------------------------------------
import { AFFINITY_POINTS_V4, DIMINISHING as DIM_V4 } from '@perfil/shared';

describe('V3 §35 pesos y rendimientos de la Afinidad V4', () => {
  it('solo puntúa lo corroborado', () => {
    assert.equal(AFFINITY_ENGINE_VERSION, 4);
    assert.equal(AFFINITY_POINTS_V4.ACTIVITY_CONFIRMED, 10);
    assert.equal(AFFINITY_POINTS_V4.PROJECT_SUPPORTED, 0);
    assert.equal(AFFINITY_POINTS_V4.PROJECT_CORROBORATED, 18);
    assert.equal(AFFINITY_POINTS_V4.PROJECT_REVIEWED, 22);
    assert.equal(AFFINITY_POINTS_V4.CERTIFICATE_SUPPORTED, 0);
    assert.equal(AFFINITY_POINTS_V4.CERTIFICATE_CORROBORATED, 15);
  });
  it('rendimientos: actividades 1/0,7/0,5/0,3; proyectos y credenciales 1/0,75/0,5/0,25', () => {
    assert.deepEqual([...DIM_V4.ACTIVITY], [1, 0.7, 0.5, 0.3]);
    assert.deepEqual([...DIM_V4.PROJECT], [1, 0.75, 0.5, 0.25]);
  });
});

describe('V3 §55 · Elegibilidad por semestre de una necesidad', () => {
  it('sin semestres objetivo la ve cualquiera, incluso sin semestre registrado', () => {
    assert.equal(semestreElegible([], 3), true);
    assert.equal(semestreElegible(null, null), true);
  });
  it('con semestres objetivo, solo quien cursa uno de ellos', () => {
    assert.equal(semestreElegible([5, 6], 5), true);
    assert.equal(semestreElegible([5, 6], 2), false);
  });
  it('un perfil sin semestre no entra cuando hay semestres objetivo', () => {
    assert.equal(semestreElegible([5], null), false);
  });
});
