import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Product } from '../types';

type Props = {
  product: Product | null;
  addingToCart: boolean;
  onAddToCart: () => void;
  onBack: () => void;
  onOpenCart: () => void;
};

export function ProductDetailsScreen({ product, addingToCart, onAddToCart, onBack, onOpenCart }: Props) {
  if (!product) {
    return (
      <View style={styles.centered}>
        <Text>Book details unavailable.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>← Back</Text></Pressable>

      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}><Text style={styles.placeholderText}>{product.title.slice(0, 1)}</Text></View>
      )}

      <Text style={styles.category}>{product.category}</Text>
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.author}>{product.author}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.price}>₦{Number(product.price).toLocaleString('en-NG')}</Text>
        <Text style={styles.stock}>{product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}</Text>
      </View>

      <Text style={styles.description}>{product.description}</Text>

      <Pressable style={styles.primaryButton} onPress={onAddToCart} disabled={addingToCart || product.stock_quantity <= 0}>
        {addingToCart ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Add to cart</Text>}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onOpenCart}>
        <Text style={styles.secondaryButtonText}>View cart</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f7f4ef' },
  container: { padding: 18, backgroundColor: '#f7f4ef', paddingBottom: 40 },
  backButton: { marginBottom: 12 },
  backText: { color: '#563b62', fontWeight: '600', fontSize: 16 },
  image: { width: '100%', height: 280, borderRadius: 18, marginBottom: 18 },
  placeholder: {
    width: '100%',
    height: 280,
    borderRadius: 18,
    backgroundColor: '#efe5d7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  placeholderText: { fontSize: 54, color: '#563b62', fontWeight: '700' },
  category: { color: '#7a6b73', letterSpacing: 1.4, fontSize: 12, marginBottom: 4 },
  title: { color: '#1d1725', fontSize: 32, fontWeight: '700', marginBottom: 6 },
  author: { color: '#715f69', fontSize: 16, marginBottom: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  price: { color: '#563b62', fontSize: 22, fontWeight: '700' },
  stock: { color: '#4c5d46', fontSize: 14, fontWeight: '600' },
  description: { color: '#51464d', fontSize: 16, lineHeight: 24, marginBottom: 22 },
  primaryButton: {
    backgroundColor: '#563b62',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#efe5d7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#2d2431', fontSize: 16, fontWeight: '600' },
});
