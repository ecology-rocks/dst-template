<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, collection, query, where, getDocs, documentId } from 'firebase/firestore'
import { db } from '../firebase'
import { useCart } from '../composables/useCart'

const route = useRoute()
const design = ref(null)
const artist = ref(null)
const loading = ref(true)
const isZoomed = ref(false)
const zoomOrigin = ref('center center')

const assignedBlanks = ref([])
const selectedBlank = ref(null)
const selectedVariant = ref(null)
const selectedSize = ref(null)
const selectedMockupIndex = ref(0)

const { addToCart } = useCart()

const handleZoom = (e) => {
  if (!isZoomed.value) return
  const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
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
      
      if (design.value.ownerId) {
        const userDocSnap = await getDoc(doc(db, 'users', design.value.ownerId))
        if (userDocSnap.exists()) artist.value = userDocSnap.data()
      }

      if (design.value.assignedBlankIds?.length > 0) {
        const blanksQ = query(collection(db, 'blanks'), where(documentId(), 'in', design.value.assignedBlankIds))
        const blanksSnap = await getDocs(blanksQ)
        assignedBlanks.value = blanksSnap.docs.map(b => ({ id: b.id, ...b.data() }))
        if (assignedBlanks.value.length > 0) selectBlank(assignedBlanks.value[0])
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error)
  } finally {
    loading.value = false
  }
})

const selectBlank = (blank) => {
  selectedBlank.value = blank
  selectedVariant.value = blank.variants?.length > 0 ? blank.variants[0] : null
  selectedMockupIndex.value = 0
}

const selectVariant = (variant) => {
  selectedVariant.value = variant
  selectedMockupIndex.value = 0 
}

// Reset size selection when the variant changes
watch(selectedVariant, (newVal) => {
  if (newVal && newVal.sizes?.length > 0) {
    selectedSize.value = newVal.sizes[0]
  } else {
    selectedSize.value = null
  }
}, { immediate: true })

const uniqueVariants = computed(() => {
  if (!selectedBlank.value?.variants) return []
  const seen = new Set()
  return selectedBlank.value.variants.filter(v => {
    if (seen.has(v.color)) return false
    seen.add(v.color)
    return true
  })
})

const currentMockupData = computed(() => {
  if (selectedVariant.value?.mockups?.length > 0) return selectedVariant.value.mockups[selectedMockupIndex.value]
  return null
})

const currentMockupUrl = computed(() => {
  if (currentMockupData.value) return currentMockupData.value.url
  if (selectedBlank.value?.defaultPhotoUrl) return selectedBlank.value.defaultPhotoUrl
  return 'https://via.placeholder.com/600x600?text=No+Mockup+Available'
})

const printAreaStyle = computed(() => {
  if (currentMockupData.value?.printArea) {
    const { top, left, width } = currentMockupData.value.printArea
    return { top: `${top}%`, left: `${left}%`, width: `${width}%` }
  }
  return { top: '25%', left: '35%', width: '30%' }
})

const currentDesignAsset = computed(() => {
  if (!design.value?.assets) return ''
  return selectedVariant.value?.tone === 'lightGarment' 
    ? (design.value.assets.darkInk || design.value.assets.lightInk)
    : (design.value.assets.lightInk || design.value.assets.darkInk)
})

const calculatedPrice = computed(() => {
  if (!selectedVariant.value) return 0
  const base = selectedVariant.value.basePrice || 0
  const offset = selectedSize.value?.priceOffset || 0
  return base + offset
})

const handleAddToCart = () => {
  if (!selectedVariant.value || !selectedBlank.value || !selectedSize.value) return
  
  const productData = {
    designId: design.value.id,
    designTitle: design.value.title,
    blankId: selectedBlank.value.id,
    blankName: selectedBlank.value.name,
    variantSku: selectedVariant.value.sku,
    color: selectedVariant.value.color,
    size: selectedSize.value.name,
    price: calculatedPrice.value,
    thumbnailUrl: currentMockupUrl.value,
    artistPhotoUrl: artist.value?.photoUrl || 'https://via.placeholder.com/150' // Passing artist photo per request
  }
  
  addToCart(productData)
}
</script>

