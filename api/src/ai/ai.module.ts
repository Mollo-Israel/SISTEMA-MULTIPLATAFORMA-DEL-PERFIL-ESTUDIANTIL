import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProvider } from '@perfil/shared';
import { AiAssistanceRun } from '../entities/ai-assistance-run.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ReportsModule } from '../reports/reports.module';
import { AI_ASSISTANCE_PORT, AiAssistancePort } from './ai-assistance.port';
import { NoneAiAdapter } from './adapters/none.adapter';
import { OpenAiCompatibleAdapter } from './adapters/openai-compatible.adapter';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

/**
 * Elige el adaptador según `AI_PROVIDER` (V2 §43.1). Ante cualquier
 * configuración incompleta, `none`: la IA es opcional y el sistema no depende
 * de ella (§84).
 */
export function aiAdapterFactory(config: ConfigService): AiAssistancePort {
  const provider = (config.get<string>('AI_PROVIDER') ?? 'none').trim().toLowerCase();
  if (provider !== AiProvider.OPENAI_COMPATIBLE) return new NoneAiAdapter();
  const baseUrl = (config.get<string>('AI_BASE_URL') ?? '').trim();
  const model = (config.get<string>('AI_MODEL') ?? '').trim();
  if (!baseUrl || !model) {
    new Logger('AiModule').warn('AI_PROVIDER=openai_compatible sin AI_BASE_URL o AI_MODEL: IA desactivada.');
    return new NoneAiAdapter();
  }
  return new OpenAiCompatibleAdapter({
    baseUrl,
    model,
    apiKey: (config.get<string>('AI_API_KEY') ?? '').trim() || null,
    timeoutMs: Math.min(120_000, Math.max(1000, Number(config.get('AI_TIMEOUT_MS') ?? 15000) || 15000)),
  });
}

@Module({
  imports: [TypeOrmModule.forFeature([AiAssistanceRun, AcademicArea]), ProjectsModule, ReportsModule],
  controllers: [AiController],
  providers: [
    { provide: AI_ASSISTANCE_PORT, useFactory: aiAdapterFactory, inject: [ConfigService] },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
