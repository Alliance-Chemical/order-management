export function resolveDocumentName(
  originalName: string | null | undefined,
  s3Key: string | null | undefined
): string {
  const trimmedOriginal = originalName?.trim();
  if (trimmedOriginal) {
    return trimmedOriginal;
  }

  const keyPart = s3Key
    ?.split('/')
    .filter(Boolean)
    .pop()
    ?.trim();

  if (keyPart) {
    return keyPart;
  }

  return 'document';
}
