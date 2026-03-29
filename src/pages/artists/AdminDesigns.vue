<script setup>
import { getAuth } from 'firebase/auth'
import { ref, onMounted, computed } from 'vue'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
import { useRoute, useRouter } from 'vue-router'

const FONT_STYLE_OPTIONS = [
  { value: 'block', label: 'Blocky' },
  { value: 'cursive', label: 'Cursive' },
  { value: 'handwritten', label: 'Handwritten' },
]

const getDefaultCustomization = () => ({
  notesEnabled: true,
  textFields: []
})

const getDefaultTextField = (index) => ({
  id: `text_${Date.now()}_${index}`,
  label: `Text Area ${index + 1}`,
  placeholder: '',
  characterLimit: 20,
  fontStyle: 'block',
  area: { top: 35, left: 20, width: 60, height: 16 }
})

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
const currentUserUid = ref(null)
const assetVariantMode = ref('two')
const textFieldModal = ref({
  isOpen: false,
  fieldRef: null,
  imageUrl: '',
  area: { top: 35, left: 20, width: 60, height: 16 }
})
const textCanvasRef = ref(null)
let isDraggingTextField = false
let isResizingTextField = false
let textStartX = 0
let textStartY = 0
let textInitialTop = 0
let textInitialLeft = 0
let textInitialWidth = 0
let textInitialHeight = 0

const currentDesign = ref({
  id: null,
  title: '',
  description: '',
  isAiAssisted: null,
  customization: getDefaultCustomization(),
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
  const auth = getAuth()
  currentUserUid.value = auth.currentUser?.uid
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
  single: 0,
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

      if (assetType === 'single') {
        currentDesign.value.assets.darkInk = downloadURL
        currentDesign.value.assets.lightInk = downloadURL
      } else {
        currentDesign.value.assets[assetType] = downloadURL
      }

      uploadProgress.value[assetType] = 0 // Reset progress text
    }
  )
}

const setAssetVariantMode = (mode) => {
  assetVariantMode.value = mode

  if (mode === 'one') {
    // Keep data shape stable: one uploaded image is used for both use cases.
    if (currentDesign.value.assets.darkInk && !currentDesign.value.assets.lightInk) {
      currentDesign.value.assets.lightInk = currentDesign.value.assets.darkInk
    } else if (currentDesign.value.assets.lightInk && !currentDesign.value.assets.darkInk) {
      currentDesign.value.assets.darkInk = currentDesign.value.assets.lightInk
    }
  }
}

const hasSingleAsset = computed(() => !!(currentDesign.value.assets.darkInk || currentDesign.value.assets.lightInk))
const customizationPreviewAsset = computed(() => currentDesign.value.assets.darkInk || currentDesign.value.assets.lightInk || '')

const addCustomizationField = () => {
  if (!currentDesign.value.customization) {
    currentDesign.value.customization = getDefaultCustomization()
  }

  if (currentDesign.value.customization.textFields.length >= 3) return

  currentDesign.value.customization.textFields.push(getDefaultTextField(currentDesign.value.customization.textFields.length))
}

const removeCustomizationField = (fieldId) => {
  currentDesign.value.customization.textFields = currentDesign.value.customization.textFields.filter(field => field.id !== fieldId)
}

const openTextFieldModal = (field) => {
  if (!customizationPreviewAsset.value) return
  textFieldModal.value.fieldRef = field
  textFieldModal.value.imageUrl = customizationPreviewAsset.value
  textFieldModal.value.area = { ...field.area }
  textFieldModal.value.isOpen = true
}

const closeTextFieldModal = () => {
  textFieldModal.value.isOpen = false
}

const saveTextFieldArea = () => {
  if (textFieldModal.value.fieldRef) {
    textFieldModal.value.fieldRef.area = { ...textFieldModal.value.area }
  }
  closeTextFieldModal()
}

const startTextFieldDrag = (event) => {
  if (isResizingTextField) return
  isDraggingTextField = true
  textStartX = event.clientX || event.touches?.[0].clientX
  textStartY = event.clientY || event.touches?.[0].clientY
  textInitialTop = textFieldModal.value.area.top
  textInitialLeft = textFieldModal.value.area.left
  window.addEventListener('mousemove', onTextFieldDrag)
  window.addEventListener('mouseup', stopTextFieldDrag)
}

