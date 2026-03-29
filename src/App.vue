<template>
  <div class="app-wrapper">
    <header class="main-header">
      <h1><router-link to="/">Dog Sport Tees</router-link></h1>
      <nav>
        <router-link to="/">Gallery</router-link>
        <router-link to="/orders" @mouseenter="prefetchOrderLookup" @focus="prefetchOrderLookup">Track Order</router-link>
        <router-link to="/admin" v-if="isLoggedIn">Designs</router-link>
        <router-link to="/admin/blanks" v-if="isLoggedIn">Blanks</router-link>
        <router-link to="/settings" v-if="isLoggedIn">User Settings</router-link>
        <router-link to="/admin/orders" v-if="isLoggedIn">Orders Dashboard</router-link>
        
        <button class="btn-secondary m-l-10" @click="toggleCart">
          Cart ({{ cart.length }})
        </button>

        <router-link to="/login" v-if="!isLoggedIn">Login</router-link>
        <button v-if="isLoggedIn" @click="handleSignOut" class="logout-btn">Logout</button>
      </nav>
    </header>
    
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <Suspense>
          <component :is="Component" />
          <template #fallback>
            <div class="route-loading-state">
              <div class="route-loading-card">
                <p class="route-loading-title">Loading page...</p>
                <p class="route-loading-subtitle">Hang tight while we fetch everything.</p>
              </div>
            </div>
          </template>
        </Suspense>
      </router-view>
      <CartDrawer />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'vue-router'
// Import the drawer and the composable
import CartDrawer from './components/CartDrawer.vue'
import { useCart } from './composables/useCart'

// Destructure what we need for the button
const { cart, toggleCart } = useCart()
const isLoggedIn = ref(false)
const router = useRouter()
let auth
let hasPrefetchedOrderLookup = false

onMounted(() => {
  auth = getAuth()
  onAuthStateChanged(auth, (user) => {
    isLoggedIn.value = !!user
  })
})

const handleSignOut = async () => {
  try {
    await signOut(auth)
    router.push('/')
  } catch (error) {
    console.error("Logout failed", error)
  }
}

const prefetchOrderLookup = async () => {
  if (hasPrefetchedOrderLookup) return
  hasPrefetchedOrderLookup = true

  try {
    await import('./pages/users/OrderLookup.vue')
  } catch (error) {
    hasPrefetchedOrderLookup = false
    console.error('Order lookup prefetch failed', error)
  }
}
</script>

<style scoped>
.route-loading-state {
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.route-loading-card {
  background: white;
  border: 3px solid #1A1A1A;
  border-radius: 10px;
  box-shadow: 4px 4px 0px rgba(0,0,0,0.2);
  padding: 18px 22px;
  min-width: 240px;
  text-align: center;
}

.route-loading-title {
  margin: 0;
  color: #1A1A1A;
  font-weight: bold;
}

.route-loading-subtitle {
  margin: 6px 0 0 0;
  color: #666;
  font-size: 0.9rem;
}
</style>