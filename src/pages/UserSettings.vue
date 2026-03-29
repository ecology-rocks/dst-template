<script setup>
import { ref, onMounted } from 'vue'
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { db, storage } from '../firebase'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const loading = ref(true)
const saveSuccess = ref(false)
const uploadProgress = ref(0)
const auth = getAuth()

// Baseline schema for a new user
// Baseline schema (removed shipping/billing)
const profile = ref({
  displayName: '',
  photoUrl: '',
  roles: { isShopper: true, isArtist: false },
  artistProfile: {
    bio: '',
    yearStarted: new Date().getFullYear(), // <-- NEW FIELD
    returnPolicy: 'standard',
    customReturnPolicy: '',
    printifyApiKey: '',
    printifyShopId: '',
    shopSlug: '',
    shippingCountry: 'US', // Default to US
    shipsInternationally: false,
    internationalFee: 10.00 // <-- NEW FIELD
  }
})

const submitApplication = async () => {
  if (!profile.value.artistProfile.shopSlug || !profile.value.artistProfile.bio) {
    alert("Please provide a shop URL and a short bio.")
    return
  }

  // Check if slug is taken before applying
  const slugQuery = query(collection(db, 'users'), where('artistProfile.shopSlug', '==', profile.value.artistProfile.shopSlug))
  const slugSnap = await getDocs(slugQuery)
  const isTaken = slugSnap.docs.some(d => d.id !== auth.currentUser.uid)
  
  if (isTaken) {
    alert("That Shop URL is already taken. Please choose another one.")
    return 
  }

  try {
    const auth = getAuth()
    await setDoc(doc(db, 'users', auth.currentUser.uid), {
      applicationStatus: 'pending',
      artistProfile: {
        shopSlug: profile.value.artistProfile.shopSlug,
        bio: profile.value.artistProfile.bio
      }
    }, { merge: true })
    
    profile.value.applicationStatus = 'pending'
    alert("Application submitted! We'll review it shortly.")
  } catch (error) {
    console.error("Error applying:", error)
    alert("Failed to submit application.")
  }
}

