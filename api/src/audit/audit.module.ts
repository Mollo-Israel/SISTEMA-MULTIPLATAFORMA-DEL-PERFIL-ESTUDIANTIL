import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from '../entities/audit-event.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

/**
 * Bitacora de auditoria (especificacion §70).
 *
 * Es global porque practicamente cualquier modulo tiene alguna accion que
 * debe quedar registrada; obligarlos a importarlo uno por uno solo produce
 * modulos con una dependencia mas y ninguna diferencia real.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
