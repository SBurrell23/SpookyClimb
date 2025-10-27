import type { Collectible, Platform, Player } from '../types'

export function drawSpookyBackground(ctx: CanvasRenderingContext2D, w: number, h: number, sky: string, visualSeed?: number) {
	const g = ctx.createLinearGradient(0, 0, 0, h)
	g.addColorStop(0, sky)
	g.addColorStop(1, '#03060c')
	ctx.fillStyle = g
	ctx.fillRect(0, 0, w, h)

	// Stars
	drawStars(ctx, w, h, visualSeed)

	// Seeded moon placement and size
	const rGen = seededRand((visualSeed ?? 12345) ^ 0x9e3779b9)
	const moonXRatio = 0.2 + rGen() * 0.65 // 20%..85% of width
	const moonYRatio = 0.12 + rGen() * 0.12 // 12%..24% of height
	const moonRadius = 24 + rGen() * 30 // px; min 24, max 54
	ctx.save()
	ctx.globalAlpha = 0.9
	ctx.fillStyle = '#e5e7eb'
	ctx.beginPath()
	ctx.arc(w * moonXRatio, h * moonYRatio, moonRadius, 0, Math.PI * 2)
	ctx.fill()
	ctx.restore()

	// Mountains silhouettes - seeded variation per layer
	ctx.save()
	ctx.fillStyle = '#0a0f1a'
	const layers = 5
	let phase = rGen() * Math.PI * 2
	for (let i = 0; i < layers; i++) {
		const baseY = h * (0.62 + i * 0.035)
		const amp = 30 + rGen() * 45 // 30..75
		const freq = 0.012 + rGen() * 0.02 // 0.012..0.032
		phase += rGen() * 3
		ctx.beginPath()
		ctx.moveTo(0, baseY)
		for (let x = 0; x <= w; x += 40) {
			const y = baseY - 40 - Math.sin(x * freq + phase + i * 0.7) * amp
			ctx.lineTo(x, y)
		}
		ctx.lineTo(w, h)
		ctx.lineTo(0, h)
		ctx.closePath()
		ctx.globalAlpha = 0.12 + i * 0.12
		ctx.fill()
	}
	ctx.restore()
}

let starCache: { x: number; y: number; r: number }[] | null = null
let starSeed: number | null = null
function seededRand(seed: number) {
	let t = seed >>> 0
	return () => {
		t += 0x6D2B79F5
		let r = Math.imul(t ^ (t >>> 15), 1 | t)
		r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296
	}
}
export function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, seed?: number) {
	if (!starCache || (seed != null && seed !== starSeed)) {
		const rand = seededRand(seed ?? 12345)
		const count = Math.floor((w * h) / 18000)
		starCache = Array.from({ length: count }, () => ({
			x: rand() * w,
			y: rand() * (h * 0.6),
			r: rand() * 1.2 + 0.3,
		}))
		starSeed = seed ?? null
	}
	ctx.save()
	ctx.globalCompositeOperation = 'screen'
	for (const s of starCache) {
		ctx.globalAlpha = 0.4 + Math.random() * 0.4
		ctx.fillStyle = '#cbd5e1'
		ctx.beginPath()
		ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
		ctx.fill()
	}
	ctx.restore()
}

export function drawFog(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, color: string) {
	// Softer background fog with wider bands and reduced alpha; drawn OVER the moon
	ctx.save()
	ctx.globalCompositeOperation = 'source-over'
	ctx.globalAlpha = 0.45
	for (let i = 0; i < 6; i++) {
		const y = h * (0.15 + i * 0.14) + Math.sin(time * (0.1 + i * 0.02) + i) * 26
		const grad = ctx.createLinearGradient(0, y - 120, 0, y + 120)
		grad.addColorStop(0, 'transparent')
		grad.addColorStop(0.5, color)
		grad.addColorStop(1, 'transparent')
		ctx.fillStyle = grad
		ctx.fillRect(0, y - 120, w, 240)
	}
	ctx.restore()
}

