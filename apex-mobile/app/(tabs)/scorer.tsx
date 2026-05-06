import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Loader, ErrorState, PriceChange, ScoreBar, Badge } from '@/components/UI';

interface Asset {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  score100: number;
  score10: number;
  volX: number;
}

function AssetRow({ item, rank, onPress }: { item: Asset; rank: number; onPress: () => void }) {
  const c = useColors();
  const signal = item.score100 >= 75 ? 'Strong Buy' : item.score100 >= 60 ? 'Buy' : item.score100 >= 40 ? 'Neutral' : 'Caution';
  const sigColor = item.score100 >= 75 ? c.bull : item.score100 >= 60 ? c.info : item.score100 >= 40 ? c.neutral : c.bear;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ backgroundColor: c.surface, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.ai + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Text style={{ color: c.ai, fontSize: 11, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>#{rank}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{item.ticker}</Text>
          <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{item.name} · {item.sector}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: c.foreground, fontWeight: '700', fontSize: 15, fontFamily: 'Inter_700Bold' }}>${item.price}</Text>
          <PriceChange value={item.change} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: c.surface2, borderRadius: c.radiusSm, padding: 10, alignItems: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'Inter_500Medium', marginBottom: 2 }}>AI SCORE</Text>
          <Text style={{ color: c.ai, fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>{item.score10}/10</Text>
        </View>
        <View style={{ flex: 2, backgroundColor: c.surface2, borderRadius: c.radiusSm, padding: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'Inter_500Medium' }}>SIGNAL</Text>
            <Text style={{ color: sigColor, fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{signal}</Text>
          </View>
          <ScoreBar score={item.score100} />
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 5, fontFamily: 'Inter_400Regular' }}>Vol: {item.volX}× avg</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ScorerTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ rows: Asset[] }>({
    queryKey: ['/api/market/top-assets'],
    queryFn: () => apiRequest('GET', '/api/market/top-assets', undefined, token),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const topInsets = Platform.OS === 'web' ? 67 : insets.top;
  const assets = (data?.rows || []).sort((a, b) => b.score100 - a.score100);

  if (isLoading) return <View style={{ flex: 1, backgroundColor: c.background, paddingTop: topInsets }}><Loader /></View>;
  if (error) return <View style={{ flex: 1, backgroundColor: c.background }}><ErrorState message="Failed to load scorer" onRetry={refetch} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={assets}
        keyExtractor={item => item.ticker}
        renderItem={({ item, index }) => (
          <AssetRow
            item={item}
            rank={index + 1}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/scorer/${item.ticker}`);
            }}
          />
        )}
        contentContainerStyle={{ paddingTop: topInsets + 12, paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: -0.5 }}>AI Scorer</Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, fontFamily: 'Inter_400Regular' }}>Top picks ranked by AI signal strength</Text>
          </View>
        }
        scrollEnabled={!!assets.length}
      />
    </View>
  );
}
