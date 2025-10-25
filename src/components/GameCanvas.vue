<template>
	<div class="canvas-wrap">
		<canvas ref="canvasRef" :width="canvasWidth" :height="canvasHeight" />
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { createGame } from '@/game/game'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWidth = 960
const canvasHeight = 720

let dispose: (() => void) | null = null

onMounted(() => {
	if (!canvasRef.value) return
	dispose = createGame(canvasRef.value, { width: canvasWidth, height: canvasHeight })
})

onUnmounted(() => {
	if (dispose) dispose()
})
</script>

<style scoped>
.canvas-wrap {
	border: 2px solid rgba(124, 58, 237, 0.4);
	box-shadow: 0 0 24px rgba(124, 58, 237, 0.25);
	border-radius: 8px;
	overflow: hidden;
}
canvas { display: block; }
</style>
