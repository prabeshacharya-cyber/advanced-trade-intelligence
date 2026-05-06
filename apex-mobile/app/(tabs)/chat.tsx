import { useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function MessageBubble({ msg }: { msg: Message }) {
  const c = useColors();
  const isUser = msg.role === 'user';
  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, paddingHorizontal: 16 }}>
      {!isUser && (
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: c.ai + '30', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <Ionicons name="sparkles" size={13} color={c.ai} />
        </View>
      )}
      <View style={{
        maxWidth: '82%',
        backgroundColor: isUser ? c.primary : c.surface,
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        padding: 12,
        borderWidth: isUser ? 0 : 1,
        borderColor: c.border,
        elevation: isUser ? 2 : 0,
      }}>
        <Text style={{ color: isUser ? '#fff' : c.foreground, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' }}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

export default function ChatTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: "I'm ATI, your Advanced Trade Intelligence assistant powered by Gemini Pro. Ask me anything about markets, stocks, trading setups, or economic data." }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const topInsets = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInsets = Platform.OS === 'web' ? 34 : insets.bottom;

  async function send() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [userMsg, ...prev]);
    setSending(true);
    try {
      const res = await apiRequest<{ reply: string }>('POST', '/api/chat', { message: text }, token);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.reply };
      setMessages(prev => [aiMsg, ...prev]);
    } catch {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [errMsg, ...prev]);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: topInsets + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ color: c.foreground, fontSize: 20, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>AI Chat</Text>
        <Text style={{ color: c.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>Powered by Gemini Pro</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          inverted
          contentContainerStyle={{ paddingVertical: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={sending ? (
            <View style={{ alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={{ backgroundColor: c.surface, borderRadius: 16, borderBottomLeftRadius: 4, padding: 12, borderWidth: 1, borderColor: c.border }}>
                <ActivityIndicator size="small" color={c.ai} />
              </View>
            </View>
          ) : null}
        />

        <View style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          paddingBottom: bottomInsets > 0 ? bottomInsets + 10 : 14,
          borderTopWidth: 1,
          borderTopColor: c.border,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'flex-end',
          backgroundColor: c.background,
          elevation: 4,
        }}>
          <TextInput
            style={{ flex: 1, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingVertical: 11, color: c.foreground, fontSize: 15, maxHeight: 100, fontFamily: 'Inter_400Regular' }}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about markets, stocks, setups..."
            placeholderTextColor={c.muted}
            multiline
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() && !sending ? c.primary : c.surface2, alignItems: 'center', justifyContent: 'center', elevation: input.trim() ? 4 : 0 }}
          >
            <Ionicons name="arrow-up" size={20} color={input.trim() && !sending ? '#fff' : c.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
