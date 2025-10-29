import type { GameDimensions, LevelDefinition, Platform } from './types'
import { createRenderer } from './renderer'
import { createInput } from './input'
import { LEVELS, buildClassicLevels, buildLevelsFromBaseSeed } from './levels'
import { createPlayer, stepPlayer } from './physics'
import { createCamera } from './camera'
import { playJump, playDoubleJump, playLand, playDoor, startRainAmbience, setRainIntensity, playDeath } from './audio'

export function createGame(canvas: HTMLCanvasElement, view: GameDimensions) {
	const ctx = canvas.getContext('2d')!
	ctx.imageSmoothingEnabled = false

    // Active level pool (may be classic or from a base seed)
    let activeLevels: LevelDefinition[] = LEVELS
    let currentLevelIndex = 0
    let level: LevelDefinition = activeLevels[currentLevelIndex]!
	let player = createPlayer(level.spawn)
	const input = createInput()
	const camera = createCamera(view, level.bounds)
	const renderer = createRenderer(ctx, view)

    type Mode = 'start' | 'playing' | 'transition' | 'end'
	let mode: Mode = 'start'

    // Start menu seed selection state
    type SeedMode = 'classic' | 'random' | 'custom'
    let menuSelected = 1 // 0 Classic, 1 Random, 2 Enter Seed
    let seedMode: SeedMode = 'random'
    let customSeedInput = '' // 0..8 digits
    let baseSeedLabel: string | null = null // Shown under level title (Classic or 8-digit)

    // Edge tracking for menu input
    let prevLeftHeld = false
    let prevRightHeld = false
    let prevEnterHeld = false
    let prevBackspaceHeld = false
    let prevEscapeHeld = false

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

	// Door transition state
	let transitionPhase: 'launch' | 'arrive' = 'launch'
	let transitionTimer = 0
	const LAUNCH_DURATION = 0.6
	const ARRIVE_MIN_TIME = 0.2
	let queuedNextLevelIndex: number | null = null

	// Timing
	const levelTimes: number[] = []
	let levelElapsed = 0

    // --- Start screen click support ---
    type Rect = { x: number; y: number; w: number; h: number }
    function getStartMenuButtonRects(): Rect[] {
        const titleY = Math.floor(view.height * 0.40) - 15
        const baseY = titleY + 120
        const w = 160, h = 42
        const rects: Rect[] = []
        for (let i = 0; i < 3; i++) {
            const cx = view.width / 2 + (i - 1) * 180
            const cy = baseY
            rects.push({ x: cx - w / 2, y: cy - h / 2, w, h })
        }
        return rects
    }
    function getSeedInputRectIfVisible(): Rect | null {
        if (menuSelected !== 2) return null
        const titleY = Math.floor(view.height * 0.40) - 15
        const baseY = titleY + 120
        const labelY = baseY + 56
        const boxW = 260, boxH = 40
        const bx = view.width / 2 - boxW / 2
        const by = labelY + 34
        return { x: bx, y: by, w: boxW, h: boxH }
    }
    function pointInRect(px: number, py: number, r: Rect): boolean {
        return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
    }
    function toCanvasSpace(clientX: number, clientY: number) {
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
    }
    function onPointerDown(e: MouseEvent) {
        if (mode !== 'start') return
        const p = toCanvasSpace(e.clientX, e.clientY)
        const rects = getStartMenuButtonRects()
        for (let i = 0; i < rects.length; i++) {
            if (pointInRect(p.x, p.y, rects[i]!)) {
                if (i === menuSelected) {
                    if (i !== 2 || customSeedInput.length >= 8) startGame()
                } else {
                    menuSelected = i
                }
                return
            }
        }
        const inputRect = getSeedInputRectIfVisible()
        if (inputRect && pointInRect(p.x, p.y, inputRect)) {
            menuSelected = 2
            return
        }
    }

    function startGame() {
		mode = 'playing'
		// Stop menu music if any via renderer side; ensure gameplay is music-free
        currentLevelIndex = 0
        // Determine level pool based on selection
        if (menuSelected === 0) {
            seedMode = 'classic'
            activeLevels = buildClassicLevels()
            baseSeedLabel = 'Classic'
        } else if (menuSelected === 1) {
            seedMode = 'random'
            const rand8 = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
            activeLevels = buildLevelsFromBaseSeed(rand8)
            baseSeedLabel = rand8
        } else {
            seedMode = 'custom'
            const normalized = customSeedInput.replace(/\D/g, '').padStart(8, '0').slice(0, 8)
            activeLevels = buildLevelsFromBaseSeed(normalized)
            baseSeedLabel = normalized
        }
        level = activeLevels[currentLevelIndex]!
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
		startRainAmbience()
		// Prevent immediate jump from start press
		input.state.jump = false
		prevJumpHeld = true
	}

    function beginLevelTransition() {
        if (mode === 'transition') return
		// Queue next level (or end)
        queuedNextLevelIndex = currentLevelIndex >= activeLevels.length - 1 ? null : currentLevelIndex + 1
		// Record level time now
		levelTimes.push(levelElapsed)
		levelElapsed = 0
		// Enter launch phase
		mode = 'transition'
		transitionPhase = 'launch'
		transitionTimer = 0
		player.onGround = false
		player.vel.y = -1600
		player.vel.x = 0
	}

    function resetLevel(idx = currentLevelIndex) {
		currentLevelIndex = idx
        const next = activeLevels[currentLevelIndex]
        level = next ?? activeLevels[0]!
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
        if (currentLevelIndex >= activeLevels.length - 1) {
			mode = 'end'
			return
		}
		currentLevelIndex++
        level = activeLevels[currentLevelIndex]!
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
            // Menu navigation: left/right changes selection (edge only)
            if (input.state.left && !prevLeftHeld) {
                menuSelected = (menuSelected + 2) % 3
            }
            if (input.state.right && !prevRightHeld) {
                menuSelected = (menuSelected + 1) % 3
            }
            // Custom seed input handling
            if (menuSelected === 2) {
                const d = (input.state.lastDigit ?? null)
                if (d && customSeedInput.length < 8) {
                    customSeedInput += d
                    input.state.lastDigit = null
                }
                // If buffer is full and a digit was pressed, clear it so it won't be applied later
                if (input.state.lastDigit && customSeedInput.length >= 8) {
                    input.state.lastDigit = null
                }
                if (input.state.backspace && !prevBackspaceHeld) {
                    customSeedInput = customSeedInput.slice(0, -1)
                    // Clear any pending digit so it doesn't re-appear after deletion
                    input.state.lastDigit = null
                }
            } else {
                // Clear any residual digit
                input.state.lastDigit = null
            }
            // Press space or enter to begin
            const confirmPressed = (input.state.jump && !prevJumpHeld) || (!!input.state.enter && !prevEnterHeld)
            if (confirmPressed) {
                if (menuSelected === 2 && customSeedInput.length < 8) {
                    // Require 8 digits; ignore start until valid
                } else {
                    startGame()
                }
            }
            // track edges
            prevLeftHeld = input.state.left
            prevRightHeld = input.state.right
            prevEnterHeld = !!input.state.enter
            prevBackspaceHeld = !!input.state.backspace
            prevEscapeHeld = !!input.state.escape
			return
		}
	if (mode === 'end') {
			// Press space to restart
			if (input.state.jump && !prevJumpHeld) startGame()
            // Allow Escape to refresh to home
            if (input.state.escape && !prevEscapeHeld) {
                window.location.reload()
                return
            }
            prevEscapeHeld = !!input.state.escape
			return
		}
	if (mode === 'transition') {
		// Inputs disabled
        prevJumpHeld = input.state.jump
        if (input.state.escape && !prevEscapeHeld) { window.location.reload(); return }
        prevEscapeHeld = !!input.state.escape
		if (transitionPhase === 'launch') {
			transitionTimer += dt
			// move upward fast, slight extra boost
			player.pos.y += player.vel.y * dt
			player.vel.y -= 300 * dt
			camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
			if (transitionTimer >= LAUNCH_DURATION) {
				if (queuedNextLevelIndex == null) {
					mode = 'end'
					return
				}
				currentLevelIndex = queuedNextLevelIndex
				level = LEVELS[currentLevelIndex]!
				player = createPlayer({ x: level.spawn.x, y: level.spawn.y + 80 })
				player.vel.y = -900
				player.vel.x = 0
				camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
				renderer.triggerFadeIn(0.25)
				transitionPhase = 'arrive'
				transitionTimer = 0
			}
			return
		}
		// arrive phase: simulate until grounded briefly (ignore ceiling so ghost can pass up through platform)
		const currPlatforms = computePlatforms(tCurr)
		attachEntitiesToPlatforms(currPlatforms)
		stepPlayer(player, dt, { left: false, right: false, jumpPressed: false, jumpHeld: false, down: false, coyoteAvailable: false, ignoreCeiling: true }, currPlatforms)
		transitionTimer += dt
		camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
		if (player.onGround && transitionTimer >= ARRIVE_MIN_TIME) {
			mode = 'playing'
			transitionTimer = 0
		}
		return
	}

		levelElapsed += dt
        // Escape → refresh back to start
        if (input.state.escape && !prevEscapeHeld) { window.location.reload(); return }
        prevEscapeHeld = !!input.state.escape

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
            if (idx >= 0 && idx < activeLevels.length) resetLevel(idx)
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
		// We need to know whether the jump consumed the mid-air jump; call step first then infer
		const wasOnGroundBefore = player.onGround
		const airJumpsLeftBefore = (player as any).airJumpsLeft as number | undefined
		stepPlayer(player, dt, { left: input.state.left, right: input.state.right, jumpPressed, jumpHeld, down: input.state.down, coyoteAvailable }, currPlatforms)
		if (jumpPressed) {
			const airAfter = (player as any).airJumpsLeft as number | undefined
			if (wasOnGroundBefore || coyoteAvailable) {
				playJump()
			} else if ((airJumpsLeftBefore ?? 0) > (airAfter ?? 0)) {
				playDoubleJump()
			}
		}
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
			playLand()
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

	// Door overlap check -> begin animated transition
		if (isMostlyOverlappingDoor()) {
			playDoor()
			beginLevelTransition()
			return
		}

		// Death zone: push it farther down (so ghost fully off-screen before trigger)
		const playerBottom = player.pos.y + player.height
		const deathY = camera.pos.y + view.height + 120
		if (playerBottom > deathY) {
			renderer.triggerFlash(FLASH_DURATION)
			playDeath()
			respawnTimer = FLASH_DURATION
			return
		}

		camera.follow({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 })
		// Drive rain ambience softly from progress
		const levelTop = level.exitDoor.y
		const spawnBottom = level.spawn.y + player.height
		const playerBottomNow = player.pos.y + player.height
		const totalClimbHeight = Math.max(1, spawnBottom - levelTop)
		const playerClimbProgress = spawnBottom - playerBottomNow
		const progress = Math.max(0, Math.min(1, playerClimbProgress / totalClimbHeight))
		const rainScale = Math.max(0, Math.min(1, progress / 0.75))
		setRainIntensity(0.10 + 0.90 * rainScale)
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
            // Ensure mouse listener is attached
            canvas.addEventListener('mousedown', onPointerDown)
            renderer.renderStartScreen('Spooky Climb', 'Press Space to Play', { sky: '#0b1220', fog: 'rgba(124,58,237,0.08)' }, { selected: menuSelected, seedInput: customSeedInput })
		} else if (mode === 'end') {
			const total = levelTimes.reduce((a, b) => a + b, 0)
            const names = activeLevels.map(l => l.title)
			renderer.renderEndScreen(levelTimes, total, names)
		} else {
            canvas.removeEventListener('mousedown', onPointerDown)
            const seedLabel = baseSeedLabel ?? 'Classic'
            renderer.render(level, player, level.enemies, camera.pos, dt, platforms, activeLevels, seedLabel)
		}
		requestAnimationFrame(frame)
	}

	requestAnimationFrame(frame)

	return () => {
		running = false
		input.dispose()
		canvas.removeEventListener('mousedown', onPointerDown)
	}
}
