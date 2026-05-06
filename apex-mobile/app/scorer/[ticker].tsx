import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';
import { Card, Loader, ErrorState, ScoreBar, PriceChange } from '@/components/UI';

export default function ScorerInsightScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const { data: assets } = useQuery<{ rows: any[] }>({
    queryKey: ['/api/market/top-assets'],
    queryFn: () => apiRequest('GET', '/api/market/top-assets', undefined, token),
  });

  const asset = assets?.rows?.find(a => a.ticker === ticker);

  const { data: insight, isLoading, error } = useQuery<{ insight: string }>({
    queryKey: ['/api/scorer-insight', ticker],
    queryFn: () => apiRequest('POST', '/api/scorer-insight', { ticker, assetData: asset }, token),
    enabled: !!ticker && !!asset,
  });

  const topInsets = Platform.OS === 'web' ? 67 : insets.top;
  const signal = (asset?.score100 ?? 0) >= 75 ? 'Strong Buy' : (asset?.score100 ?? 0) >= 60 ? 'Buy' : (asset?.score100 ?? 0) >= 40 ? 'Neutral' : 'Caution';
  const sigColor = (asset?.score100 ?? 0) >= 75 ? c.bull : (asset?.score100 ?? 0) >= 60 ? c.info : (asset?.score100 ?? 0) >= 40 ? c.neutral : c.bear;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: topInsets + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-down" size={24} color={c.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.foreground, fontSize: 20, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>{ticker}</Text>
          {asset && <Text style={{ color: c.muted, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{asset.name}</Text>}
        </View>
        {asset && <PriceChange value={asset.change} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {asset && (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <Card style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1 }}>AI SCORE</Text>
                <Text style={{ color: c.ai, fontSize: 32, fontWeight: '800', fontFamily: 'Inter_700Bold', marginVertical: 4 }}>{asset.score10}/10</Text>
                <ScoreBar score={asset.score100} />
              </Card>
              <Card style={{ flex: 1 }}>
                <Text style={{ color: c.muted, fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginBottom: 6 }}>SIGNAL</Text>
                <Text style={{ color: sigColor, fontSize: 17, fontWeight: '800', fontFamily: 'Inter_700Bold' }}>{signal}</Text>
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, fontFamily: 'Inter_400Regular' }}>Vol: {asset.volX}× avg</Text>
                <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>Price: ${asset.price}</Text>
              </Card>
            </View>

            <Card style={{ marginBottom: 12 }}>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, fontFamily: 'Inter_700Bold' }}>SUGGESTED LEVELS</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  ['Entry', `$${asset.price}`, c.info],
                  ['Stop', `$${(asset.price * 0.965).toFixed(2)}`, c.bear],
                  ['Target', `$${(asset.price * 1.085).toFixed(2)}`, c.bull],
                ].map(([label, val, col]) => (
                  <View key={label as string} style={{ flex: 1, backgroundColor: (col as string) + '15', borderRadius: c.radiusSm, padding: 10, alignItems: 'center' }}>
                    <Text style={{ color: col as string, fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 2 }}>{label as string}</Text>
                    <Text style={{ color: c.foreground, fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{val as string}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Ionicons name="sparkles" size={14} color={c.ai} />
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, fontFamily: 'Inter_700Bold' }}>GEMINI PRO INSIGHT</Text>
          </View>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={c.ai} />
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 10, fontFamily: 'Inter_400Regular' }}>Analyzing {ticker}...</Text>
            </View>
          ) : error ? (
            <Text style={{ color: c.bear, fontSize: 14, fontFamily: 'Inter_400Regular' }}>Failed to load AI insight</Text>
          ) : (
            <Text style={{ color: c.foreground, fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular' }}>{insight?.insight}</Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
