import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDefined, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SetCredentialPolicyDto {
  @ApiProperty({ description: 'Habilitar o apagar la emisión de registros verificables.' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Por qué Dirección decide esto (queda en la historia y en la bitácora).', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  justification: string;
}

export class CredentialReasonDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class IssuePendingDto {
  @ApiPropertyOptional({ description: 'Solo esta actividad. Sin ella, todo lo pendiente (máximo 500 estudiantes por vez).' })
  @IsOptional()
  @IsUUID()
  activityId?: string;
}

export class VerifyPresentedDto {
  @ApiProperty({
    description: 'La credencial: objeto JSON (Open Badges 3.0 / 2.0), texto JSON, un VC-JWT o una URL de verificación.',
    oneOf: [{ type: 'string' }, { type: 'object' }],
  })
  @IsDefined()
  credential: unknown;
}

export class VerifyBatchDto {
  @ApiProperty({ type: [String], maxItems: 25 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  codes: string[];
}