// Avatar upload with size validation
const uploadAvatar = (event) => {
  const file = event.target.files[0]
  if (!file || !auth.currentUser) return
  
  // 2MB Validation
  if (file.size > 2 * 1024 * 1024) {
    alert('File is too large. Please upload an image under 2MB.')
    event.target.value = '' // Clear the input
    return
  }
  
  const fileRef = storageRef(storage, `users/${auth.currentUser.uid}/avatar_${Date.now()}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on('state_changed', 
    (snap) => uploadProgress.value = Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
    (err) => console.error(err),
    async () => {
      profile.value.photoUrl = await getDownloadURL(uploadTask.snapshot.ref)
      uploadProgress.value = 0
    }
  )
}

onMounted(async () => {
  if (!auth.currentUser) return // Should be guarded by router, but just in case
  
  const docRef = doc(db, 'users', auth.currentUser.uid)
  const docSnap = await getDoc(docRef)
  
  if (docSnap.exists()) {
    // Merge existing data over the baseline schema to prevent undefined errors
    const data = docSnap.data()
    profile.value = { 
      ...profile.value, 
      ...data,
      roles: { ...profile.value.roles, ...(data.roles || {}) },
      artistProfile: { ...profile.value.artistProfile, ...(data.artistProfile || {}) }
    }
  }
  loading.value = false
})

// Automatically formats the input to be lowercase with hyphens instead of spaces
const formatSlug = () => {
  if (profile.value.artistProfile.shopSlug) {
    profile.value.artistProfile.shopSlug = profile.value.artistProfile.shopSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/(^-|-$)+/g, '')    // Remove leading/trailing hyphens
  }
}

// Replace your existing saveProfile function with this one to check for duplicates
const saveProfile = async () => {
  saveSuccess.value = false
  
  // Check if the shop URL is already taken by someone else
  if (profile.value.roles.isArtist && profile.value.artistProfile.shopSlug) {
    const slugQuery = query(
      collection(db, 'users'), 
      where('artistProfile.shopSlug', '==', profile.value.artistProfile.shopSlug)
    )
    const slugSnap = await getDocs(slugQuery)
    
    // If we found docs, check if any of them belong to a DIFFERENT user
    const isTaken = slugSnap.docs.some(d => d.id !== auth.currentUser.uid)
    if (isTaken) {
      alert("That Shop URL is already taken. Please choose another one.")
      return // Stop the save process
    }
  }

  try {
    const docRef = doc(db, 'users', auth.currentUser.uid)
    await setDoc(docRef, profile.value, { merge: true })
    saveSuccess.value = true
    setTimeout(() => saveSuccess.value = false, 3000)
  } catch (error) {
    console.error("Error saving profile:", error)
    alert("Failed to save settings.")
  }
}
</script>

<template>
  <div class="settings-container">
    <h2>Account Settings</h2>

    <div v-if="loading" class="loading">Loading profile...</div>

    <form v-else @submit.prevent="saveProfile" class="settings-form">

      <div class="form-section">
        <h3>General Information</h3>
        
        <div class="form-group avatar-upload">
          <img :src="profile.photoUrl || 'https://via.placeholder.com/150'" alt="Profile Pic" class="avatar-preview" />
          <div>
            <label>Profile Picture</label>
            <p style="font-size: 0.8rem; color: #666; margin: 0 0 10px 0;">Recommended: Square image. Max size: 2MB (JPEG, PNG, WEBP).</p>
            <input type="file" accept="image/png, image/jpeg, image/webp" @change="uploadAvatar" />
            <p v-if="uploadProgress > 0" class="progress-text">Uploading: {{ uploadProgress }}%</p>
          </div>
        </div>

        <div class="form-group">
          <label>Display Name</label>
          <input v-model="profile.displayName" type="text" placeholder="How you appear on the site" required />
        </div>
      </div>

      <div class="application-banner" v-if="!profile.roles?.isArtist">
        <h3>Artist Dashboard Access</h3>
        
        <div v-if="profile.applicationStatus === 'none' || !profile.applicationStatus">
          <p>Want to sell your dog sport designs on our platform? Apply to become an artist!</p>
          
          <div class="application-form">
            <div class="form-group">
              <label>Proposed Shop URL</label>
              <div class="slug-input-group">
                <span class="slug-prefix">dogsporttees.com/shop/</span>
                <input v-model="profile.artistProfile.shopSlug" @input="formatSlug" type="text" placeholder="my-awesome-shop" class="slug-input" />
              </div>
            </div>
            
            <div class="form-group">
              <label>Artist Bio / Application Notes</label>
              <textarea v-model="profile.artistProfile.bio" rows="4" placeholder="Tell us about your art style and your involvement in dog sports..."></textarea>
            </div>
          </div>

          <button @click="submitApplication" type="button" class="btn-primary">Submit Application</button>
        </div>

        <div v-else-if="profile.applicationStatus === 'pending'" class="status-pending">
          <p>⏳ <strong>Your application is under review!</strong> Hang tight, our team is verifying your account.</p>
        </div>

        <div v-else-if="profile.applicationStatus === 'rejected'" class="status-rejected">
          <p>❌ <strong>Application Declined.</strong> Unfortunately, we cannot approve your artist account at this time.</p>
        </div>
        
        <hr class="section-divider" />
      </div>
      
      <div v-if="profile.roles.isArtist" class="form-section artist-theme">
        <h3>Artist Shop Setup</h3>
        <div class="form-group" style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 2px dashed #ccc;">
          <label>Your Custom Shop URL</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: #666; font-weight: bold;">dogsporttees.com/shop/</span>
            <input 
              v-model="profile.artistProfile.shopSlug" 
              @input="formatSlug"
              type="text" 
              placeholder="my-awesome-shop" 
              style="flex: 1; border-color: var(--secondary);"
            />
          </div>
          <p style="font-size: 0.8rem; color: #666; margin: 5px 0 0 0;">This is how customers will find your storefront.</p>
        </div>
        <div class="form-group" style="margin-top: 20px;">
          <label>Year Started</label>
          <input v-model.number="profile.artistProfile.yearStarted" type="number" min="1900" :max="new Date().getFullYear()" placeholder="e.g., 2015" />
          <p style="font-size: 0.8rem; color: #666; margin: 5px 0 0 0;">Show shoppers how long you've been creating art.</p>
        </div>
        <div class="form-group">
          <label>Artist Bio</label>
          <div class="editor-wrapper">
            <QuillEditor theme="snow" v-model:content="profile.artistProfile.bio" contentType="html" toolbar="essential" />
          </div>
        </div>

        <h4 class="sub-header">Shipping Rules</h4>
        
        <div class="form-group">
          <label>Base Shipping Country</label>
          <p class="help-text">Your item prices should include "free" shipping to this country.</p>
          <select v-model="profile.artistProfile.shippingCountry" class="standard-input">
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            </select>
        </div>

        <div class="form-group checkbox-group">
          <label class="toggle-card" :class="{ active: profile.artistProfile.shipsInternationally }">
            <span>
            <input type="checkbox" v-model="profile.artistProfile.shipsInternationally" />
            <div class="toggle-content">
              <strong>Ship Internationally? </strong>
              Allow customers outside your base country to buy your items.
            </div>
          </span>
          </label>
        </div>

        <div class="form-group" v-if="profile.artistProfile.shipsInternationally">
          <label>International Shipping Surcharge</label>
          <p class="help-text">This flat fee is added once per order for customers outside your base country.</p>
          <div class="currency-input-group">
            <span class="currency-prefix">$</span>
            <input type="number" step="0.50" min="0" v-model="profile.artistProfile.internationalFee" class="currency-input" />
          </div>
        </div>

        <div class="form-group">
          <label>Return & Exchange Policy</label>
          <select v-model="profile.artistProfile.returnPolicy">
            <option value="standard">Standard (30 days, buyer pays return shipping)</option>
            <option value="no_returns">No Returns (All sales final)</option>
            <option value="custom">Custom Policy</option>
          </select>
        </div>

        <div v-if="profile.artistProfile.returnPolicy === 'custom'" class="form-group">
          <label>Custom Return Policy Details</label>
          <textarea v-model="profile.artistProfile.customReturnPolicy" rows="3" placeholder="Explain your rules..."></textarea>
        </div>

        <hr style="margin: 25px 0; border-color: #ccc;" />
        
        <h4>Print-on-Demand Integrations</h4>
        <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px;">Configure your Printify API connection to automate order fulfillment.</p>
        
        <div class="form-group" style="display: flex; gap: 15px;">
          <div style="flex: 2;">
            <label>Printify API Key (Personal Access Token)</label>
            <input v-model="profile.artistProfile.printifyApiKey" type="password" placeholder="ptf_..." />
          </div>
          <div style="flex: 1;">
            <label>Printify Shop ID</label>
            <input v-model="profile.artistProfile.printifyShopId" type="text" placeholder="e.g., 1234567" />
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" style="font-size: 1.1rem; padding: 12px 24px;">Save Settings</button>
        <span v-if="saveSuccess" style="color: #4CAF50; font-weight: bold; margin-left: 15px;">Settings saved successfully!</span>
      </div>
    </form>
  </div>
</template>

<style scoped>
.sub-header {
  margin-top: 30px;
  border-bottom: 2px solid #f1f2f6;
  padding-bottom: 10px;
  color: var(--primary);
}

.standard-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
}

.currency-input-group {
  display: flex;
  align-items: center;
  border: 2px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
  max-width: 200px;
}

.currency-prefix {
  background: #f1f2f6;
  padding: 10px 15px;
  font-weight: bold;
  color: #666;
  border-right: 2px solid #ccc;
}

.currency-input {
  flex: 1;
  padding: 10px;
  border: none;
  outline: none;
  font-size: 1rem;
}

.toggle-card {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px;
  border: 2px solid #ccc;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.toggle-card:hover {
  border-color: #1A1A1A;
}

.toggle-card.active {
  border-color: #1A1A1A;
  background: #f8f9fa;
  box-shadow: 2px 2px 0px var(--accent);
}

.toggle-card input[type="checkbox"] {
  margin-top: 4px;
  transform: scale(1.2);
}

.toggle-content {
  display: flex;
  flex-direction: column;
}

.toggle-content strong {
  color: #1A1A1A;
  margin-bottom: 2px;
}

.toggle-content span {
  font-size: 0.85rem;
  color: #666;
}
.application-form {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 2px dashed #ccc;
}
.slug-input-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.slug-prefix {
  color: #666;
  font-weight: bold;
}
.slug-input {
  flex: 1;
}
.section-divider {
  margin: 25px 0;
  border-color: #ccc;
}
.help-text {
  font-size: 0.8rem;
  color: #666;
  margin: 0 0 10px 0;
}

.settings-container { max-width: 800px; margin: 0 auto; padding: 20px; }
.form-section { background: white; padding: 25px; border: 3px solid #1A1A1A; border-radius: var(--radius); margin-bottom: 25px; box-shadow: 4px 4px 0px rgba(0,0,0,0.1); }
.form-section h3 { margin-top: 0; color: var(--primary); border-bottom: 2px solid #f1f2f6; padding-bottom: 10px; margin-bottom: 20px; }

.artist-theme { border-color: var(--secondary); box-shadow: 4px 4px 0px rgba(30, 144, 255, 0.2); }
.artist-theme h3 { color: var(--secondary); }

.form-group { margin-bottom: 20px; }
label { display: block; font-weight: bold; margin-bottom: 5px; color: #1A1A1A; font-size: 0.95rem; }
input[type="text"], input[type="password"], textarea, select { width: 100%; padding: 10px; border: 2px solid #ccc; border-radius: 6px; box-sizing: border-box; font-family: inherit; }
input:focus, textarea:focus, select:focus { border-color: var(--secondary); outline: none; }

/* Role Cards */
.checkbox-group { display: flex; gap: 15px; }
.role-card { flex: 1; border: 2px solid #ccc; padding: 15px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; align-items: flex-start; }
.role-card input { display: none; }
.role-card strong { font-size: 1.1rem; color: #1A1A1A; margin-bottom: 5px; }
.role-card span { font-size: 0.85rem; color: #666; }
.role-card.active { border-color: var(--primary); background: rgba(192, 57, 43, 0.05); box-shadow: 2px 2px 0px var(--primary); }

/* Avatar */
.avatar-upload { display: flex; align-items: center; gap: 20px; }
.avatar-preview { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #1A1A1A; }

/* Quill Overrides */
.editor-wrapper :deep(.ql-toolbar) { border: 2px solid #ccc !important; border-bottom: none !important; border-radius: 6px 6px 0 0; background: #f9f9f9; }
.editor-wrapper :deep(.ql-container) { border: 2px solid #ccc !important; border-radius: 0 0 6px 6px; min-height: 150px; background: white; font-size: 1rem; font-family: inherit; }
</style>