<template>
  <div class="app-wrapper">
    <header class="main-header">
      <h1>Dog Sport Tees</h1>
      <nav>
        <router-link to="/">Gallery</router-link>
        <router-link to="/admin" v-if="isLoggedIn">Designs</router-link>
        <router-link to="/admin/blanks" v-if="isLoggedIn">Blanks</router-link>
        <router-link to="/login" v-if="!isLoggedIn">Login</router-link>
        <button v-if="isLoggedIn" @click="handleSignOut" class="logout-btn">Logout</button>
      </nav>
    </header>
    
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'vue-router'

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