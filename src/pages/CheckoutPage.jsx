import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, RotateCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { supabase } from "../lib/supabase.js";

const initialDelivery = {
  customerName: "",
  phone: "",
  deliveryAddress: "",
  city: "",
  state: "",
};
const checkoutFingerprintKey = "dbridge-checkout-fingerprint";
const checkoutRequestKey = "dbridge-checkout-request-id";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getCheckoutRequestId(items) {
  const fingerprint = JSON.stringify(
    items.map(({ id, quantity }) => [id, quantity]).sort(([firstId], [secondId]) => firstId.localeCompare(secondId)),
  );
  const savedFingerprint = localStorage.getItem(checkoutFingerprintKey);
  const savedRequestId = localStorage.getItem(checkoutRequestKey);
  if (savedFingerprint === fingerprint && uuidPattern.test(savedRequestId ?? "")) return savedRequestId;

  const requestId = crypto.randomUUID();
  localStorage.setItem(checkoutFingerprintKey, fingerprint);
  localStorage.setItem(checkoutRequestKey, requestId);
  return requestId;
}

function currency(value) {
  return `₦${Number(value).toLocaleString("en-NG")}`;
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user, session, loading, signInWithGoogle } = useAuth();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [message, setMessage] = useState("");
  const [placing, setPlacing] = useState(false);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  function updateField(event) {
    setDelivery((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function beginSignIn() {
    setMessage("");
    try {
      await signInWithGoogle("/auth/callback?returnTo=%2Fcheckout");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function placeOrder(event) {
    event.preventDefault();
    setMessage("");
    if (!session?.access_token) {
      setMessage("Sign in with Google before placing your order.");
      return;
    }

    setPlacing(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...delivery,
          customerName: delivery.customerName.trim() || user?.user_metadata?.full_name || "",
          checkoutKey: getCheckoutRequestId(items),
          items: items.map(({ id, quantity }) => ({ productId: id, quantity })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!result || typeof result !== "object") {
        throw new Error("The order service returned an invalid response. Please try again.");
      }
      if (!response.ok) throw new Error(result.message ?? "We could not place your order. Please try again.");
      localStorage.removeItem(checkoutFingerprintKey);
      localStorage.removeItem(checkoutRequestKey);
      setOrderResult(result);
      clearCart();
    } catch (error) {
      setMessage(error instanceof TypeError
        ? "We couldn’t reach the order service. Check your connection and try again."
        : error.message);
    } finally {
      setPlacing(false);
    }
  }

  async function retryConfirmationEmail() {
    if (!session?.access_token || !orderResult?.order?.id) return;
    setRetryingEmail(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${orderResult.order.id}/confirmation-email/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => null);
      if (!result || typeof result !== "object") {
        throw new Error("The email service returned an invalid response. Please try again.");
      }
      if (!response.ok) throw new Error(result.emailMessage ?? result.message ?? "The confirmation email could not be retried.");
      setOrderResult((current) => ({ ...current, ...result }));
    } catch (error) {
      setMessage(error instanceof TypeError
        ? "We couldn’t reach the email service. Your order is still saved; try again shortly."
        : error.message);
    } finally {
      setRetryingEmail(false);
    }
  }

  if (orderResult?.order) {
    const orderNumber = orderResult.order.id.slice(0, 8).toUpperCase();
    return (
      <div className="order-success section-shell">
        <span className="order-success__icon"><CheckCircle2 size={30} /></span>
        <span className="eyebrow"><span className="eyebrow-line" /> ORDER RECEIVED</span>
        <h1>Your next chapter is <em>on its way.</em></h1>
        <p className="order-success__reference">Order #DB-{orderNumber}</p>
        <p className="order-success__message">{orderResult.emailMessage}</p>
        {orderResult.emailStatus === "failed" && (
          <button className="button button--outline" onClick={retryConfirmationEmail} disabled={retryingEmail}>
            <RotateCw size={15} /> {retryingEmail ? "Retrying email…" : "Retry confirmation email"}
          </button>
        )}
        {message && <p className="inline-error" role="alert">{message}</p>}
        <div className="order-success__actions">
          <Link className="button button--primary" to={`/orders/${orderResult.order.id}`}>View order details <ArrowRight size={15} /></Link>
          <Link className="text-link" to="/shop">Back to the bookshop</Link>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return <div className="cart-empty section-shell"><span className="eyebrow">CHECKOUT</span><h1>Your bag is <em>empty.</em></h1><Link className="button button--primary" to="/shop">Find a book <ArrowRight size={16} /></Link></div>;
  }

  return (
    <div className="checkout-page section-shell">
      <Link to="/cart" className="back-link"><ArrowLeft size={15} /> Back to your bag</Link>
      <div className="page-intro page-intro--left"><span className="eyebrow"><span className="eyebrow-line" /> THE NEXT CHAPTER</span><h1>Let’s make it <em>yours.</em></h1><p>A few details and these good reads will be on their way.</p></div>
      <div className="checkout-layout">
        <form className="checkout-main" onSubmit={placeOrder}>
          <div className="checkout-step"><span className="checkout-step__number">01</span><div><h2>Your details</h2><p>We’ll use your account to keep your orders together.</p></div></div>
          {loading ? <p className="checkout-note">Checking your account…</p> : user ? (
            <div className="delivery-form">
              <div className="signed-in-note"><span className="signed-in-check">✓</span><div><strong>Signed in with Google</strong><span>{user.email}</span></div></div>
              <label className="form-field"><span>Email address</span><input type="email" value={user.email ?? ""} readOnly /></label>
              <label className="form-field"><span>Full name</span><input name="customerName" autoComplete="name" value={delivery.customerName || user.user_metadata?.full_name || ""} onChange={updateField} minLength={2} maxLength={120} required /></label>
              <label className="form-field"><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" value={delivery.phone} onChange={updateField} placeholder="+234 801 234 5678" required /></label>
              <label className="form-field"><span>Delivery address</span><input name="deliveryAddress" autoComplete="street-address" value={delivery.deliveryAddress} onChange={updateField} minLength={5} maxLength={300} required /></label>
              <div className="form-row">
                <label className="form-field"><span>City</span><input name="city" autoComplete="address-level2" value={delivery.city} onChange={updateField} minLength={2} maxLength={100} required /></label>
                <label className="form-field"><span>State</span><input name="state" autoComplete="address-level1" value={delivery.state} onChange={updateField} minLength={2} maxLength={100} required /></label>
              </div>
            </div>
          ) : (
            <div className="signin-prompt"><p>Sign in with Google to continue to your delivery details.</p><button type="button" className="button button--outline" onClick={beginSignIn}>Continue with Google <ArrowRight size={15} /></button></div>
          )}
          <div className="checkout-step checkout-step--locked"><span className="checkout-step__number">02</span><div><h2>Delivery information</h2><p>Your name, phone and address</p></div><LockKeyhole size={16} /></div>
          <div className="checkout-step checkout-step--locked"><span className="checkout-step__number">03</span><div><h2>Review & place order</h2><p>Confirm your books and delivery</p></div><LockKeyhole size={16} /></div>
          {user && <button className="button button--primary place-order-button" type="submit" disabled={placing || loading}>{placing ? "Placing your order…" : "Place order"} <ArrowRight size={16} /></button>}
          {message && <p className="inline-error" role="alert">{message}</p>}
          {!supabase && <div className="setup-message"><strong>Checkout setup still needed</strong><p>This preview can build your bag, but checkout requires Supabase Auth, the order database migration, and server credentials. We won’t claim an order is placed or take payment until those integrations are configured.</p><Link to="/orders">See account setup status <ArrowRight size={14} /></Link></div>}
        </form>
        <aside className="cart-summary checkout-summary"><span className="eyebrow">YOUR BOOK BAG</span><h2>A few good reads.</h2>{items.map((item) => <div className="checkout-summary__item" key={item.id}><span>{item.title}<small>Qty {item.quantity}</small></span><strong>{currency(item.price * item.quantity)}</strong></div>)}<div className="summary-total"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div><p className="summary-note">Delivery details and any applicable fees will be confirmed before placing your order.</p></aside>
      </div>
      <p className="preview-price-note">Development catalog prices are examples. No payment is taken through this checkout.</p>
    </div>
  );
}
