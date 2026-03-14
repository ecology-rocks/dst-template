<template>
  <div class="product-page">
    <div v-if="loading" class="loading">Loading design...</div>
    <div v-else-if="!design" class="error">Design not found.</div>
    
    <div v-else class="product-container">
      
      <div 
          class="preview-stage" 
          @mousemove="handleZoom" 
          @mouseenter="isZoomed = true" 
          @mouseleave="isZoomed = false"
        >
          <div class="zoom-wrapper" :class="{ 'is-zoomed': isZoomed }" :style="{ transformOrigin: zoomOrigin }">
            <img :src="currentMockupUrl" alt="Product Mockup" class="mockup-base" />
            
            <img 
              v-if="currentMockupUrl && currentDesignAsset" 
              :src="currentDesignAsset" 
              alt="Design Overlay" 
              class="design-overlay"
              :style="printAreaStyle"
            />
          </div>
        
        <div v-if="selectedVariant && selectedVariant.mockups && selectedVariant.mockups.length > 1" class="thumbnail-strip">
          <img 
            v-for="(mockup, index) in selectedVariant.mockups" 
            :key="index" 
            :src="mockup.url" 
            @click="selectedMockupIndex = index"
            :class="{ active: selectedMockupIndex === index }"
          />
        </div>
      </div>

      <div class="product-details">
        <h2>{{ design.title }}</h2>
        <p class="description">{{ design.description }}</p>
        
        <div class="tags" style="margin-bottom: 25px;">
          <span v-for="tag in design.keywords" :key="tag" class="tag">{{ tag }}</span>
        </div>

        <div class="configurator">
          <div v-if="assignedBlanks.length > 0" class="config-section">
            <h3>1. Select Product</h3>
            <div class="button-group">
              <button 
                v-for="blank in assignedBlanks" 
                :key="blank.id"
                @click="selectBlank(blank)"
                :class="['select-btn', { active: selectedBlank?.id === blank.id }]"
              >
                {{ blank.name }}
              </button>
            </div>
          </div>
          <div v-else class="error-box">This design has no products assigned to it yet.</div>

          <div v-if="selectedBlank && uniqueVariants.length > 0" class="config-section">
            <h3>2. Select Color</h3>
            <div class="button-group">
              <button 
                v-for="variant in uniqueVariants" 
                :key="variant.sku"
                @click="selectVariant(variant)"
                :class="['select-btn', { active: selectedVariant?.sku === variant.sku }]"
              >
                {{ variant.color }}
              </button>
            </div>
          </div>

          <div v-if="selectedVariant" class="price-display">
            <h2>${{ (selectedVariant.basePrice / 100).toFixed(2) }}</h2>
            <p style="margin: 0; color: #666; font-size: 0.9em;">Available in sizes: {{ selectedVariant.minSize }} - {{ selectedVariant.maxSize }}</p>
          </div>

          <button class="btn-primary cart-btn" :disabled="!selectedVariant">
            {{ selectedVariant ? 'Add to Cart (Coming Soon)' : 'Select a product to continue' }}
          </button>
          <div v-if="selectedBlank && (selectedBlank.description || selectedBlank.sizingInfo)" class="blank-details">
            <div v-if="selectedBlank.description" class="detail-block">
              <h3>Product Details</h3>
              <div class="html-content" v-html="selectedBlank.description"></div>
            </div>
            
            <div v-if="selectedBlank.sizingInfo" class="detail-block">
              <h3>Sizing Chart</h3>
              <div class="html-content" v-html="selectedBlank.sizingInfo"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, getDocs, documentId } from 'firebase/firestore'
import { db } from '../firebase'

const route = useRoute()
const design = ref(null)
const loading = ref(true)
const isZoomed = ref(false)
const zoomOrigin = ref('center center')

const assignedBlanks = ref([])
const selectedBlank = ref(null)
const selectedVariant = ref(null)
const selectedMockupIndex = ref(0)

const handleZoom = (e) => {
  if (!isZoomed.value) return
  const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
  
  // Calculate mouse position as a percentage of the container
  const x = ((e.clientX - left) / width) * 100
  const y = ((e.clientY - top) / height) * 100
  
  zoomOrigin.value = `${x}% ${y}%`
}

