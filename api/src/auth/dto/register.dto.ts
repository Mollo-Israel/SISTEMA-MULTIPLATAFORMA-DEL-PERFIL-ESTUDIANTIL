import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// Nombre/apellido: letras (con acentos), separados por un solo espacio, apóstrofo o guion.
const NAME_RE = /^[A-Za-zÀ-ÿ]+(?:[ '-][A-Za-zÀ-ÿ]+)*$/;
// Correo institucional: debe terminar en univalle.edu (admite subdominios: est.univalle.edu, etc.)
const UNIVALLE_RE = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*univalle\.edu$/i;
// Contraseña fuerte: mayúscula, minúscula, número y símbolo; sin espacios; 8 a 72.
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])(?!.*\s).{8,72}$/;

export class RegisterDto {
  @ApiProperty({ example: 'Ana' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El nombre no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: 'El nombre solo admite letras, espacios, apóstrofo o guion.' })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El apellido no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: 'El apellido solo admite letras, espacios, apóstrofo o guion.' })
  lastName: string;

  @ApiProperty({ example: 'ana.perez@univalle.edu' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(160, { message: 'El correo es demasiado largo.' })
  @Matches(UNIVALLE_RE, { message: 'El correo debe ser institucional (terminar en univalle.edu).' })
  email: string;

  @ApiProperty({ example: 'Clave123*', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga.' })
  @Matches(PASSWORD_RE, {
    message: 'La contraseña debe incluir mayúscula, minúscula, número y símbolo, sin espacios.',
  })
  password: string;
}
