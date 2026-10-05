import { ArrowRight, BookOpen, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";

function SignInPanel() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setMessage("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setMessage("");
    try {
      await signOut();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (loading) return <div className="loading-state">Restoring your account…</div>;

  return user ? (
    <div className="account-card">
      <span className="account-icon"><ShieldCheck size={23} /></span>
      <span className="eyebrow">YOU’RE SIGNED IN</span>
      <h2>Welcome back, {user.user_metadata?.full_name?.split(" ")[0] ?? "reader"}.</h2>
      <p>{user.email}</p>
      <button className="button button--outline" onClick={handleSignOut}><LogOut size={15} /> Sign out</button>
    </div>
  ) : (
    <div className="account-card">
      <span className="account-icon"><BookOpen size={23} /></span>
      <span className="eyebrow">YOUR READING LIFE, TOGETHER</span>
      <h2>Sign in to see your orders.</h2>
      <p>Use your Google account to return to your reading journey and order history.</p>
      <button className="button button--primary" onClick={handleSignIn} disabled={busy}>{busy ? "Connecting…" : "Continue with Google"} <ArrowRight size={16} /></button>
      {message && <p className="inline-error" role="alert">{message}</p>}
    </div>
  );
}

export function OrdersPage() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-state">Restoring your account…</div>;

  if (!user) {
    return (
      <div className="account-page section-shell">
        <div className="page-intro">
          <span className="eyebrow"><span className="eyebrow-line" /> YOUR READING JOURNEY</span>
          <h1>A little more <em>personal.</em></h1>
          <p>Sign in to keep your past and future orders close at hand.</p>
        </div>
        <SignInPanel />
      </div>
    );
  }

  return <OrderHistory user={user} />;
}

function OrderHistory({ user }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const { signOut } = useAuth();

  useEffect(() => {
    let active = true;
    if (!supabase) return undefined;
    supabase.from("orders").select("id,created_at,total,status,order_items(product_title,quantity)").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(`Could not load your orders: ${queryError.message}`);
        else setOrders(data ?? []);
      })
      .catch((queryError) => {
        console.error("Could not load order history:", queryError.message);
        if (active) setError("We couldn’t load your orders right now. Please try again.");
      });
    return () => { active = false; };
  }, [user.id]);

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
    } catch (signOutFailure) {
      setSignOutError(signOutFailure.message);
    }
  }

  if (!supabase) return <div className="account-page section-shell"><div className="page-intro"><span className="eyebrow"><span className="eyebrow-line" /> YOUR READING JOURNEY</span><h1>Your books are <em>in good company.</em></h1><p>Order history will appear here once the bookstore database is connected.</p></div><SignInPanel /></div>;
  if (error) return <div className="account-page section-shell"><h1>We couldn’t load your orders.</h1><p className="inline-error" role="alert">{error}</p></div>;
  if (orders === null) return <div className="loading-state">Looking up your orders…</div>;

  return (
    <div className="orders-page section-shell">
      <div className="orders-heading">
        <div className="page-intro page-intro--left">
          <span className="eyebrow"><span className="eyebrow-line" /> YOUR READING JOURNEY</span>
          <h1>Your books are <em>in good company.</em></h1>
          <p>Signed in as {user.email}</p>
        </div>
        <button className="sign-out-button" onClick={handleSignOut}><LogOut size={14} /> Sign out</button>
      </div>
      {signOutError && <p className="inline-error" role="alert">{signOutError}</p>}
      {orders.length ? (
        <div className="orders-list">
          {orders.map((order) => (
            <Link className="order-row" to={`/orders/${order.id}`} key={order.id}>
              <span className="order-row__icon"><BookOpen size={18} /></span>
              <span className="order-row__main">
                <strong>Order #{order.id.slice(0, 8).toUpperCase()}</strong>
                <small>{new Date(order.created_at).toLocaleDateString("en-NG")} · {order.order_items?.length ?? 0} books</small>
              </span>
              <span className="order-row__total">
                ₦{Number(order.total).toLocaleString("en-NG")}
                <small>{order.status}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="orders-empty">
          <span>✳</span>
          <h2>Your next favourite book is out there.</h2>
          <p>No orders yet. When you find the right one, it’ll be right here.</p>
          <Link className="button button--primary" to="/shop">Find your next read <ArrowRight size={16} /></Link>
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [retryingEmail, setRetryingEmail] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    if (!supabase || !user) return undefined;
    supabase.from("orders").select("*,order_items(*)").eq("id", id).eq("user_id", user.id).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          console.error("Could not load order details:", queryError.message);
          setError("We couldn’t load this order right now. Please try again.");
        }
        else if (!data) setError("We couldn’t find that order.");
        else setOrder(data);
      })
      .catch((queryError) => {
        console.error("Could not load order details:", queryError.message);
        if (active) setError("We couldn’t load this order right now. Please try again.");
      });
    return () => { active = false; };
  }, [id, user?.id]);

  async function retryConfirmationEmail() {
    if (!supabase || !user || !order) return;
    setRetryingEmail(true);
    setEmailMessage("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Your sign-in session could not be restored. Please sign in again.");
      }
      const response = await fetch(`/api/orders/${order.id}/confirmation-email/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const result = await response.json().catch(() => null);
      if (!result || typeof result !== "object") throw new Error("The email service returned an invalid response.");
      if (!response.ok) throw new Error(result.emailMessage ?? result.message ?? "The confirmation email could not be sent.");
      setEmailMessage(result.emailMessage);
    } catch (retryError) {
      setEmailMessage(retryError instanceof TypeError
        ? "We couldn’t reach the email service. Your order is still saved; try again shortly."
        : retryError.message);
    } finally {
      setRetryingEmail(false);
    }
  }

  if (loading) return <div className="loading-state">Restoring your account…</div>;
  if (!user) return <div className="account-page section-shell"><SignInPanel /></div>;
  if (error) return <div className="not-found"><p className="inline-error">{error}</p><button className="button button--outline" onClick={() => navigate("/orders")}>Back to orders</button></div>;
  if (!supabase) return <div className="not-found"><h1>Orders aren’t connected yet.</h1><p>Connect Supabase to view order details.</p></div>;
  if (!order) return <div className="loading-state">Finding your order…</div>;

  return (
    <div className="order-detail-page section-shell">
      <Link className="back-link" to="/orders">← Back to orders</Link>
      <div className="page-intro page-intro--left">
        <span className="eyebrow"><span className="eyebrow-line" /> ORDER DETAILS</span>
        <h1>A good choice, <em>well made.</em></h1>
        <p>Order #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString("en-NG")}</p>
      </div>
      <div className="order-detail-card">
        <div className="order-status">{order.status}</div>
        {order.order_items?.map((item) => (
          <div className="order-detail-item" key={item.id}>
            <span>{item.product_title} <small>× {item.quantity}</small></span>
            <strong>₦{Number(item.subtotal).toLocaleString("en-NG")}</strong>
          </div>
        ))}
        <div className="summary-total">
          <span>Total</span>
          <strong>₦{Number(order.total).toLocaleString("en-NG")}</strong>
        </div>
        <div className="delivery-summary">
          <strong>Delivery to</strong>
          <span>{order.customer_name}</span>
          <span>{order.delivery_address}, {order.city}, {order.state}</span>
        </div>
        <div className="order-email-actions">
          <button className="button button--outline" onClick={retryConfirmationEmail} disabled={retryingEmail}>
            {retryingEmail ? "Checking email…" : "Send / retry confirmation email"}
          </button>
          {emailMessage && (
            <p
              className={emailMessage.includes("could not") || emailMessage.includes("couldn’t") ? "inline-error" : "order-email-message"}
              role="status"
            >
              {emailMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const requestedPath = searchParams.get("returnTo");
  const destination = requestedPath === "/checkout" || requestedPath === "/orders" || requestedPath === "/admin"
    ? requestedPath
    : "/orders";

  useEffect(() => {
    if (!loading) navigate(user ? destination : "/", { replace: true });
  }, [loading, user, destination, navigate]);

  return <div className="loading-state">Completing your sign-in…</div>;
}