export function drawMidgroundFog(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, color: string, parallaxX = 0.04, parallaxY = 0.02, camX = 0, camY = 0) {
	// Flowing radial cloud puffs with subtle blur and parallax relative to camera
	ctx.save()
	ctx.globalCompositeOperation = 'screen'
	ctx.globalAlpha = 0.28
	for (let layer = 0; layer < 3; layer++) {
		const speed = 12 + layer * 10
		const scale = 1 + layer * 0.15
		const offX = ((time * speed) % (w + 300)) + camX * parallaxX * (0.5 + layer * 0.5)
		const offY = camY * parallaxY * (0.5 + layer * 0.5)
		for (let i = -2; i < 5; i++) {
			const cx = i * 280 - offX
			const cy = h * (0.2 + layer * 0.3) + Math.sin(time * 0.7 + i * 1.2) * 40 - offY
			ctx.save()
			ctx.shadowColor = color
			ctx.shadowBlur = 24
			const rOuter = 220 * scale
			const radial = ctx.createRadialGradient(cx, cy, 10, cx, cy, rOuter)
			radial.addColorStop(0, color)
			radial.addColorStop(1, 'transparent')
			ctx.fillStyle = radial
			ctx.beginPath()
			ctx.arc(cx, cy, rOuter, 0, Math.PI * 2)
			ctx.fill()
			ctx.restore()
		}
	}
	ctx.restore()
}

// Cache pre-rendered platform canvases by a stable key so we don't rebuild every frame
type PlatformBuffer = { canvas: HTMLCanvasElement; topPts: Array<{ x: number; y: number }> }
const platformCanvasCache = new Map<string, PlatformBuffer>()

