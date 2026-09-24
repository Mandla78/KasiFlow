import { TERMS_OF_USE } from '@/content/legal/termsOfUse';

import { LegalDocumentScreen } from './LegalDocumentScreen';

export default function TermsOfUseScreen() {
  return <LegalDocumentScreen doc={TERMS_OF_USE} />;
}
