export type CartItem = {
  productId: number;
  variantId: number;
  productName: string;
  variantLabel: string;
  price: string;
  quantity: number;
  stockQuantity: number;
}

export const guestCartKey='brightbuy_cart_usd_v1_guest';
export const customerCartKey=(email:string)=>`brightbuy_cart_usd_v1_${email}`;
function getCartKey(): string {
  const email = localStorage.getItem('currentUserEmail');
  // Keep legacy and LKR snapshots archived. New USD carts never reuse them
  // or silently interpret converted amounts as dollars.
  return email ? customerCartKey(email) : guestCartKey;
}

export function getCart(): CartItem[] {
  return readStoredCart(getCartKey());
}
export function readStoredCart(key: string): CartItem[] {
  try {
    const data = sessionStorage.getItem(key);
    if (data) {
      const parsed: unknown = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length>100) throw new Error('Invalid saved cart');
      const seen=new Set<number>();
      const valid = parsed.every(item => !!item && typeof item === 'object'
        && Number.isSafeInteger(item.variantId) && item.variantId>0
        && Number.isSafeInteger(item.productId) && item.productId>0
        && Number.isSafeInteger(item.quantity) && item.quantity>0
        && Number.isSafeInteger(item.stockQuantity) && item.stockQuantity>=item.quantity
        && typeof item.price==='string' && /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(item.price)
        && typeof item.productName==='string' && typeof item.variantLabel==='string'
        && !seen.has(item.variantId) && !!seen.add(item.variantId));
      if(!valid) throw new Error('Invalid saved cart');
      return parsed as CartItem[];
    }
  } catch (e) {
    throw new Error('Your saved cart cannot be read. Clear it from the cart page and try again.', {cause:e});
  }
  return [];
}

export function addToCart(item: CartItem) {
  if (!Number.isSafeInteger(item.quantity) || item.quantity<1 || item.quantity>item.stockQuantity) throw new Error('Invalid cart quantity');
  const cart = getCart();
  const existingIndex = cart.findIndex(i => i.variantId === item.variantId);
  if (existingIndex >= 0) {
    cart[existingIndex] = { ...item, quantity: cart[existingIndex].quantity + item.quantity };
    if (cart[existingIndex].quantity > item.stockQuantity) {
        cart[existingIndex].quantity = item.stockQuantity;
    }
  } else {
    cart.push(item);
  }
  sessionStorage.setItem(getCartKey(), JSON.stringify(cart));
  window.dispatchEvent(new Event('cart-updated'));
}

export function updateCartQuantity(variantId: number, quantity: number) {
  if (!Number.isSafeInteger(quantity)) return;
  const cart = getCart();
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
    sessionStorage.setItem(getCartKey(), JSON.stringify(cart));
    window.dispatchEvent(new Event('cart-updated'));
  }
}

export function removeFromCart(variantId: number) {
  let cart = getCart();
  cart = cart.filter(i => i.variantId !== variantId);
  sessionStorage.setItem(getCartKey(), JSON.stringify(cart));
  window.dispatchEvent(new Event('cart-updated'));
}

export function clearCart() {
  sessionStorage.removeItem(getCartKey());
  window.dispatchEvent(new Event('cart-updated'));
}

export function getCartTotalQuantity() {
  return getCart().reduce((acc, item) => acc + item.quantity, 0);
}

export function getCartTotalPrice() {
  return getCart().reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);
}

export function cartSnapshot(): {items:CartItem[];error:string} {
  try{return {items:getCart(),error:''}}
  catch(e){return {items:[],error:e instanceof Error?e.message:'Your cart is unavailable.'}}
}
