import { PRIVACY_POLICY } from '@/content/legal/privacyPolicy';

import { LegalDocumentScreen } from './LegalDocumentScreen';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen doc={PRIVACY_POLICY} />;
}
