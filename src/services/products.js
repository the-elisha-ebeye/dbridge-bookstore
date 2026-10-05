import { books } from "../data/books.js";
import { supabase } from "../lib/supabase.js";

const productFields =
  "id,title,author,description,price,category,image_url,stock_quantity,isbn,featured,tags,is_available";

export async function getProducts() {
  if (!supabase) {
    return { products: books, source: "development" };
  }

  const { data, error } = await supabase
    .from("products")
    .select(productFields)
    .is("archived_at", null)
    .order("featured", { ascending: false })
    .order("title", { ascending: true });

  if (error) throw new Error(`Could not load the book catalog: ${error.message}`);
  return { products: data ?? [], source: "supabase" };
}

export function getBookCover(book) {
  return book.cover ?? "cream";
}