export function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], groundColor: string, seed?: number) {
	ctx.save()
	for (const p of platforms) {
		const key = `${p.id}:${groundColor}:${seed ?? 0}:${p.w}x${p.h}`
		let entry = platformCanvasCache.get(key)
		if (!entry) {
			const buf = document.createElement('canvas')
			buf.width = Math.max(1, Math.ceil(p.w))
			buf.height = Math.max(1, Math.ceil(p.h))
			const g = buf.getContext('2d')!
			const rand = seededRand(((seed ?? 1234) ^ (p.id * 2654435761)) >>> 0)
			// Base gradient body
			const bodyGrad = g.createLinearGradient(0, 0, 0, p.h)
			bodyGrad.addColorStop(0, '#434b57')
			bodyGrad.addColorStop(1, '#1b2230')
			g.fillStyle = bodyGrad
			g.fillRect(0, 0, p.w, p.h)
			// Build jagged top profile
			const topPts: Array<{x:number;y:number}> = []
			let x = 0
			while (x < p.w) {
				const seg = 8 + rand() * 16
				const drop = 2 + rand() * Math.min(10, p.h * 0.3)
				const end = Math.min(p.w, x + seg)
				topPts.push({ x: end, y: drop })
				x = end
			}
			// Carve above top profile
			g.save()
			g.globalCompositeOperation = 'destination-out'
			g.beginPath()
			g.moveTo(0, 0)
			g.lineTo(p.w, 0)
			g.lineTo(p.w, topPts[topPts.length - 1]!.y)
			for (let i = topPts.length - 2; i >= 0; i--) g.lineTo(topPts[i]!.x, topPts[i]!.y)
			g.lineTo(0, topPts[0]!.y)
			g.closePath()
			g.fill()
			// Side bites
			const sideBites = 6 + Math.floor(rand() * 6)
			for (let s = 0; s < sideBites; s++) {
				const left = rand() < 0.5
				const by = 3 + rand() * Math.max(6, p.h - 6)
				const bw = 3 + rand() * 9
				const bh = 6 + rand() * 16
				g.beginPath()
				if (left) {
					g.moveTo(0, by)
					g.lineTo(bw, by + bh * 0.45)
					g.lineTo(0, by + bh)
				} else {
					g.moveTo(p.w, by)
					g.lineTo(p.w - bw, by + bh * 0.45)
					g.lineTo(p.w, by + bh)
				}
				g.closePath()
				g.fill()
			}
			// Carve below bottom jagged profile
			const bottomPts: Array<{x:number;y:number}> = []
			let bx = 0
			while (bx < p.w) {
				const seg = 10 + rand() * 18
				const rise = 2 + rand() * Math.min(10, p.h * 0.35)
				const end = Math.min(p.w, bx + seg)
				bottomPts.push({ x: end, y: p.h - rise })
				bx = end
			}
			g.beginPath()
			g.moveTo(0, p.h)
			g.lineTo(p.w, p.h)
			g.lineTo(p.w, bottomPts[bottomPts.length - 1]!.y)
			for (let i = bottomPts.length - 2; i >= 0; i--) g.lineTo(bottomPts[i]!.x, bottomPts[i]!.y)
			g.lineTo(0, bottomPts[0]!.y)
			g.closePath()
			g.fill()
			g.restore()

			// Overlay tint only over existing pixels (avoid refilling carved holes)
			g.save()
			g.globalCompositeOperation = 'source-atop'
			g.globalAlpha = 0.35
			g.fillStyle = groundColor
			g.fillRect(0, 0, p.w, p.h)
			g.restore()

			// Top highlight following the jagged profile (clipped to existing)
			g.save()
			g.globalCompositeOperation = 'source-atop'
			g.strokeStyle = 'rgba(255,255,255,0.16)'
			g.lineWidth = 1.5
			g.beginPath()
			g.moveTo(0, Math.min(p.h, topPts[0]!.y + 1))
			for (const pt of topPts) g.lineTo(pt.x, pt.y)
			g.stroke()
			g.restore()

			// Underhang shadow below highlight (clipped to existing)
			g.save()
			g.globalCompositeOperation = 'source-atop'
			g.fillStyle = 'rgba(0,0,0,0.25)'
			g.beginPath()
			g.moveTo(0, Math.min(p.h, topPts[0]!.y + 2))
			for (const pt of topPts) g.lineTo(pt.x, Math.min(p.h, pt.y + 2))
			g.lineTo(p.w, Math.min(p.h, topPts[topPts.length - 1]!.y + 2))
			g.lineTo(0, Math.min(p.h, topPts[0]!.y + 2))
			g.closePath()
			g.fill()
			g.restore()

			// Bottom shadow line inside body (clipped)
			g.save()
			g.globalCompositeOperation = 'source-atop'
			g.fillStyle = 'rgba(0,0,0,0.35)'
			g.fillRect(0, p.h - 2, p.w, 2)
			g.restore()

			// More rock imperfections: cracks, pock marks, and horizontal scrapes (clipped)
			g.save()
			g.globalCompositeOperation = 'source-atop'
			g.strokeStyle = 'rgba(0,0,0,0.45)'
			g.lineWidth = 0.8
			const cracks = (4 + Math.floor(rand() * 6)) * 4
			for (let i = 0; i < cracks; i++) {
				const cx = 4 + rand() * (p.w - 8)
				const cy = 3 + rand() * (p.h - 6)
				const len = 8 + rand() * 18
				g.beginPath()
				g.moveTo(cx, cy)
				g.lineTo(cx + (rand() * 10 - 5), cy + len * 0.4)
				g.lineTo(cx + (rand() * 14 - 7), cy + len)
				g.stroke()
			}
			// pock marks
			g.fillStyle = 'rgba(0,0,0,0.22)'
			const pocks = (6 + Math.floor(rand() * 10)) * 4
			for (let i = 0; i < pocks; i++) {
				const px = 4 + rand() * (p.w - 8)
				const py = 4 + rand() * (p.h - 8)
				const rr = 0.8 + rand() * 1.8
				g.beginPath()
				g.arc(px, py, rr, 0, Math.PI * 2)
				g.fill()
			}
			// subtle horizontal scrapes
			g.strokeStyle = 'rgba(255,255,255,0.06)'
			g.lineWidth = 1
			const scrapes = (2 + Math.floor(rand() * 3)) * 4
			for (let i = 0; i < scrapes; i++) {
				const sy = (p.h * (0.25 + rand() * 0.5)) | 0
				g.beginPath()
				g.moveTo(3, sy)
				g.lineTo(p.w - 3, sy)
				g.stroke()
			}
			g.restore()

			// Moss smear hugging the jagged lip (irregular band, not flat; clipped)
			if (p.h >= 12) {
				g.save()
				g.globalCompositeOperation = 'source-atop'
				// darker, mossy tone
				g.fillStyle = 'rgba(12,74,50,0.55)'
				g.beginPath()
				// inner edge along lip
				g.moveTo(0, topPts[0]!.y)
				for (const pt of topPts) g.lineTo(pt.x, pt.y)
				// outer edge slightly above with noise
				for (let i = topPts.length - 1; i >= 0; i--) {
					const pt = topPts[i]!
					const up = 2 + rand() * 3.5
					g.lineTo(pt.x, Math.max(0, pt.y - up))
				}
				g.closePath()
				g.fill()
				g.restore()
			}

			// Moss clumps on the platform face (inside only) — darker greens mixed with browns
			g.save()
			g.globalCompositeOperation = 'source-atop'
			function drawBlob(cx: number, cy: number, r: number) {
				const pts = 8 + Math.floor(rand() * 6)
				g.beginPath()
				for (let k = 0; k < pts; k++) {
					const a = (k / pts) * Math.PI * 2
					const jitter = 0.55 + rand() * 0.65
					const rx = cx + Math.cos(a) * r * jitter
					const ry = cy + Math.sin(a) * r * jitter
					if (k === 0) g.moveTo(rx, ry)
					else g.lineTo(rx, ry)
				}
				g.closePath()
				g.fill()
			}
			const clumps = (8 + Math.floor(rand() * Math.max(6, Math.floor(p.w / 50)))) * 5
			for (let i = 0; i < clumps; i++) {
				const cx = 6 + rand() * (p.w - 12)
				const cy = (p.h * (0.2 + rand() * 0.6)) | 0
				const r = 4 + rand() * 10
				const isBrown = rand() < 0.45
				const alpha = 0.16 + rand() * 0.18
				g.fillStyle = isBrown ? `rgba(87,66,50,${alpha})` : `rgba(12,74,50,${alpha + 0.04})`
				drawBlob(cx, cy, r)
				if (rand() < 0.6) drawBlob(cx + (rand() * 10 - 5), cy + (rand() * 8 - 4), r * (0.5 + rand() * 0.35))
			}
			// subtle inner shading on clumps for depth
			g.globalCompositeOperation = 'multiply'
			g.strokeStyle = 'rgba(0,0,0,0.18)'
			g.lineWidth = 0.8
			for (let i = 0; i < 24; i++) {
				const sx = 6 + rand() * (p.w - 12)
				const sy = (p.h * (0.2 + rand() * 0.6)) | 0
				g.beginPath()
				g.moveTo(sx - 2, sy)
				g.lineTo(sx + 3, sy + 3)
				g.stroke()
			}
			g.restore()

			// Moss drips from top lip
			g.save()
			g.globalCompositeOperation = 'source-atop'
			g.strokeStyle = 'rgba(12,74,50,0.5)'
			g.lineWidth = 1
			g.lineCap = 'round'
			const drips = (2 + Math.floor(rand() * 4)) * 5
			for (let i = 0; i < drips; i++) {
				const ix = 6 + rand() * (p.w - 12)
				// map ix to top y via topPts
				let prevX = 0, prevY = topPts[0]?.y ?? 0
				for (let k = 0; k < topPts.length; k++) {
					const tx = topPts[k]!.x
					const ty = topPts[k]!.y
					if (ix <= tx) { const t = (ix - prevX) / Math.max(1e-3, tx - prevX); prevY = prevY + (ty - prevY) * t; break }
					prevX = tx; prevY = ty
				}
				const len = 8 + rand() * Math.min(22, p.h * 0.5)
				g.beginPath()
				g.moveTo(ix, prevY)
				g.bezierCurveTo(ix - 1 + rand() * 2, prevY + len * 0.4, ix + (rand() * 2 - 1), prevY + len * 0.75, ix + (rand() * 2 - 1), prevY + len)
				g.stroke()
			}
			g.restore()

			entry = { canvas: buf, topPts }
			platformCanvasCache.set(key, entry)
		}
		ctx.drawImage(entry.canvas, p.x, p.y)
	}
	ctx.restore()
}

