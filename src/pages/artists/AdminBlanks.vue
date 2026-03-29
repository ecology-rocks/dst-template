<script setup>
import { ref, onMounted } from 'vue'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { db, storage } from '../../firebase'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import AppModal from '@components/AppModal.vue'

// Add this near the top of your constants
const SIZE_PRESETS = {
  'XS to 5XL': [
    { name: 'XS', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: 'S', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: 'M', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: 'L', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: 'XL', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: '2XL', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: '3XL', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: '4XL', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: '5XL', priceOffset: 0, priceOffsetDisplay: 0 }
  ],
  'Youth Apparel': [
    { name: 'YS', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: 'YM', priceOffset: 0, priceOffsetDisplay: 0 },
    { name: 'YL', priceOffset: 0, priceOffsetDisplay: 0 }
  ],
  'One Size': [
    { name: 'One Size', priceOffset: 0, priceOffsetDisplay: 0 }
  ]
}

const currentUserUid = ref(null)

// Dialog modal state (replaces browser alert/confirm)
const dialog = ref({ isOpen: false, mode: 'alert', title: '', message: '', danger: false, confirmText: 'OK', cancelText: 'Cancel', resolve: null })
const openDialog = (options) => new Promise(resolve => {
  dialog.value = { isOpen: true, resolve, cancelText: 'Cancel', confirmText: 'OK', danger: false, ...options }
})
const onDialogConfirm = () => { dialog.value.isOpen = false; dialog.value.resolve?.(true) }
const onDialogCancel = () => { dialog.value.isOpen = false; dialog.value.resolve?.(false) }

// Function to apply a preset to a specific variant
const applyPreset = (variantIndex, presetName) => {
  const preset = SIZE_PRESETS[presetName]
  if (preset) {
    // We use structuredClone or a map to ensure we don't accidentally share references
    currentBlank.value.variants[variantIndex].sizes = preset.map(s => ({ ...s }))
    updateCents(currentBlank.value.variants[variantIndex])
  }
}

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
  tone: 'darkGarment',
  basePrice: 0, 
  basePriceDisplay: null, 
  sizes: [{ name: 'Default', priceOffsetDisplay: 0, priceOffset: 0 }], // <-- NEW SIZES ARRAY
  mockups: []
})

const currentBlank = ref({
  id: null,
  name: '',
  category: '',
  subCategory: '',
  description: '',
  sizingInfo: '',
  isPublic: true,
  defaultPhotoUrl: '',
  variants: [getEmptyVariant()],
  isActive: true
})

