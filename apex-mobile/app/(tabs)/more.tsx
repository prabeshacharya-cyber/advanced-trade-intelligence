import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { Card, Divider } from '@/components/UI';

const navGroups = [
  {
    section: 'Market',
    items: [
      { label: 'Markets Overview', icon: 'stats-chart', route: '/(tabs)/index' as const },
      { label: 'AI Scorer',        icon: 'trophy',       route: '/(tabs)/scorer' as const },
    ],
  },
  {
    section: 'AI Intelligence',
    items: [
      { label: 'AI Chat',     icon: 'sparkles',  route: '/(tabs)/chat' as const },
    ],
  },
  {
    section: 'Trader Tools',
    items: [
      { label: 'Trade Planner & Journal', icon: 'calculator', route: '/(tabs)/tools' as const },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'Profile & Settings', icon: 'person-circle', route: '/(tabs)/profile' as const },
    ],
  },
]

export default function MoreTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const topInsets = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topInsets + 12, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: -0.5 }}>More</Text>
          {user && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, backgroundColor: c.surface, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.primary, fontSize: 18, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>{user.name?.[0]?.toUpperCase() || 'A'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{user.name}</Text>
                <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{user.email}</Text>
              </View>
              <View style={{ backgroundColor: user.role === 'admin' ? c.ai + '20' : c.info + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: user.role === 'admin' ? c.ai : c.info, fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>
                  {user.role === 'admin' ? 'ADMIN' : 'MEMBER'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {navGroups.map(({ section, items }) => (
          <View key={section} style={{ marginBottom: 4 }}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8, fontFamily: 'Inter_700Bold' }}>
              {section.toUpperCase()}
            </Text>
            <Card style={{ marginHorizontal: 16, padding: 0, overflow: 'hidden' }}>
              {items.map((item, idx) => (
                <View key={item.label}>
                  {idx > 0 && <Divider />}
                  <TouchableOpacity
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(item.route as any);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, minHeight: 52 }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Ionicons name={`${item.icon}-outline` as any} size={16} color={c.muted} />
                    </View>
                    <Text style={{ flex: 1, color: c.foreground, fontSize: 15, fontFamily: 'Inter_500Medium' }}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={15} color={c.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity
            onPress={async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              logout();
              router.replace('/auth');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bear + '15', borderRadius: c.radius, borderWidth: 1, borderColor: c.bear + '30', paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={17} color={c.bear} />
            <Text style={{ color: c.bear, fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: c.mutedForeground, fontSize: 11, textAlign: 'center', marginTop: 24, fontFamily: 'Inter_400Regular' }}>
          ATI · Advanced Trade Intelligence · Not financial advice
        </Text>
      </ScrollView>
    </View>
  );
}
