<template>
  <div class="register-container">
    <h2>Create Admin Account</h2>
    <form @submit.prevent="handleRegister" class="register-form">
      <div class="form-group">
        <label>Email</label>
        <input v-model="email" type="email" required />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input v-model="password" type="password" required minlength="6" />
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input v-model="confirmPassword" type="password" required minlength="6" />
      </div>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <button type="submit" class="btn-primary">Register</button>
    </form>
    <p class="login-link">
      Already have an account? <router-link to="/login">Login here</router-link>.
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const router = useRouter()

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match."
    return
  }

  try {
    const auth = getAuth()
    await createUserWithEmailAndPassword(auth, email.value, password.value)
    // Automatically redirects to admin upon successful creation
    router.push('/admin') 
  } catch (error) {
    errorMessage.value = "Failed to create account. " + error.message
    console.error("Registration Error:", error)
  }
}
</script>

<style scoped>
.register-container { max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: white; }
.form-group { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
input { width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
.btn-primary { width: 100%; padding: 10px; background-color: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
.btn-primary:hover { background-color: var(--secondary); }
.error { color: red; font-size: 0.9em; margin-bottom: 10px; }
.login-link { margin-top: 15px; text-align: center; font-size: 0.9em; }
</style>