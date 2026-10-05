import {
  Archive,
  ArrowLeft,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useProducts } from "../context/ProductsContext.jsx";
import { adminRequest } from "../services/admin.js";

const orderStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const emptyProduct = {
  title: "",
  author: "",
  description: "",
  price: "",
  category: "Personal Development",
  image_url: "",
  stock_quantity: "0",
  isbn: "",
  featured: false,
  tags: "",
  is_available: true,
};

function money(value) {
  return `₦${Number(value ?? 0).toLocaleString("en-NG")}`;
}

export default function AdminPage() {
  const { user, session, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { refreshProducts } = useProducts();
  const [role, setRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(false);
  const [view, setView] = useState("dashboard");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [productDraft, setProductDraft] = useState(null);

  useEffect(() => {
    let active = true;
    setRole(null);
    if (!session?.access_token) return () => { active = false; };
    setCheckingRole(true);
    adminRequest("/me", session.access_token)
      .then((result) => { if (active) setRole(result.role); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setCheckingRole(false); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (role !== "admin" || !session?.access_token) return;
    loadDashboard();
    loadProducts();
    loadOrders();
  }, [role, session?.access_token]);

  async function runRequest(action, successMessage) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const actionNotice = await action();
      if (successMessage) setNotice(actionNotice ?? successMessage);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn() {
    setError("");
    try {
      await signInWithGoogle("/auth/callback?returnTo=%2Fadmin");
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function handleSignOut() {
    setError("");
    try {
      await signOut();
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function loadDashboard() {
    try {
      setDashboard(await adminRequest("/dashboard", session.access_token));
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function loadProducts() {
    try {
      const result = await adminRequest("/products", session.access_token);
      setProducts(result.products);
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function loadOrders() {
    try {
      const result = await adminRequest("/orders", session.access_token);
      setOrders(result.orders);
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function selectOrder(orderId) {
    setSelectedOrder(null);
    await runRequest(async () => {
      const result = await adminRequest(`/orders/${orderId}`, session.access_token);
      setSelectedOrder(result.order);
    });
  }

  async function saveProduct(event) {
    event.preventDefault();
    const { id, uploadedImageKey, uploadedImageUrl } = productDraft;
    const payload = {
      title: productDraft.title,
      author: productDraft.author,
      description: productDraft.description,
      category: productDraft.category,
      image_url: productDraft.image_url,
      price: Number(productDraft.price),
      stock_quantity: Number(productDraft.stock_quantity),
      isbn: productDraft.isbn || null,
      featured: productDraft.featured,
      is_available: productDraft.is_available,
      tags: productDraft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    await runRequest(async () => {
      const method = id ? "PUT" : "POST";
      const path = id ? `/products/${id}` : "/products";
      const saveResult = await adminRequest(path, session.access_token, { method, body: JSON.stringify(payload) });
      setProductDraft(null);
      await Promise.all([loadProducts(), loadDashboard(), refreshProducts()]);
      let cleanupWarning = saveResult.cleanupWarning;
      if (uploadedImageKey && payload.image_url !== uploadedImageUrl) {
        try {
          await adminRequest(`/images/${uploadedImageKey}`, session.access_token, { method: "DELETE" });
        } catch (cleanupError) {
          console.error("Book saved, but the unused cover could not be cleaned up:", cleanupError.message);
          cleanupWarning = "Book saved, but an unused uploaded cover could not be cleaned up.";
        }
      }
      return cleanupWarning;
    }, id ? "Book changes saved." : "Book added to the catalog.");
  }

  async function uploadCover(file) {
    if (!file) return;
    await runRequest(async () => {
      const previousUploadKey = productDraft.uploadedImageKey;
      const formData = new FormData();
      formData.set("image", file);
      const result = await adminRequest("/images", session.access_token, { method: "POST", body: formData });
      setProductDraft((current) => ({ ...current, image_url: result.imageUrl, uploadedImageKey: result.storageKey, uploadedImageUrl: result.imageUrl }));
      if (previousUploadKey) {
        try {
          await adminRequest(`/images/${previousUploadKey}`, session.access_token, { method: "DELETE" });
        } catch (cleanupError) {
          console.error("New cover uploaded, but the replaced temporary cover could not be removed:", cleanupError.message);
          return "New cover uploaded, but an unused temporary cover could not be cleaned up.";
        }
      }
    }, "Cover uploaded. Save the book to apply it.");
  }

  async function cancelProductEditor() {
    if (productDraft?.uploadedImageKey) {
      try {
        await adminRequest(`/images/${productDraft.uploadedImageKey}`, session.access_token, { method: "DELETE" });
      } catch (cleanupError) {
        setError(`The editor was closed, but the unused cover could not be removed: ${cleanupError.message}`);
      }
    }
    setProductDraft(null);
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Archive “${product.title}”? It will disappear from the shop, while past orders remain unchanged.`)) return;
    await runRequest(async () => {
      await adminRequest(`/products/${product.id}`, session.access_token, { method: "DELETE" });
      await Promise.all([loadProducts(), loadDashboard(), refreshProducts()]);
    }, "Book archived; its order history is preserved.");
  }

  async function restoreProduct(product) {
    await runRequest(async () => {
      await adminRequest(`/products/${product.id}/restore`, session.access_token, { method: "POST" });
      await Promise.all([loadProducts(), loadDashboard(), refreshProducts()]);
    }, "Book restored to the catalog.");
  }

  async function updateOrderStatus(orderId, status) {
    await runRequest(async () => {
      const result = await adminRequest(`/orders/${orderId}/status`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setSelectedOrder((current) => current?.id === orderId ? { ...current, ...result.order } : current);
      await Promise.all([loadOrders(), loadDashboard()]);
    }, "Order status updated.");
  }

  if (authLoading || checkingRole) return <div className="loading-state">Checking admin access…</div>;
  if (!user) {
    return (
      <div className="admin-gate">
        <Link className="back-link" to="/"><ArrowLeft size={15} /> Return to the bookshop</Link>
        <ShieldAlert size={34} />
        <span className="eyebrow">D’BRIDGE BOOKSHOP</span>
        <h1>Owner sign-in</h1>
        <p>Sign in with the Google account approved for bookshop administration.</p>
        <button className="button button--primary" onClick={handleSignIn}>Continue with Google</button>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
    );
  }
  if (role !== "admin") {
    return (
      <div className="admin-gate">
        <ShieldAlert size={34} />
        <span className="eyebrow">RESTRICTED AREA</span>
        <h1>Admin access only</h1>
        <p>This signed-in account has not been granted the shop administrator role.</p>
        <div className="admin-gate__actions"><Link className="button button--outline" to="/">Back to shop</Link><button className="button button--primary" onClick={handleSignOut}>Sign out</button></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
    );
  }

  const navigation = [
    ["dashboard", "Overview", LayoutDashboard],
    ["products", "Books & inventory", BookOpen],
    ["orders", "Customer orders", ClipboardList],
  ];
  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <Link className="brand" to="/" aria-label="D’Bridge Bookshop home"><span className="brand-mark"><BookOpen size={19} /></span><span className="brand-name">D’Bridge<span>Shop admin</span></span></Link>
        <div><span>{user.email}</span><button className="admin-topbar__logout" onClick={handleSignOut}><LogOut size={15} /> Sign out</button></div>
      </header>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <span className="admin-sidebar__label">MANAGE BOOKSHOP</span>
          {navigation.map(([key, label, Icon]) => <button key={key} className={view === key ? "admin-nav-button admin-nav-button--active" : "admin-nav-button"} onClick={() => { setView(key); setError(""); setNotice(""); }}><Icon size={17} />{label}<ChevronRight size={15} /></button>)}
          <div className="admin-sidebar__help"><span>✳</span><p>Thoughtfully chosen, right from the shelves of Benin City.</p></div>
        </aside>
        <main className="admin-main">
          {error && <div className="error-banner" role="alert">{error}</div>}
          {notice && <div className="admin-notice" role="status"><Check size={15} />{notice}</div>}
          {view === "dashboard" && <DashboardView data={dashboard} openView={setView} />}
          {view === "products" && <ProductsView products={products} onCreate={() => setProductDraft({ ...emptyProduct })} onEdit={(product) => setProductDraft({ ...product, price: String(product.price), stock_quantity: String(product.stock_quantity), tags: (product.tags ?? []).join(", ") })} onArchive={archiveProduct} onRestore={restoreProduct} busy={busy} />}
          {view === "orders" && <OrdersView orders={orders} selectedOrder={selectedOrder} onSelect={selectOrder} onStatus={updateOrderStatus} busy={busy} />}
        </main>
      </div>
      {productDraft && <ProductEditor draft={productDraft} setDraft={setProductDraft} onSave={saveProduct} onUpload={uploadCover} onCancel={cancelProductEditor} busy={busy} />}
    </div>
  );
}

function DashboardView({ data, openView }) {
  if (!data) return <div className="loading-state">Gathering the shop overview…</div>;
  const metrics = [
    ["Orders", data.stats.orderCount, ClipboardList],
    ["Revenue", money(data.stats.revenue), CircleDollarSign],
    ["This month", data.stats.monthOrderCount, PackageCheck],
    ["Active books", data.stats.productCount, BookOpen],
    ["Low stock", data.stats.lowStockCount, Boxes],
  ];
  return (
    <>
      <div className="admin-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> SHOP OVERVIEW</span><h1>Good morning, <em>shopkeeper.</em></h1><p>A clear view of the shelves and the people finding their next read.</p></div><button className="button button--primary" onClick={() => openView("products")}><Plus size={16} /> Add a book</button></div>
      <div className="admin-metrics">{metrics.map(([label, value, Icon]) => <article className="admin-metric" key={label}><span><Icon size={17} /></span><small>{label}</small><strong>{value}</strong></article>)}</div>
      <section className="admin-panel"><div className="admin-panel__heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Latest orders</h2></div><button className="admin-text-button" onClick={() => openView("orders")}>See all <ChevronRight size={15} /></button></div>
        {data.recentOrders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>{data.recentOrders.map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.customer_name}</td><td>{new Date(order.created_at).toLocaleDateString("en-NG")}</td><td><span className={`status-pill status-pill--${order.status}`}>{order.status}</span></td><td>{money(order.total)}</td></tr>)}</tbody></table></div> : <p className="admin-empty-inline">Orders will appear here as customers check out.</p>}
      </section>
      <section className="admin-panel admin-panel--stock"><div className="admin-panel__heading"><div><span className="eyebrow">INVENTORY CARE</span><h2>Books running low</h2></div><button className="admin-text-button" onClick={() => openView("products")}>Manage books <ChevronRight size={15} /></button></div>
        {data.lowStockProducts.length ? <div className="low-stock-list">{data.lowStockProducts.map((product) => <div className="low-stock-row" key={product.id}><span><BookOpen size={16} /></span><strong>{product.title}</strong><small>{product.stock_quantity} left</small></div>)}</div> : <p className="admin-empty-inline">No low-stock books at the moment.</p>}
      </section>
    </>
  );
}

function ProductsView({ products, onCreate, onEdit, onArchive, onRestore, busy }) {
  const [showArchived, setShowArchived] = useState(false);
  const displayed = products.filter((product) => Boolean(product.archived_at) === showArchived);
  return (
    <>
      <div className="admin-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> CATALOG & INVENTORY</span><h1>Books on the <em>shelves.</em></h1><p>Keep your catalog, availability and quantities up to date.</p></div><button className="button button--primary" onClick={onCreate}><Plus size={16} /> Add a book</button></div>
      <div className="admin-list-toolbar"><div><button className={!showArchived ? "admin-filter-button admin-filter-button--active" : "admin-filter-button"} onClick={() => setShowArchived(false)}>Active books</button><button className={showArchived ? "admin-filter-button admin-filter-button--active" : "admin-filter-button"} onClick={() => setShowArchived(true)}>Archived</button></div><span>{displayed.length} {displayed.length === 1 ? "book" : "books"}</span></div>
      <div className="admin-book-list">{displayed.map((product) => <article className={`admin-book-row ${product.archived_at ? "admin-book-row--archived" : ""}`} key={product.id}><div className="admin-book-cover">{product.image_url ? <img src={product.image_url} alt="" /> : <BookOpen size={21} />}</div><div className="admin-book-main"><strong>{product.title}</strong><span>by {product.author}</span><small>{product.category} · {money(product.price)}</small></div><div className="admin-book-stock"><span>{product.archived_at ? "Archived" : product.is_available ? "Available" : "Unavailable"}</span><small>{product.stock_quantity} in stock</small></div><div className="admin-book-actions">{product.archived_at ? <button title="Restore book" disabled={busy} onClick={() => onRestore(product)}><RotateCcw size={16} /></button> : <><button title="Edit book" disabled={busy} onClick={() => onEdit(product)}><Save size={16} /></button><button title="Archive book" disabled={busy} onClick={() => onArchive(product)}><Archive size={16} /></button></>}</div></article>)}</div>
    </>
  );
}

function ProductEditor({ draft, setDraft, onSave, onUpload, onCancel, busy }) {
  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
      <section className="admin-editor" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <header><div><span className="eyebrow">BOOK CATALOG</span><h2 id="product-editor-title">{draft.id ? "Edit book details" : "Add a new book"}</h2></div><button className="admin-close-button" disabled={busy} onClick={onCancel} aria-label="Close editor"><X size={20} /></button></header>
        <form onSubmit={onSave}>
          <div className="admin-editor-grid">
            <label>Book title<input required maxLength="160" value={draft.title} onChange={(event) => setField("title", event.target.value)} /></label>
            <label>Author<input required maxLength="160" value={draft.author} onChange={(event) => setField("author", event.target.value)} /></label>
            <label>Category<input required maxLength="160" value={draft.category} onChange={(event) => setField("category", event.target.value)} /></label>
            <label>ISBN<input maxLength="32" value={draft.isbn ?? ""} onChange={(event) => setField("isbn", event.target.value)} /></label>
            <label>Price (₦)<input required type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setField("price", event.target.value)} /></label>
            <label>Stock quantity<input required type="number" min="0" step="1" value={draft.stock_quantity} onChange={(event) => setField("stock_quantity", event.target.value)} /></label>
          </div>
          <label className="admin-editor__wide">Description<textarea required maxLength="10000" rows="4" value={draft.description} onChange={(event) => setField("description", event.target.value)} /></label>
          <label className="admin-editor__wide">Tags <small>Separate with commas</small><input value={draft.tags} onChange={(event) => setField("tags", event.target.value)} /></label>
          <div className="admin-image-editor">
            <div className="admin-image-preview">{draft.image_url ? <img src={draft.image_url} alt="Book cover preview" /> : <ImagePlus size={24} />}</div>
            <div><label>Cover image URL<input type="url" placeholder="https://…" value={draft.image_url ?? ""} disabled={busy} onChange={(event) => setField("image_url", event.target.value)} /></label><label className="admin-upload-button"><Upload size={15} /> Upload cover<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => onUpload(event.target.files?.[0])} /></label><small>JPEG, PNG or WebP · 5 MB max</small></div>
          </div>
          <div className="admin-editor-options"><label><input type="checkbox" checked={draft.featured} onChange={(event) => setField("featured", event.target.checked)} /> Feature this book in the shop</label><label><input type="checkbox" checked={draft.is_available} onChange={(event) => setField("is_available", event.target.checked)} /> Available to order</label></div>
          <footer><button type="button" className="button button--outline" onClick={onCancel} disabled={busy}>Cancel</button><button type="submit" className="button button--primary" disabled={busy}><Save size={15} />{busy ? "Saving…" : "Save book"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function OrdersView({ orders, selectedOrder, onSelect, onStatus, busy }) {
  return (
    <>
      <div className="admin-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> CUSTOMER CARE</span><h1>Orders, handled <em>thoughtfully.</em></h1><p>Review delivery details and keep each customer up to date.</p></div></div>
      <section className="admin-panel"><div className="admin-panel__heading"><div><span className="eyebrow">ALL CUSTOMERS</span><h2>Order history</h2></div><span>{orders.length} orders</span></div>
        {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>#{order.id.slice(0, 8).toUpperCase()}</td><td>{order.customer_name}<small>{order.email}</small></td><td>{new Date(order.created_at).toLocaleDateString("en-NG")}</td><td><span className={`status-pill status-pill--${order.status}`}>{order.status}</span></td><td>{money(order.total)}</td><td><button className="admin-text-button" onClick={() => onSelect(order.id)}>Details <ChevronRight size={14} /></button></td></tr>)}</tbody></table></div> : <p className="admin-empty-inline">There are no customer orders yet.</p>}
      </section>
      {selectedOrder && <section className="admin-panel admin-order-detail"><div className="admin-panel__heading"><div><span className="eyebrow">ORDER #{selectedOrder.id.slice(0, 8).toUpperCase()}</span><h2>{selectedOrder.customer_name}</h2></div><span className={`status-pill status-pill--${selectedOrder.status}`}>{selectedOrder.status}</span></div>
        <div className="admin-order-info"><span>{selectedOrder.email}</span><span>{selectedOrder.phone}</span><span>{selectedOrder.delivery_address}, {selectedOrder.city}, {selectedOrder.state}</span></div>
        <div className="admin-order-items">{selectedOrder.order_items?.map((item) => <div key={item.id}><span>{item.product_title} <small>× {item.quantity}</small></span><strong>{money(item.subtotal)}</strong></div>)}</div>
        <div className="admin-order-total"><span>Order total</span><strong>{money(selectedOrder.total)}</strong></div>
        <label className="admin-status-control">Update status<select value={selectedOrder.status} disabled={busy} onChange={(event) => onStatus(selectedOrder.id, event.target.value)}>{orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      </section>}
    </>
  );
}
