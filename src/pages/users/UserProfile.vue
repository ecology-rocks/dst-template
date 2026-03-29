<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

const route = useRoute()
const userProfile = ref(null)
const artistDesigns = ref([])
const loading = ref(true)

// Helper to pull the fast-loading thumbnail
const getThumbnailUrl = (originalUrl) => {
  if (!originalUrl) return 'https://via.placeholder.com/300?text=No+Image';
  const baseUrl = originalUrl.split('?')[0];
  const thumbnailUrl = baseUrl.replace(/\.[\w\d_-]+$/i, '_400x400.webp');
  return `${thumbnailUrl}?alt=media`;
};

onMounted(async () => {
  const shopSlug = route.params.slug
  try {
    // 1. Fetch the user profile by their custom shop slug
    const userQ = query(collection(db, 'users'), where('artistProfile.shopSlug', '==', shopSlug))
    const userSnap = await getDocs(userQ)
    
    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0]
      userProfile.value = userDoc.data()
      const artistUid = userDoc.id // Get the actual user ID to query their designs

      // 2. Fetch the active designs owned by this specific artist
      const designQ = query(
        collection(db, 'designs'), 
        where('ownerId', '==', artistUid),
        where('isActive', '==', true)
      )
      const designSnap = await getDocs(designQ)
      artistDesigns.value = designSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }
  } catch (error) {
    console.error("Error fetching artist profile or designs:", error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="public-profile">
    <div v-if="loading" class="loading">Loading profile...</div>
    <div v-else-if="!userProfile" class="error-state">User not found.</div>
    
    <div v-else class="profile-wrapper">
      <aside class="profile-sidebar">
        <div class="profile-card">
          <img :src="userProfile.photoUrl || 'https://via.placeholder.com/150'" alt="Avatar" class="avatar" />
          <h2>{{ userProfile.displayName || 'Anonymous User' }}</h2>
          <p v-if="userProfile.roles?.isArtist && userProfile.artistProfile?.yearStarted" class="year-started">
            Creating since {{ userProfile.artistProfile.yearStarted }}
          </p>
          <span v-if="userProfile.roles?.isArtist" class="badge-artist">Artist Shop</span>
          
          <template v-if="userProfile.roles?.isArtist && userProfile.artistProfile?.bio">
            <div class="bio-content" v-html="userProfile.artistProfile.bio"></div>
          </template>
        </div>

        <div v-if="userProfile.roles?.isArtist" class="policy-card">
          <h3>Return Policy</h3>
          <p v-if="userProfile.artistProfile?.returnPolicy === 'standard'"><strong>Standard:</strong> 30 days, buyer pays return shipping.</p>
          <p v-else-if="userProfile.artistProfile?.returnPolicy === 'no_returns'"><strong>All Sales Final:</strong> No returns or exchanges accepted.</p>
          <div v-else-if="userProfile.artistProfile?.returnPolicy === 'custom'">
            <p><strong>Custom Policy:</strong></p>
            <p class="custom-policy-text">{{ userProfile.artistProfile?.customReturnPolicy || 'No details provided.' }}</p>
          </div>
          <p v-else><strong>Standard:</strong> 30 days, buyer pays return shipping.</p>
        </div>
      </aside>

      <main class="profile-main">
        <div class="main-header">
          <h3>Designs by {{ userProfile.displayName }}</h3>
          <span class="design-count">{{ artistDesigns.length }} items</span>
        </div>

        <div v-if="artistDesigns.length === 0" class="empty-designs">
          This artist hasn't published any designs yet.
        </div>

        <div v-else class="design-grid">
          <div v-for="design in artistDesigns" :key="design.id" class="card">
            
            <router-link :to="`/design/${design.id}`">
              <img 
                :src="getThumbnailUrl(design.assets?.darkInk || design.assets?.lightInk)" 
                @error="(e) => e.target.src = (design.assets?.darkInk || design.assets?.lightInk)" 
                :alt="design.title" 
                class="card-img" 
              />
            </router-link>
            
            <div class="card-content">
              <router-link :to="`/design/${design.id}`" class="card-title-link">
                <h4>{{ design.title }}</h4>
              </router-link>
              
              <div class="unified-tags-display">
                <span v-for="breed in design.breeds" :key="'b-'+breed" class="tag tag-breed">{{ breed }}</span>
                <span v-for="sport in design.sports" :key="'s-'+sport" class="tag tag-sport">{{ sport }}</span>
                <span v-for="keyword in design.keywords" :key="'k-'+keyword" class="tag tag-keyword">{{ keyword }}</span>
              </div>
              <span v-if="design.isCustomizable" class="tag tag-customizable">Customizable</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.public-profile {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.loading, .error-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 1.2rem;
}

.profile-wrapper {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 30px;
}

/* Sidebar Styles */
.profile-card, .policy-card {
  background: white;
  border: 3px solid #1A1A1A;
  border-radius: var(--radius);
  padding: 25px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-chunky);
  text-align: center;
}

.avatar {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #1A1A1A;
  margin-bottom: 15px;
}

.profile-card h2 {
  margin: 0 0 10px 0;
  font-size: 1.8rem;
  color: #1A1A1A;
  letter-spacing: -0.5px;
}

.badge-artist {
  display: inline-block;
  background: var(--secondary);
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  border: 2px solid #1A1A1A;
  margin-bottom: 20px;
}

.bio-content {
  text-align: left;
  border-top: 2px dashed #ccc;
  padding-top: 15px;
  margin-top: 15px;
}

.bio-content :deep(p) {
  line-height: 1.5;
  color: #444;
  font-size: 0.95rem;
  margin-bottom: 1em;
}

.policy-card {
  text-align: left;
}

.policy-card h3 {
  margin-top: 0;
  color: var(--primary);
  border-bottom: 2px solid #f1f2f6;
  padding-bottom: 10px;
  font-size: 1.1rem;
}

.policy-card p {
  font-size: 0.9rem;
  color: #555;
  line-height: 1.5;
  margin: 0;
}

.custom-policy-text {
  white-space: pre-wrap;
  color: #555;
  margin-top: 5px !important;
}

/* Main Grid Styles */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 3px solid #1A1A1A;
  padding-bottom: 10px;
}

