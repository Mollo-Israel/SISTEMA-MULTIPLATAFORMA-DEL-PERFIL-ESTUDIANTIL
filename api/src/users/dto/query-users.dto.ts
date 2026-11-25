import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { RolNombre, UserStatus } from '@perfil/shared';
import { trim } from '../../common/validation';

/** V7.1 §4.1: un único estado de cuenta, o «all» para verlas todas. */
export const ESTADOS_DE_CUENTA = [...Object.values(UserStatus), 'all'] as const;
export type EstadoDeCuenta = (typeof ESTADOS_DE_CUENTA)[number];

/** Columnas por las que la grilla de usuarios puede ordenar. */
export const ORDENES_DE_USUARIOS = ['created', 'name', 'email', 'role', 'semester', 'status'] as const;
export type OrdenDeUsuarios = (typeof ORDENES_DE_USUARIOS)[number];

/**
 * Filtros del listado de cuentas (V7.1 §4.1).
 *
 * Sin `limit` la respuesta es la lista completa, como siempre: la usan los
 * selectores de responsables y las suites anteriores. Con `limit` es una
 * página `{ items, total, limit, offset, surnamesPending }`, filtrada en SQL
 * antes de paginar, así que `total` es el del filtro.
 */
export class QueryUsersDto {
  @ApiPropertyOptional({ description: 'Nombre, apellido, correo o código universitario' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100, { message: 'La búsqueda admite hasta 100 caracteres.' })
  search?: string;

  @ApiPropertyOptional({ enum: RolNombre })
  @IsOptional()
  @IsEnum(RolNombre, { message: 'El rol indicado no es válido.' })
  role?: RolNombre;

  @ApiPropertyOptional({ enum: ESTADOS_DE_CUENTA, description: 'Un único estado. «all» trae todas las cuentas.' })
  @IsOptional()
  @IsIn(ESTADOS_DE_CUENTA, { message: 'El estado debe ser pending_activation, active, suspended, inactive o all.' })
  status?: EstadoDeCuenta;

  @ApiPropertyOptional({ enum: ['pending'], description: 'Solo cuentas con un apellido heredado por separar (V5-04)' })
  @IsOptional()
  @IsIn(['pending'], { message: 'El filtro de apellidos solo admite «pending».' })
  surnames?: 'pending';

  @ApiPropertyOptional({ enum: ORDENES_DE_USUARIOS, description: 'Columna de orden (con limit). Por omisión, las más recientes primero.' })
  @IsOptional()
  @IsIn(ORDENES_DE_USUARIOS, { message: 'La columna de orden no es válida.' })
  sort?: OrdenDeUsuarios;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'El sentido del orden debe ser asc o desc.' })
  dir?: 'asc' | 'desc';

  @ApiPropertyOptional({ minimum: 1, maximum: 100, description: 'Tamaño de página (activa la paginación)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El tamaño de página debe ser un número.' })
  @Min(1, { message: 'El tamaño de página mínimo es 1.' })
  @Max(100, { message: 'El tamaño de página máximo es 100.' })
  limit?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Desde qué posición (con limit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La posición debe ser un número.' })
  @Min(0, { message: 'La posición no puede ser negativa.' })
  offset?: number;
}
