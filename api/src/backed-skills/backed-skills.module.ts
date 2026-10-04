import { Global, Module } from '@nestjs/common';
import { BackedSkillsService } from './backed-skills.service';

/**
 * Global: perfil compartible, equipos, recomendaciones, reportes y CV lo
 * necesitan, y ninguno de ellos debe volver a calcular «qué tecnologías están
 * respaldadas» por su cuenta (V2 RNF07: sin duplicación innecesaria).
 */
@Global()
@Module({
  providers: [BackedSkillsService],
  exports: [BackedSkillsService],
})
export class BackedSkillsModule {}
