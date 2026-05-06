import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 16 }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: c.foreground, fontSize: 20, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: -0.3 }}>{title}</Text>
      {sub && <Text style={{ color: c.muted, fontSize: 13, marginTop: 2, fontFamily: 'Inter_400Regular' }}>{sub}</Text>}
    </View>
  );
}

export function Loader() {
  const c = useColors();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
      <Text style={{ color: c.bear, fontSize: 15, textAlign: 'center', marginBottom: 16, fontFamily: 'Inter_400Regular' }}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={{ backgroundColor: c.surface, borderRadius: c.radiusSm, paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ color: c.primary, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + '20', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>{label}</Text>
    </View>
  );
}

export function PriceChange({ value }: { value: number }) {
  const c = useColors();
  const color = value >= 0 ? c.bull : c.bear;
  return (
    <Text style={{ color, fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </Text>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const c = useColors();
  const color = score >= 75 ? c.bull : score >= 50 ? c.info : score >= 35 ? c.neutral : c.bear;
  return (
    <View style={{ height: 4, backgroundColor: c.border, borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <View style={{ height: 4, width: `${score}%`, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: 1, backgroundColor: c.border + '80', marginVertical: 12 }} />;
}

export function PillButton({
  label, active, onPress, color
}: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const c = useColors();
  const bg = active ? (color || c.primary) + '20' : 'transparent';
  const textColor = active ? (color || c.primary) : c.muted;
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 }}>
      <Text style={{ color: textColor, fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </TouchableOpacity>
  );
}
