<template>
  <div class="admin-container">
    <h2>Design Catalog Management</h2>
    
    <form @submit.prevent="saveDesign" class="design-form">
      <div class="form-group">
        <label>Design Title</label>
        <input v-model="currentDesign.title" type="text" required placeholder="e.g., Agility Jump Silhouette" />
      </div>

      <div class="form-group">
        <label>Description (SEO)</label>
        <textarea v-model="currentDesign.description" rows="3" placeholder="Detailed description for the product page..."></textarea>
      </div>

      <div class="form-group">
        <label>Keywords (Comma separated for SEO)</label>
        <input v-model="keywordInput" type="text" placeholder="dog sports, agility, border collie" />
      </div>
      <div class="form-group blanks-assignment">
        <label>Assign Blanks to Design</label>
        
        <div class="filter-controls" style="display: flex; gap: 10px; margin-bottom: 15px;">
          <input v-model="blankSearchQuery" type="text" placeholder="Search blanks..." style="flex: 2;" />
          <select v-model="selectedCategory" style="flex: 1; padding: 10px; border-radius: 6px; border: 2px solid #1A1A1A;">
            <option value="">All Categories</option>
            <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div class="blanks-list" style="max-height: 200px; overflow-y: auto; border: 2px solid #ccc; padding: 10px; border-radius: 6px; background: #fafafa;">
          <div v-for="blank in filteredBlanks" :key="blank.id" style="margin-bottom: 8px;">
            <label style="font-weight: normal; display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input 
                type="checkbox" 
                :value="blank.id" 
                v-model="currentDesign.assignedBlankIds"
              />
              {{ blank.name }}
              <span class="tag" style="font-size: 0.7rem; padding: 2px 6px;">{{ blank.category }} &gt; {{ blank.subCategory }}</span>
              <span v-if="!blank.isPublic" style="color: #C0392B; font-size: 0.8rem; font-weight: bold;">(Private)</span>
            </label>
          </div>
          <p v-if="filteredBlanks.length === 0" style="color: #666; font-size: 0.9em;">No blanks match your filters.</p>
        </div>
      </div>

      <div class="form-group">
        <label>Upload Asset (Dark Ink for Light Shirts)</label>
        <input type="file" accept="image/png, image/jpeg" @change="(e) => handleFileUpload(e, 'darkInk')" />
        <p v-if="uploadProgress.darkInk">Uploading: {{ uploadProgress.darkInk }}%</p>
        <p v-if="currentDesign.assets.darkInk" class="success-text">File attached!</p>
      </div>

      <div class="form-group">
        <label>Upload Asset (Light Ink for Dark Shirts)</label>
        <input type="file" accept="image/png, image/jpeg" @change="(e) => handleFileUpload(e, 'lightInk')" />
        <p v-if="uploadProgress.lightInk">Uploading: {{ uploadProgress.lightInk }}%</p>
        <p v-if="currentDesign.assets.lightInk" class="success-text">File attached!</p>
      </div>

      <button type="submit" class="btn-primary">
        {{ isEditing ? 'Update Design' : 'Add New Design' }}
      </button>
      <button v-if="isEditing" @click="resetForm" type="button" class="btn-secondary">Cancel</button>
    </form>

    <hr />

    <div class="design-list">
      <h3>Current Designs</h3>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Keywords</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="design in designs" :key="design.id">
            <td>{{ design.title }}</td>
            <td>{{ design.keywords.join(', ') }}</td>
            <td>
              <button @click="editDesign(design)">Edit</button>
              <button @click="deleteDesign(design.id)" class="btn-danger">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { getAuth } from 'firebase/auth'
import { ref, onMounted, computed } from 'vue'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useRoute, useRouter } from 'vue-router'

const designsCollection = collection(db, 'designs')
const route = useRoute()
const router = useRouter()

const designs = ref([])
const isEditing = ref(false)
const keywordInput = ref('')
const blanksCollection = collection(db, 'blanks')
const allBlanks = ref([])
const blankSearchQuery = ref('')
const selectedCategory = ref('')

const currentDesign = ref({
  id: null,
  title: '',
  description: '',
  keywords: [],
  assets: { darkInk: '', lightInk: '' },
  assignedBlankIds: [], // <-- NEW FIELD
  isActive: true
})

