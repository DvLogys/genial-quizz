<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/api/client'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  if (!username.value.trim() || !password.value) return
  error.value = null
  submitting.value = true
  try {
    await authStore.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/quizzes'
    router.replace(redirect)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      error.value = "Le nom d'utilisateur n'existe pas."
    } else if (e instanceof ApiError && e.status === 401) {
      error.value = "Le nom d'utilisateur ou le mot de passe est incorrect."
    } else {
      error.value = e instanceof ApiError ? e.message : 'Erreur de connexion'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">GENIAL QUIZZ</h1>
      <p class="auth-subtitle">Connexion</p>

      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="field-label">Nom d'utilisateur</span>
          <input v-model="username" type="text" class="input" autocomplete="username" required />
        </label>
        <label class="field">
          <span class="field-label">Mot de passe</span>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="current-password"
            required
          />
        </label>

        <div v-if="error" class="error">{{ error }}</div>

        <button class="btn btn-primary" type="submit" :disabled="submitting">
          {{ submitting ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <p class="auth-footer">
        Pas de compte ?
        <RouterLink to="/register" class="link">S'inscrire</RouterLink>
      </p>
      <p class="auth-footer">
        <RouterLink to="/forgot-password" class="link">Mot de passe oublié ?</RouterLink>
      </p>
      <p class="auth-footer">
        <RouterLink to="/quizzes" class="link">Continuer sans compte</RouterLink>
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
  padding: 2rem;
}

.auth-card {
  background: var(--color-white);
  border: 3px solid var(--color-primary-dark);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-gold-lg);
  padding: 2rem;
  width: 100%;
  max-width: 420px;
}

.auth-title {
  font-size: 2.2rem;
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
