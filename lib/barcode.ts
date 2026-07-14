const BARCODE_PREFIX = 'MSC';
const BARCODE_SEQUENCE_LENGTH = 8;

export function formatBarcodeSequence(sequence: number): string {
  return `${BARCODE_PREFIX}${String(sequence).padStart(BARCODE_SEQUENCE_LENGTH, '0')}`;
}

export function generateBarcodeFromTimestamp(): string {
  const sequence = Date.now() % 10 ** BARCODE_SEQUENCE_LENGTH;
  return formatBarcodeSequence(sequence);
}

export async function getNextBarcodeSequence(
  getMaxSequence: () => Promise<number>
): Promise<string> {
  const maxSequence = await getMaxSequence();
  return formatBarcodeSequence(maxSequence + 1);
}

export function isValidInternalBarcode(barcode: string): boolean {
  return /^MSC\d{8}$/.test(barcode.trim());
}
