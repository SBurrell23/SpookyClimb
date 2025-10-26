// Minimal procedural audio using Web Audio API
// Exposes one-shot SFX (jump, land, door, thunder) and a looped rain ambience with intensity control

type AudioCtx = AudioContext | null

let ctx: AudioCtx = null
let master: GainNode | null = null
// Rain layers: body (pink, low) + hiss (white, high)
let rainBodySrc: AudioBufferSourceNode | null = null
let rainHissSrc: AudioBufferSourceNode | null = null
let rainBodyFilter: BiquadFilterNode | null = null
let rainHissHP: BiquadFilterNode | null = null
let rainHissLP: BiquadFilterNode | null = null
let rainBodyGain: GainNode | null = null
let rainHissGain: GainNode | null = null
// Subtle modulation
let lfo: OscillatorNode | null = null
let lfoGain: GainNode | null = null

// Menu music state
let menuOscLead: OscillatorNode | null = null
let menuOscBass: OscillatorNode | null = null
let menuLeadGain: GainNode | null = null
let menuBassGain: GainNode | null = null
let menuInterval: number | null = null

function ensureCtx() {
	if (!ctx) {
		ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
		master = ctx.createGain()
		master.gain.value = 0.6
		master.connect(ctx.destination)
	}
}

function now() { ensureCtx(); return (ctx as AudioContext).currentTime }

function createGain(value: number) {
	const g = (ctx as AudioContext).createGain()
	g.gain.value = value
	return g
}

function env(g: GainNode, t0: number, a = 0.001, d = 0.12, sus = 0.4, r = 0.1, peak = 1) {
	const t = (ctx as AudioContext).currentTime
	g.gain.cancelScheduledValues(t)
	g.gain.setValueAtTime(0, t0)
	g.gain.linearRampToValueAtTime(peak, t0 + a)
	g.gain.linearRampToValueAtTime(sus, t0 + a + d)
	g.gain.linearRampToValueAtTime(0, t0 + a + d + r)
}

function osc(type: OscillatorType, freq: number) {
	const o = (ctx as AudioContext).createOscillator()
	o.type = type
	o.frequency.value = freq
	return o
}

function noiseBuffer(seconds = 1) {
	const sr = (ctx as AudioContext).sampleRate
	const len = Math.max(1, Math.floor(seconds * sr))
	const buf = (ctx as AudioContext).createBuffer(1, len, sr)
	const data = buf.getChannelData(0)
	for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
	return buf
}

function pinkNoiseBuffer(seconds = 2) {
	const sr = (ctx as AudioContext).sampleRate
	const len = Math.max(1, Math.floor(seconds * sr))
	const buf = (ctx as AudioContext).createBuffer(1, len, sr)
	const data = buf.getChannelData(0)
	// Paul Kellet's pink noise approximation
	let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
	for (let i = 0; i < len; i++) {
		const white = Math.random() * 2 - 1
		b0 = 0.99886 * b0 + white * 0.0555179
		b1 = 0.99332 * b1 + white * 0.0750759
		b2 = 0.96900 * b2 + white * 0.1538520
		b3 = 0.86650 * b3 + white * 0.3104856
		b4 = 0.55000 * b4 + white * 0.5329522
		b5 = -0.7616 * b5 - white * 0.0168980
		const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
		b6 = white * 0.115926
		data[i] = pink * 0.11 // scale down to avoid clipping
	}
	return buf
}

export function playJump() {
	ensureCtx()
	const t0 = now()
	const o = osc('triangle', 520)
	const g = createGain(0)
	env(g, t0, 0.003, 0.06, 0.0, 0.08, 0.6)
	o.connect(g).connect(master!)
	o.start(t0)
	o.frequency.exponentialRampToValueAtTime(280, t0 + 0.08)
	o.stop(t0 + 0.12)
}

export function playLand() {
	ensureCtx()
	const t0 = now()
	const o = osc('sine', 140)
	const g = createGain(0)
	env(g, t0, 0.001, 0.05, 0.0, 0.08, 0.7)
	o.connect(g).connect(master!)
	o.start(t0)
	o.frequency.exponentialRampToValueAtTime(90, t0 + 0.06)
	o.stop(t0 + 0.1)
}

export function playDoor() {
	ensureCtx()
	const t0 = now()
	const o = osc('square', 420)
	const g = createGain(0)
	env(g, t0, 0.004, 0.12, 0.0, 0.2, 0.5)
	o.connect(g).connect(master!)
	o.start(t0)
	o.frequency.linearRampToValueAtTime(660, t0 + 0.12)
	o.stop(t0 + 0.22)
}

export function playThunder() {
	ensureCtx()
	const t0 = now()
	const src = (ctx as AudioContext).createBufferSource()
	src.buffer = noiseBuffer(2)
	const g = createGain(0)
	const f = (ctx as AudioContext).createBiquadFilter()
	f.type = 'lowpass'
	f.frequency.value = 800
	// rolling envelope
	g.gain.setValueAtTime(0, t0)
	g.gain.linearRampToValueAtTime(0.9, t0 + 0.04)
	g.gain.linearRampToValueAtTime(0.5, t0 + 0.4)
	g.gain.linearRampToValueAtTime(0, t0 + 1.1)
	src.connect(f).connect(g).connect(master!)
	src.start(t0)
	src.stop(t0 + 1.2)
}

