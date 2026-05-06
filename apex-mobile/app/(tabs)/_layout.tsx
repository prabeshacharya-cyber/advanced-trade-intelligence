import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { useEffect } from 'react';

function TabIcon({ name, focused, color }: { name: any; focused: boolean; color: string }) {
  return <Ionicons name={focused ? name : `${name}-outline` as any} size={22} color={color} />;
}

export default function TabsLayout() {
  const c = useColors();
  const { token, loading } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      router.replace('/auth');
    }
  }, [token, loading]);

  if (!token) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 6,
          elevation: Platform.OS === 'android' ? 8 : 0,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter_500Medium',
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Markets', tabBarIcon: ({ focused, color }) => <TabIcon name="stats-chart" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="scorer"
        options={{ title: 'Scorer', tabBarIcon: ({ focused, color }) => <TabIcon name="trophy" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'AI Chat', tabBarIcon: ({ focused, color }) => <TabIcon name="sparkles" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="tools"
        options={{ title: 'Tools', tabBarIcon: ({ focused, color }) => <TabIcon name="construct" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ focused, color }) => <TabIcon name="ellipsis-horizontal-circle" focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
