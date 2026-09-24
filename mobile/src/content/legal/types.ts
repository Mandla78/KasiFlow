export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDocument = {
  /** Stored with the user's consent, so a changed document can ask again. */
  version: string;
  title: string;
  effectiveDate: string;
  draftNotice?: string;
  sections: LegalSection[];
};