export function playDeath() {
	ensureCtx()
	const t0 = now()
	// Low thump + short noise burst
	const o = osc('sine', 200)
	const g = createGain(0)
	env(g, t0, 0.002, 0.08, 0.0, 0.2, 0.8)
	o.connect(g).connect(master!)
	o.start(t0)
	o.frequency.exponentialRampToValueAtTime(90, t0 + 0.18)
	o.stop(t0 + 0.24)
	const n = (ctx as AudioContext).createBufferSource()
	n.buffer = noiseBuffer(0.25)
	const nf = (ctx as AudioContext).createBiquadFilter()
	nf.type = 'lowpass'
	nf.frequency.value = 900
	const ng = createGain(0.0)
	ng.gain.setValueAtTime(0, t0)
	ng.gain.linearRampToValueAtTime(0.4, t0 + 0.02)
	ng.gain.linearRampToValueAtTime(0, t0 + 0.18)
	n.connect(nf).connect(ng).connect(master!)
	n.start(t0)
	n.stop(t0 + 0.2)
}

export function startRainAmbience() {
	ensureCtx()
	if (rainBodySrc && rainHissSrc) return
	// Soft rain body (pink noise, lowpassed)
	const body = (ctx as AudioContext).createBufferSource()
	body.buffer = pinkNoiseBuffer(4)
	body.loop = true
	const bodyLP = (ctx as AudioContext).createBiquadFilter()
	bodyLP.type = 'lowpass'
	bodyLP.frequency.value = 900
	const bodyG = createGain(0.0)
	body.connect(bodyLP).connect(bodyG).connect(master!)
	body.start()
	// Gentle hiss (white noise, tight band)
	const hiss = (ctx as AudioContext).createBufferSource()
	hiss.buffer = noiseBuffer(4)
	hiss.loop = true
	const hp = (ctx as AudioContext).createBiquadFilter()
	hp.type = 'highpass'
	hp.frequency.value = 2200
	const lp = (ctx as AudioContext).createBiquadFilter()
	lp.type = 'lowpass'
	lp.frequency.value = 4800
	const hissG = createGain(0.0)
	hiss.connect(hp).connect(lp).connect(hissG).connect(master!)
	hiss.start()
	// Very light LFO for shimmer
	const l = (ctx as AudioContext).createOscillator()
	l.type = 'sine'
	l.frequency.value = 0.12
	const lg = createGain(0.01)
	l.connect(lg)
	lg.connect(hissG.gain)
	l.start()
	rainBodySrc = body
	rainBodyFilter = bodyLP
	rainBodyGain = bodyG
	rainHissSrc = hiss
	rainHissHP = hp
	rainHissLP = lp
	rainHissGain = hissG
	lfo = l
	lfoGain = lg
}

export function setRainIntensity(scale01: number) {
	if (!ctx) return
	if (!rainBodySrc || !rainHissSrc) startRainAmbience()
	const s = Math.max(0, Math.min(1, scale01))
	const t = (ctx as AudioContext).currentTime
	const bodyLevel = 0.10 * s // softer overall
	const hissLevel = 0.05 * s
	rainBodyGain!.gain.cancelScheduledValues(t)
	rainBodyGain!.gain.linearRampToValueAtTime(bodyLevel, t + 0.12)
	rainHissGain!.gain.cancelScheduledValues(t)
	rainHissGain!.gain.linearRampToValueAtTime(hissLevel, t + 0.12)
	// tighten band slightly with intensity
	const hpCut = 2100 + 400 * s
	const lpCut = 4600 + 600 * s
	rainHissHP!.frequency.setTargetAtTime(hpCut, t, 0.25)
	rainHissLP!.frequency.setTargetAtTime(lpCut, t, 0.25)
}

export function stopAllAudio() {
	if (!ctx) return
	try { rainBodySrc?.stop(); } catch {}
	try { rainHissSrc?.stop(); } catch {}
	try { lfo?.stop(); } catch {}
	rainBodySrc = null
	rainHissSrc = null
}

// --- Loopable spooky chiptune for start/end screens ---
export function startMenuMusic() {
	ensureCtx()
	// disabled by request
}

export function stopMenuMusic() {
	if (!ctx) return
	if (menuInterval) { clearInterval(menuInterval); menuInterval = null }
	const t = now()
	if (menuLeadGain) { menuLeadGain.gain.cancelScheduledValues(t); menuLeadGain.gain.linearRampToValueAtTime(0, t + 0.08) }
	if (menuBassGain) { menuBassGain.gain.cancelScheduledValues(t); menuBassGain.gain.linearRampToValueAtTime(0, t + 0.08) }
	try { menuOscLead?.stop(t + 0.1) } catch {}
	try { menuOscBass?.stop(t + 0.1) } catch {}
	menuOscLead = null
	menuOscBass = null
	menuLeadGain = null
	menuBassGain = null
}

export function startEndMusic() {
	ensureCtx()
	// disabled by request
}

// Gracefully fade out and stop rain ambience (used for end screen)
export function stopRainAmbience() {
	if (!ctx) return
	const t = now()
	if (rainBodyGain) { rainBodyGain.gain.cancelScheduledValues(t); rainBodyGain.gain.linearRampToValueAtTime(0, t + 0.15) }
	if (rainHissGain) { rainHissGain.gain.cancelScheduledValues(t); rainHissGain.gain.linearRampToValueAtTime(0, t + 0.15) }
	window.setTimeout(() => {
		try { rainBodySrc?.stop() } catch {}
		try { rainHissSrc?.stop() } catch {}
		try { lfo?.stop() } catch {}
		rainBodySrc = null
		rainHissSrc = null
	}, 220)
}


