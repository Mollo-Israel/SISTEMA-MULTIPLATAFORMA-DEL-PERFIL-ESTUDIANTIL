import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SkillInterestKind } from '@perfil/shared';
import { cleanText } from '../../common/validation';

export class SkillInterestItemDto {
  @ApiProperty()
  @IsUUID('4', { message: 'La tecnología elegida no es válida.' })
  skillId: string;

  @ApiProperty({ enum: SkillInterestKind, default: SkillInterestKind.INTEREST })
  @IsEnum(SkillInterestKind, { message: 'Indica si te interesa o si quieres mejorarla.' })
  kind: SkillInterestKind;
}

/** Reemplazo completo de las tecnologías de interés (V2 §21). */
export class ReplaceSkillInterestsDto {
  @ApiProperty({ type: [SkillInterestItemDto] })
  @IsArray()
  @ArrayMaxSize(60, { message: 'Puedes marcar como máximo 60 tecnologías.' })
  @ValidateNested({ each: true })
  @Type(() => SkillInterestItemDto)
  items: SkillInterestItemDto[];
}

/** Paso 1 de la bienvenida: confirmar datos institucionales (y bio opcional). */
export class ConfirmInstitutionalDto {
  @ApiPropertyOptional({ description: 'Presentación breve, opcional (§20.2).' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  bio?: string;
}

/** Paso 4 de la bienvenida: privacidad básica (§20.2). */
export class OnboardingPrivacyDto {
  @ApiProperty({ description: 'Aparecer como posible compañero en sugerencias de otros estudiantes.' })
  @IsBoolean({ message: 'Indica si quieres aparecer en las sugerencias de compañeros.' })
  peerDiscoverable: boolean;

  @ApiProperty({ description: 'Activar el perfil compartible (opt-in, §58).' })
  @IsBoolean({ message: 'Indica si quieres activar tu perfil compartible.' })
  publicProfileEnabled: boolean;
}
