<script setup>
import { ref, onMounted, computed } from 'vue'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../../firebase'

const orders = ref([])
const loading = ref(true)
const printOrder = ref(null)
const currentFilter = ref('all')


const filteredOrders = computed(() => {
  if (currentFilter.value === 'all') return orders.value
  return orders.value.filter(o => o.status === currentFilter.value)
})

const fetchOrders = async () => {
  const auth = getAuth()
  if (!auth.currentUser) return
  
  try {
    // Assuming the future Stripe Webhook stamps the order with the artist's UID as sellerId
    const q = query(collection(db, 'orders'), where('sellerId', '==', auth.currentUser.uid))
    const snap = await getDocs(q)
    
    // Sort by newest first
    orders.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch (error) {
    console.error("Error fetching orders:", error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchOrders)

const updateStatus = async (orderId, newStatus) => {
  try {
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus })
    const order = orders.value.find(o => o.id === orderId)
    if (order) order.status = newStatus
  } catch (error) {
    console.error("Error updating status:", error)
    alert("Failed to update status.")
  }
}

const saveTracking = async (orderId, trackingNumber) => {
  try {
    await updateDoc(doc(db, 'orders', orderId), { trackingNumber })
    alert('Tracking number saved!')
  } catch (error) {
    console.error("Error saving tracking:", error)
    alert("Failed to save tracking.")
  }
}

const copyAddress = async (shipping) => {
  if (!shipping) return
  
  const addressText = [
    shipping.name,
    shipping.line1,
    shipping.line2,
    `${shipping.city}, ${shipping.state} ${shipping.postal_code}`,
    shipping.country
  ].filter(Boolean).join('\n')

  try {
    await navigator.clipboard.writeText(addressText)
    alert('Shipping address copied to clipboard!')
  } catch (error) {
    console.error('Failed to copy text: ', error)
  }
}

const triggerPrint = (order) => {
  printOrder.value = order
  // Wait a tick for the DOM to render the printable area before opening the dialog
  setTimeout(() => {
    window.print()
    printOrder.value = null
  }, 100)
}
</script>

<template>
  <div class="orders-dashboard screen-only">
    <h2>Order Management</h2>

    <div class="filter-pills">
      <button @click="currentFilter = 'all'" :class="{ active: currentFilter === 'all' }">All Orders</button>
      <button @click="currentFilter = 'received'" :class="{ active: currentFilter === 'received' }">Received</button>
      <button @click="currentFilter = 'processing'" :class="{ active: currentFilter === 'processing' }">Processing</button>
      <button @click="currentFilter = 'shipped'" :class="{ active: currentFilter === 'shipped' }">Shipped</button>
      <button @click="currentFilter = 'complete'" :class="{ active: currentFilter === 'complete' }">Complete</button>
    </div>
    
    <div v-if="loading" class="loading-state">Loading your orders...</div>
    <div v-else-if="filteredOrders.length === 0" class="empty-state">No orders yet. Keep creating!</div>
    
    <div v-else class="orders-list">
      <div v-for="order in filteredOrders" :key="order.id" class="order-card">
        
        <div class="order-header">
          <div>
            <span class="order-id">Order #{{ order.id.slice(-6).toUpperCase() }}</span>
            <span class="order-date">{{ new Date(order.createdAt?.seconds * 1000).toLocaleDateString() }}</span>
          </div>
            <div class="status-control">
            <select :value="order.status || 'received'" @change="(e) => updateStatus(order.id, e.target.value)" class="status-select" :class="order.status || 'received'">
              <option value="received">Received</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="complete">Complete</option>
            </select>
          </div>
        </div>

        <div class="order-grid">
          <div class="order-items">
            <h4>Items</h4>
            <div v-for="(item, index) in order.items" :key="index" class="item-row">
              <img :src="item.designAssetUrl" alt="Thumbnail" class="item-thumb" />
              <div class="item-details">
                <strong>{{ item.designTitle }}</strong>
                <span class="item-meta">{{ item.blankName }}</span>
                <span class="item-meta">Color: {{ item.color }} | Size: {{ item.size }}</span>
                <span class="item-meta">Qty: {{ item.quantity }}</span>
                <span v-for="field in item.customization?.textFields || []" :key="field.label + field.text" class="item-meta customization-meta">
                  {{ field.label }}: {{ field.text }}
                </span>
                <span v-if="item.customization?.notes" class="item-meta customization-meta">
                  Notes: {{ item.customization.notes }}
                </span>
              </div>
            </div>
          </div>

          <div class="order-fulfillment">
            <h4>Shipping Info</h4>
            <div class="address-box" v-if="order.shipping">
              <p class="address-line">{{ order.shipping.name }}</p>
              <p class="address-line">{{ order.shipping.line1 }}</p>
              <p class="address-line" v-if="order.shipping.line2">{{ order.shipping.line2 }}</p>
              <p class="address-line">{{ order.shipping.city }}, {{ order.shipping.state }} {{ order.shipping.postal_code }}</p>
              <button @click="copyAddress(order.shipping)" class="btn-secondary copy-btn">Copy Address</button>
            </div>
            
            <div class="tracking-box">
              <label>Tracking Number</label>
              <div class="tracking-input-group">
                <input v-model="order.trackingNumber" type="text" placeholder="e.g., 1Z99999..." class="tracking-input" />
                <button @click="saveTracking(order.id, order.trackingNumber)" class="btn-secondary small-btn">Save</button>
              </div>
              <a v-if="order.customerEmail" :href="`mailto:${order.customerEmail}?subject=Your Order has shipped!&body=Your tracking number is: ${order.trackingNumber || ''}`" class="email-link">
                Email Customer
              </a>
            </div>

            <button @click="triggerPrint(order)" class="btn-primary print-btn">Print Packing Slip</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="printOrder" class="printable-slip print-only">
    <div class="slip-header">
      <h2>Packing Slip</h2>
      <p><strong>Order ID:</strong> #{{ printOrder.id.slice(-6).toUpperCase() }}</p>
      <p><strong>Date:</strong> {{ new Date(printOrder.createdAt?.seconds * 1000).toLocaleDateString() }}</p>
    </div>

    <div class="slip-addresses">
      <div class="ship-to">
        <h3>Ship To:</h3>
        <p>{{ printOrder.shipping?.name }}</p>
        <p>{{ printOrder.shipping?.line1 }}</p>
        <p v-if="printOrder.shipping?.line2">{{ printOrder.shipping?.line2 }}</p>
        <p>{{ printOrder.shipping?.city }}, {{ printOrder.shipping?.state }} {{ printOrder.shipping?.postal_code }}</p>
      </div>
    </div>

    <table class="slip-items">
      <thead>
        <tr>
          <th>Qty</th>
          <th>Item Details</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, index) in printOrder.items" :key="index">
          <td class="center">{{ item.quantity }}</td>
          <td>
            <strong>{{ item.designTitle }}</strong><br>
            <small>{{ item.blankName }} ({{ item.color }})</small>
          </td>
          <td>{{ item.size }}</td>
        </tr>
      </tbody>
    </table>
    
    <div class="slip-footer">
      <p>Thank you for supporting independent artists!</p>
    </div>
  </div>
