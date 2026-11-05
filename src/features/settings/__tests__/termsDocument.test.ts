import { resolveTermsDocument } from '../termsDocument';

const valid = {
  version: '20261104',
  title: 'Approved test document',
  sections: [
    { kind: 'heading', text: 'Overview' },
    { kind: 'paragraph', text: 'A'.repeat(9500) },
  ],
};

describe('Terms document loading gate', () => {
  it('keeps the pending state when no approved document exists', () => {
    expect(resolveTermsDocument(undefined)).toEqual({ status: 'unavailable' });
    expect(resolveTermsDocument(null)).toEqual({ status: 'unavailable' });
  });

  it('renders only a complete versioned plain-text document', () => {
    expect(resolveTermsDocument(valid)).toEqual({ status: 'ready', document: valid });
  });

  it.each([
    { ...valid, version: 'unknown' },
    { ...valid, title: '' },
    { ...valid, sections: [] },
    { ...valid, sections: [{ kind: 'html', text: '<script>alert(1)</script>' }] },
    { ...valid, sections: [{ kind: 'paragraph', text: ' ' }] },
    { ...valid, sections: [{ kind: 'paragraph', text: 'x'.repeat(12001) }] },
    'invalid',
  ])('refuses invalid content without falling back to unapproved text', candidate => {
    expect(resolveTermsDocument(candidate)).toEqual({ status: 'invalid' });
  });
});
