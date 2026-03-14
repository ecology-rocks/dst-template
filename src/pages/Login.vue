<template>
  <div class="login-container">
    <h2>Admin Login</h2>
    <form @submit.prevent="handleLogin" class="login-form">
      <div class="form-group">
        <label>Email</label>
        <input v-model="email" type="email" required />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input v-model="password" type="password" required />
      </div>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="submit" class="btn-primary">Sign In</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const router = useRouter()

const handleLogin = async () => {
  try {
    const auth = getAuth()
    await signInWithEmailAndPassword(auth, email.value, password.value)
    router.push('/admin') // Redirect to the admin dashboard on success
  } catch (error) {
    errorMessage.value = "Failed to log in. Check credentials."
    console.error("Login Error:", error)
  }
}
</script>

<style scoped>
.login-container { max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: white; }
.form-group { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
input { width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
.btn-primary { width: 100%; padding: 10px; background-color: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
.btn-primary:hover { background-color: var(--secondary); }
.error { color: red; font-size: 0.9em; margin-bottom: 10px; }
</style>