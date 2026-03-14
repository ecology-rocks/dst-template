<template>
  <div class="admin-container">
    <h2>Product Blanks Management</h2>
    
    <form @submit.prevent="saveBlank" class="design-form">
      
      <div class="form-section">
        <h3>1. Basic Information</h3>
        <div class="form-group">
          <label>Blank Name</label>
          <input v-model="currentBlank.name" type="text" required placeholder="e.g., Gildan 64000" />
        </div>

        <div class="form-group" style="display: flex; gap: 15px;">
          <div style="flex: 1;">
            <label>Parent Category</label>
            <select v-model="currentBlank.category" @change="currentBlank.subCategory = ''" required>
              <option value="" disabled>Select Category</option>
              <option v-for="(subs, parent) in categoryMap" :key="parent" :value="parent">{{ parent }}</option>
            </select>
          </div>
          <div style="flex: 1;">
            <label>Sub-Category</label>
            <select v-model="currentBlank.subCategory" :disabled="!currentBlank.category" required>
              <option value="" disabled>Select Type</option>
              <option v-for="sub in categoryMap[currentBlank.category]" :key="sub" :value="sub">{{ sub }}</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="display: flex; align-items: center; justify-content: space-between;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: normal;">
            <input v-model="currentBlank.isPublic" type="checkbox" />
            <strong>Make Public</strong> (Available to other platform artists)
          </label>
        </div>

        <div class="form-group">
          <label>Default Photo (For Catalog Display)</label>
          <input v-if="!currentBlank.defaultPhotoUrl" type="file" accept="image/png, image/jpeg, image/webp" @change="uploadDefaultPhoto" />
          <div v-else style="display: flex; align-items: center; gap: 10px;">
            <img :src="currentBlank.defaultPhotoUrl" alt="Default" style="height: 50px; border-radius: 4px;" />
            <button type="button" @click="currentBlank.defaultPhotoUrl = ''" class="text-danger" style="background:none; border:none; cursor:pointer;">Remove</button>
          </div>
          <p v-if="uploadProgress.default > 0" class="progress-text">Uploading: {{ uploadProgress.default }}%</p>
        </div>

        <div class="form-group">
          <label>Product Description</label>
          <div class="editor-wrapper">
            <QuillEditor theme="snow" v-model:content="currentBlank.description" contentType="html" toolbar="essential" />
          </div>
        </div>

        <div class="form-group">
          <label>Sizing Information (Copy & Paste tables from Excel/Sheets!)</label>
          <div class="editor-wrapper">
            <QuillEditor theme="snow" v-model:content="currentBlank.sizingInfo" contentType="html" toolbar="full" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3>2. Variants & Colors</h3>
          <button type="button" @click="addVariant" class="btn-secondary" style="font-size: 0.8rem;">+ Add Variant</button>
        </div>

        <div v-for="(variant, index) in currentBlank.variants" :key="index" class="variant-card">
          <div class="variant-header">
            <strong>Variant {{ index + 1 }}</strong>
            <button type="button" @click="removeVariant(index)" class="text-danger" style="background: none; border: none; cursor: pointer;">Remove</button>
          </div>
          
          <div class="variant-grid">
            <div>
              <label>Color Name</label>
              <input v-model="variant.color" type="text" placeholder="e.g., Heather Grey" required />
            </div>
            <div>
              <label>Min Size</label>
              <input v-model="variant.minSize" type="text" placeholder="e.g., S" required />
            </div>
            <div>
              <label>Max Size</label>
              <input v-model="variant.maxSize" type="text" placeholder="e.g., 3XL" required />
            </div>
            <div>
              <label>Ink Tone</label>
              <select v-model="variant.tone">
                <option value="darkGarment">Dark Garment (Needs Light Ink)</option>
                <option value="lightGarment">Light Garment (Needs Dark Ink)</option>
              </select>
            </div>
            <div>
              <label>Base Price ($)</label>
              <input v-model.number="variant.basePriceDisplay" @input="updateCents(variant)" type="number" step="0.01" min="0" placeholder="15.00" required />
            </div>
          </div>

          <div class="variant-images">
            <label>Variant Photos (Max 8)</label>
            <input v-if="variant.mockups.length < 8" type="file" multiple accept="image/png, image/jpeg, image/webp" @change="(e) => uploadVariantPhotos(e, index)" />
            <p v-if="uploadProgress[`variant_${index}`] > 0" class="progress-text">Uploading... {{ uploadProgress[`variant_${index}`] }}%</p>
            
            <div class="image-preview-row">
              <div v-for="(mockup, imgIndex) in variant.mockups" :key="imgIndex" class="image-thumbnail">
                <img :src="mockup.url" />
                <button type="button" @click="variant.mockups.splice(imgIndex, 1)" class="delete-img">x</button>
                <button type="button" @click="openPositionModal(mockup)" class="position-btn">Set Area</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" style="font-size: 1.1rem; padding: 12px 24px;">
          {{ isEditing ? 'Update Blank' : 'Save New Blank' }}
        </button>
        <button v-if="isEditing" @click="resetForm" type="button" class="btn-secondary">Cancel</button>
      </div>
    </form>
    
    <hr style="margin: 40px 0;" />
    
    <h3>Saved Blanks</h3>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Variants</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="blank in blanks" :key="blank.id">
          <td>{{ blank.name }}</td>
          <td>{{ blank.category }} > {{ blank.subCategory }}</td>
          <td>{{ blank.variants?.length || 0 }}</td>
          <td>
            <button @click="editBlank(blank)" style="margin-right: 10px;">Edit</button>
            <button @click="deleteBlank(blank.id)" class="text-danger" style="background:none; border:none; cursor:pointer;">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-if="modalState.isOpen" class="modal-overlay">
    <div class="modal-content">
      <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
        <h3>Set Print Area</h3>
        <button type="button" @click="closeModal" class="text-danger" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
      </div>
      
      <p style="font-size: 0.9em; color: #666; margin-bottom: 15px;">Drag the box to position. Drag the bottom-right corner to scale.</p>

      <div class="canvas-container" ref="canvasRef">
        <img :src="modalState.url" alt="Mockup" class="canvas-bg" />
        
        <div 
          class="print-area-box"
          :style="{ 
            top: modalState.area.top + '%', 
            left: modalState.area.left + '%', 
            width: modalState.area.width + '%' 
          }"
          @mousedown="startDrag"
        >
          <div class="resize-handle" @mousedown="startResize"></div>
          <span class="box-label">Print Area</span>
        </div>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
        <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
        <button type="button" @click="savePrintArea" class="btn-primary">Save Coordinates</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { db, storage } from '../firebase'
