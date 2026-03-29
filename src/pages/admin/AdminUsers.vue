<script setup>
import { ref, onMounted, computed } from 'vue'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'

const users = ref([])
const loading = ref(true)

// Modal State
const selectedUser = ref(null)
const isModalOpen = ref(false)

// Filter State
const currentFilter = ref('pending') // Default to pending so you see action items first

const filteredUsers = computed(() => {
  if (currentFilter.value === 'all') return users.value
  if (currentFilter.value === 'artist') return users.value.filter(u => u.roles?.isArtist)
  return users.value.filter(u => (u.applicationStatus || 'none') === currentFilter.value)
})

const fetchUsers = async () => {
  try {
    const snap = await getDocs(collection(db, 'users'))
    users.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.error("Error fetching users:", error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)

const handleApproval = async (userId, newStatus, isArtistValue) => {
  if (confirm(`Are you sure you want to change this user's status to ${newStatus}?`)) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        applicationStatus: newStatus,
        'roles.isArtist': isArtistValue
      })
      
      const user = users.value.find(u => u.id === userId)
      if (user) {
        user.applicationStatus = newStatus
        if (!user.roles) user.roles = {}
        user.roles.isArtist = isArtistValue
      }
      
      if (selectedUser.value && selectedUser.value.id === userId) {
        closeModal()
      }
    } catch (error) {
      console.error("Error updating status:", error)
      alert("Failed to update user.")
    }
  }
}

const openModal = (user) => {
  selectedUser.value = user
  isModalOpen.value = true
}

const closeModal = () => {
  selectedUser.value = null
  isModalOpen.value = false
}
</script>

<template>
  <div class="admin-container">
    <h2>Artist Applications</h2>
    
    <div class="filter-pills">
      <button @click="currentFilter = 'pending'" :class="{ active: currentFilter === 'pending' }">Pending</button>
      <button @click="currentFilter = 'approved'" :class="{ active: currentFilter === 'approved' }">Approved</button>
      <button @click="currentFilter = 'rejected'" :class="{ active: currentFilter === 'rejected' }">Rejected</button>
      <button @click="currentFilter = 'none'" :class="{ active: currentFilter === 'none' }">No Application</button>
      <button @click="currentFilter = 'artist'" :class="{ active: currentFilter === 'artist' }" class="artist-filter-button">Active Artists</button>
      <button @click="currentFilter = 'all'" :class="{ active: currentFilter === 'all' }">All Users</button>
    </div>
    
    <div v-if="loading" class="loading">Loading users...</div>
    <div v-else-if="filteredUsers.length === 0" class="empty-state empty-users-state">
      No users found for this filter.
    </div>
    
    <table v-else>
      <thead>
        <tr>
          <th>Email</th>
          <th>Status</th>
          <th>Artist Access</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in filteredUsers" :key="user.id">
          <td>{{ user.email }}</td>
          <td>
            <span class="tag" :class="user.applicationStatus || 'none'">
              {{ (user.applicationStatus || 'None').toUpperCase() }}
            </span>
          </td>
          <td>{{ user.roles?.isArtist ? '✅ Yes' : '❌ No' }}</td>
          <td>
            <div class="action-buttons">
              <button @click="openModal(user)" class="btn-secondary btn-small">View Details</button>
              
              <template v-if="user.applicationStatus === 'pending'">
                <button @click="handleApproval(user.id, 'approved', true)" class="btn-success btn-small">Approve</button>
                <button @click="handleApproval(user.id, 'rejected', false)" class="btn-danger btn-small">Reject</button>
              </template>
              
              <template v-else-if="user.roles?.isArtist">
                <button @click="handleApproval(user.id, 'revoked', false)" class="btn-warning btn-small">Revoke Access</button>
              </template>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Application Details</h3>
        <button @click="closeModal" class="close-modal-btn">&times;</button>
      </div>
      
      <div v-if="selectedUser?.artistProfile" class="modal-body">
        <div class="detail-group">
          <label>Email</label>
          <p>{{ selectedUser.email }}</p>
        </div>
        
        <div class="detail-group">
          <label>Proposed Shop URL</label>
          <p>dogsporttees.com/shop/<strong>{{ selectedUser.artistProfile.shopSlug }}</strong></p>
        </div>

        <div class="detail-group">
          <label>Artist Bio / Notes</label>
          <div class="bio-content" v-html="selectedUser.artistProfile.bio"></div>
        </div>

        <div class="modal-actions" v-if="selectedUser.applicationStatus === 'pending'">
           <button @click="handleApproval(selectedUser.id, 'approved', true)" class="btn-success btn-large">Approve Artist</button>
           <button @click="handleApproval(selectedUser.id, 'rejected', false)" class="btn-danger btn-large">Reject</button>
        </div>
      </div>
      
      <div v-else class="modal-body">
        <p class="empty-state">No application profile found for this user.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Main Dashboard Layout */
