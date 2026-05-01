<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import type { QuestionCell } from '@/types'
import PlayerSidebar from '@/components/PlayerSidebar.vue'
import QuestionModal from '@/components/QuestionModal.vue'

const router = useRouter()
const gameStore = useGameStore()
const playerStore = usePlayerStore()

const selectedCell = ref<QuestionCell | null>(null)

onMounted(() => {
  if (gameStore.phase !== 'playing' || gameStore.categories.length === 0) {
    router.replace('/quizzes')
  }
})

function openCell(catIdx: number, tierIdx: number) {
  const cell = gameStore.getCell(catIdx, tierIdx)
  if (cell && !cell.played) {
    selectedCell.value = cell
  }
}

function closeModal() {
  selectedCell.value = null
}

function backToSetup() {
  gameStore.resetGame()
  router.push('/quizzes')
}
</script>

<template>
  <div class="board-page">
    <!-- Sidebar -->
    <div class="sidebar-area">
      <PlayerSidebar />
      <div class="sidebar-footer">
        <div class="progress-info">
          {{ gameStore.playedCells }} / {{ gameStore.totalCells }} questions
        </div>
        <button class="btn-back" @click="backToSetup">Retour aux quizz</button>
      </div>
    </div>

    <!-- Main Grid -->
    <main class="grid-area">
      <div
        class="game-grid"
        :style="{ gridTemplateColumns: `repeat(${Math.max(gameStore.categories.length, 1)}, 1fr)` }"
      >
        <!-- Category headers -->
        <div
          v-for="(cat, catIdx) in gameStore.categories"
          :key="'header-' + catIdx"
          class="grid-header"
        >
          {{ cat.name }}
        </div>

        <!-- Question cells -->
        <template
          v-for="tierIdx in gameStore.categories[0]?.questions.length ?? 0"
          :key="'tier-' + tierIdx"
        >
          <div
            v-for="(cat, catIdx) in gameStore.categories"
            :key="catIdx + '-' + tierIdx"
            class="grid-cell"
            :class="{ played: cat.questions[tierIdx - 1]?.played }"
            @click="openCell(catIdx, tierIdx - 1)"
          >
            <span class="cell-points">{{ cat.questions[tierIdx - 1]?.points }}</span>
          </div>
        </template>
      </div>

      <!-- Branding -->
      <div class="branding">
        <div class="branding-planet">
          <div class="ring ring-1"></div>
          <div class="ring ring-2"></div>
          <div class="ring ring-3"></div>
          <div class="branding-core">
            <span class="branding-text">GENIAL</span>
            <span class="branding-text accent">QUIZZ</span>
          </div>
        </div>
      </div>

      <!-- All played message -->
      <div v-if="gameStore.allPlayed" class="game-over">
        <h2>Partie terminee !</h2>
        <div class="final-scores">
          <div
            v-for="player in [...playerStore.players].sort((a, b) => b.score - a.score)"
            :key="player.id"
            class="final-player"
          >
            <span class="final-name">{{ player.name }}</span>
            <span class="final-score" :class="{ negative: player.score < 0 }">{{
              player.score
            }}</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Question Modal -->
    <QuestionModal v-if="selectedCell" :cell="selectedCell" @close="closeModal" />
  </div>
</template>

<style scoped>
.board-page {
  display: flex;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* Hive pattern background on the grid area */
.grid-area::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('@/assets/hive-pattern.jpg');
  background-size: 400px;
  background-repeat: repeat;
  opacity: 0.07;
  pointer-events: none;
  z-index: 0;
}

.sidebar-area {
  width: 270px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #f0f4fb, #e6ecf7);
  border-right: 3px solid #c4d4ec;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 1;
}

.sidebar-footer {
  padding: 0.6rem 0.85rem;
  border-top: 2px solid #c4d4ec;
  margin-top: auto;
  background: rgba(255, 255, 255, 0.4);
}

.progress-info {
  text-align: center;
  font-weight: 600;
  color: var(--color-text-light);
  font-size: 0.8rem;
  margin-bottom: 0.4rem;
}

.btn-back {
  width: 100%;
  padding: 0.4rem;
  background: white;
  border: 2px solid #c4d4ec;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-weight: 600;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn-back:hover {
  background: var(--color-primary);
  border-color: var(--color-amber);
}

.grid-area {
  flex: 1;
  padding: 1rem 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.game-grid {
  display: grid;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 900px;
}

.grid-header {
  background: var(--color-navy);
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: 0.85rem;
  text-align: center;
  padding: 0.6rem 0.25rem;
  border-radius: var(--radius-sm);
  word-break: break-word;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}

.grid-cell {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  border: 2px solid var(--color-amber);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(255, 179, 0, 0.12);
  min-height: 64px;
}

.grid-cell:hover:not(.played) {
  transform: scale(1.06);
  box-shadow: var(--shadow-gold);
  z-index: 2;
}

.grid-cell.played {
  background: var(--color-played);
  border-color: #d5cdb0;
  opacity: 0.45;
  cursor: default;
}

.grid-cell.played .cell-points {
  color: #a09880;
}

.cell-points {
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--color-navy);
}

/* Branding */
.branding {
  text-align: center;
  padding: 1.5rem 0 0.5rem;
  position: relative;
  z-index: 1;
  user-select: none;
}

.branding-planet {
  position: relative;
  display: inline-block;
  width: 420px;
  height: 100px;
}

.branding-core {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  z-index: 2;
}

.branding-text {
  font-family: var(--font-display);
  font-size: 3.2rem;
  color: var(--color-navy);
  letter-spacing: 5px;
  text-shadow: 3px 3px 0 var(--color-primary);
  opacity: 0.65;
}

.branding-text.accent {
  color: var(--color-primary-dark);
  text-shadow: 3px 3px 0 var(--color-amber);
}

/* Static Saturn-like rings */
.ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  border-style: solid;
  border-color: transparent;
  pointer-events: none;
}

.ring-1 {
  width: 380px;
  height: 50px;
  transform: translate(-50%, -50%) rotate(-6deg);
  border-width: 2px;
  border-top-color: rgba(255, 193, 7, 0.3);
  border-bottom-color: rgba(255, 193, 7, 0.3);
}

.ring-2 {
  width: 340px;
  height: 36px;
  transform: translate(-50%, -50%) rotate(-6deg);
  border-width: 1.5px;
  border-top-color: rgba(255, 179, 0, 0.2);
  border-bottom-color: rgba(255, 179, 0, 0.2);
}

.ring-3 {
  width: 420px;
  height: 64px;
  transform: translate(-50%, -50%) rotate(-6deg);
  border-width: 1px;
  border-top-color: rgba(255, 107, 53, 0.15);
  border-bottom-color: rgba(255, 107, 53, 0.15);
}

/* Game over */
.game-over {
  text-align: center;
  margin-top: 1rem;
  padding: 1.5rem;
  background: var(--color-white);
  border-radius: var(--radius-xl);
  border: 3px solid var(--color-primary-dark);
  box-shadow: var(--shadow-gold-lg);
  position: relative;
  z-index: 1;
  max-width: 500px;
}

.game-over h2 {
  font-size: 1.6rem;
  margin-bottom: 0.75rem;
  color: var(--color-navy);
}

.final-scores {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 360px;
  margin: 0 auto;
}

.final-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 2px solid var(--color-amber);
}

.final-player:first-child {
  border-color: var(--color-orange);
  box-shadow: var(--shadow-gold);
}

.final-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-navy);
}

.final-score {
  font-family: var(--font-display);
  font-size: 1.2rem;
  color: var(--color-navy);
}

.final-score.negative {
  color: var(--color-red);
}
</style>
