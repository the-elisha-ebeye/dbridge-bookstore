-- Development examples only. Prices, stock, cover art, and availability are not verified inventory.
insert into public.products
  (id, title, author, description, price, category, stock_quantity, isbn, featured, tags)
values
  ('atomic-habits', 'Atomic Habits', 'James Clear', 'A practical guide to building good habits, breaking bad ones, and making small changes that lead to remarkable results.', 12500, 'Personal Development', 8, '9780735211292', true, array['habits', 'discipline', 'productivity', 'personal-development']),
  ('psychology-of-money', 'The Psychology of Money', 'Morgan Housel', 'Timeless lessons on wealth, greed, and happiness, told through stories about the ways people think about money.', 14500, 'Finance', 5, '9780857197689', true, array['finance', 'money', 'mindset', 'personal-development']),
  ('start-with-why', 'Start With Why', 'Simon Sinek', 'Discover how inspiring leaders and organisations think, act, and communicate from the inside out.', 13800, 'Leadership', 4, '9781591846444', true, array['leadership', 'business', 'purpose']),
  ('purpose-driven-life', 'The Purpose Driven Life', 'Rick Warren', 'A forty-day journey to help readers understand why they are here and how to live a life of purpose.', 11000, 'Christian', 9, '9780310342243', true, array['faith', 'purpose', 'spiritual-growth', 'personal-development']),
  ('how-to-win-friends', 'How to Win Friends and Influence People', 'Dale Carnegie', 'A trusted guide to communicating with warmth, building stronger relationships, and working well with others.', 9800, 'Relationships', 12, '9780671027032', false, array['communication', 'relationships', 'career']),
  ('rich-dad-poor-dad', 'Rich Dad Poor Dad', 'Robert T. Kiyosaki', 'A personal finance classic about how different beliefs around money shape the choices we make.', 12000, 'Finance', 6, '9781612680194', false, array['finance', 'business', 'money']),
  ('7-habits', 'The 7 Habits of Highly Effective People', 'Stephen R. Covey', 'A principle-centred approach to solving personal and professional challenges with lasting effectiveness.', 15000, 'Personal Development', 3, '9781982137274', false, array['habits', 'leadership', 'productivity', 'personal-development']),
  ('good-to-great', 'Good to Great', 'Jim Collins', 'Research-backed ideas on what helps good organisations make the leap to sustained excellence.', 16000, 'Business', 2, '9780066620992', false, array['business', 'leadership', 'management'])
on conflict (id) do update set
  title = excluded.title,
  author = excluded.author,
  description = excluded.description,
  price = excluded.price,
  category = excluded.category,
  stock_quantity = excluded.stock_quantity,
  isbn = excluded.isbn,
  featured = excluded.featured,
  tags = excluded.tags,
  updated_at = now();
