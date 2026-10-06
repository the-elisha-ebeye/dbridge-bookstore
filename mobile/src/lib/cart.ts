import { apiBaseUrl } from '../config';
import { CartItem } from '../types';

export async function fetchUserCart(accessToken: string) {
  const response = await fetch(`${apiBaseUrl}/api/cart`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Could not load your cart.');
  }

  return (payload?.items ?? []) as CartItem[];
}

export async function updateCartItem(accessToken: string, productId: string, quantity: number) {
  const response = await fetch(`${apiBaseUrl}/api/cart/${productId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quantity }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Could not update your cart.');
  }

  return (payload?.items ?? []) as CartItem[];
}

export async function removeCartItem(accessToken: string, productId: string) {
  const response = await fetch(`${apiBaseUrl}/api/cart/${productId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Could not remove that item.');
  }

  return (payload?.items ?? []) as CartItem[];
}

export async function addToCart(accessToken: string, productId: string, quantity = 1) {
  const response = await fetch(`${apiBaseUrl}/api/cart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, quantity }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Could not add that item to your cart.');
  }

  return (payload?.items ?? []) as CartItem[];
}
