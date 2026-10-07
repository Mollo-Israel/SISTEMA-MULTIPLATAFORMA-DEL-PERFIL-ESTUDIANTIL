import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CertificatesService } from './certificates.service';
import { CreateExternalCertificateDto } from './dto/create-external-certificate.dto';
import { UpdateExternalCertificateDto } from './dto/update-external-certificate.dto';

@ApiTags('certificates')
@ApiBearerAuth()
@Roles(RolNombre.STUDENT)
@Controller('certificates/external')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post()
  @ApiOperation({ summary: 'Registra un certificado externo con sus tecnologías (V2 §41).' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExternalCertificateDto) {
    return this.certificatesService.create(user.userId, dto);
  }

  @Get('eligible-opportunities')
  @ApiOperation({
    summary: 'Oportunidades terminadas en las que ya puede adjuntar su credencial (V3 §15).',
    description: 'Externas en las que fue aceptado e internas con credencial de un tercero en las que fue confirmado, ya finalizadas y sin credencial adjunta.',
  })
  eligibleOpportunities(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.eligibleOpportunities(user.userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Certificados externos propios, con sus tecnologías.' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.findMine(user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza un certificado propio; se vuelve a validar.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExternalCertificateDto,
  ) {
    return this.certificatesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un certificado propio y su archivo.' })
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificatesService.remove(user.userId, id);
  }
}
