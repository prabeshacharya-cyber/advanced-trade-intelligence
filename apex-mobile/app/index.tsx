import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { token, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (token) {
      router.replace('/(tabs)');
    } else {
      router.replace('/auth');
    }
  }, [token, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#0a84ff" size="large" />
    </View>
  );
}
