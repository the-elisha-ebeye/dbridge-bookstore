import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Product } from '../types';

type Props = {
  products: Product[];
  loading: boolean;
  error: string | null;
  onSelectProduct: (product: Product) => void;
  onOpenCart: () => void;
  onSignOut: () => void;
};

export function HomeScreen({ products, loading, error, onSelectProduct, onOpenCart, onSignOut }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>D’BRIDGE</Text>
          <Text style={styles.heading}>Bookshelf</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryButton} onPress={onOpenCart}>
            <Text style={styles.secondaryButtonText}>Cart</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onSignOut}>
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#563b62" size="large" />
          <Text style={styles.loadingText}>Loading books…</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelectProduct(item)} style={styles.card}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={styles.coverPlaceholder}><Text style={styles.coverText}>{item.title.slice(0, 1)}</Text></View>
              )}
              <View style={styles.cardText}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.author}>{item.author}</Text>
                <Text style={styles.price}>₦{Number(item.price).toLocaleString('en-NG')}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f4ef', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brand: { fontSize: 12, letterSpacing: 2, color: '#563b62', fontWeight: '700' },
  heading: { fontSize: 32, fontWeight: '700', color: '#251d29' },
  headerActions: { flexDirection: 'row', gap: 8 },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#efe5d7',
  },
  secondaryButtonText: { color: '#2d2431', fontWeight: '600' },
  error: {
    backgroundColor: '#fff0f0',
    borderRadius: 10,
    color: '#9b1c1c',
    padding: 12,
    marginBottom: 16,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { marginTop: 10, color: '#563b62', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#efe5d7',
  },
  cover: { width: '100%', height: 220 },
  coverPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#efe5d7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverText: { fontSize: 44, color: '#563b62', fontWeight: '700' },
  cardText: { padding: 14 },
  category: { color: '#7a6b73', fontSize: 12, marginBottom: 4, letterSpacing: 1.2 },
  title: { color: '#1d1725', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  author: { color: '#755f69', fontSize: 14, marginBottom: 8 },
  price: { color: '#563b62', fontWeight: '700', fontSize: 18 },
});
