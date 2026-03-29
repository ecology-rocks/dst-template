<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCart } from '../composables/useCart'

const { cart } = useCart()
const route = useRoute()
const orderRefs = ref([])
const isCheckingOrderRefs = ref(false)
const orderLookupNote = ref('')
const knownFunctionNames = ['createStripeCheckout', 'lookupOrders', 'getOrderRefsBySession']

const resolveFunctionUrl = (functionName) => {
  const rawBase = (import.meta.env.VITE_FUNCTIONS_URL || '').trim().replace(/\/+$/, '')
  if (!rawBase) return `/${functionName}`

  const matchedFunction = knownFunctionNames.find((name) => rawBase.endsWith(`/${name}`))
  if (matchedFunction) {
    return `${rawBase.slice(0, -matchedFunction.length)}${functionName}`
  }

  return `${rawBase}/${functionName}`
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const fetchOrderRefs = async () => {
  const sessionId = route.query.session_id
  if (!sessionId) return

  isCheckingOrderRefs.value = true
  orderLookupNote.value = ''

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(`${resolveFunctionUrl('getOrderRefsBySession')}?session_id=${encodeURIComponent(sessionId)}`)
      const contentType = response.headers.get('content-type') || ''
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { error: await response.text() }

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load order references.')
      }

      if (!contentType.includes('application/json')) {
        throw new Error('Unexpected response format while loading order references.')
      }

      orderRefs.value = payload.orderRefs || []
      if (orderRefs.value.length > 0) {
        break
      }
    } catch (error) {
      console.error('Failed to fetch order references:', error)
      if (attempt === 4) {
        orderLookupNote.value = 'We could not fetch your order reference yet. You can still use your checkout email on the Track Order page.'
      }
    }

    if (attempt < 4) {
      await sleep(1500)
    }
  }

  if (!orderRefs.value.length && !orderLookupNote.value) {
    orderLookupNote.value = 'Order processing can take a moment. Visit Track Order in a minute and use your checkout email.'
  }

  isCheckingOrderRefs.value = false
}

onMounted(() => {
  // Clear the cart since the payment was successful
  cart.value = []
  localStorage.removeItem('dst_cart')
  fetchOrderRefs()
})
</script>

<template>
  <div class="status-container">
    <div class="status-card">
      <div class="icon-circle success">✓</div>
      <h1>Order Confirmed!</h1>
      <p>Thank you for supporting independent dog sport artists. We’ve received your order and are getting to work.</p>

      <div class="order-ref-box">
        <p class="order-ref-title">Order Reference</p>
        <p v-if="isCheckingOrderRefs" class="order-ref-text">Fetching your order reference...</p>

        <template v-else-if="orderRefs.length">
          <p class="order-ref-text">Save this reference for guest tracking:</p>
          <ul class="order-ref-list">
            <li v-for="orderRef in orderRefs" :key="orderRef.id">#{{ orderRef.shortId }}</li>
          </ul>
        </template>

        <p v-else class="order-ref-text">{{ orderLookupNote }}</p>

        <router-link to="/orders" class="track-order-link">Track an Order</router-link>
      </div>

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
.order-ref-box {
  border: 2px dashed #ccc;
  border-radius: 10px;
  padding: 16px;
  margin: 0 0 24px 0;
  text-align: left;
}
.order-ref-title {
  color: #1A1A1A;
  font-weight: bold;
  margin: 0 0 8px 0;
}
.order-ref-text {
  margin: 0 0 10px 0;
}
.order-ref-list {
  margin: 0 0 12px 0;
  padding-left: 18px;
}
.order-ref-list li {
  font-weight: bold;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.track-order-link {
  display: inline-block;
  font-weight: bold;
  text-decoration: underline;
}
</style>