// Add these to your existing imports
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

const categoryMap = {
  'Apparel': ['T-shirts', 'Tanktops', 'Hoodies', 'Sweaters'],
  'Merch': ['Stickers', 'Pins', 'Magnets', 'Patches', 'Enamel Pins'],
  'Prints': ['Photos', 'Art Print', 'Canvas Print']
}

const blanksCollection = collection(db, 'blanks')
const blanks = ref([])
const isEditing = ref(false)
const uploadProgress = ref({ default: 0 })

const getEmptyVariant = () => ({
  color: '',
  minSize: '',
  maxSize: '',
  tone: 'darkGarment',
  basePrice: 0, 
  basePriceDisplay: null, 
  mockups: [] // <-- Changed from mockupUrls
})

const currentBlank = ref({
  id: null,
  name: '',
  category: '',
  subCategory: '',
  isPublic: true,
  defaultPhotoUrl: '',
  description: '', // <-- NEW
  sizingInfo: '',  // <-- NEW
  variants: [getEmptyVariant()],
  isActive: true
})

// Make sure to add them to your resetForm() function as well!

const fetchBlanks = async () => {
  const querySnapshot = await getDocs(blanksCollection)
  blanks.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

onMounted(fetchBlanks)

const addVariant = () => currentBlank.value.variants.push(getEmptyVariant())
const removeVariant = (index) => currentBlank.value.variants.splice(index, 1)

// Convert dollars to cents for safe database storage
const updateCents = (variant) => {
  if (variant.basePriceDisplay) {
    variant.basePrice = Math.round(variant.basePriceDisplay * 100)
  }
}

// Generate a clean SKU string
const generateSku = (blankName, colorName) => {
  const slugify = (str) => (str || '').toLowerCase().trim().replace(/[\s\W-]+/g, '-')
  return `${slugify(blankName)}-${slugify(colorName)}`
}

const uploadDefaultPhoto = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const fileRef = storageRef(storage, `blanks/default_${Date.now()}_${file.name}`)
  const uploadTask = uploadBytesResumable(fileRef, file)

  uploadTask.on('state_changed', 
    (snap) => uploadProgress.value.default = Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
    (err) => console.error(err),
    async () => {
      currentBlank.value.defaultPhotoUrl = await getDownloadURL(uploadTask.snapshot.ref)
      uploadProgress.value.default = 0
    }
  )
}

