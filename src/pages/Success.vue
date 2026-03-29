<script setup>
import { onMounted } from 'vue'
import { useCart } from '../composables/useCart'

const { cart } = useCart()

onMounted(() => {
  // Clear the cart since the payment was successful
  cart.value = []
  localStorage.removeItem('dst_cart')
})
</script>

<template>
  <div class="status-container">
    <div class="status-card">
      <div class="icon-circle success">✓</div>
      <h1>Order Confirmed!</h1>
      <p>Thank you for supporting independent dog sport artists. We’ve received your order and are getting to work.</p>
      <router-link to="/" class="btn-primary">Back to Gallery</router-link>
    </div>
  </div>
</template>

<style scoped>
.status-container { display: flex; justify-content: center; align-items: center; min-height: 60vh; padding: 20px; }
.status-card { background: white; border: 3px solid #1A1A1A; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 8px 8px 0px #1A1A1A; max-width: 500px; }
.icon-circle { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2.5rem; color: white; border: 3px solid #1A1A1A; }
.success { background-color: #27ae60; }
h1 { margin: 0 0 15px 0; color: #1A1A1A; }
p { color: #666; line-height: 1.6; margin-bottom: 30px; }
</style>