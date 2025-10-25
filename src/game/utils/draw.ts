import type { Collectible, Platform, Player } from '../types'

export function drawSpookyBackground(ctx: CanvasRenderingContext2D, w: number, h: number, sky: string, visualSeed?: number) {
	const g = ctx.createLinearGradient(0, 0, 0, h)
	g.addColorStop(0, sky)
	g.addColorStop(1, '#03060c')
	ctx.fillStyle = g
	ctx.fillRect(0, 0, w, h)

	// Stars
	drawStars(ctx, w, h, visualSeed)

	// Moon
	ctx.save()
	ctx.globalAlpha = 0.9
	ctx.fillStyle = '#e5e7eb'
	ctx.beginPath()
	ctx.arc(w * 0.8, h * 0.18, 40, 0, Math.PI * 2)
	ctx.fill()
	ctx.restore()

	// Mountains silhouettes
	ctx.save()
	ctx.fillStyle = '#0a0f1a'
	for (let i = 0; i < 5; i++) {
		const baseY = h * 0.65 + i * 8
		ctx.beginPath()
		ctx.moveTo(0, baseY)
		for (let x = 0; x <= w; x += 40) {
			const y = baseY - 60 - Math.sin((x + i * 23) * 0.02) * 30
			ctx.lineTo(x, y)
		}
		ctx.lineTo(w, h)
		ctx.lineTo(0, h)
		ctx.closePath()
		ctx.globalAlpha = 0.15 + i * 0.12
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

export function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], groundColor: string, seed?: number) {
	ctx.save()
	for (const p of platforms) {
		// Stable variation per platform using id + optional seed
		const rand = seededRand(((seed ?? 1234) ^ (p.id * 2654435761)) >>> 0)
		// Darker stone gradient
		const grad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h)
		grad.addColorStop(0, '#434b57')
		grad.addColorStop(1, '#1b2230')
		ctx.fillStyle = grad
		ctx.fillRect(p.x, p.y, p.w, p.h)

		// Jagged edge erosion (visual only): carve small bites from top and sides
		ctx.save()
		ctx.globalCompositeOperation = 'destination-out'
		ctx.fillStyle = 'rgba(0,0,0,1)'
		// Top bites and profile points
		let xCursor = p.x + 2 + rand() * 6
		const topPoints: Array<{x:number;y:number}> = []
		let xxTmp = p.x
		while (xxTmp < p.x + p.w) {
			const seg = 6 + rand() * 12
			const drop = 1 + rand() * Math.min(4, p.h * 0.25)
			const end = Math.min(p.x + p.w, xxTmp + seg)
			topPoints.push({ x: end, y: p.y + drop })
			xxTmp = end
		}
		while (xCursor < p.x + p.w - 2) {
			const biteW = 6 + rand() * 12
			const biteH = 1 + rand() * Math.min(4, p.h * 0.25)
			ctx.beginPath()
			ctx.moveTo(xCursor, p.y)
			ctx.lineTo(xCursor + biteW * 0.5, p.y + biteH)
			ctx.lineTo(xCursor + biteW, p.y)
			ctx.closePath()
			ctx.fill()
			xCursor += biteW + (rand() * 6)
		}
		// Dense side erosion (left and right)
		const sideBites = 6 + Math.floor(rand() * 6)
		for (let s = 0; s < sideBites; s++) {
			const left = rand() < 0.5
			const by = p.y + 3 + rand() * Math.max(6, p.h - 6)
			const bw = 3 + rand() * 7
			const bh = 4 + rand() * 12
			ctx.beginPath()
			if (left) {
				ctx.moveTo(p.x, by)
				ctx.lineTo(p.x + bw, by + bh * 0.45)
				ctx.lineTo(p.x, by + bh)
			} else {
				ctx.moveTo(p.x + p.w, by)
				ctx.lineTo(p.x + p.w - bw, by + bh * 0.45)
				ctx.lineTo(p.x + p.w, by + bh)
			}
			ctx.closePath()
			ctx.fill()
		}
		// Bottom jagged bites across the whole width
		let bx = p.x + 2 + rand() * 6
		while (bx < p.x + p.w - 2) {
			const seg = 6 + rand() * 14
			const heightBite = 2 + rand() * Math.min(8, p.h * 0.35)
			const end = Math.min(p.x + p.w, bx + seg)
			ctx.beginPath()
			ctx.moveTo(bx, p.y + p.h)
			ctx.lineTo(bx + (end - bx) * 0.5, p.y + p.h - heightBite)
			ctx.lineTo(end, p.y + p.h)
			ctx.closePath()
			ctx.fill()
			bx = end + (rand() * 6)
		}
		ctx.restore()

		// Per-level tint (multiply with palette ground)
		ctx.save()
		ctx.globalCompositeOperation = 'multiply'
		ctx.globalAlpha = 0.35
		ctx.fillStyle = groundColor
		ctx.fillRect(p.x, p.y, p.w, p.h)
		ctx.restore()

		// Jagged top highlight following the irregular profile
		ctx.save()
		ctx.strokeStyle = 'rgba(255,255,255,0.16)'
		ctx.lineWidth = 1.5
		ctx.beginPath()
		ctx.moveTo(p.x, p.y + 1)
		for (const pt of topPoints) {
			ctx.lineTo(pt.x, pt.y)
		}
		ctx.stroke()
		ctx.restore()
		// Underhang shadow right below the highlight to pop the lip
		ctx.save()
		ctx.globalCompositeOperation = 'multiply'
		ctx.fillStyle = 'rgba(0,0,0,0.25)'
		ctx.beginPath()
		ctx.moveTo(p.x, p.y + 2)
		for (const pt of topPoints) {
			ctx.lineTo(pt.x, Math.min(p.y + 4, pt.y + 2))
		}
		ctx.lineTo(p.x + p.w, p.y + 4)
		ctx.lineTo(p.x, p.y + 4)
		ctx.closePath()
		ctx.fill()
		ctx.restore()

		// Bottom shadow line
		ctx.fillStyle = 'rgba(0,0,0,0.35)'
		ctx.fillRect(p.x, p.y + p.h - 2, p.w, 2)

		// Block segmentation (vertical mortar lines)
		ctx.strokeStyle = 'rgba(0,0,0,0.28)'
		ctx.lineWidth = 1
		const blockW = 18 + Math.floor(rand() * 14)
		for (let x = p.x + (rand() * blockW); x < p.x + p.w; x += blockW) {
			ctx.beginPath()
			ctx.moveTo(x | 0, p.y + 2)
			ctx.lineTo(x | 0, p.y + p.h - 2)
			ctx.stroke()
		}
		// Multiple horizontal mortar lines for thicker platforms
		if (p.h >= 16) {
			const rows = 1 + Math.floor(rand() * Math.max(1, Math.floor(p.h / 12)))
			for (let r = 1; r <= rows; r++) {
				const y = (p.y + (r * (p.h / (rows + 1)))) | 0
				ctx.beginPath()
				ctx.moveTo(p.x + 2, y)
				ctx.lineTo(p.x + p.w - 2, y)
				ctx.stroke()
			}
		}

		// Cracks (more)
		ctx.strokeStyle = 'rgba(0,0,0,0.45)'
		ctx.lineWidth = 0.8
		const cracks = 3 + Math.floor(rand() * 5)
		for (let i = 0; i < cracks; i++) {
			const cx = p.x + 4 + rand() * (p.w - 8)
			const cy = p.y + 3 + rand() * (p.h - 6)
			const len = 8 + rand() * 18
			ctx.beginPath()
			ctx.moveTo(cx, cy)
			ctx.lineTo(cx + (rand() * 10 - 5), cy + len * 0.4)
			ctx.lineTo(cx + (rand() * 14 - 7), cy + len)
			ctx.stroke()
		}

		// Flecks / dirt (more)
		ctx.fillStyle = 'rgba(229,231,235,0.1)'
		const flecks = 12 + Math.floor(rand() * 10)
		for (let i = 0; i < flecks; i++) {
			const fx = p.x + 2 + rand() * (p.w - 4)
			const fy = p.y + 2 + rand() * (p.h - 4)
			ctx.fillRect(fx, fy, 1.2, 1.2)
		}
		ctx.fillStyle = 'rgba(15,23,42,0.28)'
		const dirt = 8 + Math.floor(rand() * 8)
		for (let i = 0; i < dirt; i++) {
			const fx = p.x + 2 + rand() * (p.w - 4)
			const fy = p.y + 2 + rand() * (p.h - 4)
			ctx.fillRect(fx, fy, 1.6, 1.1)
		}

		// Moss / vines heavier
		if (p.h >= 12) {
			const vines = 2 + Math.floor(rand() * 4)
			ctx.strokeStyle = 'rgba(22,163,74,0.5)'
			ctx.lineWidth = 1.6
			for (let v = 0; v < vines; v++) {
				const vx = p.x + 4 + rand() * (p.w - 8)
				const len = 12 + rand() * Math.min(44, p.h)
				ctx.beginPath()
				ctx.moveTo(vx, p.y + 2)
				ctx.bezierCurveTo(vx - 5, p.y + len * 0.35, vx + 4, p.y + len * 0.65, vx + (rand() * 4 - 2), p.y + len)
				ctx.stroke()
			}
			// Moss smear on top edge (jagged)
			ctx.save()
			ctx.fillStyle = 'rgba(34,197,94,0.35)'
			ctx.beginPath()
			let xx = p.x
			ctx.moveTo(xx, p.y)
			while (xx < p.x + p.w) {
				const seg = 6 + rand() * 12
				const drop = 1 + rand() * 3.5
				const mid = Math.min(p.x + p.w, xx + seg * 0.5)
				const end = Math.min(p.x + p.w, xx + seg)
				ctx.lineTo(mid, p.y + drop)
				ctx.lineTo(end, p.y)
				xx = end
			}
			ctx.lineTo(p.x + p.w, p.y - 0.5)
			ctx.lineTo(p.x, p.y - 0.5)
			ctx.closePath()
			ctx.fill()
			ctx.restore()
		}
	}
	ctx.restore()
}

