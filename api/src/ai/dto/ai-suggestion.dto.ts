import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AiTaskType, CvAssistMode } from '@perfil/shared';

/** Pedido de una sugerencia (V2 §43.2). Cada tarea usa solo sus campos. */
export class AiSuggestionDto {
  @ApiProperty({ enum: AiTaskType })
  @IsEnum(AiTaskType, { message: 'Tarea de IA no válida.' })
  task: AiTaskType;

  /** TAG_SUGGESTION: título y descripción de la actividad o nombre de la habilidad. CV_TEXT_ASSIST: el texto. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  /** TAG_SUGGESTION: sobre qué se sugiere. */
  @ApiProperty({ required: false, enum: ['activity', 'skill'] })
  @IsOptional()
  @IsIn(['activity', 'skill'])
  target?: 'activity' | 'skill';

  /** EVIDENCE_SUMMARY e INCONSISTENCY_EXPLANATION. */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4', { message: 'Proyecto no válido.' })
  projectId?: string;

  @ApiProperty({ required: false, enum: CvAssistMode })
  @IsOptional()
  @IsEnum(CvAssistMode)
  mode?: CvAssistMode;
}