const onTextFieldDrag = (event) => {
  if (!isDraggingTextField || !textCanvasRef.value) return
  const currentX = event.clientX || event.touches?.[0].clientX
  const currentY = event.clientY || event.touches?.[0].clientY
  const rect = textCanvasRef.value.getBoundingClientRect()
  textFieldModal.value.area.left = Math.max(0, Math.min(100 - textFieldModal.value.area.width, textInitialLeft + (((currentX - textStartX) / rect.width) * 100)))
  textFieldModal.value.area.top = Math.max(0, Math.min(100 - textFieldModal.value.area.height, textInitialTop + (((currentY - textStartY) / rect.height) * 100)))
}

const stopTextFieldDrag = () => {
  isDraggingTextField = false
  window.removeEventListener('mousemove', onTextFieldDrag)
  window.removeEventListener('mouseup', stopTextFieldDrag)
}

const startTextFieldResize = (event) => {
  event.stopPropagation()
  isResizingTextField = true
  textStartX = event.clientX || event.touches?.[0].clientX
  textStartY = event.clientY || event.touches?.[0].clientY
  textInitialWidth = textFieldModal.value.area.width
  textInitialHeight = textFieldModal.value.area.height
  window.addEventListener('mousemove', onTextFieldResize)
  window.addEventListener('mouseup', stopTextFieldResize)
}

const onTextFieldResize = (event) => {
  if (!isResizingTextField || !textCanvasRef.value) return
  const currentX = event.clientX || event.touches?.[0].clientX
  const currentY = event.clientY || event.touches?.[0].clientY
  const rect = textCanvasRef.value.getBoundingClientRect()
  const nextWidth = textInitialWidth + (((currentX - textStartX) / rect.width) * 100)
  const nextHeight = textInitialHeight + (((currentY - textStartY) / rect.height) * 100)
  textFieldModal.value.area.width = Math.max(10, Math.min(100 - textFieldModal.value.area.left, nextWidth))
  textFieldModal.value.area.height = Math.max(8, Math.min(100 - textFieldModal.value.area.top, nextHeight))
}

const stopTextFieldResize = () => {
  isResizingTextField = false
  window.removeEventListener('mousemove', onTextFieldResize)
  window.removeEventListener('mouseup', stopTextFieldResize)
}

const saveDesign = async () => {
  const auth = getAuth()
  const user = auth.currentUser

  if (!user) {
    alert('You must be logged in to save designs. Please sign in again.')
    return
  }

  // Refresh token to avoid stale-session permission issues.
  await user.getIdToken(true)

  try {
    if (assetVariantMode.value === 'one') {
      const sharedAsset = currentDesign.value.assets.darkInk || currentDesign.value.assets.lightInk
      if (sharedAsset) {
        currentDesign.value.assets.darkInk = sharedAsset
        currentDesign.value.assets.lightInk = sharedAsset
      }
    }

    if (isEditing.value) {
      const docRef = doc(db, 'designs', currentDesign.value.id)
      const dataToUpdate = { ...currentDesign.value }
      if (!dataToUpdate.ownerId) {
        dataToUpdate.ownerId = user.uid
      }
      delete dataToUpdate.id // Don't write the ID to the document fields
      await updateDoc(docRef, dataToUpdate)
    } else {
      const dataToAdd = { 
        ...currentDesign.value, 
        createdAt: new Date(),
        ownerId: user.uid // <-- Stamps the creator's UID
      }
      delete dataToAdd.id
      await addDoc(designsCollection, dataToAdd)
    }
    await fetchDesigns()
    resetForm()
  } catch (error) {
    console.error("Error saving design: ", error)
    const details = error?.code ? `${error.code}: ${error.message}` : (error?.message || 'Unknown error')
    if (error?.code === 'permission-denied') {
      alert(`Save blocked by Firestore permissions.\n\n${details}\n\nTry signing out/in and reloading. If it persists, verify deployed Firestore rules for the active project.`)
      return
    }
    alert(`Failed to save design.\n\n${details}`)
  }
}

