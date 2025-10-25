<template>
	<div class="app-root">
		<h1 class="title">Spooky Platformer</h1>
		<GameCanvas />
		<div class="help">
			<p>Controls: A/D or ←/→ to move, Space to jump, 1-3 to change level, R to reset</p>
		</div>
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
.title {
	color: #f5f3ff;
	text-shadow: 0 0 8px rgba(178, 102, 255, 0.6);
	font-family: ui-rounded, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
}
.help { color: #cbd5e1; font-size: 0.9rem; }
</style>
