<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { defaultQuiz } from '@/config/defaultQuiz'
import type { QuizConfig } from '@/config/defaultQuiz'
import { POINT_TIERS } from '@/types'
import type {
  Question,
  DirectQuestion,
  GuessTheMostQuestion,
  QuizDetail,
  QuizInput,
} from '@/types'
import * as quizzesApi from '@/api/quizzes'
import { ApiError } from '@/api/client'

const router = useRouter()
const route = useRoute()
const playerStore = usePlayerStore()
const gameStore = useGameStore()
const authStore = useAuthStore()

const routeId = computed(() => {
  const raw = route.params.id
  return typeof raw === 'string' ? raw : null
})
const isNewQuiz = computed(() => routeId.value === null || routeId.value === 'new')

const quizId = ref<string | null>(null)
const ownerId = ref<string | null>(null)
const quizName = ref('')
const isPublic = ref(false)

const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveMessage = ref<string | null>(null)
const saveError = ref<string | null>(null)

const canEdit = computed(() => {
  if (isNewQuiz.value) return authStore.isAuthenticated
  return authStore.user !== null && ownerId.value === authStore.user.id
})

// Players
const playerNames = ref<string[]>(['Julien', 'Andrija', 'Cédric'])

function addPlayerSlot() {
  if (playerNames.value.length < 6) playerNames.value.push('')
}

function removePlayerSlot(index: number) {
  if (playerNames.value.length > 2) playerNames.value.splice(index, 1)
}

// Quiz content
const pointTiers = ref<number[]>([...POINT_TIERS])
const categoryNames = ref<string[]>([...defaultQuiz.categories])
const questions = reactive<Question[][]>(buildQuestionsFromConfig(defaultQuiz))
const activeCategoryTab = ref(0)

function buildQuestionsFromConfig(config: QuizConfig): Question[][] {
  return config.questions.map((cat) =>
    cat.map((q) => {
      if (q.type === 'guess_the_most') {
        return {
          type: 'guess_the_most' as const,
          text: q.text,
          words: q.words.map((w) => ({ word: w.word, foundBy: null })),
          imageUrl: q.imageUrl,
        }
      }
      return { type: 'direct' as const, text: q.text, answer: q.answer, imageUrl: q.imageUrl }
    }),
  )
}

function applyDetail(detail: QuizDetail) {
  quizId.value = detail.id
  ownerId.value = detail.ownerId
  quizName.value = detail.name
  isPublic.value = detail.isPublic
  pointTiers.value = [...detail.pointTiers]
  categoryNames.value = [...detail.categories]
  const built = buildQuestionsFromConfig({
    name: detail.name,
    categories: detail.categories,
    pointTiers: detail.pointTiers,
    questions: detail.questions,
  })
  questions.splice(0, questions.length, ...built)
  activeCategoryTab.value = 0
}

function applyDefault() {
  quizId.value = null
  ownerId.value = null
  quizName.value = 'Nouveau quiz'
  isPublic.value = false
  pointTiers.value = [...POINT_TIERS]
  categoryNames.value = [...defaultQuiz.categories]
  const built = buildQuestionsFromConfig(defaultQuiz)
  questions.splice(0, questions.length, ...built)
  activeCategoryTab.value = 0
}

async function loadQuiz() {
  loadError.value = null
  if (isNewQuiz.value) {
    applyDefault()
    return
  }
  if (!routeId.value) return
  loading.value = true
  try {
    const detail = await quizzesApi.get(routeId.value)
    applyDetail(detail)
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : 'Erreur de chargement du quiz'
  } finally {
    loading.value = false
  }
}

onMounted(loadQuiz)
watch(routeId, loadQuiz)

function setQuestionType(catIdx: number, tierIdx: number, type: 'direct' | 'guess_the_most') {
  const existing = questions[catIdx]![tierIdx]!
  if (type === 'direct') {
    questions[catIdx]![tierIdx] = {
      type: 'direct',
      text: existing.text,
      answer: '',
      imageUrl: existing.imageUrl,
    }
  } else {
    questions[catIdx]![tierIdx] = {
      type: 'guess_the_most',
      text: existing.text,
      words: [{ word: '', foundBy: null }],
      imageUrl: existing.imageUrl,
    }
  }
}

