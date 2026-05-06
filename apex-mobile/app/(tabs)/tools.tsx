import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { Card, Divider, PriceChange } from '@/components/UI';

type Tool = 'planner' | 'journal' | 'alerts';

interface TradeEntry {
  id: string;
  ticker: string;
  side: 'long' | 'short';
  entry: string;
  exit: string;
  size: string;
  date: string;
  notes: string;
}

function TradePlanner() {
  const c = useColors();
  const [account, setAccount] = useState('25000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('', );
  const [target, setTarget] = useState('');

  const calc = () => {
    const acc = parseFloat(account) || 0;
    const risk = parseFloat(riskPct) / 100 || 0;
    const e = parseFloat(entry) || 0;
    const s = parseFloat(stop) || 0;
    const t = parseFloat(target) || 0;
    if (!e || !s || e === s) return null;
    const riskDollar = acc * risk;
    const stopDist = Math.abs(e - s);
    const shares = Math.floor(riskDollar / stopDist);
    const posSize = shares * e;
    const profitTarget = t ? (Math.abs(t - e) * shares) : null;
    const rr = t ? (Math.abs(t - e) / stopDist).toFixed(2) : null;
    return { riskDollar, shares, posSize, profitTarget, rr, stopDist };
  };

  const result = calc();
  const inputStyle = { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: c.radiusSm, paddingHorizontal: 12, paddingVertical: 10, color: c.foreground, fontSize: 15, fontFamily: 'Inter_400Regular' };
  const labelStyle = { color: c.muted, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1, marginBottom: 6, fontFamily: 'Inter_700Bold' };

  return (
    <View>
      <Text style={{ color: c.foreground, fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 16 }}>Trade Planner</Text>
      <Card style={{ marginBottom: 12 }}>
        <Text style={labelStyle}>ACCOUNT SIZE</Text>
        <TextInput style={inputStyle} value={account} onChangeText={setAccount} keyboardType="numeric" placeholder="25000" placeholderTextColor={c.muted} />
        <View style={{ height: 12 }} />
        <Text style={labelStyle}>MAX RISK PER TRADE (%)</Text>
        <TextInput style={inputStyle} value={riskPct} onChangeText={setRiskPct} keyboardType="numeric" placeholder="1" placeholderTextColor={c.muted} />
      </Card>
      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>ENTRY</Text>
            <TextInput style={inputStyle} value={entry} onChangeText={setEntry} keyboardType="numeric" placeholder="150.00" placeholderTextColor={c.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={labelStyle}>STOP LOSS</Text>
            <TextInput style={inputStyle} value={stop} onChangeText={setStop} keyboardType="numeric" placeholder="145.00" placeholderTextColor={c.muted} />
          </View>
        </View>
        <View style={{ height: 10 }} />
        <Text style={labelStyle}>TARGET (OPTIONAL)</Text>
        <TextInput style={inputStyle} value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="165.00" placeholderTextColor={c.muted} />
      </Card>
      {result && (
        <Card>
          <Text style={labelStyle}>POSITION SIZING</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              ['Risk $', `$${result.riskDollar.toFixed(0)}`],
              ['Shares', result.shares.toString()],
              ['Position Size', `$${result.posSize.toLocaleString()}`],
              result.rr ? ['Risk/Reward', `${result.rr}:1`] : null,
              result.profitTarget ? ['Profit Target', `$${result.profitTarget.toFixed(0)}`] : null,
            ].filter(Boolean).map(([label, val]) => (
              <View key={label as string} style={{ flex: 1, minWidth: '45%', backgroundColor: c.background, borderRadius: c.radiusSm, padding: 12 }}>
                <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{label as string}</Text>
                <Text style={{ color: c.foreground, fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold', marginTop: 2 }}>{val as string}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

function TradeJournal() {
  const c = useColors();
  const [trades] = useState<TradeEntry[]>([]);
  return (
    <View>
      <Text style={{ color: c.foreground, fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 16 }}>Trade Journal</Text>
      {trades.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="journal-outline" size={40} color={c.muted} style={{ marginBottom: 12 }} />
          <Text style={{ color: c.muted, fontSize: 15, fontFamily: 'Inter_400Regular' }}>No trades logged yet</Text>
          <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: 4, fontFamily: 'Inter_400Regular' }}>Your trades will appear here</Text>
        </Card>
      ) : null}
    </View>
  );
}

function Alerts() {
  const c = useColors();
  return (
    <View>
      <Text style={{ color: c.foreground, fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 16 }}>Price Alerts</Text>
      <Card style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Ionicons name="notifications-outline" size={40} color={c.muted} style={{ marginBottom: 12 }} />
        <Text style={{ color: c.muted, fontSize: 15, fontFamily: 'Inter_400Regular' }}>No active alerts</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 13, marginTop: 4, fontFamily: 'Inter_400Regular' }}>Set price and volume alerts for your watchlist</Text>
      </Card>
    </View>
  );
}

export default function ToolsTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<Tool>('planner');
  const topInsets = Platform.OS === 'web' ? 67 : insets.top;

  const tools: { key: Tool; label: string; icon: string }[] = [
    { key: 'planner', label: 'Planner', icon: 'calculator' },
    { key: 'journal', label: 'Journal', icon: 'journal' },
    { key: 'alerts', label: 'Alerts', icon: 'notifications' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: topInsets + 12, paddingHorizontal: 16, paddingBottom: 0 }}>
        <Text style={{ color: c.foreground, fontSize: 26, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginBottom: 16 }}>Tools</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {tools.map(t => (
            <TouchableOpacity
              key={t.key}
              onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTool(t.key); }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: c.radiusSm, backgroundColor: activeTool === t.key ? c.primary : c.surface, borderWidth: 1, borderColor: activeTool === t.key ? c.primary : c.border }}
            >
              <Ionicons name={`${t.icon}-outline` as any} size={15} color={activeTool === t.key ? '#fff' : c.muted} />
              <Text style={{ color: activeTool === t.key ? '#fff' : c.muted, fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 34 : 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeTool === 'planner' && <TradePlanner />}
        {activeTool === 'journal' && <TradeJournal />}
        {activeTool === 'alerts' && <Alerts />}
      </ScrollView>
    </View>
  );
}
