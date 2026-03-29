import { createRouter, createWebHistory } from 'vue-router'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'


const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/PublicGallery.vue') // We'll build this next
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/users/Login.vue') // We'll build this next
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../pages/artists/AdminDesigns.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/design/:id',
    name: 'SingleProduct',
    component: () => import('../pages/SingleProduct.vue')
  },
  {
    path: '/admin/blanks',
    name: 'AdminBlanks',
    component: () => import('../pages/artists/AdminBlanks.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin/users',
    name: 'AdminUsers',
    component: () => import('../pages/admin/AdminUsers.vue'),
    meta: { requiresAuth: true, requiresAdmin: true } 
  },
  {
    path: '/settings',
    name: 'UserSettings',
    component: () => import('../pages/users/UserSettings.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/shop/:slug',
    name: 'ArtistShop',
    component: () => import('../pages/users/UserProfile.vue')
  },
  {
    path: '/checkout-success',
    name: 'CheckoutSuccess',
    component: () => import('../pages/Success.vue')
  },
  { 
    path: '/admin/orders', 
    name: 'AdminOrders',
    component: () => import('../pages/artists/AdminOrders.vue'), 
    meta: { requiresAuth: true } 
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../pages/users/Register.vue')
  },
  {
    path: '/orders',
    name: 'OrderLookup',
    component: () => import('../pages/users/OrderLookup.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Wait for Firebase Auth to initialize before checking the guard
const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const removeListener = onAuthStateChanged(
      getAuth(),
      (user) => {
        removeListener()
        resolve(user)
      },
      reject
    )
  })
}

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  if (requiresAuth) {
    const user = await getCurrentUser()
    
    // 1. If they aren't logged in at all, kick to login
    if (!user) {
      next('/login')
      return
    }

    // 2. If the route specifically requires Admin privileges
    if (requiresAdmin) {
      try {
        const userDocRef = doc(db, 'users', user.uid)
        const userDoc = await getDoc(userDocRef)
        
        if (userDoc.exists() && userDoc.data().roles?.isAdmin) {
          next() // They are an admin, let them in!
        } else {
          alert("You do not have permission to view the Admin dashboard.")
          next('/settings') // Kick them back to settings
        }
      } catch (error) {
        console.error("Error checking admin status:", error)
        next('/settings')
      }
    } else {
      // 3. Just a standard authenticated route (like /settings)
      next() 
    }
  } else {
    // 4. Public routes (like the Home page)
    next()
  }
})

export default router