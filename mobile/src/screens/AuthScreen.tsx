import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    try {
      const redirectTo = 'dbridge://auth/callback';
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error('Google sign-in could not start.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        throw new Error('Google sign-in was cancelled.');
      }

      const callbackUrl = new URL(result.url);
      const callbackError = callbackUrl.searchParams.get('error_description')
        ?? callbackUrl.searchParams.get('error');
      if (callbackError) throw new Error(callbackError);

      const code = callbackUrl.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const fragment = new URLSearchParams(callbackUrl.hash.slice(1));
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');
        if (!accessToken || !refreshToken) {
          throw new Error('Google sign-in returned no authorization code or session tokens.');
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('Google sign-in did not create a Supabase session.');
      await onSignedIn();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Google sign-in failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>D’Bridge Bookshop</Text>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in with the same Google account used on the web shop.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={handleGoogleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue with Google</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8f2eb',
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#563b62',
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 10,
    color: '#2b1f2f',
  },
  subtitle: {
    color: '#655a63',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#563b62',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    backgroundColor: '#fff0f0',
    borderRadius: 10,
    color: '#9b1c1c',
    padding: 12,
    marginBottom: 16,
  },
});
