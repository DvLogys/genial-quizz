<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as authApi from '@/api/auth'
import { ApiError } from '@/api/client'

const email = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const sent = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
  error.value = null
  const mail = email.value.trim()
  if (!EMAIL_RE.test(mail)) {
    error.value = 'Email invalide'
    return
  }
  submitting.value = true
  try {
    await authApi.requestPasswordReset(mail)
    sent.value = true
  } catch (e) {
    // Always behave the same as success to avoid email enumeration,
    // but surface server errors that aren't 404.
    if (e instanceof ApiError && e.status !== 404) {
      error.value = e.message
    } else {
      sent.value = true
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
      <p class="auth-subtitle">Mot de passe oublié</p>

      <form v-if="!sent" class="auth-form" @submit.prevent="onSubmit">
        <p class="auth-help">
          Entrez l'email associé à votre compte. Si un compte existe, un lien de réinitialisation
          vous sera envoyé.
        </p>
        <label class="field">
          <span class="field-label">Email</span>
          <input v-model="email" type="email" class="input" autocomplete="email" required />
        </label>

        <div v-if="error" class="error">{{ error }}</div>

        <button class="btn btn-primary" type="submit" :disabled="submitting">
          {{ submitting ? 'Envoi...' : 'Envoyer le lien' }}
        </button>
      </form>

      <div v-else class="success-box">
        <p>
          Si un compte est associé à <strong>{{ email }}</strong
          >, un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception.
        </p>
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

.auth-help {
  font-size: 0.9rem;
  color: var(--color-text-light);
  line-height: 1.4;
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
  font-weight: 500;
  line-height: 1.4;
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
