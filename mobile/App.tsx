import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { addToCart, fetchUserCart, removeCartItem, updateCartItem } from './src/lib/cart';
import { supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { CartScreen } from './src/screens/CartScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProductDetailsScreen } from './src/screens/ProductDetailsScreen';
import { CartItem, Product } from './src/types';

type ScreenName = 'auth' | 'home' | 'details' | 'cart';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [screen, setScreen] = useState<ScreenName>('auth');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  async function loadUserCartForSession(activeSession: Session | null) {
    if (!activeSession?.access_token) return;
    setCartLoading(true);
    setCartError(null);

    try {
      const items = await fetchUserCart(activeSession.access_token);
      setCart(items);
    } catch (error) {
      setCartError(error instanceof Error ? error.message : 'Could not load your cart.');
    } finally {
      setCartLoading(false);
    }
  }

  async function refreshSession() {
    const { data } = await supabase.auth.getSession();
    const nextSession = data.session ?? null;
    setSession(nextSession);
    setScreen(nextSession ? 'home' : 'auth');
    if (nextSession) {
      await loadUserProducts();
      await loadUserCartForSession(nextSession);
    } else {
      setProducts([]);
      setCart([]);
    }
  }

  async function loadUserProducts() {
    setProductsLoading(true);
    setProductsError(null);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id,title,author,description,price,category,image_url,stock_quantity,isbn,featured,tags,is_available,archived_at')
        .is('archived_at', null)
        .order('featured', { ascending: false })
        .order('title', { ascending: true });

      if (error) throw error;
      setProducts((data ?? []).filter((product) => product.is_available !== false));
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Could not load books.');
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadUserCart() {
    await loadUserCartForSession(session ?? null);
  }

  useEffect(() => {
    async function bootstrap() {
      await refreshSession();
    }

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setScreen('home');
        loadUserProducts();
        loadUserCartForSession(nextSession);
      } else {
        setScreen('auth');
        setProducts([]);
        setCart([]);
      }
    });

    const subscription = Linking.addEventListener('url', async (event) => {
      if (event.url.startsWith('dbridge://auth/callback')) {
        await refreshSession();
      }
    });

    return () => {
      data.subscription.unsubscribe();
      subscription.remove();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setScreen('auth');
    setProducts([]);
    setCart([]);
  }

  async function handleAddToCart(product: Product) {
    if (!session?.access_token) return;
    setAddingToCart(true);
    try {
      const items = await addToCart(session.access_token, product.id, 1);
      setCart(items);
      setSelectedProduct(product);
      setScreen('cart');
    } catch (error) {
      setCartError(error instanceof Error ? error.message : 'Could not add that book to your cart.');
    } finally {
      setAddingToCart(false);
    }
  }

  async function handleUpdateQuantity(productId: string, quantity: number) {
    if (!session?.access_token) return;
    try {
      const nextQuantity = Math.max(quantity, 0);
      const items = nextQuantity === 0
        ? await removeCartItem(session.access_token, productId)
        : await updateCartItem(session.access_token, productId, nextQuantity);
      setCart(items);
      setCartError(null);
    } catch (error) {
      setCartError(error instanceof Error ? error.message : 'Could not update that cart item.');
    }
  }

  async function handleRemove(productId: string) {
    if (!session?.access_token) return;
    try {
      const items = await removeCartItem(session.access_token, productId);
      setCart(items);
      setCartError(null);
    } catch (error) {
      setCartError(error instanceof Error ? error.message : 'Could not remove that cart item.');
    }
  }

  if (session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f4ef' }}>
        <ActivityIndicator size="large" color="#563b62" />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthScreen onSignedIn={refreshSession} />
      </>
    );
  }

  if (screen === 'home') {
    return (
      <>
        <StatusBar style="dark" />
        <HomeScreen
          products={products}
          loading={productsLoading}
          error={productsError}
          onSelectProduct={(product) => {
            setSelectedProduct(product);
            setScreen('details');
          }}
          onOpenCart={() => {
            loadUserCart();
            setScreen('cart');
          }}
          onSignOut={handleSignOut}
        />
      </>
    );
  }

  if (screen === 'details') {
    return (
      <>
        <StatusBar style="dark" />
        <ProductDetailsScreen
          product={selectedProduct}
          addingToCart={addingToCart}
          onAddToCart={() => {
            if (selectedProduct) handleAddToCart(selectedProduct);
          }}
          onBack={() => setScreen('home')}
          onOpenCart={() => {
            loadUserCart();
            setScreen('cart');
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <CartScreen
        items={cart}
        loading={cartLoading}
        error={cartError}
        onBack={() => setScreen('home')}
        onRemove={handleRemove}
        onUpdateQuantity={handleUpdateQuantity}
        onRefresh={() => loadUserCart()}
      />
    </>
  );
}
