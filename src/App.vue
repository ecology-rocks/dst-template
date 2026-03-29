<template>
  <div class="app-wrapper">
    <header class="main-header">
      <h1><router-link to="/">Dog Sport Tees</router-link></h1>
      <nav>
        <router-link to="/">Gallery</router-link>
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
      <router-view />
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
</script>