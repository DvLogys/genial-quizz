<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameStore } from '@/stores/game'
import { resolveMediaUrl } from '@/api/client'
import type { QuestionCell, GuessTheMostQuestion, DirectQuestion } from '@/types'

const props = defineProps<{
  cell: QuestionCell
}>()

const emit = defineEmits<{
  close: []
}>()

const playerStore = usePlayerStore()
const gameStore = useGameStore()

const answerRevealed = ref(false)
const selectedPlayerId = ref<string | null>(playerStore.activePlayer?.id ?? null)
const scored = ref(false)

// For guess_the_most
const guessQuestion = computed(() => {
  if (props.cell.question.type === 'guess_the_most') {
    return props.cell.question as GuessTheMostQuestion
  }
  return null
})

const revealedWords = ref<Set<number>>(new Set())
const wordAssignments = ref<Record<number, string>>({})

const audioRef = ref<HTMLAudioElement | null>(null)

const audioSrc = computed(() => {
  if (props.cell.question.type !== 'direct') return undefined
  return resolveMediaUrl((props.cell.question as DirectQuestion).audioUrl)
})

const audioStart = computed(() => {
  if (props.cell.question.type !== 'direct') return 0
  return (props.cell.question as DirectQuestion).audioStartSeconds ?? 0
})

function onAudioMetadataLoaded() {
  const el = audioRef.value
  if (!el) return
  if (audioStart.value > 0 && Number.isFinite(el.duration) && audioStart.value < el.duration) {
    el.currentTime = audioStart.value
  }
}

const pointPerWord = computed(() => {
  if (!guessQuestion.value) return 0
  return Math.floor(props.cell.points / guessQuestion.value.words.length)
})

function revealWord(index: number) {
  revealedWords.value.add(index)
}

function assignWordToPlayer(wordIndex: number, playerId: string) {
  wordAssignments.value[wordIndex] = playerId
  playerStore.updateScore(playerId, pointPerWord.value)
}

function scoreCorrect() {
  if (!selectedPlayerId.value) return
  playerStore.updateScore(selectedPlayerId.value, props.cell.points)
  scored.value = true
  finishAndClose()
}

function scoreHalf() {
  if (!selectedPlayerId.value) return
  playerStore.updateScore(selectedPlayerId.value, Math.floor(props.cell.points / 2))
  scored.value = true
  finishAndClose()
}

function scoreWrong() {
  if (!selectedPlayerId.value) return
  playerStore.updateScore(selectedPlayerId.value, -props.cell.points)
  scored.value = true
  finishAndClose()
}

function skip() {
  finishAndClose()
}

function finishAndClose() {
  gameStore.markPlayed(props.cell.categoryIndex, props.cell.tierIndex)
  emit('close')
}

function finishGuess() {
  finishAndClose()
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="modal" @click.stop>
        <!-- Header -->
        <div class="modal-header">
          <span class="modal-points">{{ cell.points }} pts</span>
          <span class="modal-type-badge">{{
            cell.question.type === 'direct' ? 'Direct' : 'Guess the Most'
          }}</span>
          <button class="modal-close" @click="emit('close')">&times;</button>
        </div>

        <!-- Question -->
        <div class="modal-question">
          {{ cell.question.text }}
        </div>

        <!-- Question image -->
        <div v-if="cell.question.imageUrl" class="modal-image">
          <img :src="resolveMediaUrl(cell.question.imageUrl)" alt="Question image" />
        </div>

        <!-- Audio (direct only) -->
        <div
          v-if="cell.question.type === 'direct' && cell.question.audioUrl"
          class="modal-audio"
        >
          <audio
            ref="audioRef"
            :src="audioSrc"
            controls
            preload="auto"
            @loadedmetadata="onAudioMetadataLoaded"
          ></audio>
        </div>

        <!-- DIRECT TYPE -->
        <template v-if="cell.question.type === 'direct'">
          <!-- Answer reveal -->
          <div class="answer-section">
            <button v-if="!answerRevealed" class="btn btn-reveal" @click="answerRevealed = true">
              Reveler la reponse
            </button>
            <div v-else class="answer-box">
              <span class="answer-label">Reponse :</span>
              <span class="answer-text">{{ cell.question.answer }}</span>
            </div>
          </div>

          <!-- Player selector -->
          <div class="player-select-section">
            <label class="select-label">Qui repond ?</label>
            <div class="player-chips">
              <button
                v-for="player in playerStore.players"
                :key="player.id"
                class="chip"
                :class="{ selected: selectedPlayerId === player.id }"
                @click="selectedPlayerId = player.id"
              >
                {{ player.name }}
              </button>
            </div>
          </div>

          <!-- Scoring buttons -->
          <div class="scoring-buttons">
            <button
              class="btn btn-correct"
              :disabled="!selectedPlayerId || scored"
              @click="scoreCorrect"
            >
              Correct +{{ cell.points }}
            </button>
            <button class="btn btn-half" :disabled="!selectedPlayerId || scored" @click="scoreHalf">
              Moitie +{{ Math.floor(cell.points / 2) }}
            </button>
            <button
              class="btn btn-wrong"
              :disabled="!selectedPlayerId || scored"
              @click="scoreWrong"
            >
              Faux -{{ cell.points }}
            </button>
            <button class="btn btn-skip" @click="skip">Passer</button>
          </div>
        </template>

        <!-- GUESS THE MOST TYPE -->
        <template v-else-if="guessQuestion">
          <div class="guess-section">
            <div class="guess-info">
              <span>{{ pointPerWord }} pts par mot</span>
              <span>{{ revealedWords.size }} / {{ guessQuestion.words.length }} trouves</span>
            </div>

            <div class="words-grid">
              <div
                v-for="(word, idx) in guessQuestion.words"
                :key="idx"
                class="word-card"
                :class="{ revealed: revealedWords.has(idx), assigned: wordAssignments[idx] }"
              >
                <template v-if="!revealedWords.has(idx)">
                  <button class="btn btn-word-reveal" @click="revealWord(idx)">
                    Mot {{ idx + 1 }}
                  </button>
                </template>
                <template v-else>
                  <span class="word-text">{{ word.word }}</span>
                  <div v-if="!wordAssignments[idx]" class="word-assign">
                    <button
                      v-for="player in playerStore.players"
                      :key="player.id"
                      class="chip chip-small"
                      @click="assignWordToPlayer(idx, player.id)"
                    >
                      {{ player.name }}
                    </button>
                  </div>
                  <span v-else class="word-assigned-to">
                    {{ playerStore.players.find((p) => p.id === wordAssignments[idx])?.name }}
                    +{{ pointPerWord }}
                  </span>
                </template>
              </div>
            </div>

            <button class="btn btn-done" @click="finishGuess">Terminer</button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(255, 248, 214, 0.6);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.2s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: var(--color-white);
  border: 3px solid var(--color-primary-dark);
  border-radius: var(--radius-xl);
  width: min(94%, 700px);
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: var(--shadow-gold-lg);
  animation: scale-in 0.25s ease;
}