onMounted(async () => {
  const designId = route.params.id
  try {
    const docRef = doc(db, 'designs', designId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      design.value = { id: docSnap.id, ...docSnap.data() }
      
      // Fetch associated blanks
      if (design.value.assignedBlankIds && design.value.assignedBlankIds.length > 0) {
        const blanksQ = query(collection(db, 'blanks'), where(documentId(), 'in', design.value.assignedBlankIds))
        const blanksSnap = await getDocs(blanksQ)
        assignedBlanks.value = blanksSnap.docs.map(b => ({ id: b.id, ...b.data() }))
        
        // Auto-select the first blank to get the UI populated
        if (assignedBlanks.value.length > 0) {
          selectBlank(assignedBlanks.value[0])
        }
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error)
  } finally {
    loading.value = false
  }
})

// Helper to handle swapping blanks
const selectBlank = (blank) => {
  selectedBlank.value = blank
  selectedVariant.value = blank.variants && blank.variants.length > 0 ? blank.variants[0] : null
  selectedMockupIndex.value = 0
}

// Helper to handle swapping colors
const selectVariant = (variant) => {
  selectedVariant.value = variant
  selectedMockupIndex.value = 0 // Reset image preview to first image of new color
}

// Filter variants to just unique colors (in case you later add sizing rows to the DB)
const uniqueVariants = computed(() => {
  if (!selectedBlank.value || !selectedBlank.value.variants) return []
  const seen = new Set()
  return selectedBlank.value.variants.filter(v => {
    if (seen.has(v.color)) return false
    seen.add(v.color)
    return true
  })
})

// Compute the background mockup image
const currentMockupData = computed(() => {
  if (selectedVariant.value && selectedVariant.value.mockups && selectedVariant.value.mockups.length > 0) {
    return selectedVariant.value.mockups[selectedMockupIndex.value]
  }
  return null
})

// Extract just the background URL
const currentMockupUrl = computed(() => {
  if (currentMockupData.value) return currentMockupData.value.url
  if (selectedBlank.value && selectedBlank.value.defaultPhotoUrl) return selectedBlank.value.defaultPhotoUrl
  return 'https://via.placeholder.com/600x600?text=No+Mockup+Available'
})

const printAreaStyle = computed(() => {
  if (currentMockupData.value && currentMockupData.value.printArea) {
    const { top, left, width } = currentMockupData.value.printArea
    return {
      top: `${top}%`,
      left: `${left}%`,
      width: `${width}%`
    }
  }
  // Fallback if no coordinates were saved
  return {
    top: '25%',
    left: '35%',
    width: '30%'
  }
})

// Dynamically swap light/dark ink based on the variant's tone!
const currentDesignAsset = computed(() => {
  if (!design.value || !design.value.assets) return ''
  if (selectedVariant.value && selectedVariant.value.tone === 'lightGarment') {
    return design.value.assets.darkInk || design.value.assets.lightInk
  } else {
    return design.value.assets.lightInk || design.value.assets.darkInk
  }
})
</script>

<style scoped>
.product-page { max-width: 1200px; margin: 0 auto; padding: 20px; }
.product-container { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; background: var(--card-bg); padding: 30px; border: 3px solid #1A1A1A; border-radius: var(--radius); box-shadow: var(--shadow-chunky); }

/* The CSS Canvas Magic */
.preview-stage {
  position: relative;
  width: 100%;
  border: 3px solid #1A1A1A;
  border-radius: 8px;
  background-color: #f1f2f6;
  overflow: hidden;
}

.mockup-base {
  width: 100%;
  display: block;
  object-fit: cover;
}
.design-overlay {
  position: absolute;
  pointer-events: none; /* Prevents users from dragging or right-clicking the raw PNG */
  /* top, left, and width are now controlled dynamically via inline :style */
}

/* Thumbnails */
.thumbnail-strip { display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding-bottom: 5px; }
.thumbnail-strip img { width: 80px; height: 80px; object-fit: cover; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: border-color 0.2s; }
.thumbnail-strip img.active { border-color: var(--primary); border-width: 3px; }

/* Right Column Details */
.product-details h2 { margin-top: 0; font-size: 2.2rem; color: #1A1A1A; letter-spacing: -1px; }
.description { font-size: 1.1rem; line-height: 1.5; color: #555; }

.configurator { border-top: 2px dashed #ccc; padding-top: 20px; margin-top: 20px; }
.config-section { margin-bottom: 25px; }
.config-section h3 { margin: 0 0 10px 0; font-size: 1.1rem; color: #1A1A1A; }

.button-group { display: flex; flex-wrap: wrap; gap: 10px; }
.select-btn { background: #fff; border: 2px solid #ccc; border-radius: 6px; padding: 10px 15px; cursor: pointer; font-weight: bold; color: #555; transition: all 0.1s; }
.select-btn:hover { border-color: #1A1A1A; color: #1A1A1A; }
.select-btn.active { background: #1A1A1A; color: var(--accent); border-color: #1A1A1A; box-shadow: 2px 2px 0px var(--accent); }

.price-display { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 2px solid #eee; margin-bottom: 20px; }
.price-display h2 { margin: 0 0 5px 0; color: var(--primary); font-size: 2rem; }

.cart-btn { width: 100%; font-size: 1.2rem; padding: 15px; text-transform: uppercase; letter-spacing: 1px; }
.cart-btn:disabled { background: #ccc; border-color: #999; box-shadow: none; color: #666; cursor: not-allowed; }

.error-box { background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; border: 1px solid #ffeeba; }

@media (max-width: 768px) {
  .product-container { grid-template-columns: 1fr; }
}

/* Update your preview-stage and add zoom-wrapper */
.preview-stage {
  position: relative;
  width: 100%;
  border: 3px solid #1A1A1A;
  border-radius: 8px;
  background-color: #f1f2f6;
  overflow: hidden; /* Keeps the zoomed image inside the box */
  cursor: crosshair;
}

.zoom-wrapper {
  position: relative;
  width: 100%;
  transition: transform 0.1s ease-out; /* Smooth snapping when mouse enters/leaves */
}

.zoom-wrapper.is-zoomed {
  transform: scale(2.5); /* Change this to increase/decrease zoom power */
}

/* Styles for the rendered HTML fields */
.blank-details { margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px; }
.detail-block { margin-bottom: 25px; }
.detail-block h3 { margin-bottom: 10px; font-size: 1.2rem; color: #1A1A1A; }

/* Scoped styles to ensure your HTML tables look decent */
.html-content :deep(table) { width: 100%; border-collapse: collapse; margin-top: 10px; }
.html-content :deep(th), .html-content :deep(td) { border: 1px solid #ccc; padding: 8px; text-align: left; }
.html-content :deep(th) { background-color: #f8f9fa; font-weight: bold; }
.html-content :deep(p) { line-height: 1.5; color: #555; }
</style>