function addWord(catIdx: number, tierIdx: number) {
  const q = questions[catIdx]![tierIdx] as GuessTheMostQuestion
  q.words.push({ word: '', foundBy: null })
}

function removeWord(catIdx: number, tierIdx: number, wordIdx: number) {
  const q = questions[catIdx]![tierIdx] as GuessTheMostQuestion
  if (q.words.length > 1) q.words.splice(wordIdx, 1)
}

function handleImageFile(catIdx: number, tierIdx: number, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    questions[catIdx]![tierIdx]!.imageUrl = reader.result as string
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function removeImage(catIdx: number, tierIdx: number) {
  questions[catIdx]![tierIdx]!.imageUrl = undefined
}

// Serialize current state to QuizInput (for save) or QuizConfig (for export)
function buildInput(): QuizInput {
  return {
    name: quizName.value.trim() || 'Sans titre',
    isPublic: isPublic.value,
    categories: categoryNames.value.map((n) => n.trim()),
    pointTiers: [...pointTiers.value],
    questions: questions.map((cat) =>
      cat.map((q) => {
        if (q.type === 'guess_the_most') {
          return {
            type: 'guess_the_most' as const,
            text: q.text,
            words: q.words.map((w) => ({ word: w.word, foundBy: null })),
            imageUrl: q.imageUrl,
          }
        }
        return { type: 'direct' as const, text: q.text, answer: q.answer, imageUrl: q.imageUrl }
      }),
    ),
  }
}

async function saveQuiz() {
  if (!canEdit.value) return
  saveMessage.value = null
  saveError.value = null
  saving.value = true
  try {
    const input = buildInput()
    const detail = quizId.value
      ? await quizzesApi.update(quizId.value, input)
      : await quizzesApi.create(input)
    applyDetail(detail)
    saveMessage.value = 'Quiz sauvegardé'
    if (isNewQuiz.value) {
      router.replace(`/quizzes/${detail.id}`)
    }
  } catch (e) {
    saveError.value = e instanceof ApiError ? e.message : 'Erreur de sauvegarde'
  } finally {
    saving.value = false
  }
}

// Export / Import (still useful for offline backup)
function exportQuiz() {
  const config: QuizConfig = {
    name: quizName.value || 'Genial Quizz Export',
    categories: [...categoryNames.value],
    pointTiers: [...pointTiers.value],
    questions: questions.map((cat) =>
      cat.map((q) => {
        if (q.type === 'guess_the_most') {
          return {
            type: 'guess_the_most' as const,
            text: q.text,
            words: q.words.map((w) => ({ word: w.word, foundBy: null })),
            imageUrl: q.imageUrl,
          }
        }
        return { type: 'direct' as const, text: q.text, answer: q.answer, imageUrl: q.imageUrl }
      }),
    ),
  }

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(quizName.value || 'genial-quizz').replace(/\s+/g, '-').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  importInput.value?.click()
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const config = JSON.parse(reader.result as string) as QuizConfig
      if (!config.categories || !config.questions) {
        alert('Fichier invalide : categories ou questions manquantes.')
        return
      }
      if (config.name) quizName.value = config.name
      categoryNames.value = [...config.categories]
      if (config.pointTiers) pointTiers.value = [...config.pointTiers]
      const built = buildQuestionsFromConfig(config)
      questions.splice(0, questions.length, ...built)
      activeCategoryTab.value = 0
    } catch {
      alert('Erreur lors de la lecture du fichier JSON.')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

// Validation / Play
function canStart(): boolean {
  const validPlayers = playerNames.value.filter((n) => n.trim().length > 0)
  if (validPlayers.length < 2) return false
  for (const name of categoryNames.value) {
    if (!name.trim()) return false
  }
  return true
}

function startGame() {
  if (!canStart()) return
  const validPlayers = playerNames.value
    .filter((n) => n.trim().length > 0)
    .map((name) => ({ name: name.trim() }))

  playerStore.setPlayers(validPlayers)
  gameStore.initCategories(
    categoryNames.value.map((n) => n.trim()),
    questions,
    pointTiers.value,
  )
  gameStore.startGame()
  router.push('/board')
}
</script>

<template>
  <div class="setup-page">
    <header class="setup-header">
      <div class="header-top">
        <RouterLink to="/quizzes" class="btn btn-back">← Retour</RouterLink>
        <h1>GENIAL QUIZZ</h1>
        <div class="header-spacer"></div>
      </div>
      <p class="subtitle">
        {{
          isNewQuiz ? 'Créer un nouveau quiz' : canEdit ? 'Éditer et jouer' : 'Consulter et jouer'
        }}
      </p>
    </header>

    <div v-if="loadError" class="banner banner-error">{{ loadError }}</div>
    <div v-if="loading" class="banner">Chargement du quiz...</div>

    <!-- Quiz meta (name + public + save) -->
    <section class="setup-section">
      <div class="meta-row">
        <label class="field meta-name">
          <span class="field-label">Nom du quiz</span>
          <input
            v-model="quizName"
            type="text"
            class="input"
            placeholder="Nom du quiz"
            :disabled="!canEdit"
          />
        </label>

        <label v-if="canEdit" class="toggle">
          <input v-model="isPublic" type="checkbox" />
          <span>Public</span>
        </label>
        <span v-else-if="!isNewQuiz" class="badge" :class="isPublic ? 'public' : 'private'">
          {{ isPublic ? 'Public' : 'Privé' }}
        </span>
      </div>

      <div class="toolbar">
        <button
          v-if="canEdit"
          class="btn btn-save"
          :disabled="saving"
          @click="saveQuiz"
        >
          {{ saving ? 'Sauvegarde...' : quizId ? 'Sauvegarder' : 'Créer le quiz' }}
        </button>
        <button class="btn btn-toolbar" @click="exportQuiz">Exporter JSON</button>
        <button v-if="canEdit" class="btn btn-toolbar" @click="triggerImport">Importer JSON</button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          class="hidden-input"
          @change="handleImport"
        />
      </div>

      <div v-if="saveMessage" class="banner banner-success">{{ saveMessage }}</div>
      <div v-if="saveError" class="banner banner-error">{{ saveError }}</div>
      <div v-if="isNewQuiz && !authStore.isAuthenticated" class="banner">
        Connectez-vous pour sauvegarder ce quiz sur le serveur.
      </div>
    </section>

    <!-- Players -->
    <section class="setup-section">
      <h2>Joueurs</h2>
      <div class="players-grid">
        <div v-for="(_, index) in playerNames" :key="index" class="player-input-row">
          <span class="player-number">{{ index + 1 }}</span>
          <input
            v-model="playerNames[index]"
            type="text"
            :placeholder="`Joueur ${index + 1}`"
            class="input"
          />
          <button
            v-if="playerNames.length > 2"
            class="btn-icon btn-remove"
            @click="removePlayerSlot(index)"
          >
            &times;
          </button>
        </div>
      </div>
      <button v-if="playerNames.length < 6" class="btn btn-secondary" @click="addPlayerSlot">
        + Ajouter un joueur
      </button>
    </section>

    <!-- Categories -->
    <section class="setup-section">
      <h2>Categories</h2>
      <div class="categories-grid">
        <div v-for="(_, index) in categoryNames" :key="index" class="category-input-row">
          <span class="category-number">{{ index + 1 }}</span>
          <input
            v-model="categoryNames[index]"
            type="text"
            :placeholder="`Categorie ${index + 1}`"
            class="input"
            :disabled="!canEdit"
          />
        </div>
      </div>
    </section>

    <!-- Questions -->
    <section class="setup-section">
      <h2>Questions</h2>
      <div class="category-tabs">
        <button
          v-for="(cat, idx) in categoryNames"
          :key="idx"
          class="tab"
          :class="{ active: activeCategoryTab === idx }"
          @click="activeCategoryTab = idx"
        >
          {{ cat || `Cat ${idx + 1}` }}
        </button>
      </div>

      <div class="questions-list">
        <div v-for="(_tier, tierIdx) in pointTiers" :key="tierIdx" class="question-card">
          <div class="question-header">
            <div class="points-badge-edit">
              <input
                v-model.number="pointTiers[tierIdx]"
                type="number"
                min="0"
                step="50"
                class="points-input"
                :disabled="!canEdit"
              />
              <span class="points-suffix">pts</span>
            </div>
            <select
              :value="questions[activeCategoryTab]![tierIdx]!.type"
              class="type-select"
              :disabled="!canEdit"
              @change="
                setQuestionType(
                  activeCategoryTab,
                  tierIdx,
                  ($event.target as HTMLSelectElement).value as 'direct' | 'guess_the_most',
                )
              "
            >
              <option value="direct">Direct</option>
              <option value="guess_the_most">Guess the Most</option>
            </select>
          </div>

          <input
            v-model="questions[activeCategoryTab]![tierIdx]!.text"
            type="text"
            placeholder="Question..."
            class="input input-full"
            :disabled="!canEdit"
          />

          <template v-if="questions[activeCategoryTab]![tierIdx]!.type === 'direct'">
            <input
              v-model="(questions[activeCategoryTab]![tierIdx] as DirectQuestion).answer"
              type="text"
              placeholder="Reponse..."
              class="input input-full"
              :disabled="!canEdit"
            />
          </template>

          <template v-else>
            <div class="words-section">
              <div
                v-for="(word, wIdx) in (
                  questions[activeCategoryTab]![tierIdx] as GuessTheMostQuestion
                ).words"
                :key="wIdx"
                class="word-row"
              >
                <input
                  v-model="word.word"
                  type="text"
                  :placeholder="`Mot ${wIdx + 1}`"
                  class="input"
                  :disabled="!canEdit"
                />
                <button
                  v-if="
                    canEdit &&
                    (questions[activeCategoryTab]![tierIdx] as GuessTheMostQuestion).words.length >
                      1
                  "
                  class="btn-icon btn-remove-small"
                  @click="removeWord(activeCategoryTab, tierIdx, wIdx)"
                >
                  &times;
                </button>
              </div>
              <button
                v-if="canEdit"
                class="btn btn-small btn-secondary"
                @click="addWord(activeCategoryTab, tierIdx)"
              >
                + Mot
              </button>
            </div>
          </template>

          <div class="image-section">
            <div class="image-label">Image (optionnel)</div>
            <div v-if="canEdit" class="image-controls">
              <input
                :value="
                  questions[activeCategoryTab]![tierIdx]!.imageUrl?.startsWith('data:')
                    ? ''
                    : (questions[activeCategoryTab]![tierIdx]!.imageUrl ?? '')
                "
                type="text"
                placeholder="URL de l'image..."
                class="input image-url-input"
                @input="
                  questions[activeCategoryTab]![tierIdx]!.imageUrl =
                    ($event.target as HTMLInputElement).value || undefined
                "
              />
              <label class="btn btn-small btn-secondary btn-upload">
                Fichier
                <input
                  type="file"
                  accept="image/*"
                  class="hidden-input"
                  @change="handleImageFile(activeCategoryTab, tierIdx, $event)"
                />
              </label>
              <button
                v-if="questions[activeCategoryTab]![tierIdx]!.imageUrl"
                class="btn-icon btn-remove-small"
                @click="removeImage(activeCategoryTab, tierIdx)"
              >
                &times;
              </button>
            </div>
            <div v-if="questions[activeCategoryTab]![tierIdx]!.imageUrl" class="image-preview">
              <img :src="questions[activeCategoryTab]![tierIdx]!.imageUrl" alt="Preview" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="start-section">
      <button class="btn btn-start" :disabled="!canStart()" @click="startGame">
        Lancer la partie !
      </button>
    </div>
  </div>
</template>

<style scoped>
.setup-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}