export function drawPlayer(ctx: CanvasRenderingContext2D, pl: Player, time: number) {
	ctx.save()
	ctx.translate(pl.pos.x + pl.width / 2, pl.pos.y + pl.height)
	ctx.scale(pl.facing, 1)

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
	// Eyes
	ctx.beginPath()
	ctx.arc(-7, -h + 16, 3.5, 0, Math.PI * 2)
	ctx.arc(7, -h + 16, 3.5, 0, Math.PI * 2)
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
	for (let i = 0; i < 6; i++) {
		const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.6
		const speed = 80 + Math.random() * 60
		dust.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.4 + Math.random() * 0.2 })
	}
}
export function updateAndDrawDust(ctx: CanvasRenderingContext2D, dust: Dust[], dt: number) {
	ctx.save()
	ctx.fillStyle = 'rgba(148,163,184,0.6)'
	for (let i = dust.length - 1; i >= 0; i--) {
		const p = dust[i]
		if (!p) continue
		p.life -= dt
		if (p.life <= 0) { dust.splice(i, 1); continue }
		p.x += p.vx * dt
		p.y += p.vy * dt
		p.vy += 900 * dt
		const alpha = Math.max(0, Math.min(1, p.life / 0.6))
		ctx.globalAlpha = alpha
		ctx.beginPath()
		ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
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
