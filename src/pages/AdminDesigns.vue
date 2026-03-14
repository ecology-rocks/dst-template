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
const blanksCollection = collection(db, 'blanks')
const allBlanks = ref([])
const blankSearchQuery = ref('')
const selectedCategory = ref('')
const tagInput = ref('')
const showSuggestions = ref(false)

const currentDesign = ref({
  id: null,
  title: '',
  description: '',
  breeds: [],     // <-- NEW
  sports: [],     // <-- NEW
  keywords: [],
  assets: { darkInk: '', lightInk: '' },
  assignedBlankIds: [], // <-- NEW FIELD
  isActive: true
})


const existingTags = computed(() => {
  const tags = []
  designs.value.forEach(d => {
    (d.breeds || []).forEach(b => tags.push({ text: b, type: 'breed' }));
    (d.sports || []).forEach(s => tags.push({ text: s, type: 'sport' }));
    (d.keywords || []).forEach(k => tags.push({ text: k, type: 'keyword' }));
  })
  // Deduplicate
  return tags.filter((tag, index, self) =>
    index === self.findIndex((t) => t.text.toLowerCase() === tag.text.toLowerCase() && t.type === tag.type)
  ).sort((a, b) => a.text.localeCompare(b.text))
})

const filteredSuggestions = computed(() => {
  if (!tagInput.value) return []
  const lowerInput = tagInput.value.toLowerCase()
  return existingTags.value.filter(t => t.text.toLowerCase().includes(lowerInput))
})