const uploadVariantPhotos = async (event, variantIndex) => {
  const files = Array.from(event.target.files)
  const variant = currentBlank.value.variants[variantIndex]
  
  if (variant.mockups.length + files.length > 8) {
    alert("Maximum of 8 photos allowed per variant.")
    return
  }

  uploadProgress.value[`variant_${variantIndex}`] = 1

  for (const file of files) {
    const fileRef = storageRef(storage, `blanks/variants/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(fileRef, file)
    
    await new Promise((resolve, reject) => {
      uploadTask.on('state_changed', null, reject, async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        // Push the new object schema with sensible defaults (centered, 30% width)
        variant.mockups.push({
          url: url,
          printArea: { top: 25, left: 35, width: 30 } 
        })
        resolve()
      })
    })
  }
  uploadProgress.value[`variant_${variantIndex}`] = 0
}

const saveBlank = async () => {
  const auth = getAuth()
  
  // Prep payload and auto-generate SKUs
  const payload = { ...currentBlank.value }
  payload.variants = payload.variants.map(v => {
    const cleanVariant = { ...v }
    delete cleanVariant.basePriceDisplay // Don't save the UI dollar value to DB
    cleanVariant.sku = generateSku(payload.name, cleanVariant.color)
    return cleanVariant
  })

  try {
    if (isEditing.value) {
      const docRef = doc(db, 'blanks', payload.id)
      delete payload.id
      await updateDoc(docRef, payload)
    } else {
      payload.ownerId = auth.currentUser.uid
      payload.createdAt = new Date()
      delete payload.id
      await addDoc(blanksCollection, payload)
    }
    await fetchBlanks()
    resetForm()
  } catch (error) {
    console.error("Error saving blank: ", error)
    alert("Failed to save blank.")
  }
}

const editBlank = (blank) => {
  currentBlank.value = { ...blank }
  // Map cents back to dollars for the UI
  currentBlank.value.variants = blank.variants.map(v => ({
    ...v,
    basePriceDisplay: v.basePrice ? (v.basePrice / 100).toFixed(2) : 0
  }))
  isEditing.value = true
}

const deleteBlank = async (id) => {
  if (confirm('Are you sure you want to delete this blank?')) {
    await deleteDoc(doc(db, 'blanks', id))
    await fetchBlanks()
  }
}

const resetForm = () => {
  isEditing.value = false
  currentBlank.value = {
    id: null,
    name: '',
    category: '',
    subCategory: '',
    description: '', // <-- NEW
    sizingInfo: '',  // <-- NEW
    isPublic: true,
    defaultPhotoUrl: '',
    variants: [getEmptyVariant()],
    isActive: true
  }
}

// --- Modal & Drag/Drop Logic ---
const modalState = ref({
  isOpen: false,
  mockupRef: null, // Keeps a reference to the exact array item we are editing
  url: '',
  area: { top: 0, left: 0, width: 0 }
})

const canvasRef = ref(null)
let isDragging = false
let isResizing = false
let startX = 0, startY = 0, initialTop = 0, initialLeft = 0, initialWidth = 0

const openPositionModal = (mockup) => {
  modalState.value.mockupRef = mockup
  modalState.value.url = mockup.url
  modalState.value.area = { ...mockup.printArea } // Clone so we can cancel without saving
  modalState.value.isOpen = true
}

const closeModal = () => {
  modalState.value.isOpen = false
}

const savePrintArea = () => {
  // Write the adjusted coordinates back to the original variant mockup object
  modalState.value.mockupRef.printArea = { ...modalState.value.area }
  closeModal()
}

// --- Dragging (Position) ---
const startDrag = (e) => {
  if (isResizing) return
  isDragging = true
  startX = e.clientX || e.touches?.[0].clientX
  startY = e.clientY || e.touches?.[0].clientY
  initialTop = modalState.value.area.top
  initialLeft = modalState.value.area.left
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

const onDrag = (e) => {
  if (!isDragging) return
  const currentX = e.clientX || e.touches?.[0].clientX
  const currentY = e.clientY || e.touches?.[0].clientY
  
  const rect = canvasRef.value.getBoundingClientRect()
  const percentX = ((currentX - startX) / rect.width) * 100
  const percentY = ((currentY - startY) / rect.height) * 100

  modalState.value.area.left = initialLeft + percentX
  modalState.value.area.top = initialTop + percentY
}

const stopDrag = () => {
  isDragging = false
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

// --- Resizing (Scale) ---
const startResize = (e) => {
  e.stopPropagation() // Don't trigger the drag handler
  isResizing = true
  startX = e.clientX || e.touches?.[0].clientX
  initialWidth = modalState.value.area.width
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', stopResize)
}

const onResize = (e) => {
  if (!isResizing) return
  const currentX = e.clientX || e.touches?.[0].clientX
  const rect = canvasRef.value.getBoundingClientRect()
  const percentX = ((currentX - startX) / rect.width) * 100
  
  // Prevent scaling below 5% width
  modalState.value.area.width = Math.max(5, initialWidth + percentX)
}

const stopResize = () => {
  isResizing = false
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', stopResize)
}
</script>

<style scoped>
.admin-container { max-width: 900px; margin: 0 auto; padding: 20px; }
.form-section { background: white; padding: 25px; border: 3px solid #1A1A1A; border-radius: var(--radius); margin-bottom: 25px; box-shadow: 4px 4px 0px rgba(0,0,0,0.1); }
.form-section h3 { margin-top: 0; color: var(--primary); border-bottom: 2px solid #f1f2f6; padding-bottom: 10px; }
.form-group { margin-bottom: 15px; }
label { display: block; font-weight: bold; margin-bottom: 5px; color: #1A1A1A; font-size: 0.9rem; }
select, input[type="text"], input[type="number"] { width: 100%; padding: 10px; border: 2px solid #ccc; border-radius: 6px; box-sizing: border-box; }
select:focus, input:focus { border-color: var(--secondary); outline: none; }

.variant-card { background: #f8f9fa; border: 2px dashed #ccc; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.variant-header { display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
.variant-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px; }
.variant-images { background: white; padding: 10px; border-radius: 6px; border: 1px solid #ddd; }

.image-preview-row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.image-thumbnail { position: relative; width: 60px; height: 60px; border: 1px solid #ccc; border-radius: 4px; }
.image-thumbnail img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.image-thumbnail button { position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 10px; line-height: 1; padding: 0; }

.progress-text { font-size: 0.8rem; color: var(--secondary); margin-top: 5px; font-weight: bold; }
table { width: 100%; border-collapse: collapse; background: white; border: 3px solid #1A1A1A; }
th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
th { background-color: #f1f2f6; font-weight: bold; }

/* Thumbnail overrides */
.image-thumbnail { position: relative; width: 100px; height: 100px; border: 1px solid #ccc; border-radius: 4px; display: flex; flex-direction: column; align-items: center; }
.image-thumbnail img { width: 100%; height: 70px; object-fit: cover; border-radius: 4px 4px 0 0; }
.delete-img { position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 10px; line-height: 1; padding: 0; }
.position-btn { width: 100%; height: 30px; background: var(--secondary); color: white; border: none; border-radius: 0 0 4px 4px; font-size: 0.7rem; font-weight: bold; cursor: pointer; }

/* Modal Styles */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 600px; border: 4px solid #1A1A1A; box-shadow: 8px 8px 0px rgba(0,0,0,1); }

/* Canvas Styles */
.canvas-container { position: relative; width: 100%; background: #f1f2f6; border: 2px solid #ccc; border-radius: 8px; overflow: hidden; user-select: none; }
.canvas-bg { width: 100%; display: block; object-fit: contain; pointer-events: none; }

.print-area-box { 
  position: absolute; 
  border: 2px dashed #1A1A1A; 
  background: rgba(30, 144, 255, 0.3); 
  aspect-ratio: 1 / 1.2; /* Approximates standard t-shirt print area ratio */
  cursor: move; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
}

.box-label { color: #1A1A1A; font-weight: bold; font-size: 0.8rem; pointer-events: none; opacity: 0.7; }

.resize-handle { 
  position: absolute; 
  bottom: -5px; 
  right: -5px; 
  width: 15px; 
  height: 15px; 
  background: var(--primary); 
  border: 2px solid white; 
  border-radius: 50%; 
  cursor: nwse-resize; 
}

/* Add these Quill overrides to your styles */
.editor-wrapper {
  margin-top: 5px;
}
.editor-wrapper :deep(.ql-toolbar) {
  border: 2px solid #1A1A1A !important;
  border-bottom: none !important;
  border-radius: 6px 6px 0 0;
  background-color: #f1f2f6;
  font-family: inherit;
}
.editor-wrapper :deep(.ql-container) {
  border: 2px solid #1A1A1A !important;
  border-radius: 0 0 6px 6px;
  min-height: 120px;
  font-family: inherit;
  font-size: 1rem;
  background: white;
}
.editor-wrapper :deep(.ql-editor:focus) {
  outline: none;
}
</style>