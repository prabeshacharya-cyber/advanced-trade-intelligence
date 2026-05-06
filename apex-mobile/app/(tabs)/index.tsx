import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Card, Loader, ErrorState, PriceChange, Divider } from '@/components/UI';

interface MarketOverview {
  indices: { symbol: string; price: number; change: number; changePct: number }[];
  vix: number;
  fearGreed: number;
  sectors: { symbol: string; name: string; change: number }[];
}

export default function MarketsTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: overview, isLoading, error, refetch } = useQuery<MarketOverview>({
    queryKey: ['/api/market/overview'],
    queryFn: () => apiRequest('GET', '/api/market/overview', undefined, token),
  });

  const { data: sectors } = useQuery<{ sectors: any[] }>({
    queryKey: ['/api/market/sectors'],
    queryFn: () => apiRequest('GET', '/api/market/sectors', undefined, token),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const topInsets = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) return <View style={{ flex: 1, backgroundColor: c.background, paddingTop: topInsets }}><Loader /></View>;
  if (error) return <View style={{ flex: 1, backgroundColor: c.background }}><ErrorState message="Failed to load market data" onRetry={refetch} /></View>;

  const sectorList = sectors?.sectors || overview?.sectors || [];
  const bulls = sectorList.filter(s => s.change >= 0).sort((a, b) => b.change - a.change).slice(0, 4);
  const bears = sectorList.filter(s => s.change < 0).sort((a, b) => a.change - b.change).slice(0, 4);

  const fgColor = (overview?.fearGreed ?? 50) > 70 ? c.bear : (overview?.fearGreed ?? 50) > 55 ? c.neutral : (overview?.fearGreed ?? 50) > 40 ? c.bull : c.info;
  const fgLabel = (overview?.fearGreed ?? 50) > 70 ? 'Greed' : (overview?.fearGreed ?? 50) > 55 ? 'Mild Greed' : (overview?.fearGreed ?? 50) > 40 ? 'Neutral' : 'Fear';

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topInsets + 12, paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <View>
            <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: -0.5 }}>Markets</Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, fontFamily: 'Inter_400Regular' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={{ backgroundColor: c.bull + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: c.bull, fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>● LIVE</Text>
          </View>
        </View>

        {/* Indices */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, fontFamily: 'Inter_700Bold' }}>INDICES</Text>
          {(overview?.indices || []).map((idx, i) => (
            <View key={idx.symbol}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: c.foreground, fontWeight: '700', fontSize: 15, fontFamily: 'Inter_700Bold' }}>{idx.symbol}</Text>
                  <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>${idx.price?.toLocaleString()}</Text>
                </View>
                <PriceChange value={idx.changePct ?? idx.change} />
              </View>
            </View>
          ))}
        </Card>

        {/* VIX + Fear & Greed */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, fontFamily: 'Inter_700Bold' }}>VIX</Text>
            <Text style={{ color: c.foreground, fontSize: 28, fontWeight: '800', fontFamily: 'Inter_700Bold', marginTop: 4 }}>{overview?.vix ?? '—'}</Text>
            <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
              {(overview?.vix ?? 0) < 15 ? 'Low Vol' : (overview?.vix ?? 0) < 25 ? 'Moderate' : 'Elevated'}
            </Text>
          </Card>
          <Card style={{ flex: 2 }}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, fontFamily: 'Inter_700Bold' }}>FEAR & GREED</Text>
            <View style={{ height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <View style={{ height: 6, width: `${overview?.fearGreed ?? 50}%`, backgroundColor: fgColor, borderRadius: 3 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: fgColor, fontSize: 18, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>{overview?.fearGreed ?? '—'}</Text>
              <Text style={{ color: fgColor, fontSize: 13, fontWeight: '600', alignSelf: 'flex-end', fontFamily: 'Inter_600SemiBold' }}>{fgLabel}</Text>
            </View>
          </Card>
        </View>

        {/* Sectors */}
        {sectorList.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, fontFamily: 'Inter_700Bold' }}>SECTOR ROTATION</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.bull, fontSize: 11, fontWeight: '700', marginBottom: 6, fontFamily: 'Inter_700Bold' }}>LEADING</Text>
                {bulls.map(s => (
                  <View key={s.symbol} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{s.symbol}</Text>
                    <Text style={{ color: c.bull, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>+{s.change?.toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
              <View style={{ width: 1, backgroundColor: c.border }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.bear, fontSize: 11, fontWeight: '700', marginBottom: 6, fontFamily: 'Inter_700Bold' }}>LAGGING</Text>
                {bears.map(s => (
                  <View key={s.symbol} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: c.foreground, fontSize: 13, fontFamily: 'Inter_500Medium' }}>{s.symbol}</Text>
                    <Text style={{ color: c.bear, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{s.change?.toFixed(1)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