.admin-container { max-width: 1000px; margin: 0 auto; padding: 20px; }

/* Filter Pills */
.filter-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 25px; }
.filter-pills button { background: white; border: 2px solid #ccc; border-radius: 20px; padding: 8px 16px; font-weight: bold; color: #555; cursor: pointer; transition: all 0.2s; }
.filter-pills button:hover { border-color: #1A1A1A; color: #1A1A1A; }
.filter-pills button.active { background: #1A1A1A; color: white; border-color: #1A1A1A; box-shadow: 2px 2px 0px var(--accent); }
.artist-filter-button {
  margin-left: auto;
  border-color: var(--secondary);
  color: var(--secondary);
}

/* Table */
table { width: 100%; border-collapse: collapse; background: white; border: 3px solid #1A1A1A; }
th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
th { background-color: #f1f2f6; font-weight: bold; color: #1A1A1A; }

/* Status Tags */
.tag { padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; }
.tag.pending { background: #ffeaa7; color: #d35400; }
.tag.approved { background: #55efc4; color: #00b894; }
.tag.rejected, .tag.revoked { background: #ff7675; color: #d63031; }
.tag.none { background: #eee; color: #666; }

/* Buttons */
.action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-small { padding: 6px 10px; font-size: 0.8rem; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; }
.btn-large { padding: 12px; font-size: 1rem; border-radius: 4px; border: none; cursor: pointer; font-weight: bold; flex: 1; }

.btn-success { background: #2ecc71; color: white; }
.btn-danger { background: #e74c3c; color: white; }
.btn-warning { background: #f39c12; color: white; }
.btn-secondary { background: #95a5a6; color: white; }

/* Modal Styles */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
.modal-content { background: white; padding: 25px; border-radius: 12px; width: 100%; max-width: 600px; border: 4px solid #1A1A1A; box-shadow: 8px 8px 0px rgba(0,0,0,1); max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f1f2f6; padding-bottom: 10px; }
.modal-header h3 { margin: 0; color: var(--primary); font-size: 1.5rem; }
.close-modal-btn { background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #e74c3c; font-weight: bold; padding: 0; line-height: 1; }

/* Modal Content Formatting */
.detail-group { margin-bottom: 20px; }
.detail-group label { display: block; font-weight: bold; margin-bottom: 5px; color: #666; font-size: 0.85rem; text-transform: uppercase; }
.detail-group p { margin: 0; font-size: 1.1rem; color: #1A1A1A; }

.bio-content { background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #ccc; font-size: 0.95rem; line-height: 1.6; color: #333; }
.bio-content :deep(p) { margin-top: 0; }
.bio-content :deep(p:last-child) { margin-bottom: 0; }

.modal-actions { display: flex; gap: 10px; margin-top: 30px; border-top: 2px solid #f1f2f6; padding-top: 20px; }
.empty-state { text-align: center; color: #666; font-style: italic; padding: 20px 0; }
.empty-users-state {
  padding: 40px;
  background: white;
  border: 2px dashed #ccc;
  border-radius: 8px;
}
</style>