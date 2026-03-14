<script setup>
import { computed } from 'vue'
import { useCart } from '../composables/useCart'

const { cart, isCartOpen, removeFromCart, toggleCart } = useCart()

const cartTotal = computed(() => {
  return cart.value.reduce((total, item) => total + (item.price * item.quantity), 0)
})
</script>

<template>
  <div class="cart-wrapper">
    <div 
      class="cart-overlay" 
      :class="{ 'is-open': isCartOpen }" 
      @click="toggleCart"
    ></div>

    <div class="cart-panel" :class="{ 'is-open': isCartOpen }">
      <div class="cart-header">
        <h2>Your Cart</h2>
        <button class="close-btn" @click="toggleCart">&times;</button>
      </div>

      <div class="cart-body">
        <div v-if="cart.length === 0" class="empty-cart">
          <p>Your cart is looking a little empty.</p>
          <button class="btn-primary" @click="toggleCart">Keep Shopping</button>
        </div>

        <div v-else class="cart-items">
          <div v-for="item in cart" :key="item.cartItemId" class="cart-item">
            <img :src="item.designAssetUrl" :alt="item.designTitle" class="item-image" />
            
            <div class="item-details">
              <h4>{{ item.designTitle }}</h4>
              <p class="item-meta">{{ item.blankName }}</p>
              <p class="item-meta">Color: {{ item.color }} | Size: {{ item.size }}</p>
              
              <div class="item-actions">
                <span class="item-price">${{ (item.price / 100).toFixed(2) }}</span>
                <button class="remove-btn text-danger" @click="removeFromCart(item.cartItemId)">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="cart-footer" v-if="cart.length > 0">
        <div class="subtotal-row">
          <span>Subtotal</span>
          <span class="subtotal-price">${{ (cartTotal / 100).toFixed(2) }}</span>
        </div>
        <p class="tax-note">Taxes and shipping calculated at checkout.</p>
        <button class="btn-primary checkout-btn" disabled>Proceed to Checkout (Coming Soon)</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Overlay */
.cart-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  z-index: 999;
}

.cart-overlay.is-open {
  opacity: 1;
  visibility: visible;
}

/* Panel */
.cart-panel {
  position: fixed;
  top: 0;
  right: -100%;
  width: 100%;
  max-width: 450px;
  height: 100vh;
  background-color: var(--bg-color);
  border-left: 4px solid #1A1A1A;
  box-shadow: -8px 0px 0px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  transition: right 0.3s ease-in-out;
  z-index: 1000;
}

.cart-panel.is-open {
  right: 0;
}

/* Header */
.cart-header {
  padding: 20px;
  background-color: var(--primary);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 4px solid #1A1A1A;
}

.cart-header h2 {
  margin: 0;
  font-size: 1.5rem;
  text-transform: uppercase;
  letter-spacing: -0.5px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: none;
  padding: 0;
}

.close-btn:hover {
  transform: scale(1.1);
}

/* Body */
.cart-body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-cart {
  text-align: center;
  margin-top: 50px;
  color: #666;
}

/* Cart Items */
.cart-item {
  display: flex;
  gap: 15px;
  background: white;
  border: 2px solid #1A1A1A;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
}

.item-image {
  width: 80px;
  height: 80px;
  object-fit: contain; /* Ensures the whole PNG fits in the box */
  border: 2px solid #ccc;
  border-radius: 4px;
  background-color: #f8f9fa; /* Soft contrast background */
  padding: 8px; /* Breathing room for the design */
}

.item-details {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.item-details h4 {
  margin: 0 0 5px 0;
  color: #1A1A1A;
  font-size: 1.1rem;
}

.item-meta {
  margin: 0 0 4px 0;
  font-size: 0.85rem;
  color: #666;
}

.item-actions {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 10px;
}

.item-price {
  font-weight: bold;
  color: var(--secondary);
  font-size: 1.1rem;
}

.remove-btn {
  font-size: 0.8rem;
  padding: 2px 5px;
}

/* Footer */
.cart-footer {
  padding: 20px;
  background: white;
  border-top: 4px solid #1A1A1A;
}

.subtotal-row {
  display: flex;
  justify-content: space-between;
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 5px;
  color: #1A1A1A;
}

.tax-note {
  font-size: 0.85rem;
  color: #666;
  margin: 0 0 15px 0;
}

.checkout-btn {
  width: 100%;
  padding: 15px;
  font-size: 1.1rem;
  text-transform: uppercase;
}

.checkout-btn:disabled {
  background-color: #ccc;
  border-color: #999;
  box-shadow: none;
  cursor: not-allowed;
}
</style>