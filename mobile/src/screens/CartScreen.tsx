import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CartItem } from '../types';

type Props = {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRemove: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRefresh: () => void;
};

export function CartScreen({ items, loading, error, onBack, onRemove, onUpdateQuantity, onRefresh }: Props) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.heading}>Your cart</Text>
        <Pressable onPress={onRefresh}><Text style={styles.refreshText}>Refresh</Text></Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#563b62" size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Your cart is empty.</Text>
          <Text style={styles.emptyText}>Add a few books to start your next chapter.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.author}>{item.author}</Text>
                <Text style={styles.price}>₦{Number(item.price).toLocaleString('en-NG')}</Text>
              </View>

              <View style={styles.controls}>
                <View style={styles.quantityBox}>
                  <Pressable onPress={() => onUpdateQuantity(item.id, Math.max(item.quantity - 1, 0))} style={styles.qtyButton}><Text style={styles.qtyText}>−</Text></Pressable>
                  <Text style={styles.quantity}>{item.quantity}</Text>
                  <Pressable onPress={() => onUpdateQuantity(item.id, item.quantity + 1)} style={styles.qtyButton}><Text style={styles.qtyText}>+</Text></Pressable>
                </View>
                <Pressable onPress={() => onRemove(item.id)} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {items.length > 0 ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₦{Number(total).toLocaleString('en-NG')}</Text>
        </View>
      ) : null}
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
  backText: { color: '#563b62', fontWeight: '600', fontSize: 16 },
  heading: { fontSize: 28, fontWeight: '700', color: '#251d29' },
  refreshText: { color: '#563b62', fontWeight: '600' },
  list: { paddingBottom: 18 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#efe5d7',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1, paddingRight: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#251d29', marginBottom: 4 },
  author: { color: '#715f69', fontSize: 14, marginBottom: 6 },
  price: { color: '#563b62', fontSize: 16, fontWeight: '600' },
  controls: { alignItems: 'flex-end' },
  quantityBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qtyButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#efe5d7',
    borderRadius: 8,
  },
  qtyText: { color: '#2d2431', fontSize: 22, fontWeight: '700' },
  quantity: { minWidth: 30, textAlign: 'center', fontWeight: '600', color: '#251d29' },
  removeButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fff0f0' },
  removeText: { color: '#9b1c1c', fontWeight: '600' },
  summary: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#efe5d7',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: { color: '#755f69', fontWeight: '600' },
  summaryValue: { color: '#563b62', fontWeight: '700', fontSize: 18 },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#251d29', marginBottom: 8 },
  emptyText: { color: '#655a63', fontSize: 16 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: {
    backgroundColor: '#fff0f0',
    borderRadius: 10,
    color: '#9b1c1c',
    padding: 12,
    marginBottom: 16,
  },
});
