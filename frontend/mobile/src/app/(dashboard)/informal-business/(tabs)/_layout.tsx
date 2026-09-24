import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

function TabIcon({ name, color, focused }: { name: IconName; color: ColorValue; focused: boolean }) {
  return (
    <View style={[styles.pill, focused && styles.pillOn]}>
      <Feather name={name} size={23} color={color} />
    </View>
  );
}

/**
 * Bottom bar: Home · Account · Suppliers · More. Big enough to hit with a
 * thumb on a small phone, and it adds the phone's own bottom inset so it
 * never sits under the system navigation bar.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
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
        tabBarActiveTintColor: colors.accentDeep,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12.5, marginTop: 4 },
        tabBarItemStyle: { paddingTop: 8 },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 72 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
        },
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
  pill: { width: 60, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.accentTint },
});
