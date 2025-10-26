import type { GameDimensions, LevelDefinition, Platform } from './types'
import { createRenderer } from './renderer'
import { createInput } from './input'
import { LEVELS } from './levels'
import { createPlayer, stepPlayer } from './physics'
import { createCamera } from './camera'

export function createGame(canvas: HTMLCanvasElement, view: GameDimensions) {
	const ctx = canvas.getContext('2d')!
	ctx.imageSmoothingEnabled = false

	let currentLevelIndex = 0
	let level: LevelDefinition = LEVELS[currentLevelIndex]!
	let player = createPlayer(level.spawn)
	const input = createInput()
	const camera = createCamera(view, level.bounds)
	const renderer = createRenderer(ctx, view)

	type Mode = 'start' | 'playing' | 'end'
	let mode: Mode = 'start'

	let last = performance.now()
	let running = true
	let elapsed = 0
	let prevJumpHeld = false
	let wasOnGround = false
	let coyoteTimer = 0
	const COYOTE_TIME = 0.12 // 120ms
	let respawnTimer = 0
	const FLASH_DURATION = 0.6
	const FADE_IN_DURATION = 0.45

	// Timing
	const levelTimes: number[] = []
	let levelElapsed = 0

	function startGame() {
		mode = 'playing'
		currentLevelIndex = 0
		level = LEVELS[currentLevelIndex]!
		player = createPlayer(level.spawn)
		camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
		levelTimes.length = 0
		levelElapsed = 0
		elapsed = 0
		prevJumpHeld = false
		wasOnGround = false
		coyoteTimer = 0
		respawnTimer = 0
		renderer.triggerFadeIn(FADE_IN_DURATION)
	}

	function resetLevel(idx = currentLevelIndex) {
		currentLevelIndex = idx
		const next = LEVELS[currentLevelIndex]
		level = next ?? LEVELS[0]!
		player = createPlayer(level.spawn)
		// Immediately snap camera to player in new bounds
		camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
		elapsed = 0
		levelElapsed = 0
		prevJumpHeld = false
		wasOnGround = false
		coyoteTimer = 0
		respawnTimer = 0
		// Begin fade-in after respawn
		renderer.triggerFadeIn(FADE_IN_DURATION)
	}

	function isMostlyOverlappingDoor(): boolean {
		const door = level.exitDoor
		const px = player.pos.x
		const py = player.pos.y
		const pw = player.width
		const ph = player.height
		const overlapX = Math.max(0, Math.min(px + pw, door.x + door.w) - Math.max(px, door.x))
		const overlapY = Math.max(0, Math.min(py + ph, door.y + door.h) - Math.max(py, door.y))
		const playerArea = pw * ph
		const overlapArea = overlapX * overlapY
		return overlapArea >= playerArea * 0.5
	}

	function advanceToTargetLevel() {
		// Record level time
		levelTimes.push(levelElapsed)
		levelElapsed = 0
		if (currentLevelIndex >= 4) {
			mode = 'end'
			return
		}
		currentLevelIndex++
		level = LEVELS[currentLevelIndex]!
		player = createPlayer(level.spawn)
		camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
		renderer.triggerFadeIn(FADE_IN_DURATION)
	}

	function computePlatforms(t: number): Platform[] {
		return level.platforms.map(p => {
			if (!p.move) return p
			const nx = p.move.baseX + Math.sin(t * p.move.angularSpeed + p.move.phase) * p.move.range
			return { ...p, x: nx }
		})
	}

	function attachEntitiesToPlatforms(platforms: Platform[]) {
		const idToPlatform = new Map<number, Platform>()
		for (const p of platforms) idToPlatform.set(p.id, p)
		const d = level.exitDoor
		if (d.attachToPlatformId != null && d.localOffsetX != null) {
			const p = idToPlatform.get(d.attachToPlatformId)
			if (p) {
				d.x = p.x + d.localOffsetX
				d.y = p.y - d.h
			}
		}
	}

	function findSupportingPlatform(platforms: Platform[]): Platform | null {
		const eps = 1
		const footY = player.pos.y + player.height
		for (const p of platforms) {
			// Only stand on top surface
			const horizontallyOver = (player.pos.x + player.width) > p.x && player.pos.x < (p.x + p.w)
			const onTop = Math.abs(footY - p.y) <= eps
			if (horizontallyOver && onTop) return p
		}
		return null
	}

	function update(dt: number, tPrev: number, tCurr: number) {
		if (mode === 'start') {
			// Press space to begin
			if (input.state.jump && !prevJumpHeld) startGame()
			return
		}
		if (mode === 'end') {
			// Press space to restart
			if (input.state.jump && !prevJumpHeld) startGame()
			return
		}

		levelElapsed += dt
		// If waiting to respawn, count down and respawn when time elapses
		if (respawnTimer > 0) {
			respawnTimer -= dt
			if (respawnTimer <= 0) {
				resetLevel(currentLevelIndex)
			}
			return
		}

		// Handle level switching keys for testing
		if (input.state.level) {
			const idx = input.state.level - 1
			if (idx >= 0 && idx < LEVELS.length) resetLevel(idx)
			input.state.level = null
		}
		if (input.state.reset) {
			resetLevel(currentLevelIndex)
			input.state.reset = false
		}

		const prevPlatforms = computePlatforms(tPrev)
		const currPlatforms = computePlatforms(tCurr)
		attachEntitiesToPlatforms(currPlatforms)

		// Rising-edge + variable jump + coyote time
		const jumpPressed = input.state.jump && !prevJumpHeld
		const jumpHeld = input.state.jump
		const coyoteAvailable = coyoteTimer > 0
		stepPlayer(player, dt, { left: input.state.left, right: input.state.right, jumpPressed, jumpHeld, down: input.state.down, coyoteAvailable }, currPlatforms)
		prevJumpHeld = input.state.jump

		// Update coyote timer based on grounded state
		if (player.onGround) {
			coyoteTimer = COYOTE_TIME
		} else {
			coyoteTimer -= dt
			if (coyoteTimer < 0) coyoteTimer = 0
		}

		// Landing dust
		if (!wasOnGround && player.onGround) {
			for (let i = 0; i < 4; i++) {
				renderer.spawnDust(player.pos.x + player.width / 2, player.pos.y + player.height)
			}
		}
		wasOnGround = player.onGround

		// Platform carry: if standing on a moving platform, move with its delta
		if (player.onGround) {
			const support = findSupportingPlatform(currPlatforms)
			if (support) {
				const prev = prevPlatforms.find(p => p.id === support.id)
				if (prev) {
					const dx = support.x - prev.x
					player.pos.x += dx
				}
			}
		}

		// Door overlap check
		if (isMostlyOverlappingDoor()) {
			advanceToTargetLevel()
		}

		// Death zone: push it farther down (so ghost fully off-screen before trigger)
		const playerBottom = player.pos.y + player.height
		const deathY = camera.pos.y + view.height + 120
		if (playerBottom > deathY) {
			renderer.triggerFlash(FLASH_DURATION)
			respawnTimer = FLASH_DURATION
			return
		}

		camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
	}

	function frame(now: number) {
		if (!running) return
		const dt = Math.min(1 / 30, (now - last) / 1000)
		const tPrev = elapsed
		last = now
		elapsed += dt
		const tCurr = elapsed
		update(dt, tPrev, tCurr)
		const platforms = computePlatforms(elapsed)
		attachEntitiesToPlatforms(platforms)
		if (mode === 'start') {
			renderer.renderStartScreen('Spooky Climb', 'Press Space to Play')
		} else if (mode === 'end') {
			const total = levelTimes.reduce((a, b) => a + b, 0)
			const names = LEVELS.map(l => l.title)
			renderer.renderEndScreen(levelTimes, total, names)
		} else {
			renderer.render(level, player, level.enemies, camera.pos, dt, platforms)
		}
		requestAnimationFrame(frame)
	}

	requestAnimationFrame(frame)

	return () => {
		running = false
		input.dispose()
	}
}
