import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView } from 'expo-camera';
import { Button } from './ui';

/**
 * V7.1 §12.1 (T04): cámara para leer el QR de un perfil compartible.
 *
 * Solo lee códigos QR y entrega el texto una única vez; qué hacer con él lo
 * decide `leerQrDePerfil` (nunca se abre una URL desde aquí). El permiso de
 * cámara lo pide la pantalla cuando la persona toca «Escanear QR».
 */
export function EscanerQr({ visible, onLeido, onCerrar }: Readonly<{
  visible: boolean;
  onLeido: (texto: string) => void;
  onCerrar: () => void;
}>) {
  const [leido, setLeido] = useState(false);
  useEffect(() => { if (visible) setLeido(false); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        {visible && (
          <CameraView
            style={styles.camara}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={leido ? undefined : ({ data }) => { setLeido(true); onLeido(data); }}
          />
        )}
        <View style={styles.pie}>
          <Text style={styles.texto}>Apunta al código QR del perfil compartible de la otra persona.</Text>
          <Button variant="secondary" icon="x" title="Cancelar" onPress={onCerrar} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000' },
  camara: { flex: 1 },
  pie: { padding: 20, gap: 12, backgroundColor: '#000' },
  texto: { color: '#fff', textAlign: 'center' },
});