<template>
  <div class="product-page">
    <div v-if="loading" class="loading">Loading design...</div>
    <div v-else-if="!design" class="error">Design not found.</div>
    
    <div v-else class="product-container">
      <div class="product-gallery">
        <div class="preview-stage" @mousemove="handleZoom" @mouseenter="isZoomed = true" @mouseleave="isZoomed = false">
          <div class="zoom-wrapper" :class="{ 'is-zoomed': isZoomed }" :style="{ transformOrigin: zoomOrigin }">
            <img :src="currentMockupUrl" alt="Product Mockup" class="mockup-base" />
            <img v-if="currentMockupUrl && currentDesignAsset" :src="currentDesignAsset" alt="Design Overlay" class="design-overlay" :style="printAreaStyle" />
          </div>
        </div>
        
        <div v-if="selectedVariant?.mockups?.length > 1" class="thumbnail-strip">
          <img v-for="(mockup, index) in selectedVariant.mockups" :key="index" :src="mockup.url" @click="selectedMockupIndex = index" :class="{ active: selectedMockupIndex === index }" />
        </div>
      </div>

      <div class="product-details">
        <h2 class="title">{{ design.title }}</h2>
        
        <div v-if="artist?.artistProfile?.shopSlug" class="artist-link">
          Designed by: 
          <router-link :to="`/shop/${artist.artistProfile.shopSlug}`" class="artist-url">
            {{ artist.displayName || 'Independent Artist' }}
          </router-link>
        </div>

        <p class="description">{{ design.description }}</p>
        
        <div class="unified-tags-display">
          <span v-for="breed in design.breeds" :key="'b-'+breed" class="tag tag-breed">{{ breed }}</span>
          <span v-for="sport in design.sports" :key="'s-'+sport" class="tag tag-sport">{{ sport }}</span>
          <span v-for="keyword in design.keywords" :key="'k-'+keyword" class="tag tag-keyword">{{ keyword }}</span>
        </div>

        <div class="configurator">
          <div v-if="assignedBlanks.length > 0" class="config-section">
            <h3 class="config-title">1. Select Product</h3>
            <div class="button-group">
              <button v-for="blank in assignedBlanks" :key="blank.id" @click="selectBlank(blank)" :class="['select-btn', { active: selectedBlank?.id === blank.id }]">
                {{ blank.name }}
              </button>
            </div>
          </div>
          <div v-else class="error-box">This design has no products assigned to it yet.</div>

          <div v-if="selectedBlank && uniqueVariants.length > 0" class="config-section">
            <h3 class="config-title">2. Select Color</h3>
            <div class="button-group">
              <button v-for="variant in uniqueVariants" :key="variant.sku" @click="selectVariant(variant)" :class="['select-btn', { active: selectedVariant?.sku === variant.sku }]">
                {{ variant.color }}
              </button>
            </div>
          </div>

          <div v-if="selectedVariant && selectedVariant.sizes?.length > 0" class="config-section">
            <h3 class="config-title">3. Select Size</h3>
            <div class="size-picker-grid">
              <button 
                v-for="size in selectedVariant.sizes" 
                :key="size.name" 
                @click="selectedSize = size" 
                :class="['size-chip', { active: selectedSize?.name === size.name }]"
              >
                <span class="size-name">{{ size.name }}</span>
                <span v-if="size.priceOffset > 0" class="price-pill">+${{ (size.priceOffset / 100).toFixed(2) }}</span>
              </button>
            </div>
          </div>

          <div v-if="selectedVariant && selectedSize" class="price-display">
            <h2 class="price-val">${{ (calculatedPrice / 100).toFixed(2) }}</h2>
          </div>

          <button class="btn-primary cart-btn" :disabled="!selectedVariant || !selectedSize" @click="handleAddToCart">
            {{ (selectedVariant && selectedSize) ? 'Add to Cart' : 'Select options to continue' }}
          </button>
          
          <div v-if="selectedBlank && (selectedBlank.description || selectedBlank.sizingInfo)" class="blank-details">
            <div v-if="selectedBlank.description" class="detail-block">
              <h3 class="config-title">Product Details</h3>
              <div class="html-content" v-html="selectedBlank.description"></div>
            </div>
            <div v-if="selectedBlank.sizingInfo" class="detail-block">
              <h3 class="config-title">Sizing Chart</h3>
              <div class="html-content" v-html="selectedBlank.sizingInfo"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-page { max-width: 1200px; margin: 0 auto; padding: 20px; }