const exactMatchExists = computed(() => {
  return existingTags.value.some(t => t.text.toLowerCase() === tagInput.value.toLowerCase())
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

const addTag = (text, type) => {
  if (!text) return
  const cleanText = text.trim()
  
  if (type === 'breed' && !currentDesign.value.breeds.includes(cleanText)) currentDesign.value.breeds.push(cleanText)
  if (type === 'sport' && !currentDesign.value.sports.includes(cleanText)) currentDesign.value.sports.push(cleanText)
  if (type === 'keyword' && !currentDesign.value.keywords.includes(cleanText)) currentDesign.value.keywords.push(cleanText)
  
  tagInput.value = ''
  showSuggestions.value = false
}

const removeTag = (text, type) => {
  if (type === 'breed') currentDesign.value.breeds = currentDesign.value.breeds.filter(t => t !== text)
  if (type === 'sport') currentDesign.value.sports = currentDesign.value.sports.filter(t => t !== text)
  if (type === 'keyword') currentDesign.value.keywords = currentDesign.value.keywords.filter(t => t !== text)
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
  currentDesign.value = { 
    ...design,
    // Add fallbacks for older documents that lack these fields
    breeds: design.breeds || [],
    sports: design.sports || [],
    keywords: design.keywords || [],
    assignedBlankIds: design.assignedBlankIds || []
  }
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
  tagInput.value = ''
  showSuggestions.value = false
  currentDesign.value = {
    id: null, title: '', description: '', keywords: [], breeds: [], sports: [], 
    isCustomizable: false, assets: { darkInk: '', lightInk: '' }, assignedBlankIds: [], isActive: true
  }
}

// --- NEW: Admin Filtering Logic ---
const adminFilter = ref({ search: '', breed: '', sport: '', customizable: '' })

// Extract unique values for the admin dropdowns
const adminUniqueBreeds = computed(() => [...new Set(designs.value.flatMap(d => d.breeds || []))].sort())
const adminUniqueSports = computed(() => [...new Set(designs.value.flatMap(d => d.sports || []))].sort())

const filteredDesigns = computed(() => {
  return designs.value.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(adminFilter.value.search.toLowerCase())
    const matchBreed = adminFilter.value.breed === '' || (d.breeds && d.breeds.includes(adminFilter.value.breed))
    const matchSport = adminFilter.value.sport === '' || (d.sports && d.sports.includes(adminFilter.value.sport))
    const matchCustom = adminFilter.value.customizable === '' || 
                        (adminFilter.value.customizable === 'yes' && d.isCustomizable) || 
                        (adminFilter.value.customizable === 'no' && !d.isCustomizable)
    return matchSearch && matchBreed && matchSport && matchCustom
  })
})
</script>


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
        <label>Taxonomy & Tags (Search or Add New)</label>
        
        <div class="unified-tags-display" style="margin-bottom: 10px; min-height: 32px; padding: 5px; border: 1px dashed #ccc; border-radius: 6px;">
          <span v-for="breed in currentDesign.breeds" :key="'b-'+breed" class="tag tag-breed">
            {{ breed }} <button type="button" @click="removeTag(breed, 'breed')" style="background:none;border:none;color:white;cursor:pointer;padding:0 0 0 5px;">&times;</button>
          </span>
          <span v-for="sport in currentDesign.sports" :key="'s-'+sport" class="tag tag-sport">
            {{ sport }} <button type="button" @click="removeTag(sport, 'sport')" style="background:none;border:none;color:white;cursor:pointer;padding:0 0 0 5px;">&times;</button>
          </span>
          <span v-for="keyword in currentDesign.keywords" :key="'k-'+keyword" class="tag tag-keyword">
            {{ keyword }} <button type="button" @click="removeTag(keyword, 'keyword')" style="background:none;border:none;color:white;cursor:pointer;padding:0 0 0 5px;">&times;</button>
          </span>
          <span v-if="!currentDesign.breeds?.length && !currentDesign.sports?.length && !currentDesign.keywords?.length" style="color: #999; font-size: 0.9em; padding: 4px;">No tags added yet.</span>
        </div>

        <div class="autocomplete-wrapper">
          <input 
            v-model="tagInput" 
            @focus="showSuggestions = true"
            type="text" 
            placeholder="Type a breed, sport, or keyword..." 
            autocomplete="off"
          />
          
          <div v-if="showSuggestions && tagInput" class="autocomplete-dropdown">
            <div 
              v-for="tag in filteredSuggestions" 
              :key="tag.type + tag.text" 
              class="autocomplete-item"
              @click="addTag(tag.text, tag.type)"
            >
              <span>{{ tag.text }}</span>
              <span :class="['tag', `tag-${tag.type}`]" style="font-size: 0.7em;">{{ tag.type }}</span>
            </div>
            
            <div v-if="!exactMatchExists" style="border-top: 2px solid #1A1A1A;">
              <div class="autocomplete-action" @click="addTag(tagInput, 'breed')">
                <strong>+ Add</strong> "{{ tagInput }}" as <span class="tag tag-breed" style="font-size: 0.7em;">Breed</span>
              </div>
              <div class="autocomplete-action" @click="addTag(tagInput, 'sport')">
                <strong>+ Add</strong> "{{ tagInput }}" as <span class="tag tag-sport" style="font-size: 0.7em;">Sport</span>
              </div>
              <div class="autocomplete-action" @click="addTag(tagInput, 'keyword')">
                <strong>+ Add</strong> "{{ tagInput }}" as <span class="tag tag-keyword" style="font-size: 0.7em;">Keyword</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: normal;">
          <input v-model="currentDesign.isCustomizable" type="checkbox" />
          <strong>Design is Customizable</strong> (e.g., allows custom text or swappable elements)
        </label>
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

    <div class="design-list" style="margin-top: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3>Manage Designs ({{ filteredDesigns.length }})</h3>
      </div>

      <div style="display: flex; gap: 10px; margin-bottom: 20px; background: #f1f2f6; padding: 15px; border-radius: 8px; border: 2px solid #1A1A1A;">
        <input v-model="adminFilter.search" type="text" placeholder="Search titles..." style="flex: 2;" />
        
        <select v-model="adminFilter.breed" style="flex: 1; padding: 10px; border-radius: 6px; border: 2px solid #ccc;">
          <option value="">All Breeds</option>
          <option v-for="breed in adminUniqueBreeds" :key="breed" :value="breed">{{ breed }}</option>
        </select>
        
        <select v-model="adminFilter.sport" style="flex: 1; padding: 10px; border-radius: 6px; border: 2px solid #ccc;">
          <option value="">All Sports</option>
          <option v-for="sport in adminUniqueSports" :key="sport" :value="sport">{{ sport }}</option>
        </select>

        <select v-model="adminFilter.customizable" style="flex: 1; padding: 10px; border-radius: 6px; border: 2px solid #ccc;">
          <option value="">Customizable: Any</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Taxonomy</th>
            <th>Customizable</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="design in filteredDesigns" :key="design.id">
            <td><strong>{{ design.title }}</strong></td>
            <td>
              <div style="font-size: 0.8rem; color: #555;">
                <span v-if="design.breeds?.length"><strong>Breeds:</strong> {{ design.breeds.join(', ') }}<br/></span>
                <span v-if="design.sports?.length"><strong>Sports:</strong> {{ design.sports.join(', ') }}</span>
              </div>
            </td>
            <td>
              <span v-if="design.isCustomizable" class="tag" style="background: var(--accent);">Yes</span>
              <span v-else style="color: #999; font-size: 0.8rem;">No</span>
            </td>
            <td>
              <button @click="editDesign(design)" class="btn-secondary" style="font-size: 0.8rem; padding: 5px 10px; margin-right: 5px;">Edit</button>
              <button @click="deleteDesign(design.id)" class="text-danger">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filteredDesigns.length === 0" style="padding: 20px; text-align: center; color: #666;">No designs match your filters.</div>
    </div>
  </div>
</template>



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