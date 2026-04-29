<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import * as quizzesApi from '@/api/quizzes'
import type { QuizSummary } from '@/types'
import { ApiError } from '@/api/client'

const router = useRouter()
const authStore = useAuthStore()

const mine = ref<QuizSummary[]>([])
const publicQuizzes = ref<QuizSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const publicOthers = computed(() =>
  authStore.user
    ? publicQuizzes.value.filter((q) => q.ownerId !== authStore.user!.id)
    : publicQuizzes.value,
)

async function load() {
  loading.value = true
  error.value = null
  try {
    const tasks: Promise<unknown>[] = [
      quizzesApi.listPublic().then((page) => (publicQuizzes.value = page.items)),
    ]
    if (authStore.isAuthenticated) {
      tasks.push(quizzesApi.listMine().then((page) => (mine.value = page.items)))
    } else {
      mine.value = []
    }
    await Promise.all(tasks)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Erreur de chargement'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function editQuiz(id: string) {
  router.push(`/quizzes/${id}`)
}

function newQuiz() {
  router.push('/quizzes/new')
}

async function deleteQuiz(id: string) {
  if (!confirm('Supprimer ce quiz ?')) return
  try {
    await quizzesApi.remove(id)
    mine.value = mine.value.filter((q) => q.id !== id)
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Erreur de suppression'
  }
}

function logout() {
  authStore.logout()
  mine.value = []
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="list-page">
    <header class="list-header">
      <div class="brand">
        <h1>GENIAL QUIZZ</h1>
      </div>
      <nav class="top-nav">
        <template v-if="authStore.isAuthenticated">
          <span class="welcome">Bonjour, {{ authStore.user?.username }}</span>
          <button class="btn btn-ghost" @click="logout">Déconnexion</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn btn-ghost">Connexion</RouterLink>
          <RouterLink to="/register" class="btn btn-primary">Inscription</RouterLink>
        </template>
      </nav>
    </header>

    <div class="actions">
      <button
        class="btn btn-big"
        :disabled="!authStore.isAuthenticated"
        :title="authStore.isAuthenticated ? '' : 'Connectez-vous pour créer un quiz'"
        @click="newQuiz"
      >
        + Nouveau quiz
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="loading">Chargement...</div>

    <template v-else>
      <section v-if="authStore.isAuthenticated" class="section">
        <h2>Mes quizz</h2>
        <div v-if="mine.length === 0" class="empty">
          Vous n'avez pas encore créé de quiz. Cliquez sur "Nouveau quiz" pour commencer.
        </div>
        <div v-else class="quiz-grid">
          <article v-for="q in mine" :key="q.id" class="quiz-card">
            <div class="quiz-card-body">
              <h3>{{ q.name }}</h3>
              <div class="badges">
                <span class="badge" :class="q.isPublic ? 'badge-public' : 'badge-private'">
                  {{ q.isPublic ? 'Public' : 'Privé' }}
                </span>
                <span class="badge badge-count">
                  {{ q.categoryCount }} cat · {{ q.questionCount }} questions
                </span>
              </div>
              <div class="quiz-meta">Modifié le {{ formatDate(q.updatedAt) }}</div>
            </div>
            <div class="quiz-card-actions">
              <button class="btn btn-sm btn-edit" @click="editQuiz(q.id)">Éditer / Jouer</button>
              <button class="btn btn-sm btn-danger" @click="deleteQuiz(q.id)">Supprimer</button>
            </div>
          </article>
        </div>
      </section>

      <section class="section">
        <h2>Quizz publics</h2>
        <div v-if="publicOthers.length === 0" class="empty">Aucun quiz public disponible.</div>
        <div v-else class="quiz-grid">
          <article v-for="q in publicOthers" :key="q.id" class="quiz-card">
            <div class="quiz-card-body">
              <h3>{{ q.name }}</h3>
              <div class="badges">
                <span class="badge badge-public">Public</span>
                <span class="badge badge-count">
                  {{ q.categoryCount }} cat · {{ q.questionCount }} questions
                </span>
              </div>
              <div class="quiz-meta">Par {{ q.ownerUsername }}</div>
            </div>
            <div class="quiz-card-actions">
              <button class="btn btn-sm btn-edit" @click="editQuiz(q.id)">Voir / Jouer</button>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.list-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 2rem 3rem;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.brand h1 {
  font-size: 2.2rem;
  color: var(--color-navy);
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 var(--color-primary);
}

.top-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.welcome {
  font-weight: 600;
  color: var(--color-text-light);
  font-size: 0.9rem;
  margin-right: 0.25rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.btn {
  padding: 0.55rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.9rem;
  transition: all 0.2s;
  border: 2px solid transparent;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  color: var(--color-navy);
  box-shadow: var(--shadow-gold);
}

.btn-primary:hover:not(:disabled) {
  box-shadow: var(--shadow-gold-lg);
}

.btn-ghost {
  background: transparent;
  color: var(--color-navy);
  border-color: var(--color-primary-dark);
}

.btn-ghost:hover {
  background: var(--color-primary);
}

.btn-big {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 1.1rem;
  padding: 0.7rem 1.5rem;
  box-shadow: var(--shadow-gold);
}

.btn-big:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-gold-lg);
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

.btn-edit {
  background: var(--color-navy);
  color: var(--color-primary);
}

.btn-edit:hover {
  opacity: 0.85;
}

.btn-danger {
  background: var(--color-red);
  color: white;
}

.btn-danger:hover {
  background: #c0313d;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.4rem;
  color: var(--color-navy);
  margin-bottom: 0.75rem;
}

.empty {
  background: var(--color-white);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  text-align: center;
  color: var(--color-text-light);
  font-size: 0.95rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-light);
  font-weight: 600;
}

.error {
  background: #fde8ea;
  color: var(--color-red);
  border: 2px solid var(--color-red);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.9rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.quiz-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.quiz-card {
  background: var(--color-white);
  border: 2px solid var(--color-primary-dark);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: var(--shadow-warm);
  transition: transform 0.15s;
}

.quiz-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-gold);
}

.quiz-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.quiz-card h3 {
  font-size: 1.15rem;
  color: var(--color-navy);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.badge {
  padding: 0.15rem 0.55rem;
  border-radius: var(--radius-pill);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-public {
  background: #e8f8f0;
  color: var(--color-green);
  border: 1.5px solid var(--color-green);
}

.badge-private {
  background: var(--color-bg-dark);
  color: var(--color-text-light);
  border: 1.5px solid var(--color-border);
}

.badge-count {
  background: var(--color-navy);
  color: var(--color-primary);
}

.quiz-meta {
  font-size: 0.8rem;
  color: var(--color-text-light);
}

.quiz-card-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
</style>