// Load designs on mount
const fetchDesigns = async () => {
  const querySnapshot = await getDocs(designsCollection)
  designs.value = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  // Catch the query parameter and load the form
  if (route.query.edit) {
    const designToEdit = designs.value.find(d => d.id === route.query.edit)
    if (designToEdit) {
      editDesign(designToEdit)
    }
    // Clean up the URL so it just says /admin
    router.replace({ path: '/admin', query: {} })
  }
}

// Fetch blanks from Firestore
const fetchBlanks = async () => {
  const querySnapshot = await getDocs(blanksCollection)
  allBlanks.value = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}



onMounted(() => {
  fetchDesigns()
  fetchBlanks() 
})

const filteredBlanks = computed(() => {
  return allBlanks.value.filter(blank => {
    // Combine name and subCategory for a broader text search
    const searchTarget = `${blank.name} ${blank.subCategory || ''}`.toLowerCase()
    const matchesSearch = searchTarget.includes(blankSearchQuery.value.toLowerCase())
    
    const matchesCategory = selectedCategory.value === '' || blank.category === selectedCategory.value
    
    return matchesSearch && matchesCategory
  })
})

// Get unique categories for the dropdown
const availableCategories = computed(() => {
  const categories = allBlanks.value.map(b => b.category).filter(Boolean)
  return [...new Set(categories)]
})

// Add state to track upload progress
const uploadProgress = ref({
  darkInk: 0,
  lightInk: 0
})

const handleFileUpload = (event, assetType) => {
  const file = event.target.files[0]
  if (!file) return

  // Create a unique file name to prevent overwriting
  const fileName = `${Date.now()}_${file.name}`
  const fileRef = storageRef(storage, `designs/${fileName}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
      uploadProgress.value[assetType] = progress
    },
    (error) => {
      console.error("Upload failed:", error)
      alert("Image upload failed.")
    },
    async () => {
      // On success, get the URL and assign it to the design object
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
      currentDesign.value.assets[assetType] = downloadURL
      uploadProgress.value[assetType] = 0 // Reset progress text
    }
  )
}

const saveDesign = async () => {
  // Parse comma-separated keywords into an array
  currentDesign.value.keywords = keywordInput.value.split(',').map(k => k.trim()).filter(k => k)

  try {
    if (isEditing.value) {
      const docRef = doc(db, 'designs', currentDesign.value.id)
      const dataToUpdate = { ...currentDesign.value }
      delete dataToUpdate.id // Don't write the ID to the document fields
      await updateDoc(docRef, dataToUpdate)
    } else {
      const auth = getAuth()
      const dataToAdd = { 
        ...currentDesign.value, 
        createdAt: new Date(),
        ownerId: auth.currentUser.uid // <-- Stamps the creator's UID
      }
      delete dataToAdd.id
      await addDoc(designsCollection, dataToAdd)
    }
    await fetchDesigns()
    resetForm()
  } catch (error) {
    console.error("Error saving design: ", error)
    alert("Failed to save design. Check console.")
  }
}

const editDesign = (design) => {
  currentDesign.value = { ...design }
  keywordInput.value = design.keywords ? design.keywords.join(', ') : ''
  isEditing.value = true
}

const deleteDesign = async (id) => {
  if (confirm('Are you sure you want to delete this design?')) {
    try {
      await deleteDoc(doc(db, 'designs', id))
      await fetchDesigns()
    } catch (error) {
      console.error("Error deleting design: ", error)
    }
  }
}

const resetForm = () => {
  isEditing.value = false
  keywordInput.value = ''
  currentDesign.value = {
    id: null,
    title: '',
    description: '',
    keywords: [],
    assets: { darkInk: '', lightInk: '' },
    isActive: true
  }
}
</script>

<style scoped>
.admin-container { max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif; }
.form-group { margin-bottom: 15px; }
label { display: block; font-weight: bold; margin-bottom: 5px; }
input[type="text"], input[type="url"], textarea { width: 100%; padding: 8px; box-sizing: border-box; }
.btn-primary { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; cursor: pointer; margin-right: 10px; }
.btn-secondary { background-color: #ccc; padding: 10px 15px; border: none; cursor: pointer; }
.btn-danger { background-color: #f44336; color: white; padding: 10px 15px; border: none; cursor: pointer; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; }
th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
.success-text { color: #4CAF50; font-size: 0.85em; margin-top: 5px; font-weight: bold; }
</style>