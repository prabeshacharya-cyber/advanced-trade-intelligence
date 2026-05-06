import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, Divider } from '@/components/UI';

function Row({ icon, label, value, onPress, danger }: { icon: string; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const c = useColors();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: danger ? c.bear + '20' : c.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <Ionicons name={icon as any} size={16} color={danger ? c.bear : c.muted} />
      </View>
      <Text style={{ flex: 1, color: danger ? c.bear : c.foreground, fontSize: 15, fontFamily: 'Inter_500Medium' }}>{label}</Text>
      {value && <Text style={{ color: c.muted, fontSize: 14, fontFamily: 'Inter_400Regular', marginRight: 4 }}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function ProfileTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();
  const topInsets = Platform.OS === 'web' ? 67 : insets.top;

  const { data: subsData, refetch: refetchSubs } = useQuery({
    queryKey: ['/api/briefing/subscribers'],
    queryFn: () => apiRequest<any[]>('GET', '/api/briefing/subscribers', undefined, token),
    enabled: !!token,
  });

  const isSubscribed = Array.isArray(subsData)
    ? subsData.some((s: any) => s.email?.toLowerCase() === user?.email?.toLowerCase())
    : false;

  const subscribeMutation = useMutation({
    mutationFn: () => isSubscribed
      ? apiRequest('DELETE', '/api/briefing/subscribe-me', undefined, token)
      : apiRequest('POST', '/api/briefing/subscribe-me', undefined, token),
    onSuccess: () => {
      refetchSubs();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { logout(); router.replace('/auth'); } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInsets + 12, paddingBottom: Platform.OS === 'web' ? 34 : 20 }} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={{ paddingHorizontal: 16, marginBottom: 28 }}>
          <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginBottom: 20 }}>Profile</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.primary, fontSize: 24, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </Text>
            </View>
            <View>
              <Text style={{ color: c.foreground, fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{user?.name || 'User'}</Text>
              <Text style={{ color: c.muted, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{user?.email}</Text>
              <View style={{ backgroundColor: user?.role === 'admin' ? c.ai + '20' : c.info + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-start' }}>
                <Text style={{ color: user?.role === 'admin' ? c.ai : c.info, fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>
                  {user?.role === 'admin' ? 'ADMIN' : 'MEMBER'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Briefing subscription */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, fontFamily: 'Inter_700Bold' }}>MORNING BRIEFING</Text>
        </View>
        <Card style={{ marginHorizontal: 16, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: c.neutral + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="mail-outline" size={16} color={c.neutral} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontSize: 15, fontFamily: 'Inter_500Medium' }}>Daily 7 AM Briefing</Text>
              <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                {isSubscribed ? 'Sent to ' + user?.email : 'Gemini Pro market summary'}
              </Text>
            </View>
            <Switch
              value={isSubscribed}
              onValueChange={() => subscribeMutation.mutate()}
              trackColor={{ false: c.border, true: c.bull }}
              thumbColor="#fff"
              disabled={subscribeMutation.isPending}
            />
          </View>
        </Card>

        {/* Account */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, fontFamily: 'Inter_700Bold' }}>ACCOUNT</Text>
        </View>
        <Card style={{ marginHorizontal: 16, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <Row icon="server-outline" label="API Server" value="Connected" />
          <Divider />
          <Row icon="shield-checkmark-outline" label="Security" value="JWT Auth" />
          <Divider />
          <Row icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
        </Card>

        {/* About */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, fontFamily: 'Inter_700Bold' }}>ABOUT</Text>
        </View>
        <Card style={{ marginHorizontal: 16, padding: 0, overflow: 'hidden' }}>
          <Row icon="information-circle-outline" label="Version" value="1.0.0" />
          <Divider />
          <Row icon="alert-circle-outline" label="Disclaimer" value="Not financial advice" />
        </Card>

        <Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 28, fontFamily: 'Inter_400Regular' }}>
          ATI · Advanced Trade Intelligence
        </Text>
      </ScrollView>
    </View>
  );
}
