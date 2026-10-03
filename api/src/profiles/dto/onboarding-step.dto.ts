import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Pasos de la bienvenida, en orden. */
export const ONBOARDING_STEPS = [
  'welcome',
  'profile',
  'availability',
  'interests',
  'skills',
  'questionnaire',
  'done',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export class OnboardingStepDto {
  @ApiProperty({ enum: ONBOARDING_STEPS })
  @IsIn(ONBOARDING_STEPS as unknown as string[], { message: 'Paso de bienvenida no válido.' })
  step: OnboardingStep;
}
