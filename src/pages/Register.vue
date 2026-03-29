<template>
  <div class="register-container">
    <h2>Create an Account</h2>
    <p class="register-subtitle">Join to save your cart, or apply to become a Dog Sport Tees artist.</p>
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
      <button type="submit" class="btn-primary" :disabled="isLoading">
        {{ isLoading ? 'Creating Account...' : 'Register' }}
      </button>
    </form>
    <p class="login-link">
      Already have an account? <router-link to="/login">Login here</router-link>.
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const isLoading = ref(false)
const router = useRouter()

const handleRegister = async () => {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = "Passwords do not match."
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const auth = getAuth()
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
    const user = userCredential.user

    // Generate the baseline user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      roles: { isArtist: false, isAdmin: false },
      applicationStatus: 'none', // Can be: 'none', 'pending', 'approved', 'rejected'
      createdAt: serverTimestamp()
    })
    
    // Send them to their settings page to apply
    router.push('/settings') 
  } catch (error) {
    errorMessage.value = "Failed to create account. " + error.message
    console.error("Registration Error:", error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.register-container { max-width: 400px; margin: 50px auto; padding: 30px; border: 3px solid #1A1A1A; border-radius: 8px; background: white; box-shadow: 6px 6px 0px rgba(0,0,0,0.1); }
.form-group { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; }
input { width: 100%; padding: 10px; box-sizing: border-box; border: 2px solid #ccc; border-radius: 4px; }
.btn-primary { width: 100%; padding: 12px; background-color: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1.1rem; font-weight: bold; text-transform: uppercase; }
.btn-primary:disabled { background-color: #95a5a6; cursor: not-allowed; }
.error { color: #e74c3c; font-size: 0.9em; margin-bottom: 10px; font-weight: bold; }
.login-link { margin-top: 20px; text-align: center; font-size: 0.9em; }
.register-subtitle { text-align: center; color: #666; margin-bottom: 20px; }
</style>