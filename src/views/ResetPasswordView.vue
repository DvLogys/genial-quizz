<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import * as authApi from '@/api/auth'
import { ApiError } from '@/api/client'

const route = useRoute()
const router = useRouter()

const token = computed(() => {
  const raw = route.query.token
  return typeof raw === 'string' ? raw : ''
})

const password = ref('')
const confirm = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const success = ref(false)

async function onSubmit() {
  error.value = null
  if (!token.value) {
    error.value = 'Lien invalide ou expiré.'
    return
  }
  if (password.value.length < 8) {
    error.value = 'Le mot de passe doit faire au moins 8 caractères'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Les mots de passe ne correspondent pas'
    return
  }
  submitting.value = true
  try {
    await authApi.resetPassword(token.value, password.value)
    success.value = true
    setTimeout(() => router.replace('/login'), 2000)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Erreur de réinitialisation'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">GENIAL QUIZZ</h1>
      <p class="auth-subtitle">Réinitialiser le mot de passe</p>

      <div v-if="!token" class="error">
        Lien invalide. Veuillez recommencer la procédure de réinitialisation.
      </div>

      <form v-else-if="!success" class="auth-form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="field-label">Nouveau mot de passe (8+ caractères)</span>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>
        <label class="field">
          <span class="field-label">Confirmer le mot de passe</span>
          <input
            v-model="confirm"
            type="password"
            class="input"
            autocomplete="new-password"
            required
          />
        </label>

        <div v-if="error" class="error">{{ error }}</div>

        <button class="btn btn-primary" type="submit" :disabled="submitting">
          {{ submitting ? 'Réinitialisation...' : 'Réinitialiser' }}
        </button>
      </form>

      <div v-else class="success-box">
        Mot de passe mis à jour. Redirection vers la connexion...
      </div>

      <p class="auth-footer">
        <RouterLink to="/login" class="link">Retour à la connexion</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.auth-card {
  background: var(--color-white);
  border: 3px solid var(--color-primary-dark);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-gold-lg);
  padding: clamp(1.2rem, 4vw, 2rem);
  width: 100%;
  max-width: 420px;
}

.auth-title {
  font-size: clamp(1.4rem, 6vw, 2.2rem);
  color: var(--color-navy);
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 var(--color-primary);
  text-align: center;
}

.auth-subtitle {
  text-align: center;
  font-size: 1.05rem;
  color: var(--color-text-light);
  margin-bottom: 1.5rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-light);
}

.input {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.8rem;
  font-size: 0.95rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-primary-dark);
}

.error {
  background: #fde8ea;
  color: var(--color-red);
  border: 2px solid var(--color-red);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.success-box {
  background: #e8f8f0;
  color: var(--color-green);
  border: 2px solid var(--color-green);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn {
  padding: 0.7rem 1.2rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 1rem;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  color: var(--color-navy);
  box-shadow: var(--shadow-gold);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-gold-lg);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-footer {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.9rem;
  color: var(--color-text-light);
}

.link {
  color: var(--color-primary-dark);
  font-weight: 700;
  text-decoration: none;
}

.link:hover {
  color: var(--color-amber);
  text-decoration: underline;
}
</style>