.setup-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.header-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.header-top h1 {
  font-size: 2.5rem;
  color: var(--color-navy);
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 var(--color-primary);
  flex: 1;
}

.header-spacer {
  width: 80px;
}

.btn-back {
  background: transparent;
  color: var(--color-navy);
  border: 2px solid var(--color-primary-dark);
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.85rem;
  text-decoration: none;
  transition: all 0.2s;
  width: 80px;
  text-align: center;
}

.btn-back:hover {
  background: var(--color-primary);
}

.subtitle {
  font-size: 1rem;
  color: var(--color-text-light);
}

.banner {
  padding: 0.6rem 0.9rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
  font-weight: 600;
  background: var(--color-bg-dark);
  border: 2px solid var(--color-border);
}

.banner-success {
  background: #e8f8f0;
  border-color: var(--color-green);
  color: var(--color-green);
}

.banner-error {
  background: #fde8ea;
  border-color: var(--color-red);
  color: var(--color-red);
}

.toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.btn-toolbar {
  background: var(--color-navy);
  color: var(--color-primary);
  padding: 0.45rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.85rem;
}

.btn-toolbar:hover {
  opacity: 0.85;
}

.btn-save {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  color: var(--color-navy);
  padding: 0.45rem 1.1rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.9rem;
  box-shadow: var(--shadow-gold);
}

