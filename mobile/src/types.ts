export type Product = {
  id: string;
  title: string;
  author: string;
  description: string;
  price: number;
  category: string;
  image_url?: string | null;
  stock_quantity: number;
  featured: boolean;
  isbn?: string | null;
  is_available: boolean;
  tags?: string[];
};

export type CartItem = {
  id: string;
  title: string;
  author: string;
  category: string;
  image_url?: string | null;
  price: number;
  stock_quantity: number;
  quantity: number;
  subtotal: number;
};
