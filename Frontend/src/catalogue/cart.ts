import type { ProductVariant } from './api'

export type CartItem = {
  productId: number;
  variantId: number;
  productName: string;
  variantLabel: string;
  price: string;
  quantity: number;
  stockQuantity: number;
}

const CART_KEY = 'brightbuy_cart';

export function getCart(): CartItem[] {
  try {
    const data = sessionStorage.getItem(CART_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse cart', e);
  }
  return [];
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  const existingIndex = cart.findIndex(i => i.variantId === item.variantId);
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += item.quantity;
    if (cart[existingIndex].quantity > item.stockQuantity) {
        cart[existingIndex].quantity = item.stockQuantity;
    }
  } else {
    cart.push(item);
  }
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('cart-updated'));
}

export function updateCartQuantity(variantId: number, quantity: number) {
  let cart = getCart();
  const existingIndex = cart.findIndex(i => i.variantId === variantId);
  if (existingIndex >= 0) {
    if (quantity <= 0) {
      cart.splice(existingIndex, 1);
    } else {
      cart[existingIndex].quantity = quantity;
      if (cart[existingIndex].quantity > cart[existingIndex].stockQuantity) {
          cart[existingIndex].quantity = cart[existingIndex].stockQuantity;
      }
    }
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  }
}

export function removeFromCart(variantId: number) {
  let cart = getCart();
  cart = cart.filter(i => i.variantId !== variantId);
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('cart-updated'));
}

export function clearCart() {
  sessionStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('cart-updated'));
}

export function getCartTotalQuantity() {
  return getCart().reduce((acc, item) => acc + item.quantity, 0);
}

export function getCartTotalPrice() {
  return getCart().reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);
}
