<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'

const playerStore = usePlayerStore()

const customAmounts = ref<Record<string, string>>({})

const sortedPlayers = computed(() =>
  [...playerStore.players].sort((a, b) => b.score - a.score),
)

function quickScore(playerId: string, amount: number) {
  playerStore.updateScore(playerId, amount)
}

function applyCustom(playerId: string) {
  const val = parseInt(customAmounts.value[playerId] ?? '0', 10)
  if (!isNaN(val) && val !== 0) {
    playerStore.updateScore(playerId, val)
    customAmounts.value[playerId] = ''
  }
}
</script>

<template>
  <aside class="sidebar">
    <h2 class="sidebar-title">Joueurs</h2>
    <TransitionGroup name="player" tag="div" class="player-list">
      <div
        v-for="(player, idx) in sortedPlayers"
        :key="player.id"
        class="player-card"
        :class="{ active: player.isActive, leader: idx === 0 && player.score > 0 }"
        @click="playerStore.setActive(player.id)"
      >
        <div class="player-info">
          <span class="player-rank">{{ idx + 1 }}</span>
          <span class="player-name">{{ player.name }}</span>
          <span class="player-score" :class="{ negative: player.score < 0 }">
            {{ player.score }}
          </span>
        </div>
        <div class="player-controls" @click.stop>
          <button class="ctrl-btn minus" @click="quickScore(player.id, -100)">-100</button>
          <div class="custom-score">
            <input
              v-model="customAmounts[player.id]"
              type="number"
              placeholder="±"
              class="custom-input"
              @keyup.enter="applyCustom(player.id)"
            />
            <button class="ctrl-btn apply" @click="applyCustom(player.id)">OK</button>
          </div>
          <button class="ctrl-btn plus" @click="quickScore(player.id, 100)">+100</button>
        </div>
      </div>
    </TransitionGroup>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 100%;
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-title {
  font-size: 1.15rem;
  text-align: center;
  color: var(--color-navy);
  margin-bottom: 0.15rem;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.player-card {
  background: linear-gradient(135deg, #e8f0fe, #dce8fc);
  border: 2px solid #b8cfef;
  border-radius: var(--radius-md);
  padding: 0.6rem 0.7rem;
  cursor: pointer;
  transition: all 0.25s;
  box-shadow: 0 2px 8px rgba(140, 170, 220, 0.15);
}

.player-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(140, 170, 220, 0.25);
}

.player-card.active {
  background: linear-gradient(135deg, #fff0d4, #ffe8b8);
  border-color: var(--color-orange);
  box-shadow:
    0 0 0 2px rgba(255, 107, 53, 0.35),
    0 4px 14px rgba(255, 179, 0, 0.2);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow:
      0 0 0 2px rgba(255, 107, 53, 0.35),
      0 4px 14px rgba(255, 179, 0, 0.2);
  }
  50% {
    box-shadow:
      0 0 0 4px rgba(255, 107, 53, 0.18),
      0 6px 20px rgba(255, 179, 0, 0.3);
  }
}

.player-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.player-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(26, 26, 46, 0.12);
  color: var(--color-navy);
  font-family: var(--font-display);
  font-size: 0.78rem;
  flex-shrink: 0;
}

.player-card.leader .player-rank {
  background: var(--color-amber);
  color: var(--color-navy);
  box-shadow: 0 0 0 2px rgba(255, 193, 7, 0.35);
}

.player-name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-navy);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-score {
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: var(--color-navy);
}

.player-score.negative {
  color: var(--color-red);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.ctrl-btn {
  padding: 0.2rem 0.45rem;
  border-radius: 5px;
  font-weight: 700;
  font-size: 0.7rem;
  transition: all 0.15s;
  flex-shrink: 0;
}

.ctrl-btn.minus {
  background: var(--color-red);
  color: white;
}

.ctrl-btn.plus {
  background: var(--color-green);
  color: white;
}

.ctrl-btn.apply {
  background: var(--color-navy);
  color: white;
  padding: 0.2rem 0.35rem;
}

.ctrl-btn:hover {
  opacity: 0.85;
}

.custom-score {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.custom-input {
  width: 100%;
  min-width: 0;
  padding: 0.2rem 0.3rem;
  border: 2px solid #b8cfef;
  border-radius: 5px;
  font-size: 0.75rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.8);
  font-family: var(--font-body);
}

.custom-input:focus {
  outline: none;
  border-color: var(--color-orange);
}

/* Hide number input arrows */
.custom-input::-webkit-outer-spin-button,
.custom-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.custom-input[type='number'] {
  -moz-appearance: textfield;
}

.player-move,
.player-enter-active,
.player-leave-active {
  transition: transform 0.4s ease, opacity 0.25s ease;
}

.player-enter-from,
.player-leave-to {
  opacity: 0;
}

.player-leave-active {
  position: absolute;
  width: calc(100% - 1.7rem);
}
</style>