@media (max-width: 480px) {
  .modal {
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
    border-width: 0;
  }
}

@keyframes scale-in {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-header {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.modal-points {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--color-navy);
}

.modal-type-badge {
  background: rgba(26, 26, 46, 0.15);
  color: var(--color-navy);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill);
  font-size: 0.8rem;
  font-weight: 600;
}

.modal-close {
  margin-left: auto;
  background: none;
  font-size: 1.8rem;
  color: var(--color-navy);
  line-height: 1;
  padding: 0 0.25rem;
}

.modal-close:hover {
  opacity: 0.6;
}

.modal-question {
  padding: 1.5rem;
  font-size: clamp(1rem, 3.5vw, 1.3rem);
  font-weight: 600;
  color: var(--color-navy);
  text-align: center;
  line-height: 1.5;
}

.modal-image {
  text-align: center;
  padding: 0 1.5rem 1rem;
}

.modal-image img {
  max-width: 100%;
  max-height: 300px;
  border-radius: var(--radius-md);
  border: 2px solid var(--color-border);
  object-fit: contain;
  box-shadow: var(--shadow-warm);
}

.modal-audio {
  text-align: center;
  padding: 0 1.5rem 1rem;
}

.modal-audio audio {
  width: 100%;
  max-width: 480px;
}

.answer-section {
  padding: 0 1.5rem 1rem;
  text-align: center;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-reveal {
  background: var(--color-navy);
  color: var(--color-primary);
  font-size: 1.1rem;
  padding: 0.75rem 2rem;
}

.btn-reveal:hover {
  opacity: 0.85;
}

.answer-box {
  background: var(--color-bg);
  border: 2px solid var(--color-green);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  animation: scale-in 0.2s ease;
}

.answer-label {
  font-size: 0.85rem;
  color: var(--color-text-light);
  font-weight: 500;
}

.answer-text {
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: var(--color-green);
}

.player-select-section {
  padding: 0 1.5rem 1rem;
}

.select-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text-light);
}

.player-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  padding: 0.35rem 0.8rem;
  border-radius: var(--radius-pill);
  background: var(--color-bg-dark);
  color: var(--color-text);
  font-weight: 600;
  font-size: 0.85rem;
  border: 2px solid transparent;
  transition: all 0.15s;
}

.chip:hover {
  background: var(--color-primary);
}

.chip.selected {
  background: var(--color-primary);
  border-color: var(--color-orange);
  color: var(--color-navy);
}

.chip-small {
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
}

.scoring-buttons {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

@media (max-width: 480px) {
  .scoring-buttons .btn {
    flex: 1 1 calc(50% - 0.5rem);
  }
}

.btn-correct {
  background: var(--color-green);
  color: white;
}

.btn-half {
  background: var(--color-half-orange);
  color: white;
}

.btn-wrong {
  background: var(--color-red);
  color: white;
}

.btn-skip {
  background: var(--color-navy);
  color: var(--color-bg);
}

.btn-correct:hover:not(:disabled) {
  background: #27ae60;
}
.btn-half:hover:not(:disabled) {
  background: #e68900;
}
.btn-wrong:hover:not(:disabled) {
  background: #c0313d;
}
.btn-skip:hover {
  opacity: 0.85;
}

/* Guess the most */
.guess-section {
  padding: 0 1.5rem 1.5rem;
}

.guess-info {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  color: var(--color-text-light);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.words-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.word-card {
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  text-align: center;
  transition: all 0.2s;
}

.word-card.revealed {
  border-color: var(--color-primary-dark);
  background: var(--color-bg-dark);
}

.word-card.assigned {
  border-color: var(--color-green);
  background: #e8f8f0;
}

.btn-word-reveal {
  background: var(--color-navy);
  color: var(--color-primary);
  padding: 0.4rem 0.8rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.85rem;
  width: 100%;
}

.btn-word-reveal:hover {
  opacity: 0.85;
}

.word-text {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--color-navy);
  display: block;
  margin-bottom: 0.5rem;
}

.word-assign {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: center;
}

.word-assigned-to {
  font-weight: 700;
  color: var(--color-green);
  font-size: 0.85rem;
}

.btn-done {
  background: linear-gradient(135deg, var(--color-primary), var(--color-amber));
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 1.1rem;
  padding: 0.75rem 2rem;
  width: 100%;
  box-shadow: var(--shadow-gold);
}

.btn-done:hover {
  box-shadow: var(--shadow-gold-lg);
  transform: translateY(-1px);
}
</style>