.btn-save:hover:not(:disabled) {
  box-shadow: var(--shadow-gold-lg);
}

.btn-save:disabled {
  opacity: 0.5;
}

.hidden-input {
  display: none;
}

.setup-section {
  background: var(--color-white);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-warm);
  border: 2px solid var(--color-primary-dark);
}

.setup-section h2 {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
  color: var(--color-navy);
}

.meta-row {
  display: flex;
  align-items: end;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta-name {
  flex: 1;
  min-width: 240px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-light);
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  color: var(--color-navy);
  padding-bottom: 0.4rem;
  cursor: pointer;
}

.toggle input {
  width: 20px;
  height: 20px;
  accent-color: var(--color-primary-dark);
}

.badge {
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge.public {
  background: #e8f8f0;
  color: var(--color-green);
  border: 1.5px solid var(--color-green);
}

.badge.private {
  background: var(--color-bg-dark);
  color: var(--color-text-light);
  border: 1.5px solid var(--color-border);
}

.input {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  font-size: 0.95rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-primary-dark);
}

.input:disabled {
  background: #f4efd9;
  cursor: default;
}

.input-full {
  width: 100%;
  margin-top: 0.5rem;
}

.players-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.player-input-row,
.category-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.player-input-row .input,
.category-input-row .input {
  flex: 1;
}

