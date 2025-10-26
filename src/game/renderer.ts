import type { EnemyPlaceholder, GameDimensions, LevelDefinition, Player, Platform } from './types'
import { drawCollectibles, drawFog, drawMidgroundFog, drawPlatforms, drawPlayer, drawSpookyBackground, drawDoor, updateAndDrawDust, Dust, drawVignette } from './utils/draw'
import { playThunder } from './audio'

export function createRenderer(ctx: CanvasRenderingContext2D, view: GameDimensions) {
	let time = 0
	const dust: Dust[] = []
	let bestProgress = 0
	let lastLevelId: number | undefined
	// Adjustable thresholds
	const LIGHTNING_PROGRESS_THRESHOLD = 0.65
	// Rain always on: start at 25% of normal, reach 100% by 75% progress
    const RAIN_MIN_SCALE = 0.10
	const RAIN_FULL_PROGRESS = 0.75
	// Ambient bats
	type Bat = { x: number; y: number; vx: number; scale: number; life: number; flapOffset: number }
	const bats: Bat[] = []
	let batCooldown = 0
	// Lightning state
	let lightningTime = 0
	let lightningPoints: { x: number; y: number }[] = []
	let lightningWidth = 3
	let lightningAlpha = 0.95
	let lightningShadow = 18
	let lightningFlashAlpha = 0.22
	// Rumble (camera shake) state
	let rumbleTime = 0
	let rumbleDuration = 0.3
	let rumbleStrength = 3

    // Rain state (screen-space particles)
    const rainDrops: { x: number; y: number; len: number; vy: number; a: number; w: number }[] = []
    let prevCamY: number | null = null

	return {
		spawnDust(x: number, y: number) {
			// Moderate dust burst
			const p = {
				x,
				y,
				vx: (Math.random() - 0.5) * 120,
				vy: -120 + (Math.random() - 0.5) * 60,
				life: 0.4 + Math.random() * 0.2,
			}
			dust.push(p)
		},
		triggerFlash(durationSec = 0.6) {
			// implemented in previous edit file; kept for compatibility
			;(this as any)._flashDuration = durationSec
			;(this as any)._flashTime = durationSec
		},
		triggerFadeIn(durationSec = 0.4) {
			;(this as any)._fadeInDuration = durationSec
			;(this as any)._fadeInTime = durationSec
		},
		renderStartScreen(title = 'Spooky Climb', subtitle = 'Press Space to Play', palette = { sky: '#0b1220', fog: 'rgba(124,58,237,0.08)' }) {
			time += 1 / 60
			// Set page background/accent to match start palette
			document.body.style.setProperty('--bg1', palette.sky)
			document.body.style.setProperty('--bg2', 'rgba(0,0,0,0.9)')
			document.body.style.setProperty('--bg3', 'rgba(0,0,0,1)')
			document.body.style.setProperty('--accent-border', palette.fog.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, 'rgba($1,$2,$3,0.45)'))
			document.body.style.setProperty('--accent-shadow', palette.fog.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, 'rgba($1,$2,$3,0.25)'))
			drawSpookyBackground(ctx, view.width, view.height, palette.sky)
			drawFog(ctx, view.width, view.height, time, palette.fog)
			// Title
			ctx.save()
			ctx.fillStyle = '#f8fafc'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.shadowColor = 'rgba(168,85,247,0.4)'
			ctx.shadowBlur = 18
			ctx.font = '700 42px ui-sans-serif, system-ui, -apple-system, Segoe UI'
			ctx.fillText(title, view.width / 2, view.height * 0.35)
			ctx.shadowBlur = 0
			ctx.globalAlpha = 0.85
			ctx.font = '20px ui-sans-serif, system-ui, -apple-system, Segoe UI'
			ctx.fillText(subtitle, view.width / 2, view.height * 0.35 + 42)
			ctx.restore()
			// Little neutral ghost below
			drawHappyGhost(ctx, view.width / 2 - 16, view.height * 0.55, 32, 44, time, false)
			drawVignette(ctx, view.width, view.height)
		},
		renderEndScreen(levelTimes: number[], total: number, levelNames: string[]) {
			time += 1 / 60
			drawSpookyBackground(ctx, view.width, view.height, '#0b0b17')
			drawFog(ctx, view.width, view.height, time, 'rgba(59,130,246,0.06)')
			ctx.save()
			ctx.fillStyle = '#f8fafc'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'top'
			// Centered layout
			const titleY = Math.floor(view.height * 0.28)
			ctx.font = '700 36px ui-sans-serif, system-ui, -apple-system, Segoe UI'
			ctx.fillText('You Are At Rest!', view.width / 2, titleY)
			ctx.font = '18px ui-sans-serif, system-ui, -apple-system, Segoe UI'
			let y = Math.floor(view.height * 0.36)
			const line = 26
			for (let i = 0; i < levelTimes.length; i++) {
				const name = levelNames[i] ?? `Level ${i + 1}`
				ctx.fillText(`${name}: ${formatTime(levelTimes[i] ?? 0)}`, view.width / 2, y)
				y += line
			}
			ctx.fillText(`Total: ${formatTime(total)}`, view.width / 2, y + 8)
			ctx.fillText('Press Space to Restart', view.width / 2, y + 40)
			ctx.restore()
			drawHappyGhost(ctx, view.width / 2 - 20, Math.floor(view.height * 0.62) + 100, 40, 52, time)
			drawVignette(ctx, view.width, view.height)
		},
			render(level: LevelDefinition, player: Player, enemies: EnemyPlaceholder[], camera: { x: number; y: number }, dt: number, platforms: Platform[]) {
			time += dt
			;(this as any)._flashTime = (this as any)._flashTime ?? 0
			;(this as any)._flashDuration = (this as any)._flashDuration ?? 0.5
			;(this as any)._fadeInTime = (this as any)._fadeInTime ?? 0
			;(this as any)._fadeInDuration = (this as any)._fadeInDuration ?? 0.4
			if ((this as any)._flashTime > 0) (this as any)._flashTime -= dt
			if ((this as any)._fadeInTime > 0) (this as any)._fadeInTime -= dt
			if (rumbleTime > 0) rumbleTime -= dt
			// Reset best and ambient when level changes
			if (lastLevelId !== level.id) { bestProgress = 0; lastLevelId = level.id; bats.length = 0; batCooldown = 0; lightningTime = 0 }
			// Background
			document.body.style.setProperty('--bg1', level.palette.sky)
			document.body.style.setProperty('--bg2', 'rgba(0,0,0,0.9)')
			document.body.style.setProperty('--bg3', 'rgba(0,0,0,1)')
			const fog = level.palette.fog
			document.body.style.setProperty('--accent-border', fog.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, 'rgba($1,$2,$3,0.45)'))
			document.body.style.setProperty('--accent-shadow', fog.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^\)]+\)/, 'rgba($1,$2,$3,0.25)'))
			drawSpookyBackground(ctx, view.width, view.height, level.palette.sky, level.visualSeed ?? 0)
			drawFog(ctx, view.width, view.height, time, level.palette.fog)

			// Calculate progress (0..1)
			const levelTop = level.exitDoor.y
			const spawnBottom = level.spawn.y + player.height
			const playerBottomNow = player.pos.y + player.height
			const totalClimbHeight = Math.max(1, spawnBottom - levelTop)
			const playerClimbProgress = spawnBottom - playerBottomNow
			const progress = Math.max(0, Math.min(1, playerClimbProgress / totalClimbHeight))

			// Update bats
			batCooldown -= dt
			if (batCooldown <= 0) {
				const spawnChance = 0.35 // average ~1 bat every few seconds
				if (Math.random() < spawnChance * dt) {
					const fromLeft = Math.random() < 0.5
					const speed = 80 + Math.random() * 100
					const y = camera.y + 60 + Math.random() * (view.height - 140)
					const x = fromLeft ? camera.x - 60 : camera.x + view.width + 60
					bats.push({ x, y, vx: fromLeft ? speed : -speed, scale: 0.8 + Math.random() * 0.6, life: 6, flapOffset: Math.random() * Math.PI * 2 })
					batCooldown = 0.6 + Math.random() * 1.4
				}
			}
			for (let i = bats.length - 1; i >= 0; i--) {
				const b = bats[i]!
				b.x += b.vx * dt
				b.life -= dt
				if (b.life <= 0 || b.x < camera.x - 200 || b.x > camera.x + view.width + 200) bats.splice(i, 1)
			}

			ctx.save()
			// Apply subtle camera shake in screen space before translating to world
			if (rumbleTime > 0) {
				const t = Math.max(0, Math.min(1, rumbleTime / rumbleDuration))
				const mag = rumbleStrength * (t * t)
				const sx = (Math.random() - 0.5) * 2 * mag
				const sy = (Math.random() - 0.5) * 2 * mag
				const rot = (Math.random() - 0.5) * 0.004 * t
				ctx.translate(sx, sy)
				ctx.rotate(rot)
			}
			ctx.translate(-camera.x, -camera.y)
			// Lightning bolt behind platforms (world space)
			if (progress >= LIGHTNING_PROGRESS_THRESHOLD && lightningTime > 0) {
				ctx.save()
				ctx.strokeStyle = `rgba(208,233,255,${lightningAlpha})`
				ctx.lineWidth = lightningWidth
				ctx.shadowColor = `rgba(180,220,255,${Math.min(0.95, Math.max(0.7, lightningAlpha))})`
				ctx.shadowBlur = lightningShadow
				ctx.beginPath()
				for (let i = 0; i < lightningPoints.length; i++) {
					const p = lightningPoints[i]!
					if (i === 0) ctx.moveTo(p.x, p.y)
					else ctx.lineTo(p.x, p.y)
				}
				ctx.stroke()
				ctx.restore()
			}
			drawPlatforms(ctx, platforms, level.palette.ground, level.visualSeed ?? 0)
			// Midground fog in world-space but between platforms and player/items
			drawMidgroundFog(ctx, view.width, view.height, time, level.palette.fog, 0.06, 0.03, camera.x, camera.y)
			// Bats in front of fog but behind player/items
			for (const b of bats) drawBat(ctx, b.x, b.y, b.scale, time + b.flapOffset)
			// Door
			drawDoor(ctx, level.exitDoor.x, level.exitDoor.y, level.exitDoor.w, level.exitDoor.h)
			// No collectibles
			drawPlayer(ctx, player, time)
			updateAndDrawDust(ctx, dust, dt)
			ctx.restore()

			// Level title top-left
			ctx.save()
			ctx.fillStyle = 'rgba(255,255,255,0.8)'
			ctx.font = '16px ui-sans-serif, system-ui, -apple-system, Segoe UI'
			ctx.textAlign = 'left'
			ctx.textBaseline = 'top'
			ctx.fillText(level.title, 12, 10)
			ctx.restore()

            // Subtle rain overlay (screen-space, straight down, random)
            // Always raining: intensity scales from 10% at 0% progress up to 100% at 75% progress
            // Apply small camera-compensation with clamping so apparent speed stays nearly constant
            const camDeltaY = prevCamY == null ? 0 : (camera.y - prevCamY)
            prevCamY = camera.y
			const progressScale = Math.max(0, Math.min(1, progress / Math.max(0.001, RAIN_FULL_PROGRESS)))
			const intensityScale = RAIN_MIN_SCALE + (1 - RAIN_MIN_SCALE) * progressScale // 0.25..1.0
			const intensity = Math.max(0, Math.min(0.5, 0.5 * intensityScale)) // map to 0..0.5 range used below
			// Target drop count scales with width and intensity
			const target = Math.floor(view.width * (0.2 + intensity * 0.6))
            while (rainDrops.length < target) {
                const len = 6 + Math.random() * (12 + intensity * 24)
                // Fixed screen-space rain speed regardless of camera motion
                const vy = 420 // px/s constant
                rainDrops.push({
                    x: Math.random() * view.width,
                    y: Math.random() * view.height,
                    len,
                    vy,
                    a: 0.12 + Math.random() * 0.18,
                    w: 0.9 + Math.random() * 0.8,
                })
            }
			// Trim if too many
			if (rainDrops.length > target) rainDrops.length = target
			// Update
            for (let i = 0; i < rainDrops.length; i++) {
                const d = rainDrops[i]!
                const baseStep = d.vy * dt
                let step = baseStep - camDeltaY
                if (camDeltaY < 0) {
                    // Camera moving up (player jumping) → ensure visibly faster rain
                    const minUp = baseStep * 1.25
                    const maxUp = baseStep * 2.5
                    if (step < minUp) step = minUp
                    if (step > maxUp) step = maxUp
                } else if (camDeltaY > 0) {
                    // Camera moving down (player falling) → never allow slowdown
                    if (step < baseStep) step = baseStep
                } else {
                    // No camera movement → keep base
                    step = baseStep
                }
                d.y += step
                if (d.y - d.len > view.height + 4) {
					// Respawn at top
                    d.x = Math.random() * view.width
                    d.y = -Math.random() * 40 - d.len
                    d.vy = 420
					d.len = 6 + Math.random() * (12 + intensity * 24)
					d.a = 0.12 + Math.random() * 0.18
					d.w = 0.9 + Math.random() * 0.8
				}
			}
			// Draw
			ctx.save()
			ctx.globalCompositeOperation = 'screen'
			ctx.strokeStyle = '#cfe7ff'
			for (let i = 0; i < rainDrops.length; i++) {
				const d = rainDrops[i]!
				ctx.globalAlpha = d.a
				ctx.lineWidth = d.w
				ctx.beginPath()
				ctx.moveTo(d.x, d.y)
				ctx.lineTo(d.x, d.y - d.len)
				ctx.stroke()
			}
			ctx.restore()

			// Vignette on top
			drawVignette(ctx, view.width, view.height)

			// Right-side vertical progress bar
			ctx.save()
			const barW = 18
			const margin = 12
			const barX = view.width - barW - margin
			const barY = margin
			const barH = view.height - margin * 2
			// Track
			ctx.globalAlpha = 0.8
			ctx.fillStyle = 'rgba(15,23,42,0.6)'
			ctx.fillRect(barX, barY, barW, barH)
			ctx.globalAlpha = 1
			ctx.strokeStyle = 'rgba(255,255,255,0.15)'
			ctx.lineWidth = 2
			ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1)
			// Progress calc reused
			bestProgress = Math.max(bestProgress, progress)
			// Best overlay (faded gray up to best)
			const bestFill = Math.floor(barH * bestProgress)
			ctx.fillStyle = 'rgba(255,255,255,0.2)'
			ctx.fillRect(barX + 2, barY + barH - bestFill + 2, barW - 4, bestFill - 4 < 0 ? 0 : bestFill - 4)
			// Current progress fill (bottom -> top)
			const fillH = Math.floor(barH * progress)
			const grad = ctx.createLinearGradient(0, barY + barH - fillH, 0, barY + barH)
			grad.addColorStop(0, 'rgba(16,185,129,0.9)')
			grad.addColorStop(1, 'rgba(34,197,94,0.9)')
			ctx.fillStyle = grad
			ctx.fillRect(barX + 2, barY + barH - fillH + 2, barW - 4, fillH - 4 < 0 ? 0 : fillH - 4)
			// Completion glow at top
			if (progress >= 1) {
				const pulse = (Math.sin(time * 6) + 1) * 0.5
				ctx.save()
				ctx.globalAlpha = 0.3 + 0.4 * pulse
				ctx.fillStyle = 'rgba(250,204,21,0.9)'
				ctx.fillRect(barX + 2, barY + 2, barW - 4, 8)
				ctx.restore()
			}
			ctx.restore()

			// Lightning (generation + screen flash) once progress reaches threshold
			if (progress >= LIGHTNING_PROGRESS_THRESHOLD) {
                if (lightningTime <= 0 && Math.random() < 0.25 * dt) {
					lightningTime = 0.28
					// Per-strike subtle variation
					lightningWidth = 2.5 + Math.random() * 1.0 // 2.5..3.5 px
					lightningAlpha = 0.88 + Math.random() * 0.08 // 0.88..0.96
					lightningShadow = 14 + Math.random() * 8 // 14..22
					lightningFlashAlpha = 0.18 + Math.random() * 0.06 // 0.18..0.24
					// Start a brief rumble
					rumbleDuration = 0.28
					rumbleTime = rumbleDuration
					rumbleStrength = 2 + Math.random() * 3 // 2..5 px
                    // Generate a jagged bolt path that starts one full screen above and ends one full screen below
					const startX = camera.x + 80 + Math.random() * (view.width - 160)
					const yStart = camera.y - view.height // one screen above
					const yEnd = camera.y + view.height * 2 // one screen below
                    const segs = 12 + Math.floor(Math.random() * 6)
					lightningPoints = [{ x: startX, y: yStart }]
					let px = startX
					let py = yStart
					for (let i = 0; i < segs; i++) {
						px += (Math.random() - 0.5) * 140
						const remaining = yEnd - py
						const step = remaining / (segs - i)
						py += step * (0.85 + Math.random() * 0.4)
						lightningPoints.push({ x: px, y: py })
                    // Thunder sfx
                    playThunder()
                }
				}
				if (lightningTime > 0) {
					lightningTime -= dt
					// flash overlay only
					const flash = Math.max(0, Math.min(1, lightningTime / 0.28))
					ctx.save()
					ctx.globalAlpha = lightningFlashAlpha * flash
					ctx.fillStyle = 'rgba(210,230,255,1)'
					ctx.fillRect(0, 0, view.width, view.height)
					ctx.restore()
				}
			}

			// Flash overlay (dim + color pulse)
			if ((this as any)._flashTime > 0) {
				const remain = (this as any)._flashTime
				const dur = (this as any)._flashDuration
				const t = Math.max(0, Math.min(1, remain / dur))
				ctx.save()
				ctx.globalAlpha = 0.25 * t
				ctx.fillStyle = '#000000'
				ctx.fillRect(0, 0, view.width, view.height)
				const phase = Math.sin(time * 22)
				const isRed = phase > 0
				ctx.globalAlpha = 0.15 + 0.35 * t
				ctx.fillStyle = isRed ? '#ff2d2d' : '#ffffff'
				ctx.fillRect(0, 0, view.width, view.height)
				ctx.restore()
			}

			// Fade-in overlay after respawn
			if ((this as any)._fadeInTime > 0) {
				const t2 = Math.max(0, Math.min(1, (this as any)._fadeInTime / (this as any)._fadeInDuration))
				ctx.save()
				ctx.globalAlpha = 0.7 * t2
				ctx.fillStyle = '#000000'
				ctx.fillRect(0, 0, view.width, view.height)
				ctx.restore()
			}
		}
	}
}

