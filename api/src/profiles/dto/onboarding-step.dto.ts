import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { ONBOARDING_STEPS_V2, OnboardingStepV2 } from '@perfil/shared';

/** Pasos de la bienvenida V2 (§20.1), en orden. */
export const ONBOARDING_STEPS = ONBOARDING_STEPS_V2;
export type OnboardingStep = OnboardingStepV2;

export class OnboardingStepDto {
  @ApiProperty({ enum: ONBOARDING_STEPS })
  @IsIn(ONBOARDING_STEPS as unknown as string[], { message: 'Paso de bienvenida no válido.' })
  step: OnboardingStep;
}