.player-number,
.category-number {
  width: 28px;
  height: 28px;
  background: var(--color-primary);
  color: var(--color-navy);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  flex-shrink: 0;
}

.btn-remove {
  background: var(--color-red);
  color: white;
}

.btn-remove:hover {
  background: #c0313d;
}

.btn-remove-small {
  width: 26px;
  height: 26px;
  font-size: 1rem;
  background: var(--color-red);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.categories-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.category-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.tab {
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-pill);
  background: var(--color-bg-dark);
  color: var(--color-text);
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.tab:hover {
  background: var(--color-primary);
}

.tab.active {
  background: var(--color-primary);
  color: var(--color-navy);
  border-color: var(--color-amber);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.question-card {
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.points-badge-edit {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  padding: 0.15rem 0.6rem 0.15rem 0.3rem;
}

.points-input {
  width: 60px;
  border: none;
  background: transparent;
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-navy);
  text-align: center;
  padding: 0;
}

.points-input:focus {
  outline: none;
}

.points-input::-webkit-outer-spin-button,
.points-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.points-input[type='number'] {
  -moz-appearance: textfield;
}

.points-suffix {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--color-navy);
  opacity: 0.7;
}

.type-select {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0.3rem 0.5rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  background: white;
  color: var(--color-text);
}

.words-section {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.word-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.word-row .input {
  flex: 1;
}

.image-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.image-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-light);
  margin-bottom: 0.35rem;
}

.image-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.image-url-input {
  flex: 1;
}

.btn-upload {
  cursor: pointer;
  flex-shrink: 0;
}

.image-preview {
  margin-top: 0.5rem;
}

.image-preview img {
  max-width: 200px;
  max-height: 120px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-border);
  object-fit: cover;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.95rem;
  transition: all 0.2s;
  cursor: pointer;
  border: 2px solid transparent;
}

.btn-secondary {
  background: var(--color-bg-dark);
  color: var(--color-text);
  border: 2px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-primary);
  border-color: var(--color-amber);
}

.btn-small {
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
}

.start-section {
  text-align: center;
  margin-top: 1.5rem;
  margin-bottom: 3rem;
}

.btn-start {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 1.5rem;
  padding: 1rem 3rem;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-gold-lg);
  transition: all 0.3s;
  letter-spacing: 1px;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(255, 193, 7, 0.5);
}

.btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
