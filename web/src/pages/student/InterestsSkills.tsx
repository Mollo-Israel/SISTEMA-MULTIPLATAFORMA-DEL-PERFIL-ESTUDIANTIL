import { useEffect, useMemo, useState } from 'react';
import { FiAward, FiSave, FiSliders, FiTarget } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import type { AcademicArea, Skill } from '../../services/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonTable,
} from '../../components/ui';
import { useToast } from '../../components/feedback';

// Etiquetas legibles para el usuario; el valor interno sigue siendo 1–5.
const PRIORITY_LABELS: Record<number, string> = {
  0: 'Sin interés',
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Moderado',
  4: 'Alto',
  5: 'Muy alto',
};
const LEVEL_LABELS: Record<number, string> = {
  0: 'Sin experiencia',
  1: 'Principiante',
  2: 'Básico',
  3: 'Intermedio',
  4: 'Avanzado',
  5: 'Experto',
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function InterestsSkillsPage() {
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<Record<string, number>>({});
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});
  const [savingInterests, setSavingInterests] = useState(false);
  const [savingSkills, setSavingSkills] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const toast = useToast();

  useEffect(() => {
    Promise.all([catalogService.areas(), catalogService.skills(), profileService.summary().catch(() => null)])
      .then(([a, s, summary]) => {
        setAreas(a);
        setSkills(s);
        if (summary) {
          setInterests(Object.fromEntries(summary.interests.map((i) => [i.academicAreaId, i.priority])));
          setSkillLevels(Object.fromEntries(summary.skills.map((sk) => [sk.skillId, sk.level])));
        }
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAreas = useMemo(() => {
    const q = normalize(areaQuery.trim());
    if (!q) return areas;
    return areas.filter((a) => normalize(a.name).includes(q));
  }, [areas, areaQuery]);

  const visibleSkills = useMemo(() => {
    const q = normalize(skillQuery.trim());
    if (!q) return skills;
    return skills.filter(
      (s) => normalize(s.name).includes(q) || normalize(s.academicArea?.name ?? '').includes(q),
    );
  }, [skills, skillQuery]);

  const chosenInterests = Object.values(interests).filter((p) => p > 0).length;
  const chosenSkills = Object.values(skillLevels).filter((l) => l > 0).length;

  const saveInterests = async () => {
    setSavingInterests(true);
    try {
      await profileService.setPreferredAreas(
        Object.entries(interests)
          .filter(([, p]) => p > 0)
          .map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      toast.success('Intereses actualizados', `${chosenInterests} área${chosenInterests === 1 ? '' : 's'} con interés declarado.`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingInterests(false);
    }
  };

  const saveSkills = async () => {
    setSavingSkills(true);
    try {
      await profileService.setSkills(
        Object.entries(skillLevels)
          .filter(([, l]) => l > 0)
          .map(([skillId, level]) => ({ skillId, level })),
      );
      toast.success('Habilidades actualizadas', `${chosenSkills} habilidad${chosenSkills === 1 ? '' : 'es'} declarada${chosenSkills === 1 ? '' : 's'}.`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSavingSkills(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Intereses y habilidades"
        description="Lo que declaras aquí alimenta tus áreas de afinidad y las recomendaciones que recibes."
      />

      <Card
        title="Intereses por área"
        actions={
          <div className="flex" style={{ gap: '0.6rem' }}>
            <Badge tone={chosenInterests ? 'bordo' : 'gray'}>
              {chosenInterests} seleccionada{chosenInterests === 1 ? '' : 's'}
            </Badge>
            <Button size="sm" loading={savingInterests} onClick={saveInterests} icon={<FiSave size={14} />}>
              Guardar intereses
            </Button>
          </div>
        }
      >
        <p className="muted" style={{ marginTop: '-0.3rem' }}>
          Indica qué tanto te interesa cada área.
        </p>

        <div className="filters">
          <SearchInput
            value={areaQuery}
            onChange={setAreaQuery}
            placeholder="Buscar área académica…"
          />
          <ResultCount shown={visibleAreas.length} total={areas.length} noun="áreas" />
        </div>

        {loading ? (
          <SkeletonTable rows={6} columns={2} />
        ) : visibleAreas.length === 0 ? (
          <EmptyState
            icon={<FiTarget size={22} />}
            message={`Ningún área coincide con “${areaQuery}”.`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setAreaQuery('')}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Área</th>
                  <th style={{ width: 190 }}>Nivel de interés</th>
                </tr>
              </thead>
              <tbody>
                {visibleAreas.map((a) => {
                  const value = interests[a.id] ?? 0;
                  return (
                    <tr key={a.id} className={value > 0 ? 'row-picked' : ''}>
                      <td>
                        <span className="flex" style={{ gap: '0.5rem' }}>
                          <FiSliders size={14} className="muted" />
                          {a.name}
                        </span>
                      </td>
                      <td>
                        <select
                          value={value}
                          onChange={(e) => setInterests({ ...interests, [a.id]: Number(e.target.value) })}
                        >
                          <option value={0}>{PRIORITY_LABELS[0]}</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{PRIORITY_LABELS[n]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Habilidades declaradas"
        actions={
          <div className="flex" style={{ gap: '0.6rem' }}>
            <Badge tone={chosenSkills ? 'bordo' : 'gray'}>
              {chosenSkills} declarada{chosenSkills === 1 ? '' : 's'}
            </Badge>
            <Button size="sm" loading={savingSkills} onClick={saveSkills} icon={<FiSave size={14} />}>
              Guardar habilidades
            </Button>
          </div>
        }
      >
        <p className="muted" style={{ marginTop: '-0.3rem' }}>
          Indica tu nivel de dominio en cada habilidad.
        </p>

        <div className="filters">
          <SearchInput
            value={skillQuery}
            onChange={setSkillQuery}
            placeholder="Buscar habilidad o área…"
          />
          <ResultCount shown={visibleSkills.length} total={skills.length} noun="habilidades" />
        </div>

        {loading ? (
          <SkeletonTable rows={6} columns={3} />
        ) : visibleSkills.length === 0 ? (
          <EmptyState
            icon={<FiAward size={22} />}
            message={`Ninguna habilidad coincide con “${skillQuery}”.`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSkillQuery('')}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Habilidad</th>
                  <th>Área</th>
                  <th style={{ width: 190 }}>Nivel de dominio</th>
                </tr>
              </thead>
              <tbody>
                {visibleSkills.map((s) => {
                  const value = skillLevels[s.id] ?? 0;
                  return (
                    <tr key={s.id} className={value > 0 ? 'row-picked' : ''}>
                      <td>{s.name}</td>
                      <td className="muted">{s.academicArea?.name ?? '—'}</td>
                      <td>
                        <select
                          value={value}
                          onChange={(e) => setSkillLevels({ ...skillLevels, [s.id]: Number(e.target.value) })}
                        >
                          <option value={0}>{LEVEL_LABELS[0]}</option>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{LEVEL_LABELS[n]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
