/**
 * Puerto de almacenamiento de archivos.
 *
 * El sistema guarda evidencias y certificados a traves de esta abstraccion, no
 * contra un proveedor concreto. En desarrollo se resuelve con el disco local; un
 * proveedor externo (por ejemplo Cloudinary) se agrega implementando esta misma
 * interfaz, sin tocar los modulos que la consumen.
 */
export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface StoredFile {
  /** Identificador interno del archivo dentro del almacenamiento. */
  id: string;
  /** Ruta publica relativa para descargarlo (por ejemplo /api/files/xxx.pdf). */
  url: string;
  /** Nombre con el que lo subio la persona, para mostrarlo en la interfaz. */
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoragePort {
  /** Guarda el archivo y devuelve su referencia persistible. */
  save(file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  }): Promise<StoredFile>;

  /** Elimina un archivo. No falla si ya no existe. */
  remove(fileUrl: string): Promise<void>;
}