.loading, .error { text-align: center; padding: 40px; color: #666; font-size: 1.2rem; }

/* Mobile-Friendly Grid Stacking */
.product-container { display: grid; grid-template-columns: 1fr; gap: 40px; background: var(--card-bg); padding: 20px; border: 3px solid #1A1A1A; border-radius: var(--radius); box-shadow: var(--shadow-chunky); }
@media (min-width: 850px) {
  .product-container { grid-template-columns: 1fr 1fr; padding: 30px; }
}

/* Canvas Magic */
.preview-stage { position: relative; width: 100%; border: 3px solid #1A1A1A; border-radius: 8px; background-color: #f1f2f6; overflow: hidden; cursor: crosshair; }
.zoom-wrapper { position: relative; width: 100%; transition: transform 0.1s ease-out; }
.zoom-wrapper.is-zoomed { transform: scale(2.5); }
.mockup-base { width: 100%; display: block; object-fit: cover; }
.design-overlay { position: absolute; pointer-events: none; }

/* Thumbnails */
.thumbnail-strip { display: flex; gap: 10px; margin-top: 15px; overflow-x: auto; padding-bottom: 5px; }
.thumbnail-strip img { width: 80px; height: 80px; object-fit: cover; border: 2px solid #ccc; border-radius: 6px; cursor: pointer; transition: border-color 0.2s; flex-shrink: 0; }
.thumbnail-strip img.active { border-color: var(--primary); border-width: 3px; }

/* Right Column Details */
.title { margin-top: 0; font-size: 2.2rem; color: #1A1A1A; letter-spacing: -1px; line-height: 1.2; }
.artist-link { margin-bottom: 15px; font-size: 1.1rem; }
.artist-url { color: var(--secondary); font-weight: bold; text-decoration: none; }
.description { font-size: 1.1rem; line-height: 1.5; color: #555; }
.unified-tags-display { margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 8px; }

/* Configurator */
.configurator { border-top: 2px dashed #ccc; padding-top: 20px; margin-top: 20px; }
.config-section { margin-bottom: 25px; }
.config-title { margin: 0 0 10px 0; font-size: 1.1rem; color: #1A1A1A; }

.button-group { display: flex; flex-wrap: wrap; gap: 10px; }
.select-btn { background: #fff; border: 2px solid #ccc; border-radius: 6px; padding: 10px 15px; cursor: pointer; font-weight: bold; color: #555; transition: all 0.1s; }
.select-btn:hover { border-color: #1A1A1A; color: #1A1A1A; }
.select-btn.active { background: #1A1A1A; color: var(--accent); border-color: #1A1A1A; box-shadow: 2px 2px 0px var(--accent); }
.price-bump { font-size: 0.8em; opacity: 0.8; font-weight: normal; }

.price-display { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 2px solid #eee; margin-bottom: 20px; }
.price-val { margin: 0; color: var(--primary); font-size: 2rem; }

.cart-btn { width: 100%; font-size: 1.2rem; padding: 15px; text-transform: uppercase; letter-spacing: 1px; }
.cart-btn:disabled { background: #ccc; border-color: #999; box-shadow: none; color: #666; cursor: not-allowed; }
.error-box { background: #fff3cd; color: #856404; padding: 15px; border-radius: 6px; border: 1px solid #ffeeba; }

.blank-details { margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px; }
.detail-block { margin-bottom: 25px; overflow-x: auto; } /* Prevents large tables from breaking mobile view */

/* HTML Resets */
.html-content :deep(table) { width: 100%; border-collapse: collapse; margin-top: 10px; min-width: 400px; }
.html-content :deep(th), .html-content :deep(td) { border: 1px solid #ccc; padding: 8px; text-align: left; }
.html-content :deep(th) { background-color: #f8f9fa; font-weight: bold; }
.html-content :deep(p) { line-height: 1.5; color: #555; }

/* Better Grid for Sizes */
.size-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
}

.size-chip {
  background: white;
  border: 2px solid #1A1A1A;
  border-radius: 8px;
  padding: 12px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
  box-shadow: 2px 2px 0px rgba(0,0,0,0.1);
  /* Fix: Explicitly set text color for unselected state */
  color: #1A1A1A !important; 
}
.size-chip:hover {
  border-color: var(--secondary);
  background-color: #f8f9fa;
}

.size-chip.active {
  background: var(--primary) !important;
  color: white !important; /* Keep text white only when background is dark */
  border-color: #1A1A1A;
  box-shadow: 4px 4px 0px #1A1A1A;
  transform: translate(-2px, -2px);
}

.size-name {
  font-weight: 900;
  font-size: 1.1rem;
}

.price-pill {
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 10px;
  margin-top: 4px;
  color: #666;
}

.size-chip.active .price-pill {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}
</style>