const fetchBlanks = async () => {
  const querySnapshot = await getDocs(blanksCollection)
  blanks.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

onMounted(() => {
  const auth = getAuth()
  currentUserUid.value = auth.currentUser?.uid
  fetchBlanks() 
})

const addVariant = () => currentBlank.value.variants.push(getEmptyVariant())
const removeVariant = (index) => currentBlank.value.variants.splice(index, 1)

// New Size Helpers
const addSize = (variantIndex) => {
  currentBlank.value.variants[variantIndex].sizes.push({ name: '', priceOffsetDisplay: 0, priceOffset: 0 })
}
const removeSize = (variantIndex, sizeIndex) => {
  currentBlank.value.variants[variantIndex].sizes.splice(sizeIndex, 1)
}

const updateCents = (variant) => {
  if (variant.basePriceDisplay !== null) variant.basePrice = Math.round(variant.basePriceDisplay * 100)
  if (variant.sizes) {
    variant.sizes.forEach(size => {
      if (size.priceOffsetDisplay !== null) size.priceOffset = Math.round(size.priceOffsetDisplay * 100)
    })
  }
}

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
    await openDialog({ mode: 'alert', title: 'Upload Limit', message: 'Maximum of 8 photos allowed per variant.' })
    return
  }

  uploadProgress.value[`variant_${variantIndex}`] = 1

  for (const file of files) {
    const fileRef = storageRef(storage, `blanks/variants/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(fileRef, file)
    
    await new Promise((resolve, reject) => {
      uploadTask.on('state_changed', null, reject, async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        variant.mockups.push({ url: url, printArea: { top: 25, left: 35, width: 30, noOverlayRequired: false } })
        resolve()
      })
    })
  }
  uploadProgress.value[`variant_${variantIndex}`] = 0
}

const saveBlank = async () => {
  const auth = getAuth()
  const payload = { ...currentBlank.value }
  
  payload.variants = payload.variants.map(v => {
    const cleanVariant = { ...v }
    delete cleanVariant.basePriceDisplay 
    cleanVariant.sizes = cleanVariant.sizes.map(s => {
      const cleanSize = { ...s }
      delete cleanSize.priceOffsetDisplay
      return cleanSize
    })
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
    await openDialog({ mode: 'alert', title: 'Save Failed', message: 'Failed to save blank. Check the console for details.' })
  }
}

const editBlank = (blank) => {
  currentBlank.value = { ...blank }
  currentBlank.value.variants = blank.variants.map(v => ({
    ...v,
    basePriceDisplay: v.basePrice ? (v.basePrice / 100).toFixed(2) : 0,
    sizes: (v.sizes || []).map(s => ({
      ...s,
      priceOffsetDisplay: s.priceOffset ? (s.priceOffset / 100).toFixed(2) : 0
    }))
  }))
  isEditing.value = true
}

const deleteBlank = async (id) => {
  const confirmed = await openDialog({ mode: 'confirm', title: 'Delete Blank', message: 'Are you sure you want to delete this blank? This cannot be undone.', danger: true, confirmText: 'Delete' })
  if (confirmed) {
    await deleteDoc(doc(db, 'blanks', id))
    await fetchBlanks()
  }
}

const resetForm = () => {
  isEditing.value = false
  currentBlank.value = {
    id: null, name: '', category: '', subCategory: '', description: '', sizingInfo: '',
    isPublic: true, defaultPhotoUrl: '', variants: [getEmptyVariant()], isActive: true
  }
}

// --- Modal & Drag/Drop Logic (Kept exactly as it was) ---
const modalState = ref({ isOpen: false, mockupRef: null, url: '', area: { top: 0, left: 0, width: 0, noOverlayRequired: false } })
const canvasRef = ref(null)
let isDragging = false, isResizing = false, startX = 0, startY = 0, initialTop = 0, initialLeft = 0, initialWidth = 0

const openPositionModal = (mockup) => {
  modalState.value.mockupRef = mockup
  modalState.value.url = mockup.url
  modalState.value.area = { noOverlayRequired: false, ...(mockup.printArea || {}) }
  modalState.value.isOpen = true
}
const closeModal = () => modalState.value.isOpen = false
const savePrintArea = () => {
  modalState.value.mockupRef.printArea = { ...modalState.value.area }
  closeModal()
}

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
  modalState.value.area.left = initialLeft + (((currentX - startX) / rect.width) * 100)
  modalState.value.area.top = initialTop + (((currentY - startY) / rect.height) * 100)
}
const stopDrag = () => { isDragging = false; window.removeEventListener('mousemove', onDrag); window.removeEventListener('mouseup', stopDrag) }

const startResize = (e) => {
  e.stopPropagation()
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
  modalState.value.area.width = Math.max(5, initialWidth + (((currentX - startX) / rect.width) * 100))
}
const stopResize = () => { isResizing = false; window.removeEventListener('mousemove', onResize); window.removeEventListener('mouseup', stopResize) }
</script>

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

        <div class="form-group flex-group">
          <div class="flex-1">
            <label>Parent Category</label>
            <select v-model="currentBlank.category" @change="currentBlank.subCategory = ''" required>
              <option value="" disabled>Select Category</option>
              <option v-for="(subs, parent) in categoryMap" :key="parent" :value="parent">{{ parent }}</option>
            </select>
          </div>
          <div class="flex-1">
            <label>Sub-Category</label>
            <select v-model="currentBlank.subCategory" :disabled="!currentBlank.category" required>
              <option value="" disabled>Select Type</option>
              <option v-for="sub in categoryMap[currentBlank.category]" :key="sub" :value="sub">{{ sub }}</option>
            </select>
          </div>
        </div>

        <div class="form-group flex-between">
          <label class="checkbox-label">
            <input v-model="currentBlank.isPublic" type="checkbox" />
            <strong>Make Public</strong> (Available to other platform artists)
          </label>
        </div>

        <div class="form-group">
          <label>Default Photo (For Catalog Display)</label>
          <input v-if="!currentBlank.defaultPhotoUrl" type="file" accept="image/png, image/jpeg, image/webp" @change="uploadDefaultPhoto" />
          <div v-else class="photo-preview-group">
            <img :src="currentBlank.defaultPhotoUrl" alt="Default" class="preview-thumb" />
            <button type="button" @click="currentBlank.defaultPhotoUrl = ''" class="text-danger unstyled-btn">Remove</button>
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
        <div class="section-header">
          <h3>2. Variants & Colors</h3>
          <button type="button" @click="addVariant" class="btn-secondary small-btn">+ Add Variant</button>
        </div>

        <div v-for="(variant, index) in currentBlank.variants" :key="index" class="variant-card">
          <div class="variant-header">
            <strong>{{ index === 0 ? 'Default Variant' : 'Variant ' + (index + 1) }}</strong>
            <button type="button" @click="removeVariant(index)" class="text-danger unstyled-btn">Remove</button>
          </div>
          
          <div class="variant-grid">
            <div>
              <label>Color Name</label>
              <input v-model="variant.color" type="text" placeholder="e.g., Heather Grey" required />
            </div>
            <div>
              <label>Ink/Tone</label>
              <select v-model="variant.tone">
                <option value="darkGarment">Dark Background (Needs Light Ink)</option>
                <option value="lightGarment">Light Background (Needs Dark Ink)</option>
              </select>
            </div>
            <div>
              <label>Base Price ($)</label>
              <input v-model.number="variant.basePriceDisplay" @input="updateCents(variant)" type="number" step="0.01" min="0" required />
            </div>
          </div>

          <div class="sizes-section">
            <div class="section-header">
              <label>Available Sizes</label>
              <div class="preset-controls">
                <select @change="(e) => applyPreset(index, e.target.value)" class="preset-select">
                  <option value="">Load Preset...</option>
                  <option v-for="(sizes, name) in SIZE_PRESETS" :key="name" :value="name">{{ name }}</option>
                </select>
                <button type="button" @click="addSize(index)" class="btn-secondary tiny-btn">+ Manual</button>
              </div>
            </div>

            <div class="size-row size-row-header">
              <span class="size-input">Size</span>
              <span class="price-offset-group">Additional Cost</span>
              <span class="size-remove-slot"></span>
            </div>

            <div v-for="(size, sizeIndex) in variant.sizes" :key="`${index}-${sizeIndex}`" class="size-row">
              <input
                v-model="size.name"
                type="text"
                placeholder="Size label (e.g., S, M, L, 2XL)"
                class="size-input"
                required
              />

              <div class="price-offset-group">
                <span class="currency-symbol">$</span>
                <input
                  v-model.number="size.priceOffsetDisplay"
                  @input="updateCents(variant)"
                  type="number"
                  step="0.01"
                  class="offset-input"
                />
              </div>

              <button
                type="button"
                class="unstyled-btn text-danger size-remove-btn"
                @click="removeSize(index, sizeIndex)"
                :disabled="variant.sizes.length === 1"
                :title="variant.sizes.length === 1 ? 'At least one size is required' : 'Remove size'"
              >
                Remove
              </button>
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
        <button type="submit" class="btn-primary large-btn">
          {{ isEditing ? 'Update Blank' : 'Save New Blank' }}
        </button>
        <button v-if="isEditing" @click="resetForm" type="button" class="btn-secondary">Cancel</button>
      </div>
    </form>
    
    <hr class="spacer" />
    
    <h3>Saved Blanks</h3>
    <div class="table-responsive">
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
            <template v-if="blank.ownerId === currentUserUid">
            <td>{{ blank.name }}</td>
            <td>{{ blank.category }} > {{ blank.subCategory }}</td>
            <td>{{ blank.variants?.length || 0 }}</td>
            <td>
              <button @click="editBlank(blank)" class="action-btn">Edit</button>
              <button @click="deleteBlank(blank.id)" class="text-danger unstyled-btn">Delete</button>
            </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="modalState.isOpen" class="modal-overlay">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Set Print Area</h3>
        <button type="button" @click="closeModal" class="text-danger unstyled-btn close-modal-btn">&times;</button>
      </div>
      
      <p class="modal-instructions">Drag the box to position. Drag the bottom-right corner to scale.</p>

      <div class="canvas-container" ref="canvasRef">
        <img :src="modalState.url" alt="Mockup" class="canvas-bg" />
        
        <div 
          v-if="!modalState.area.noOverlayRequired"
          class="print-area-box"
          :style="{ top: modalState.area.top + '%', left: modalState.area.left + '%', width: modalState.area.width + '%' }"
          @mousedown="startDrag"
        >
          <div class="resize-handle" @mousedown="startResize"></div>
          <span class="box-label">Print Area</span>
        </div>
      </div>

      <label class="modal-toggle-row">
        <input v-model="modalState.area.noOverlayRequired" type="checkbox" />
        No overlay required for this mockup image
      </label>

      <div class="modal-footer">
        <button type="button" @click="closeModal" class="btn-secondary">Cancel</button>
        <button type="button" @click="savePrintArea" class="btn-primary">Save Coordinates</button>
      </div>
    </div>
  </div>

  <AppModal
    v-if="dialog.isOpen"
    :title="dialog.title"
    :message="dialog.message"
    :mode="dialog.mode"
    :confirm-text="dialog.confirmText"
    :cancel-text="dialog.cancelText"
    :danger="dialog.danger"
    @confirm="onDialogConfirm"
    @cancel="onDialogCancel"
  />
</template>

<style scoped>
/* Base & Layout */
.admin-container { max-width: 900px; margin: 0 auto; padding: 20px; }
.form-section { background: white; padding: 25px; border: 3px solid #1A1A1A; border-radius: var(--radius); margin-bottom: 25px; box-shadow: 4px 4px 0px rgba(0,0,0,0.1); }
.form-section h3 { margin-top: 0; color: var(--primary); border-bottom: 2px solid #f1f2f6; padding-bottom: 10px; }
.form-group { margin-bottom: 15px; }

/* Flex Helpers */
.flex-group { display: flex; gap: 15px; flex-direction: column; }
@media (min-width: 600px) { .flex-group { flex-direction: row; } }
.flex-1 { flex: 1; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }

/* Inputs & Labels */
label { display: block; font-weight: bold; margin-bottom: 5px; color: #1A1A1A; font-size: 0.9rem; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: normal; }
select, input[type="text"], input[type="number"] { width: 100%; padding: 10px; border: 2px solid #ccc; border-radius: 6px; box-sizing: border-box; }
select:focus, input:focus { border-color: var(--secondary); outline: none; }

/* Buttons */
.unstyled-btn { background: none; border: none; cursor: pointer; }
.small-btn { font-size: 0.8rem; padding: 5px 10px; }
.tiny-btn { font-size: 0.7rem; padding: 4px 8px; }
.large-btn { font-size: 1.1rem; padding: 12px 24px; margin-right: 10px; }
.action-btn { margin-right: 10px; }
.font-bold { font-weight: bold; }

/* Photos */
.photo-preview-group { display: flex; align-items: center; gap: 10px; }
.preview-thumb { height: 50px; border-radius: 4px; }
.progress-text { font-size: 0.8rem; color: var(--secondary); margin-top: 5px; font-weight: bold; }

/* Variants */
.variant-card { background: #f8f9fa; border: 2px dashed #ccc; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
.variant-header { display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
.variant-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 15px; }
@media (min-width: 600px) { .variant-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); } }
.variant-images { background: white; padding: 10px; border-radius: 6px; border: 1px solid #ddd; }

/* Sizing Sub-section */
.sizes-section { background: white; padding: 10px; border-radius: 6px; border: 1px solid #ddd; margin-bottom: 15px; }
.size-row { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.size-row-header {
  margin-top: 4px;
  margin-bottom: 8px;
  color: #666;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}
.size-input { flex: 2; }
.price-offset-group { flex: 1; position: relative; display: flex; align-items: center; }
.size-remove-slot { width: 56px; }
.currency-symbol { position: absolute; left: 10px; color: #666; font-size: 0.9rem; }
.offset-input { padding-left: 25px !important; }
.size-remove-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Image Thumbnails */
.image-preview-row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.image-thumbnail { position: relative; width: 80px; height: 100px; border: 1px solid #ccc; border-radius: 4px; display: flex; flex-direction: column; align-items: center; }
.image-thumbnail img { width: 100%; height: 70px; object-fit: cover; border-radius: 4px 4px 0 0; }
.delete-img { position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 10px; line-height: 1; padding: 0; }
.position-btn { width: 100%; height: 30px; background: var(--secondary); color: white; border: none; border-radius: 0 0 4px 4px; font-size: 0.7rem; font-weight: bold; cursor: pointer; }

/* Table */
.spacer { margin: 40px 0; border-color: #ccc; }
.table-responsive { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; background: white; border: 3px solid #1A1A1A; min-width: 600px; }
th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
th { background-color: #f1f2f6; font-weight: bold; }

/* Modal & Canvas */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
.modal-content { background: white; padding: 25px; border-radius: 12px; width: 100%; max-width: 600px; border: 4px solid #1A1A1A; box-shadow: 8px 8px 0px rgba(0,0,0,1); max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; margin-bottom: 15px; }
.close-modal-btn { font-size: 1.5rem; }
.modal-instructions { font-size: 0.9em; color: #666; margin-bottom: 15px; }
.modal-toggle-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
}
.modal-footer { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }

.canvas-container { position: relative; width: 100%; background: #f1f2f6; border: 2px solid #ccc; border-radius: 8px; overflow: hidden; user-select: none; }
.canvas-bg { width: 100%; display: block; object-fit: contain; pointer-events: none; }
.print-area-box { position: absolute; border: 2px dashed #1A1A1A; background: rgba(30, 144, 255, 0.3); aspect-ratio: 1 / 1.2; cursor: move; display: flex; justify-content: center; align-items: center; }
.box-label { color: #1A1A1A; font-weight: bold; font-size: 0.8rem; pointer-events: none; opacity: 0.7; }
.resize-handle { position: absolute; bottom: -5px; right: -5px; width: 15px; height: 15px; background: var(--primary); border: 2px solid white; border-radius: 50%; cursor: nwse-resize; }

/* Quill Overrides */
.editor-wrapper { margin-top: 5px; }
.editor-wrapper :deep(.ql-toolbar) { border: 2px solid #1A1A1A !important; border-bottom: none !important; border-radius: 6px 6px 0 0; background-color: #f1f2f6; font-family: inherit; }
.editor-wrapper :deep(.ql-container) { border: 2px solid #1A1A1A !important; border-radius: 0 0 6px 6px; min-height: 120px; background: white; font-size: 1rem; font-family: inherit; }
</style>