import { createRouter, createWebHistory } from 'vue-router'
import { getAuth, onAuthStateChanged } from 'firebase/auth'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/PublicGallery.vue') // We'll build this next
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/Login.vue') // We'll build this next
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../pages/AdminDesigns.vue'),
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
    component: () => import('../pages/AdminBlanks.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'UserSettings',
    component: () => import('../pages/UserSettings.vue'),
    meta: { requiresAuth: true }
  },
// Replace your existing UserProfile route with this:
  {
    path: '/shop/:slug',
    name: 'ArtistShop',
    component: () => import('../pages/UserProfile.vue')
  },
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
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (await getCurrentUser()) {
      next()
    } else {
      next('/login')
    }
  } else {
    next()
  }
})

export default router