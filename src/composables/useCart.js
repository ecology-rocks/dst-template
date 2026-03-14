import { ref, watch } from 'vue'

// Global state created outside the exported function so it persists across components
const cart = ref(JSON.parse(localStorage.getItem('dst_cart')) || [])
const isCartOpen = ref(false)

export function useCart() {
  
  // Automatically sync to local storage whenever the cart changes
  watch(cart, (newCart) => {
    localStorage.setItem('dst_cart', JSON.stringify(newCart))
  }, { deep: true })

  const addToCart = (productData) => {
    // Generate a unique ID for this specific configuration
    const cartItemId = `${productData.designId}_${productData.variantSku}_${Date.now()}`
    
    cart.value.push({
      cartItemId,
      ...productData,
      quantity: 1
    })
    
    isCartOpen.value = true // Pop the cart open when they add an item
  }

  const removeFromCart = (cartItemId) => {
    cart.value = cart.value.filter(item => item.cartItemId !== cartItemId)
  }

  const toggleCart = () => {
    isCartOpen.value = !isCartOpen.value
  }

  return {
    cart,
    isCartOpen,
    addToCart,
    removeFromCart,
    toggleCart
  }
}