<template>
	<div class="app-root">
		<GameCanvas class="game-canvas" />
	</div>
</template>

<script setup lang="ts">
import GameCanvas from './components/GameCanvas.vue'
</script>

<style scoped>
.app-root {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
}
.help { color: #cbd5e1; font-size: 0.9rem; }
.game-canvas {
	margin-top: 40px; 
}
</style>
