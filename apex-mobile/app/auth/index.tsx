import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { apiRequest } from '@/lib/queryClient';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) return;
    if (mode === 'signup' && !name.trim()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      } else {
        await apiRequest('POST', '/api/auth/signup', { name: name.trim(), email: email.trim().toLowerCase(), password });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Request Submitted', 'Your access request has been received. You\'ll be notified by email once approved.');
        setMode('login');
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const s = styles(c, insets);

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.logoRow}>
            <View style={s.logoBox}>
              <Text style={s.logoText}>A</Text>
            </View>
            <Text style={s.brandName}>ATI</Text>
            <Text style={s.brandSub}>Advanced Trade Intelligence</Text>
          </View>

          <View style={s.card}>
            <View style={s.modeRow}>
              {(['login', 'signup'] as Mode[]).map(m => (
                <TouchableOpacity key={m} onPress={() => setMode(m)} style={[s.modeBtn, mode === m && s.modeBtnActive]}>
                  <Text style={[s.modeBtnText, mode === m && s.modeBtnTextActive]}>
                    {m === 'login' ? 'Sign In' : 'Request Access'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === 'signup' && (
              <View style={s.inputGroup}>
                <Text style={s.label}>FULL NAME</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={c.muted}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={s.inputGroup}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={c.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>PASSWORD</Text>
              <View style={s.passRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={c.muted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={c.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{mode === 'login' ? 'Sign In' : 'Request Access'}</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>ATI · Advanced Trade Intelligence{'\n'}AI research tool · Not financial advice</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = (c: any, insets: any) => StyleSheet.create({
  root:              { flex: 1, backgroundColor: c.background },
  scroll:            { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
  logoRow:           { alignItems: 'center', marginBottom: 40 },
  logoBox:           { width: 64, height: 64, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText:          { color: '#fff', fontSize: 32, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  brandName:         { color: c.foreground, fontSize: 28, fontWeight: '800', fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  brandSub:          { color: c.muted, fontSize: 14, marginTop: 4, fontFamily: 'Inter_400Regular' },
  card:              { backgroundColor: c.surface, borderRadius: c.radius, borderWidth: 1, borderColor: c.border, padding: 24 },
  modeRow:           { flexDirection: 'row', backgroundColor: c.surface2, borderRadius: c.radiusSm, padding: 3, marginBottom: 24 },
  modeBtn:           { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  modeBtnActive:     { backgroundColor: c.primary },
  modeBtnText:       { color: c.muted, fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  modeBtnTextActive: { color: '#fff' },
  inputGroup:        { marginBottom: 16 },
  label:             { color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, fontFamily: 'Inter_700Bold' },
  input:             { backgroundColor: c.background, borderWidth: 1, borderColor: c.border, borderRadius: c.radiusSm, paddingHorizontal: 14, paddingVertical: 13, color: c.foreground, fontSize: 16, fontFamily: 'Inter_400Regular' },
  passRow:           { flexDirection: 'row', alignItems: 'center' },
  eyeBtn:            { position: 'absolute', right: 14 },
  submitBtn:         { backgroundColor: c.primary, borderRadius: c.radiusSm, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  submitText:        { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  footer:            { color: c.mutedForeground, fontSize: 12, textAlign: 'center', marginTop: 32, lineHeight: 18, fontFamily: 'Inter_400Regular' },
});
