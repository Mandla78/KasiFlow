import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  return (
    <View style={[styles.pill, focused && styles.pillOn]}>
      <Feather name={name} size={19} color={color} />
    </View>
  );
}

/** Bottom bar: Home · Account · Suppliers · More. */
export default function TabsLayout() {
  const tab = (title: string, icon: IconName) => ({
    title,
    tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <TabIcon name={icon} color={color} focused={focused} />
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.porcelain },
      }}>
      <Tabs.Screen name="home" options={tab('Home', 'home')} />
      <Tabs.Screen name="account" options={tab('Account', 'grid')} />
      <Tabs.Screen name="suppliers" options={tab('Suppliers', 'shopping-bag')} />
      <Tabs.Screen name="more" options={tab('More', 'more-horizontal')} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pill: { width: 46, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.accentTint },
});
