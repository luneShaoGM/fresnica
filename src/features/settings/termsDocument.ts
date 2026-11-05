/** Only approved, plain-text content may reach the read-only Terms presentation. */
export type TermsSection = Readonly<{ kind: 'heading' | 'paragraph'; text: string }>;
export type TermsDocument = Readonly<{
  version: string;
  title: string;
  sections: readonly TermsSection[];
}>;

export type TermsDocumentState =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'invalid' }>
  | Readonly<{ status: 'ready'; document: TermsDocument }>;

/** Content must be explicitly approved before it can be rendered. */
export function resolveTermsDocument(candidate: unknown): TermsDocumentState {
  if (candidate == null) return { status: 'unavailable' };
  if (typeof candidate !== 'object' || Array.isArray(candidate)) return { status: 'invalid' };
  const value = candidate as Record<string, unknown>;
  if (
    typeof value.version !== 'string' ||
    !/^[0-9]{8}$/.test(value.version) ||
    typeof value.title !== 'string' ||
    !validText(value.title, 180) ||
    !Array.isArray(value.sections) ||
    value.sections.length === 0 ||
    value.sections.length > 200
  )
    return { status: 'invalid' };

  for (const section of value.sections as unknown[]) {
    if (typeof section !== 'object' || section === null || Array.isArray(section)) return { status: 'invalid' };
    const item = section as Record<string, unknown>;
    if ((item.kind !== 'heading' && item.kind !== 'paragraph') || !validText(item.text, 12000)) {
      return { status: 'invalid' };
    }
  }
  return { status: 'ready', document: candidate as TermsDocument };
}

function validText(input: unknown, maxLength: number): input is string {
  return typeof input === 'string' && input.trim().length > 0 && input.length <= maxLength;
}