.main-header h3 {
  margin: 0;
  font-size: 1.8rem;
  color: #ffffff;
}

.design-count {
  font-weight: bold;
  color: #666;
  background: #e2e8f0;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.empty-designs {
  background: #f8f9fa;
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: #666;
  font-size: 1.1rem;
}

.design-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.card {
  border: 2px solid #1A1A1A;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 4px 4px 0px rgba(0,0,0,0.1);
  transition: transform 0.2s ease;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 4px 8px 0px rgba(0,0,0,0.15);
}

.card-img {
  width: 100%;
  height: 220px;
  object-fit: contain;
  background-color: #f1f2f6;
  padding: 10px;
  box-sizing: border-box;
  border-bottom: 2px solid #1A1A1A;
}

.card-content {
  padding: 15px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.card-title-link {
  text-decoration: none;
  color: var(--primary);
  margin-bottom: 10px;
}

.card-title-link h4 {
  margin: 0;
  font-size: 1.2rem;
}

.unified-tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 15px;
}

.tag {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
}

.tag-customizable {
  background: var(--accent);
  color: #1A1A1A;
  align-self: flex-start;
  margin-top: auto;
  border: 1px solid #1A1A1A;
}

/* Responsive */
@media (max-width: 850px) {
  .profile-wrapper {
    grid-template-columns: 1fr;
  }
  .profile-sidebar {
    max-width: 400px;
    margin: 0 auto;
  }
}

.year-started {
  margin: 0 0 15px 0; color: #666; font-size: 0.9rem;
}
</style>