function drawHappyGhost(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, smile = true) {
	ctx.save()
	ctx.translate(x + w / 2, y + h)
	ctx.fillStyle = '#f8fafc'
	ctx.shadowColor = 'rgba(236, 253, 245, 0.6)'
	ctx.shadowBlur = 18
	ctx.beginPath()
	ctx.arc(0, -h + w / 2, w / 2, Math.PI, 0)
	ctx.lineTo(w / 2, -6)
	const wave = 4
	for (let i = 0; i < 4; i++) {
		const nx = w / 2 - (w * (i + 0.5)) / 4
		const ny = -4 + Math.sin(t * 6 + i) * 1.2
		ctx.quadraticCurveTo((nx + (i === 0 ? w / 2 : w / 2 - (w * i) / 4)) / 2, ny, nx, -6)
	}
	ctx.lineTo(-w / 2, -6)
	ctx.lineTo(-w / 2, -h + w / 2)
	ctx.closePath()
	ctx.fill()
	ctx.shadowBlur = 0
	// Eyes
	ctx.fillStyle = '#111827'
	ctx.beginPath()
	ctx.arc(-7, -h + 16, 3.5, 0, Math.PI * 2)
	ctx.arc(7, -h + 16, 3.5, 0, Math.PI * 2)
	ctx.fill()
	// Mouth
	ctx.beginPath()
	if (smile) {
		ctx.arc(0, -h + 28, 7, 0, Math.PI)
		ctx.strokeStyle = '#111827'
		ctx.lineWidth = 2
		ctx.stroke()
	} else {
		ctx.ellipse(0, -h + 26, 5.5, 3, 0, 0, Math.PI * 2)
		ctx.fill()
	}
	ctx.restore()
}

function drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, t: number) {
	ctx.save()
	ctx.translate(x, y)
	ctx.scale(scale, scale)
	const flap = Math.sin(t * 12) * 0.7 + 0.3
	ctx.fillStyle = 'rgba(10,12,16,0.9)'
	ctx.beginPath()
	// body
	ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2)
	// left wing
	ctx.moveTo(0, 0)
	ctx.quadraticCurveTo(-10, -4 - 6 * flap, -18, 0)
	ctx.quadraticCurveTo(-10, 2 + 6 * flap, 0, 0)
	// right wing
	ctx.moveTo(0, 0)
	ctx.quadraticCurveTo(10, -4 - 6 * flap, 18, 0)
	ctx.quadraticCurveTo(10, 2 + 6 * flap, 0, 0)
	ctx.fill()
	ctx.restore()
}

function formatTime(s: number) {
	const m = Math.floor(s / 60)
	const sec = s % 60
	return `${m}:${sec.toFixed(2).padStart(5, '0')}`
}

// Screen-space rain overlay: diagonal streaks with subtle motion and alpha
// deprecated overlay (replaced with particle rain)
function drawRainOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity: number) {
    // intentionally no-op to keep symbol if referenced elsewhere
}