// Draw grass tufts as a separate overlay so characters/doors render behind it
export function drawPlatformGrassOverlay(ctx: CanvasRenderingContext2D, platforms: Platform[], groundColor: string, seed?: number) {
	ctx.save()
	for (const p of platforms) {
		const key = `${p.id}:${groundColor}:${seed ?? 0}:${p.w}x${p.h}`
		const entry = platformCanvasCache.get(key)
		if (!entry) continue
		const pts = entry.topPts
		function sampleTopY(xLocal: number) {
			if (pts.length === 0) return 0
			let prevX = 0, prevY = pts[0]!.y
			for (let i = 0; i < pts.length; i++) {
				const px = pts[i]!.x
				const py = pts[i]!.y
				if (xLocal <= px) {
					const t = (xLocal - prevX) / Math.max(1e-3, px - prevX)
					return prevY + (py - prevY) * t
				}
				prevX = px; prevY = py
			}
			return prevY
		}
		const grassRand = seededRand(((seed ?? 4321) ^ (p.id * 2654435761)) >>> 0)
		ctx.lineCap = 'round'
		// Draw small blades along the entire lip with varied height, color, and angle
		for (let xLocal = 2; xLocal < p.w - 2; xLocal += 1) {
			const baseYLocal = sampleTopY(xLocal)
			const baseX = p.x + xLocal
			const baseY = p.y + baseYLocal
			// Occasionally leave a tiny gap
			if (grassRand() < 0.08) continue
			// Choose color per blade (dark green → olive → brown-green)
			const palette = [
				{ r: 9, g: 79, b: 49, a: 0.9 },
				{ r: 12, g: 74, b: 50, a: 0.9 },
				{ r: 24, g: 96, b: 60, a: 0.88 },
				{ r: 41, g: 85, b: 49, a: 0.88 },
				{ r: 67, g: 87, b: 51, a: 0.86 },
				{ r: 88, g: 70, b: 40, a: 0.85 },
				{ r: 99, g: 75, b: 38, a: 0.84 },
			]
			const c = palette[Math.floor(grassRand() * palette.length)]!
			ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${c.a})`
			ctx.lineWidth = 0.9 + grassRand() * 0.9
			const blades = 1 + Math.floor(grassRand() * 2) // 1-2 blades at this x
			for (let b = 0; b < blades; b++) {
				const h = 4 + grassRand() * 18
				const offset = (b === 0 ? 0 : (grassRand() - 0.5) * 1.2)
				const lean = (grassRand() - 0.5) * 6
				ctx.beginPath()
				ctx.moveTo(baseX + offset, baseY - 1)
				ctx.bezierCurveTo(
					baseX + offset + 0.3, baseY - h * 0.4,
					baseX + offset + lean, baseY - h * 0.8,
					baseX + offset + lean, baseY - h
				)
				ctx.stroke()
			}
		}
	}
	ctx.restore()
}

export function drawPlayer(ctx: CanvasRenderingContext2D, pl: Player, time: number) {
	ctx.save()
    ctx.translate(pl.pos.x + pl.width / 2, pl.pos.y + pl.height)

    // Determine horizontal lean based on velocity and facing
    const vx = (pl as any).vel?.x as number | undefined
    const speed = typeof vx === 'number' ? vx : 0
    const dirSign = speed !== 0 ? Math.sign(speed) : (pl.facing || 1)
    // Apply facing to keep sprite mirroring consistent with direction of motion
    ctx.scale(dirSign >= 0 ? 1 : -1, 1)

	const w = pl.width
	const h = pl.height
	const headRadius = w * 0.5
	const waveAmp = 5
	const waveCount = 4
	const wavePhase = time * 6

    // Jump stretch: scale vertically when ascending
	let stretchY = 1
	let squashX = 1
	const v = (pl as any).vel?.y as number | undefined
	if (typeof v === 'number') {
		if (v < 0) { // going up
			stretchY = 1.08
			squashX = 0.94
		} else if (v > 300) { // falling fast
			stretchY = 0.96
			squashX = 1.03
		}
	}

    // Body lean based on horizontal speed (works on ground and in-air)
    // Clamp lean to a subtle range (about ±8 degrees). Rotate in local space,
    // relying on the horizontal flip above so left-lean is correct when moving left.
    const maxLeanRad = 8 * Math.PI / 180
    const lean = Math.max(0, Math.min(1, (Math.abs(speed) / 320))) * maxLeanRad
    ctx.rotate(lean)

    ctx.scale(squashX, stretchY)

	// Glow
	ctx.save()
	ctx.shadowColor = 'rgba(236, 253, 245, 0.6)'
	ctx.shadowBlur = 24
	ctx.fillStyle = '#f8fafc'

	// Body path with rounded head and wavy bottom
	ctx.beginPath()
	// Top arc (head)
	ctx.arc(0, -h + headRadius, headRadius, Math.PI, 0)
	// Right side down
	ctx.lineTo(headRadius, -10)
	// Bottom wave
	let x = headRadius
	for (let i = 0; i < waveCount; i++) {
		const nx = headRadius - (w * (i + 0.5)) / waveCount
		const ny = -4 + Math.sin(wavePhase + i) * waveAmp
		ctx.quadraticCurveTo((x + nx) / 2, ny, nx, -6)
		x = nx
	}
	// Left side up
	ctx.lineTo(-headRadius, -10)
	ctx.lineTo(-headRadius, -h + headRadius)
	ctx.closePath()
	ctx.fill()
	ctx.restore()

    // Face
	ctx.save()
	ctx.fillStyle = '#111827'
    // Eyes (shift slightly toward motion direction in local space)
    const eyeOffset = Math.max(0, Math.min(2.5, (Math.abs(speed) / 260) * 2.2))
	ctx.beginPath()
    ctx.arc(-7 + eyeOffset, -h + 16, 3.5, 0, Math.PI * 2)
    ctx.arc(7 + eyeOffset, -h + 16, 3.5, 0, Math.PI * 2)
	ctx.fill()
	// Mouth (small oval)
	ctx.beginPath()
	ctx.ellipse(0, -h + 26, 5.5, 3, 0, 0, Math.PI * 2)
	ctx.fill()
	ctx.restore()

	ctx.restore()
}

export function drawCollectibles(ctx: CanvasRenderingContext2D, items: Collectible[], t: number) {
	ctx.save()
	for (const c of items) {
		ctx.translate(c.x + c.w / 2, c.y + c.h / 2)
		const bob = Math.sin(t * 3 + c.x * 0.02) * 3
		if (c.type === 'lantern') {
			ctx.fillStyle = '#fbbf24'
			ctx.beginPath()
			ctx.arc(0, bob, 8, 0, Math.PI * 2)
			ctx.fill()
			ctx.fillStyle = 'rgba(251,191,36,0.3)'
			ctx.beginPath()
			ctx.arc(0, bob, 18, 0, Math.PI * 2)
			ctx.fill()
		} else {
			ctx.fillStyle = '#60a5fa'
			ctx.fillRect(-6, -6 + bob, 12, 12)
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0)
	}
	ctx.restore()
}

export type Dust = { x: number; y: number; vx: number; vy: number; life: number }
export function spawnLandingDust(dust: Dust[], x: number, y: number) {
	for (let i = 0; i < 5; i++) {
		const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.8
		const speed = 90 + Math.random() * 60
		dust.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.45 + Math.random() * 0.2 })
	}
}
export function updateAndDrawDust(ctx: CanvasRenderingContext2D, dust: Dust[], dt: number) {
	ctx.save()
	ctx.fillStyle = 'rgba(148,163,184,0.65)'
	for (let i = dust.length - 1; i >= 0; i--) {
		const p = dust[i]
		if (!p) continue
		p.life -= dt
		if (p.life <= 0) { dust.splice(i, 1); continue }
		p.x += p.vx * dt
		p.y += p.vy * dt
		p.vy += 1000 * dt
		const alpha = Math.max(0, Math.min(1, p.life / 0.6))
		ctx.globalAlpha = alpha
		ctx.beginPath()
		ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2)
		ctx.fill()
	}
	ctx.restore()
}

export function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	ctx.save()
	// Slightly reduce tombstone height
	const effH = h * 0.85
	const effY = y + (h - effH)

	// Ground shadow
	ctx.save()
	ctx.globalAlpha = 0.25
	ctx.fillStyle = '#000000'
	ctx.beginPath()
	ctx.ellipse(x + w / 2, effY + effH + 6, w * 0.6, 8, 0, 0, Math.PI * 2)
	ctx.fill()
	ctx.restore()

	// Tombstone body (rounded top), darker stone gradient
	const bodyTop = effY + effH * 0.15
	const stoneGrad = ctx.createLinearGradient(0, effY, 0, effY + effH)
	stoneGrad.addColorStop(0, '#4b5563')
	stoneGrad.addColorStop(1, '#1f2937')
	ctx.fillStyle = stoneGrad
	ctx.beginPath()
	ctx.moveTo(x, effY + effH)
	ctx.lineTo(x, bodyTop)
	ctx.arc(x + w / 2, bodyTop, w / 2, Math.PI, 0)
	ctx.lineTo(x + w, effY + effH)
	ctx.closePath()
	ctx.fill()

	// Subtle bevel highlight
	ctx.save()
	ctx.globalAlpha = 0.18
	ctx.strokeStyle = '#e5e7eb'
	ctx.lineWidth = 1.5
	ctx.beginPath()
	ctx.moveTo(x + 3, effY + effH - 3)
	ctx.lineTo(x + 3, bodyTop + 2)
	ctx.arc(x + w / 2, bodyTop + 2, (w / 2) - 3, Math.PI, 0)
	ctx.lineTo(x + w - 3, effY + effH - 3)
	ctx.stroke()
	ctx.restore()

	// Engraving (RIP), slightly dimmer
	ctx.save()
	ctx.globalAlpha = 0.28
	ctx.fillStyle = '#0b0f19'
	ctx.font = `${Math.floor(effH * 0.22)}px ui-sans-serif, system-ui, -apple-system, Segoe UI`
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.fillText('RIP', x + w / 2, effY + effH * 0.55)
	ctx.restore()

	// Base plinth (darker)
	ctx.fillStyle = '#111827'
	ctx.fillRect(x - 6, effY + effH - 8, w + 12, 10)
	ctx.restore()
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
	ctx.save()
	const radial = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8)
	radial.addColorStop(0, 'transparent')
	radial.addColorStop(1, 'rgba(0,0,0,0.45)')
	ctx.fillStyle = radial
	ctx.fillRect(0, 0, w, h)
	ctx.restore()
}