</template>

<style scoped>
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 25px;
}

.filter-pills button {
  background: white;
  border: 2px solid #ccc;
  border-radius: 20px;
  padding: 8px 16px;
  font-weight: bold;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-pills button:hover {
  border-color: #1A1A1A;
  color: #1A1A1A;
}

.filter-pills button.active {
  background: #1A1A1A;
  color: white;
  border-color: #1A1A1A;
  box-shadow: 2px 2px 0px var(--accent);
}

/* Add this to your status-select modifier classes */
.status-select.complete { background: #dfe6e9; color: #636e72; border-color: #636e72; }

/* Dashboard Styles (Screen Only) */
.orders-dashboard { max-width: 1000px; margin: 0 auto; padding: 20px; }
.loading-state, .empty-state { text-align: center; padding: 40px; color: #666; font-size: 1.2rem; }

.order-card { background: white; border: 3px solid #1A1A1A; border-radius: 8px; margin-bottom: 25px; overflow: hidden; box-shadow: 4px 4px 0px rgba(0,0,0,0.1); }
.order-header { background: #f1f2f6; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1A1A1A; }
.order-id { font-weight: 900; font-size: 1.1rem; margin-right: 15px; color: #1A1A1A; }
.order-date { color: #666; font-size: 0.9rem; }

.status-select { padding: 6px 12px; border-radius: 20px; font-weight: bold; border: 2px solid #1A1A1A; cursor: pointer; text-transform: uppercase; font-size: 0.8rem; }
.status-select.received { background: #ffeaa7; color: #d35400; border-color: #d35400; }
.status-select.processing { background: #74b9ff; color: #0984e3; border-color: #0984e3; }
.status-select.shipped { background: #55efc4; color: #00b894; border-color: #00b894; }

.order-grid { display: grid; grid-template-columns: 1fr; gap: 20px; padding: 20px; }
@media (min-width: 768px) { .order-grid { grid-template-columns: 2fr 1fr; } }

.order-items h4, .order-fulfillment h4 { margin: 0 0 15px 0; border-bottom: 2px dashed #ccc; padding-bottom: 5px; color: var(--primary); }
.item-row { display: flex; gap: 15px; margin-bottom: 15px; background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
.item-thumb { width: 60px; height: 60px; object-fit: contain; border: 1px solid #ccc; background: white; border-radius: 4px; padding: 4px; }
.item-details { display: flex; flex-direction: column; justify-content: center; }
.item-meta { font-size: 0.85rem; color: #666; margin-top: 2px; }
.customization-meta { color: #333; }

.address-box { background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #ccc; margin-bottom: 15px; }
.address-line { margin: 0 0 4px 0; color: #333; }
.copy-btn { margin-top: 10px; width: 100%; font-size: 0.85rem; padding: 8px; }

.tracking-box { margin-bottom: 20px; }
.tracking-box label { display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 5px; }
.tracking-input-group { display: flex; gap: 8px; margin-bottom: 8px; }
.tracking-input { flex: 1; padding: 8px; border: 2px solid #ccc; border-radius: 4px; }
.small-btn { padding: 8px 12px; }
.email-link { display: inline-block; font-size: 0.85rem; color: var(--secondary); text-decoration: none; font-weight: bold; }
.email-link:hover { text-decoration: underline; }

.print-btn { width: 100%; padding: 12px; font-weight: bold; text-transform: uppercase; }

/* Print Styles (Hidden by default, active only during printing) */
.print-only { display: none; }

@media print {
  /* Hide the rest of the app */
  :global(nav), :global(.cart-wrapper), .screen-only { display: none !important; }
  
  /* Reset body for printing */
  :global(body) { background: white; margin: 0; padding: 0; }
  
  /* Show only the slip */
  .print-only { display: block; width: 100%; max-width: 800px; margin: 0 auto; color: #000; font-family: sans-serif; }
  
  .slip-header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
  .slip-header h2 { margin: 0 0 10px 0; font-size: 24pt; }
  .slip-header p { margin: 0; }
  
  .slip-addresses { margin-bottom: 30px; }
  .ship-to h3 { margin: 0 0 10px 0; font-size: 14pt; }
  .ship-to p { margin: 0 0 5px 0; font-size: 12pt; }
  
  .slip-items { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
  .slip-items th, .slip-items td { border: 1px solid #000; padding: 12px; text-align: left; }
  .slip-items th { background-color: #f0f0f0; font-weight: bold; }
  .center { text-align: center !important; }
  
  .slip-footer { text-align: center; border-top: 1px solid #ccc; padding-top: 20px; font-style: italic; }
}
</style>