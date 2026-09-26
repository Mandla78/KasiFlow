import { View } from 'react-native';

import { ToolSwitches } from '@/features/dashboard/informal-business/account/components/ToolSwitches';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';

/** More -> Tools: switch the business's tools on and off (saved at once). */
export default function ToolsScreen() {
  return (
    <Screen back>
      <View style={{ gap: 6 }}>
        <Title>Tools</Title>
        <Body>Switch on what your business needs. You can change this any time.</Body>
      </View>
      <Card style={{ gap: 4 }}>
        <ToolSwitches />
      </Card>
    </Screen>
  );
}