const editDesign = (design) => {
  const darkInkAsset = design.assets?.darkInk || ''
  const lightInkAsset = design.assets?.lightInk || ''

  if ((darkInkAsset && !lightInkAsset) || (!darkInkAsset && lightInkAsset) || (darkInkAsset && lightInkAsset && darkInkAsset === lightInkAsset)) {
    assetVariantMode.value = 'one'
  } else {
    assetVariantMode.value = 'two'
  }

  currentDesign.value = { 
    ...design,
    // Add fallbacks for older documents that lack these fields
    isAiAssisted: typeof design.isAiAssisted === 'boolean' ? design.isAiAssisted : false,
    customization: {
      ...getDefaultCustomization(),
      ...(design.customization || {}),
      textFields: (design.customization?.textFields || []).map((field, index) => ({
        ...getDefaultTextField(index),
        ...field,
        area: {
          ...getDefaultTextField(index).area,
          ...(field.area || {})
        }
      }))
    },
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
  assetVariantMode.value = 'two'
  currentDesign.value = {
    id: null, title: '', description: '', isAiAssisted: null, customization: getDefaultCustomization(), keywords: [], breeds: [], sports: [], 
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
        
        <div class="unified-tags-display">
          <span v-for="breed in currentDesign.breeds" :key="'b-'+breed" class="tag tag-breed">
            {{ breed }} <button type="button" @click="removeTag(breed, 'breed')" class="btn-remove">&times;</button>
          </span>
          <span v-for="sport in currentDesign.sports" :key="'s-'+sport" class="tag tag-sport">
            {{ sport }} <button type="button" @click="removeTag(sport, 'sport')" class="btn-remove">&times;</button>
          </span>
          <span v-for="keyword in currentDesign.keywords" :key="'k-'+keyword" class="tag tag-keyword">
            {{ keyword }} <button type="button" @click="removeTag(keyword, 'keyword')" class="btn-remove">&times;</button>
          </span>
          <span v-if="!currentDesign.breeds?.length && !currentDesign.sports?.length && !currentDesign.keywords?.length" class="empty-tags-text">No tags added yet.</span>
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
              <span :class="['tag', `tag-${tag.type}`, 'tag-type-pill']">{{ tag.type }}</span>
            </div>
            
            <div v-if="!exactMatchExists" class="autocomplete-create-divider">
              <div class="autocomplete-action" @click="addTag(tagInput, 'breed')">
                <strong>+ Add</strong> "{{ tagInput }}" as <span class="tag tag-breed tag-type-pill">Breed</span>
              </div>
              <div class="autocomplete-action" @click="addTag(tagInput, 'sport')">
                <strong>+ Add</strong> "{{ tagInput }}" as <span class="tag tag-sport tag-type-pill">Sport</span>
              </div>
              <div class="autocomplete-action" @click="addTag(tagInput, 'keyword')">
                <strong>+ Add</strong> "{{ tagInput }}" as <span class="tag tag-keyword tag-type-pill">Keyword</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>AI-Assisted Design?</label>
        <div class="ai-radio-group">
          <label class="ai-radio-option">
            <input v-model="currentDesign.isAiAssisted" type="radio" :value="true" required />
            Yes I did use AI
          </label>
          <label class="ai-radio-option">
            <input v-model="currentDesign.isAiAssisted" type="radio" :value="false" required />
            No I did not
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="customizable-label">
          <input v-model="currentDesign.isCustomizable" type="checkbox" />
          <strong>Design is Customizable</strong> (e.g., allows custom text or swappable elements)
        </label>
      </div>

      <div v-if="currentDesign.isCustomizable" class="form-group customization-builder">
        <div class="customization-header-row">
          <label>Customization Setup</label>
          <button
            type="button"
            class="btn-secondary compact-btn"
            @click="addCustomizationField"
            :disabled="currentDesign.customization.textFields.length >= 3"
          >
            + Add Text Area
          </button>
        </div>

        <p class="customization-help-text">
          Add up to three text areas. Position each box over the design asset so customers can preview where their text will appear.
        </p>

        <label class="customizable-label customization-notes-toggle">
          <input v-model="currentDesign.customization.notesEnabled" type="checkbox" />
          <strong>Enable customer notes</strong> (for special instructions or non-text customization details)
        </label>

        <p v-if="!customizationPreviewAsset" class="customization-warning">
          Upload at least one design asset before positioning customization fields.
        </p>

        <div v-if="currentDesign.customization.textFields.length === 0" class="customization-empty-state">
          No text areas configured yet.
        </div>

        <div v-for="(field, fieldIndex) in currentDesign.customization.textFields" :key="field.id" class="customization-field-card">
          <div class="customization-field-grid">
            <div>
              <label>Field Label</label>
              <input v-model="field.label" type="text" placeholder="e.g., Dog Name" />
            </div>
            <div>
              <label>Placeholder (optional)</label>
              <input v-model="field.placeholder" type="text" placeholder="e.g., Champion" />
            </div>
            <div>
              <label>Character Limit</label>
              <input v-model.number="field.characterLimit" type="number" min="1" max="100" />
            </div>
            <div>
              <label>Font Style</label>
              <select v-model="field.fontStyle">
                <option v-for="font in FONT_STYLE_OPTIONS" :key="font.value" :value="font.value">{{ font.label }}</option>
              </select>
            </div>
          </div>

          <div class="customization-field-actions">
            <span class="customization-field-meta">Text Area {{ fieldIndex + 1 }}: top {{ Math.round(field.area.top) }}%, left {{ Math.round(field.area.left) }}%, width {{ Math.round(field.area.width) }}%, height {{ Math.round(field.area.height) }}%</span>
            <div class="customization-field-buttons">
              <button type="button" class="btn-secondary compact-btn" :disabled="!customizationPreviewAsset" @click="openTextFieldModal(field)">Position Field</button>
              <button type="button" class="text-danger" @click="removeCustomizationField(field.id)">Remove</button>
            </div>
          </div>
        </div>
      </div>

      <div class="form-group blanks-assignment">
        <label>Assign Blanks to Design</label>
        
        <div class="filter-controls">
          <input v-model="blankSearchQuery" type="text" placeholder="Search blanks..." class="filter-search-input" />
          <select v-model="selectedCategory" class="filter-category-select">
            <option value="">All Categories</option>
            <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div class="blanks-list">
          <div v-for="blank in filteredBlanks" :key="blank.id" class="blank-row">
            <label class="blank-label">
              <input 
                type="checkbox" 
                :value="blank.id" 
                v-model="currentDesign.assignedBlankIds"
              />
              {{ blank.name }}
              <span class="tag blank-category-tag">{{ blank.category }} &gt; {{ blank.subCategory }}</span>
              <span v-if="!blank.isPublic" class="blank-private">(Private)</span>
            </label>
          </div>
          <p v-if="filteredBlanks.length === 0" class="no-blanks-text">No blanks match your filters.</p>
        </div>
      </div>

      <div class="form-group">
        <label>Design Asset Variants</label>
        <div class="asset-mode-toggle">
          <label class="asset-mode-option">
            <input type="radio" name="assetVariantMode" value="one" :checked="assetVariantMode === 'one'" @change="setAssetVariantMode('one')" />
            One file (use for both light/dark backgrounds)
          </label>
          <label class="asset-mode-option">
            <input type="radio" name="assetVariantMode" value="two" :checked="assetVariantMode === 'two'" @change="setAssetVariantMode('two')" />
            Two files (separate dark-ink and light-ink assets)
          </label>
        </div>

        <div v-if="assetVariantMode === 'one'" class="asset-upload-panel">
          <label class="asset-upload-label">Upload Shared Asset</label>
          <input type="file" accept="image/png, image/jpeg" @change="(e) => handleFileUpload(e, 'single')" />
          <p v-if="uploadProgress.single">Uploading: {{ uploadProgress.single }}%</p>
          <p v-if="hasSingleAsset" class="success-text">File attached! This image will be used for both asset fields.</p>
        </div>

        <template v-else>
          <div class="asset-upload-panel">
            <label class="asset-upload-label">Upload Asset (Dark Ink for Light Backgrounds)</label>
            <input type="file" accept="image/png, image/jpeg" @change="(e) => handleFileUpload(e, 'darkInk')" />
            <p v-if="uploadProgress.darkInk">Uploading: {{ uploadProgress.darkInk }}%</p>
            <p v-if="currentDesign.assets.darkInk" class="success-text">Dark-ink file attached.</p>
          </div>

          <div class="asset-upload-panel">
            <label class="asset-upload-label">Upload Asset (Light Ink for Dark Backgrounds)</label>
            <input type="file" accept="image/png, image/jpeg" @change="(e) => handleFileUpload(e, 'lightInk')" />
            <p v-if="uploadProgress.lightInk">Uploading: {{ uploadProgress.lightInk }}%</p>
            <p v-if="currentDesign.assets.lightInk" class="success-text">Light-ink file attached.</p>
          </div>
        </template>
      </div>

      <button type="submit" class="btn-primary">
        {{ isEditing ? 'Update Design' : 'Add New Design' }}
      </button>
      <button v-if="isEditing" @click="resetForm" type="button" class="btn-secondary">Cancel</button>
    </form>

    <hr />

    <div class="design-list">
      <div class="design-list-header">
        <h3>Manage Designs ({{ filteredDesigns.length }})</h3>
      </div>

      <div class="admin-filters">
        <input v-model="adminFilter.search" type="text" placeholder="Search titles..." class="admin-search-input" />
        
        <select v-model="adminFilter.breed" class="admin-filter-select">
          <option value="">All Breeds</option>
          <option v-for="breed in adminUniqueBreeds" :key="breed" :value="breed">{{ breed }}</option>
        </select>
        
        <select v-model="adminFilter.sport" class="admin-filter-select">
          <option value="">All Sports</option>
          <option v-for="sport in adminUniqueSports" :key="sport" :value="sport">{{ sport }}</option>
        </select>

        <select v-model="adminFilter.customizable" class="admin-filter-select">
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
            <template v-if="design.ownerId === currentUserUid">
              <td><strong>{{ design.title }}</strong></td>
              <td>
                <div class="taxonomy-cell">
                  <span v-if="design.breeds?.length"><strong>Breeds:</strong> {{ design.breeds.join(', ') }}<br/></span>
                  <span v-if="design.sports?.length"><strong>Sports:</strong> {{ design.sports.join(', ') }}</span>
                </div>
              </td>
              <td>
                <span v-if="design.isCustomizable" class="tag customizable-yes">Yes</span>
                <span v-else class="customizable-no">No</span>
              </td>
              <td>
                <button @click="editDesign(design)" class="btn-secondary compact-btn">Edit</button>
                <button @click="deleteDesign(design.id)" class="text-danger">Delete</button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
      <div v-if="filteredDesigns.length === 0" class="empty-designs-message">No designs match your filters.</div>
    </div>
  </div>

  <div v-if="textFieldModal.isOpen" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Position Text Area</h3>
        <button type="button" @click="closeTextFieldModal" class="text-danger close-modal-btn">&times;</button>
      </div>

      <p class="modal-instructions">Drag the box to position it. Drag the bottom-right corner to resize it.</p>

      <div class="text-canvas-container" ref="textCanvasRef">
        <img :src="textFieldModal.imageUrl" alt="Design asset preview" class="text-canvas-image" />
        <div
          class="text-field-box"
          :style="{ top: `${textFieldModal.area.top}%`, left: `${textFieldModal.area.left}%`, width: `${textFieldModal.area.width}%`, height: `${textFieldModal.area.height}%` }"
          @mousedown="startTextFieldDrag"
        >
          <span class="text-field-box-label">Custom Text</span>
          <div class="resize-handle" @mousedown="startTextFieldResize"></div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" @click="closeTextFieldModal" class="btn-secondary">Cancel</button>
        <button type="button" @click="saveTextFieldArea" class="btn-primary">Save Position</button>
      </div>
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
.btn-remove { 
  background:none;
  border:none;
  color:white;
  cursor:pointer;
  padding:0 0 0 5px;
}
.unified-tags-display {
  margin-bottom: 10px;
  min-height: 32px;
  padding: 5px;
  border: 1px dashed #ccc;
  border-radius: 6px;
}
.empty-tags-text {
  color: #999;
  font-size: 0.9em;
  padding: 4px;
}
.tag-type-pill {
  font-size: 0.7em;
}
.autocomplete-create-divider {
  border-top: 2px solid #1A1A1A;
}
.customizable-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}
.ai-radio-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.ai-radio-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: normal;
  margin: 0;
  cursor: pointer;
}
.customization-builder {
  border: 1px dashed #ccc;
  border-radius: 8px;
  padding: 14px;
  background: #fafafa;
}
.customization-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.customization-help-text,
.customization-warning,
.customization-empty-state {
  margin: 0 0 12px 0;
  color: #666;
  font-size: 0.9rem;
}
.customization-warning {
  color: #a15c00;
}
.customization-notes-toggle {
  margin-bottom: 12px;
}
.customization-field-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  background: white;
  margin-bottom: 12px;
}
.customization-field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.customization-field-actions {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.customization-field-meta {
  color: #666;
  font-size: 0.85rem;
}
.customization-field-buttons {
  display: flex;
  gap: 8px;
}
.filter-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}
.filter-search-input {
  flex: 2;
}
.filter-category-select {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 2px solid #1A1A1A;
}
.blanks-list {
  max-height: 200px;
  overflow-y: auto;
  border: 2px solid #ccc;
  padding: 10px;
  border-radius: 6px;
  background: #fafafa;
}
.blank-row {
  margin-bottom: 8px;
}
.blank-label {
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.blank-category-tag {
  font-size: 0.7rem;
  padding: 2px 6px;
}
.blank-private {
  color: #C0392B;
  font-size: 0.8rem;
  font-weight: bold;
}
.no-blanks-text {
  color: #666;
  font-size: 0.9em;
}
.design-list {
  margin-top: 40px;
}
.design-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.admin-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  background: #f1f2f6;
  padding: 15px;
  border-radius: 8px;
  border: 2px solid #1A1A1A;
}
.admin-search-input {
  flex: 2;
}
.admin-filter-select {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: 2px solid #ccc;
}
.taxonomy-cell {
  font-size: 0.8rem;
  color: #555;
}
.customizable-yes {
  background: var(--accent);
}
.customizable-no {
  color: #999;
  font-size: 0.8rem;
}
.compact-btn {
  font-size: 0.8rem;
  padding: 5px 10px;
  margin-right: 5px;
}
.empty-designs-message {
  padding: 20px;
  text-align: center;
  color: #666;
}
.asset-mode-toggle {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px;
}
.asset-mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  margin: 0;
  cursor: pointer;
}
.asset-upload-panel {
  border: 1px dashed #ccc;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 10px;
}
.asset-upload-label {
  margin-bottom: 8px;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}
.modal-content {
  background: white;
  padding: 25px;
  border-radius: 12px;
  width: 100%;
  max-width: 700px;
  border: 4px solid #1A1A1A;
  box-shadow: 8px 8px 0px rgba(0,0,0,1);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.close-modal-btn {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
}
.modal-instructions {
  font-size: 0.9rem;
  color: #666;
}
.text-canvas-container {
  position: relative;
  width: 100%;
  border: 2px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f2f6;
  margin-top: 12px;
}
.text-canvas-image {
  width: 100%;
  display: block;
}
.text-field-box {
  position: absolute;
  border: 2px dashed #1A1A1A;
  background: rgba(30, 144, 255, 0.22);
  cursor: move;
  display: flex;
  align-items: center;
  justify-content: center;
}
.text-field-box-label {
  font-size: 0.8rem;
  font-weight: bold;
  color: #1A1A1A;
  pointer-events: none;
}
.resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 15px;
  height: 15px;
  background: var(--primary);
  border: 2px solid white;
  border-radius: 50%;
  cursor: nwse-resize;
}
.modal-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>