<script setup>
defineProps({
  title: { type: String, required: true },
  message: { type: String, required: true },
  mode: { type: String, default: 'confirm' }, // 'alert' | 'confirm'
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'Cancel' },
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Teleport to="body">
    <div class="app-modal-overlay" @click.self="emit('cancel')">
      <div class="app-modal-box" role="dialog" :aria-label="title">
        <div class="app-modal-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="app-modal-body">
          <p>{{ message }}</p>
        </div>
        <div class="app-modal-footer">
          <button v-if="mode === 'confirm'" type="button" class="modal-btn modal-btn-cancel" @click="emit('cancel')">{{ cancelText }}</button>
          <button type="button" :class="['modal-btn', danger ? 'modal-btn-danger' : 'modal-btn-confirm']" @click="emit('confirm')">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.app-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 20px;
}

.app-modal-box {
  background: white;
  padding: 25px;
  border-radius: 8px;
  width: 100%;
  max-width: 420px;
  border: 4px solid #1A1A1A;
  box-shadow: 6px 6px 0px #1A1A1A;
}

.app-modal-header {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f1f2f6;
}

.app-modal-header h3 {
  margin: 0;
  color: var(--primary);
  font-size: 1.2rem;
}

.app-modal-body {
  margin-bottom: 25px;
}

.app-modal-body p {
  margin: 0;
  color: #333;
  font-size: 1rem;
  line-height: 1.5;
}

.app-modal-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: bold;
  cursor: pointer;
}

.modal-btn-cancel {
  background: #95a5a6;
  color: white;
}

.modal-btn-confirm {
  background: var(--primary);
  color: white;
}

.modal-btn-danger {
  background: #e74c3c;
  color: white;
}
</style>
