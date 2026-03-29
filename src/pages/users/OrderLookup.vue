<script setup>
import { computed, onMounted, ref } from 'vue'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

const loading = ref(false)
const errorMessage = ref('')
const orders = ref([])
const isLoggedIn = ref(false)
const email = ref('')
const orderRef = ref('')

const canGuestLookup = computed(() => !!email.value.trim() && !!orderRef.value.trim())
const hasResults = computed(() => orders.value.length > 0)

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

const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown date'

  const seconds = timestamp.seconds ?? timestamp._seconds
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000).toLocaleDateString()
  }

  if (typeof timestamp === 'number') {
    // Support either epoch milliseconds or seconds.
    const millis = timestamp > 9999999999 ? timestamp : timestamp * 1000
    return new Date(millis).toLocaleDateString()
  }

  if (typeof timestamp === 'string') {
    const parsed = Date.parse(timestamp)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleDateString()
    }
  }

  return 'Unknown date'
}

const lookupOrders = async (useLoggedInEmail = false) => {
  loading.value = true
  errorMessage.value = ''

  const lookupEmail = useLoggedInEmail ? email.value : email.value.trim().toLowerCase()
  const lookupRef = useLoggedInEmail ? '' : orderRef.value.trim()

  if (!lookupEmail) {
    errorMessage.value = 'Please provide an email address.'
    loading.value = false
    return
  }

  if (!useLoggedInEmail && !lookupRef) {
    errorMessage.value = 'Please provide your order ID/reference.'
    loading.value = false
    return
  }

  try {
    const response = await fetch(resolveFunctionUrl('lookupOrders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: lookupEmail,
        orderRef: lookupRef,
      }),
    })

    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() }

    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load orders right now.')
    }

    if (!contentType.includes('application/json')) {
      throw new Error('Unexpected response format from order lookup endpoint.')
    }

    orders.value = payload.orders || []

    if (!orders.value.length) {
      errorMessage.value = useLoggedInEmail
        ? 'No orders found for your account email yet.'
        : 'No matching order found. Check your email and order reference, then try again.'
    }
  } catch (error) {
    console.error('Order lookup failed:', error)
    errorMessage.value = error.message || 'Order lookup failed. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const auth = getAuth()
  onAuthStateChanged(auth, (user) => {
    isLoggedIn.value = !!user
    email.value = user?.email || ''
  })
})
</script>

<template>
  <div class="orders-lookup-page">
    <h2>Track Your Order</h2>

    <div v-if="isLoggedIn" class="lookup-card">
      <h3>Signed In Order Lookup</h3>
      <p class="lookup-help">Use your account email to pull all orders placed with this login.</p>
      <p class="lookup-email"><strong>Email:</strong> {{ email }}</p>
      <button type="button" class="btn-primary" :disabled="loading" @click="lookupOrders(true)">
        {{ loading ? 'Checking...' : 'Find My Orders' }}
      </button>
    </div>

    <div v-else class="lookup-card">
      <h3>Guest Order Lookup</h3>
      <p class="lookup-help">Enter the email used at checkout and your order reference (full ID or the last 6 characters).</p>

      <div class="form-group">
        <label>Checkout Email</label>
        <input v-model="email" type="email" placeholder="you@example.com" />
      </div>

      <div class="form-group">
        <label>Order ID / Reference</label>
        <input v-model="orderRef" type="text" placeholder="e.g., 1A2B3C or full ID" />
      </div>

      <button type="button" class="btn-primary" :disabled="loading || !canGuestLookup" @click="lookupOrders(false)">
        {{ loading ? 'Checking...' : 'Look Up Order' }}
      </button>

      <p class="lookup-register-cta">
        Have an account? <router-link to="/login">Sign in</router-link> to fetch all your customer orders by email.
      </p>
      <p class="lookup-register-cta">
        New here? <router-link to="/register">Create an account</router-link> to make tracking easier.
      </p>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <div v-if="hasResults" class="results-list">
      <article v-for="order in orders" :key="order.id" class="order-card">
        <div class="order-card-header">
          <h4>Order #{{ order.shortId }}</h4>
          <span class="status-pill" :class="order.status">{{ order.status }}</span>
        </div>

        <p class="order-meta">
          <strong>Date:</strong> {{ formatDate(order.createdAt) }}
        </p>
        <p class="order-meta" v-if="order.trackingNumber">
          <strong>Tracking:</strong> {{ order.trackingNumber }}
        </p>

        <div class="order-items">
          <div v-for="(item, idx) in order.items" :key="idx" class="order-item">
            <img :src="item.designAssetUrl" :alt="item.designTitle" class="order-item-img" />
            <div>
              <p class="item-title">{{ item.designTitle }}</p>
              <p class="item-meta">{{ item.blankName }} | {{ item.color }} | {{ item.size }} | Qty {{ item.quantity }}</p>
              <p v-for="field in item.customization?.textFields || []" :key="field.label + field.text" class="item-meta customization-item-meta">
                {{ field.label }}: {{ field.text }}
              </p>
              <p v-if="item.customization?.notes" class="item-meta customization-item-meta">Notes: {{ item.customization.notes }}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.orders-lookup-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.lookup-card {
  background: white;
  border: 3px solid #1A1A1A;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.08);
}

.lookup-help {
  color: #555;
  margin-bottom: 15px;
}

.lookup-email {
  margin: 0 0 15px 0;
}

.lookup-register-cta {
  margin-top: 10px;
  color: #666;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 14px;
}

label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}

input {
  width: 100%;
  border: 2px solid #ccc;
  border-radius: 6px;
  padding: 10px;
  box-sizing: border-box;
}

.btn-primary {
  border: none;
  border-radius: 6px;
  background: var(--primary);
  color: white;
  padding: 10px 16px;
  font-weight: bold;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-text {
  color: #c0392b;
  font-weight: bold;
  margin: 10px 0 20px 0;
}

.results-list {
  display: grid;
  gap: 15px;
}

.order-card {
  background: white;
  border: 2px solid #1A1A1A;
  border-radius: 8px;
  padding: 15px;
}

.order-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.order-card-header h4 {
  margin: 0;
}

.status-pill {
  border-radius: 999px;
  padding: 4px 10px;
  text-transform: uppercase;
  font-size: 0.75rem;
  font-weight: bold;
  border: 2px solid #1A1A1A;
}

.status-pill.received {
  background: #ffeaa7;
  color: #d35400;
}

.status-pill.processing {
  background: #74b9ff;
  color: #0984e3;
}

.status-pill.shipped {
  background: #55efc4;
  color: #00b894;
}

.status-pill.complete {
  background: #dfe6e9;
  color: #636e72;
}

.order-meta {
  margin: 4px 0;
}

.order-items {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.order-item {
  display: flex;
  gap: 10px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px;
}

.order-item-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.item-title {
  margin: 0;
  font-weight: bold;
}

.item-meta {
  margin: 2px 0 0 0;
  color: #666;
  font-size: 0.85rem;
}
.customization-item-meta {
  color: #444;
}
</style>
