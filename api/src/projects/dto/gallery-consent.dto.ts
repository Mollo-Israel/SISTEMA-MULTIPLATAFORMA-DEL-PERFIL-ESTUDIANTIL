import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** V6 §7.5: si mi nombre y mis roles se muestran en «Proyectos de la carrera». */
export class GalleryConsentDto {
  @ApiProperty({ example: true })
  @IsBoolean({ message: 'Indica sí o no.' })
  showInGallery: boolean;
}
