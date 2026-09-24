import { StyleSheet, Text, View } from 'react-native';

import { LegalDocument } from '@/content/legal/types';
import { InfoNote } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Muted, Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

/** Renders a Privacy Policy / Terms document. Readable before and after sign-in. */
export function LegalDocumentScreen({ doc }: { doc: LegalDocument }) {
  return (
    <Screen>
      <BackButton />
      <View style={{ gap: 6 }}>
        <Title>{doc.title}</Title>
        <Muted>
          Version {doc.version} · effective {doc.effectiveDate}
        </Muted>
      </View>
      {doc.draftNotice ? <InfoNote icon="alert-circle">{doc.draftNotice}</InfoNote> : null}
      {doc.sections.map((s) => (
        <View key={s.heading} style={{ gap: 8 }}>
          <Text style={styles.heading}>{s.heading}</Text>
          {s.paragraphs.map((p, i) => (
            <Text key={i} style={styles.body}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.text },
});
