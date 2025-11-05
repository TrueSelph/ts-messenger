import {
	Avatar,
	Box,
	Image,
	ScrollArea,
	Card,
	chakra,
	Flex,
	Heading,
	IconButton,
	Stack,
	Textarea,
	Text,
	Float,
	Code,
	useClipboard,
	Table,
	Presence,
	Group,
} from "@chakra-ui/react";
import {
	LuClipboard,
	LuClipboardCheck,
	LuHeadphones,
	LuHeadphoneOff,
	LuInfo,
	LuVolume2,
	LuVolumeOff,
	LuArrowUpFromLine,
	LuExpand,
	LuShrink,
	LuKeyboard,
} from "react-icons/lu";

import { Provider } from "./components/ui/provider";
import Markdown, { ReactRenderer } from "marked-react";
import { ShikiHighlighter } from "react-shiki";
import {
	Fragment,
	useCallback,
	useEffect,
	useRef,
	useState,
	useMemo,
	memo,
	type ChangeEvent,
	type SetStateAction,
} from "preact/compat";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import {
	AiOutlineArrowUp,
	AiOutlinePause,
	AiOutlineStop,
} from "react-icons/ai";
import { HiOutlineMicrophone } from "react-icons/hi";
import {
	type Interaction,
	type MediaResponseMessage,
	type ResponseMessage,
	type TextResponeMessage,
} from "./types";
import useSWR, { SWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type { ComponentChild, RefObject } from "preact";
import { ReplyIndicator } from "./components/ReplyIndicator";
import { Popup } from "./popup";
import { useTranscribe } from "./useTranscribe";
import { avatarUrl } from "./avatar";
import { IconAudioVisualizer } from "./IconAudioVisualizer";

export type HeaderConfig = {
	showAvatar?: boolean;
	avatarUrl?: string;
	show?: boolean;
	hideExpandButton?: boolean;
};

function localStorageProvider(agentId?: string, sessionId?: string) {
	return () => {
		// When initializing, we restore the data from `localStorage` into a map.
		const map = new Map(
			JSON.parse(
				localStorage.getItem(`ts-msgs-${agentId}-${sessionId}`) || "[]",
			),
		);

		console.log({ map });

		window.addEventListener("tsmsave", () => {
			const appCache = JSON.stringify(Array.from(map.entries()));
			localStorage.setItem(`ts-msgs-${agentId}-${sessionId}`, appCache);
		});

		// Before unloading the app, we write back all the data into `localStorage`.
		window.addEventListener("beforeunload", () => {
			const appCache = JSON.stringify(Array.from(map.entries()));
			localStorage.setItem(`ts-msgs-${agentId}-${sessionId}`, appCache);
		});

		// We still use the map for write & read for performance.
		return map;
	};
}

export type AppProps = {
	agentId: string;
	host?: string;
	sessionId: string;
	instanceId?: string;
	headerConfig?: HeaderConfig | string;
	agentName: string;
	withDebug?: boolean;
	streaming?: boolean;
	theme?: string | Record<string, string>;
	initialInteractions?: Interaction[];
	useLocalStorageCache?: boolean;
	codeTheme?: string;
	layout?: "standard" | "popup";
	sessionIdStorage?: "localstorage" | "cookie" | "sessionstorage";
};

export function App(props: AppProps) {
	return (
		<SWRConfig
			value={{
				provider: !props.useLocalStorageCache
					? undefined
					: (localStorageProvider(props.agentId, props.sessionId) as any),
			}}
		>
			<AppContainer
				{...props}
				streaming={
					typeof (props.streaming as string | boolean) == "string"
						? (props.streaming as unknown as string) === "true"
						: props.streaming
				}
			/>
		</SWRConfig>
	);
}

function getCookie(name: string) {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts?.pop()?.split(";").shift();
}

function getLocalStorage(key: string) {
	try {
		return localStorage.getItem(key);
	} catch (error) {
		console.error(error);
		return null;
	}
}

function getSessionId(
	mode: "sessionstorage" | "cookie" | "localstorage",
	agentId: string,
) {
	try {
		switch (mode) {
			case "sessionstorage":
				return sessionStorage.getItem("tsSessionId");
			case "cookie":
				return getCookie("tsSessionId");
			case "localstorage":
				return getLocalStorage(`tsSessionId-${agentId}`);
			default:
				return null;
		}
	} catch (error) {
		console.error(error);
		return null;
	}
}

function saveSessionId(
	id: string,
	mode: "sessionstorage" | "cookie" | "localstorage",
	agentId: string,
) {
	switch (mode) {
		case "sessionstorage":
			sessionStorage.setItem("tsSessionId", id);
			break;
		case "cookie":
			document.cookie = `tsSessionId=${id}; path=/`;
			break;
		case "localstorage":
			localStorage.setItem(`tsSessionId-${agentId}`, id);
			break;
		default:
			break;
	}
}

export function AppContainer(props: AppProps) {
	const socket = new WebSocket(`${props.host}/websocket`);
	const { headerConfig, theme, layout = "standard" } = props;

	const headerConfigParsed = (
		typeof headerConfig === "string" ? JSON.parse(headerConfig) : headerConfig
	) as HeaderConfig;

	const themeParsed = (
		typeof theme === "string" ? JSON.parse(theme) : theme
	) as Record<string, string>;

	const fullScreenRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={fullScreenRef}
			style={{ height: layout === "popup" ? undefined : "100%" }}
		>
			<Provider theme={themeParsed} layout={layout}>
				<>
					{layout === "popup" ? (
						<Popup {...props} headerConfig={headerConfigParsed}>
							<ChatContainer
								socket={socket}
								themeParsed={themeParsed}
								headerConfigParsed={headerConfigParsed}
								fullScreenRef={fullScreenRef}
								{...props}
							/>
						</Popup>
					) : (
						<ChatContainer
							socket={socket}
							themeParsed={themeParsed}
							fullScreenRef={fullScreenRef}
							headerConfigParsed={headerConfigParsed}
							{...props}
						/>
					)}
				</>
			</Provider>
		</div>
	);
}

// Highly Reactive Circular Waveform Visualizer with Fixed Clipping
interface CircularWaveformVisualizerProps {
	audioUrl: string;
	isPlaying: boolean;
}

const CircularWaveformVisualizer = memo(
	({ audioUrl, isPlaying }: CircularWaveformVisualizerProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const animationRef = useRef<number | null>(null);
		const audioContextRef = useRef<AudioContext | null>(null);
		const analyserRef = useRef<AnalyserNode | null>(null);
		const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
		const audioElementRef = useRef<HTMLAudioElement | null>(null);
		const gainNodeRef = useRef<GainNode | null>(null);

		// Optimized refs for water droplet effect
		// const audioHistory = useRef<number[]>(new Array(8).fill(0));
		const lastCanvasSize = useRef({ width: 0, height: 0 });
		const rippleHistory = useRef<number[][]>([
			new Array(12).fill(0), // Droplet 1 ripple history
			new Array(12).fill(0), // Droplet 2 ripple history
			new Array(12).fill(0), // Droplet 3 ripple history
		]);

		const initializeAudio = useCallback(async () => {
			if (!audioUrl) return;

			try {
				if (!audioContextRef.current) {
					audioContextRef.current = new (window.AudioContext ||
						(window as any).webkitAudioContext)();
				}

				const audioContext = audioContextRef.current;
				if (audioContext.state === "suspended") {
					await audioContext.resume();
				}

				if (!audioElementRef.current) {
					const audio = new Audio();
					audio.crossOrigin = "anonymous";
					audio.preload = "auto";
					audio.volume = 1.0;
					audioElementRef.current = audio;
				}

				const audio = audioElementRef.current;

				if (!sourceRef.current && audio) {
					const analyser = audioContext.createAnalyser();
					analyser.fftSize = 128;
					analyser.smoothingTimeConstant = 0.1;
					analyser.minDecibels = -80;
					analyser.maxDecibels = -10;
					analyserRef.current = analyser;

					const gainNode = audioContext.createGain();
					gainNode.gain.value = 0;
					gainNodeRef.current = gainNode;

					const source = audioContext.createMediaElementSource(audio);
					source.connect(analyser);
					analyser.connect(gainNode);
					gainNode.connect(audioContext.destination);
					sourceRef.current = source;
				}

				if (audio.src !== audioUrl) {
					audio.src = audioUrl;
				}
			} catch (error) {
				console.error("Error initializing audio:", error);
			}
		}, [audioUrl]);

		const dataArray = useRef<Uint8Array>();

		const drawVisualization = useCallback((currentTime: number) => {
			const canvas = canvasRef.current;
			const analyser = analyserRef.current;

			if (!canvas || !analyser) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			// Optimize canvas sizing
			const rect = canvas.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			const scaledWidth = rect.width * dpr;
			const scaledHeight = rect.height * dpr;

			if (
				lastCanvasSize.current.width !== scaledWidth ||
				lastCanvasSize.current.height !== scaledHeight
			) {
				canvas.width = scaledWidth;
				canvas.height = scaledHeight;
				canvas.style.width = rect.width + "px";
				canvas.style.height = rect.height + "px";
				ctx.scale(dpr, dpr);
				lastCanvasSize.current = { width: scaledWidth, height: scaledHeight };
			}

			ctx.clearRect(0, 0, rect.width, rect.height);

			const centerX = rect.width * 0.5;
			const centerY = rect.height * 0.5;

			// Get audio data
			const bufferLength = analyser.frequencyBinCount;
			if (!dataArray.current || dataArray.current.length !== bufferLength) {
				dataArray.current = new Uint8Array(bufferLength);
			}

			analyser.getByteFrequencyData(dataArray.current);

			// Process frequency bands for different droplets
			let bassSum = 0,
				midSum = 0,
				highSum = 0;

			// Bass (1-4), Mid (5-15), High (16-32)
			for (let i = 1; i <= 4; i++) bassSum += dataArray.current[i];
			for (let i = 5; i <= 15; i++) midSum += dataArray.current[i];
			for (let i = 16; i <= 32; i++) highSum += dataArray.current[i];

			const bassLevel = bassSum / (4 * 255);
			const midLevel = midSum / (11 * 255);
			const highLevel = highSum / (17 * 255);

			// Update ripple histories for each droplet
			rippleHistory.current[0].shift();
			rippleHistory.current[0].push(bassLevel);
			rippleHistory.current[1].shift();
			rippleHistory.current[1].push(midLevel);
			rippleHistory.current[2].shift();
			rippleHistory.current[2].push(highLevel);

			const time = currentTime * 0.001;

			// Draw 3 overlapping water droplets with different properties
			drawWaterDroplet(
				ctx,
				centerX,
				centerY,
				68,
				bassLevel,
				rippleHistory.current[0],
				time,
				0,
				"rgba(139, 92, 246, 0.4)",
				0.8,
			);
			drawWaterDroplet(
				ctx,
				centerX,
				centerY,
				75,
				midLevel,
				rippleHistory.current[1],
				time * 1.2,
				Math.PI * 0.4,
				"rgba(99, 102, 241, 0.35)",
				0.9,
			);
			drawWaterDroplet(
				ctx,
				centerX,
				centerY,
				82,
				highLevel,
				rippleHistory.current[2],
				time * 0.7,
				Math.PI * 0.8,
				"rgba(75, 85, 235, 0.3)",
				1.0,
			);

			animationRef.current = requestAnimationFrame(drawVisualization);
		}, []);

		const drawWaterDroplet = useCallback(
			(
				ctx: CanvasRenderingContext2D,
				centerX: number,
				centerY: number,
				baseRadius: number,
				currentIntensity: number,
				rippleHistory: number[],
				time: number,
				phaseOffset: number,
				fillColor: string,
				distortionScale: number,
			) => {
				const points: { x: number; y: number }[] = [];
				const numPoints = 48; // High resolution for smooth water effect

				// Calculate ripple intensity from history
				const rippleIntensity =
					rippleHistory.reduce((sum, val) => sum + val, 0) /
					rippleHistory.length;
				const enhancedIntensity =
					Math.pow(currentIntensity * 2.5, 0.7) * distortionScale;

				for (let i = 0; i < numPoints; i++) {
					const angle = (i / numPoints) * Math.PI * 2 + phaseOffset;

					// Create multiple wave layers for water-like distortion
					const primaryWave =
						Math.sin(angle * 3 + time * 2) * enhancedIntensity * 8;
					const secondaryWave =
						Math.sin(angle * 6 + time * 3.5) * enhancedIntensity * 4;
					const tertiaryWave =
						Math.sin(angle * 12 + time * 5) * enhancedIntensity * 2;

					// Ripple effect that propagates outward from impact points
					const rippleEffect =
						Math.sin(angle * 8 + time * 8) * rippleIntensity * 6;

					// Surface tension simulation - creates the "droplet" shape
					const surfaceTension =
						Math.sin(angle * 2 + time * 1.5) * (1 + enhancedIntensity) * 3;

					// Combine all distortions
					const totalDistortion =
						primaryWave +
						secondaryWave +
						tertiaryWave +
						rippleEffect +
						surfaceTension;

					// Add subtle breathing motion
					const breathingMotion =
						Math.sin(time * 2 + angle * 0.5) * (0.5 + enhancedIntensity) * 2;

					const finalRadius = baseRadius + totalDistortion + breathingMotion;

					// Calculate position with slight wobble for liquid effect
					const wobbleX =
						Math.sin(time * 3 + angle * 2) * enhancedIntensity * 1.5;
					const wobbleY =
						Math.cos(time * 3.2 + angle * 2.2) * enhancedIntensity * 1.5;

					const x = centerX + Math.cos(angle) * finalRadius + wobbleX;
					const y = centerY + Math.sin(angle) * finalRadius + wobbleY;

					points.push({ x, y });
				}

				// Draw smooth water droplet using bezier curves
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);

				for (let i = 0; i < points.length; i++) {
					const current = points[i];
					const next = points[(i + 1) % points.length];
					// const nextNext = points[(i + 2) % points.length];

					// Create smooth curves using quadratic bezier
					const cpX = (current.x + next.x) * 0.5;
					const cpY = (current.y + next.y) * 0.5;

					ctx.quadraticCurveTo(current.x, current.y, cpX, cpY);
				}

				ctx.closePath();

				// Create water-like gradient
				const gradient = ctx.createRadialGradient(
					centerX,
					centerY,
					baseRadius * 0.3,
					centerX,
					centerY,
					baseRadius * 1.2,
				);

				// Dynamic gradient based on audio intensity
				const opacity = Math.min(0.8, 0.3 + enhancedIntensity * 0.5);
				const centerOpacity = Math.min(0.9, 0.5 + enhancedIntensity * 0.4);

				gradient.addColorStop(
					0,
					fillColor.replace(/[\d\.]+\)$/, `${centerOpacity})`),
				);
				gradient.addColorStop(
					0.7,
					fillColor.replace(/[\d\.]+\)$/, `${opacity * 0.7})`),
				);
				gradient.addColorStop(1, fillColor.replace(/[\d\.]+\)$/, "0.05)"));

				ctx.fillStyle = gradient;
				ctx.fill();

				// Add subtle inner highlight for water effect
				if (enhancedIntensity > 0.3) {
					const highlightGradient = ctx.createRadialGradient(
						centerX - baseRadius * 0.2,
						centerY - baseRadius * 0.2,
						0,
						centerX,
						centerY,
						baseRadius * 0.6,
					);

					const highlightOpacity = (enhancedIntensity - 0.3) * 0.4;
					highlightGradient.addColorStop(
						0,
						`rgba(255, 255, 255, ${highlightOpacity})`,
					);
					highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

					ctx.fillStyle = highlightGradient;
					ctx.fill();
				}

				// Add outer glow for high intensity
				if (enhancedIntensity > 0.4) {
					ctx.shadowBlur = 8 + enhancedIntensity * 12;
					ctx.shadowColor = fillColor.replace(
						/[\d\.]+\)$/,
						`${enhancedIntensity * 0.6})`,
					);
					ctx.fill();
					ctx.shadowBlur = 0;
				}

				// Add surface ripples for very high intensity
				if (enhancedIntensity > 0.6) {
					drawSurfaceRipples(
						ctx,
						centerX,
						centerY,
						baseRadius,
						enhancedIntensity,
						time,
						fillColor,
					);
				}
			},
			[],
		);

		const drawSurfaceRipples = useCallback(
			(
				ctx: CanvasRenderingContext2D,
				centerX: number,
				centerY: number,
				baseRadius: number,
				intensity: number,
				time: number,
				color: string,
			) => {
				// Draw concentric ripples on the water surface
				const numRipples = 3;

				for (let i = 0; i < numRipples; i++) {
					const rippleRadius =
						baseRadius + intensity * 15 + Math.sin(time * 6 + i * 2) * 8;
					const rippleOpacity = (intensity - 0.6) * 0.3 * (1 - i * 0.3);

					if (rippleOpacity > 0) {
						ctx.beginPath();
						ctx.arc(centerX, centerY, rippleRadius, 0, Math.PI * 2);
						ctx.strokeStyle = color.replace(/[\d\.]+\)$/, `${rippleOpacity})`);
						ctx.lineWidth = 1 + intensity * 2;
						ctx.stroke();
					}
				}
			},
			[],
		);

		useEffect(() => {
			if (!isPlaying) {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
					animationRef.current = null;
				}
				if (audioElementRef.current) {
					audioElementRef.current.pause();
				}
				const canvas = canvasRef.current;
				if (canvas) {
					const ctx = canvas.getContext("2d");
					if (ctx) {
						ctx.clearRect(0, 0, canvas.width, canvas.height);
					}
				}
				return;
			}

			initializeAudio().then(() => {
				if (audioElementRef.current && isPlaying) {
					audioElementRef.current.play().catch(console.error);
					animationRef.current = requestAnimationFrame(drawVisualization);
				}
			});

			return () => {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
				}
			};
		}, [audioUrl, isPlaying, initializeAudio, drawVisualization]);

		useEffect(() => {
			return () => {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
				}
				if (audioElementRef.current) {
					audioElementRef.current.pause();
					audioElementRef.current.src = "";
				}
				if (audioContextRef.current?.state !== "closed") {
					audioContextRef.current?.close();
				}
			};
		}, []);

		return (
			<chakra.canvas
				ref={canvasRef}
				position="absolute"
				top="50%"
				left="50%"
				width="180px"
				height="180px"
				transform="translate(-50%, -50%)"
				zIndex={0}
				pointerEvents="none"
				style={{
					maxWidth: "180px",
					maxHeight: "180px",
				}}
			/>
		);
	},
);

// const CircularWaveformVisualizer = memo(
// 	({ audioUrl, isPlaying }: CircularWaveformVisualizerProps) => {
// 		const canvasRef = useRef<HTMLCanvasElement>(null);
// 		const animationRef = useRef<number | null>(null);
// 		const audioContextRef = useRef<AudioContext | null>(null);
// 		const analyserRef = useRef<AnalyserNode | null>(null);
// 		const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
// 		const audioElementRef = useRef<HTMLAudioElement | null>(null);
// 		const gainNodeRef = useRef<GainNode | null>(null);

// 		// Optimized refs - reduced history and cached values
// 		const audioHistory = useRef<number[]>(new Array(8).fill(0)); // Reduced from 30
// 		const lastCanvasSize = useRef({ width: 0, height: 0 });
// 		const cachedColors = useRef({
// 			bassMain: "rgba(139, 92, 246, 0.8)",
// 			bassAccent: "rgba(99, 102, 241, 0.6)",
// 			midMain: "rgba(99, 102, 241, 0.7)",
// 			midAccent: "rgba(139, 92, 246, 0.5)",
// 		});

// 		const initializeAudio = useCallback(async () => {
// 			if (!audioUrl) return;

// 			try {
// 				// Reuse existing context if possible
// 				if (!audioContextRef.current) {
// 					audioContextRef.current = new (window.AudioContext ||
// 						(window as any).webkitAudioContext)();
// 				}

// 				const audioContext = audioContextRef.current;
// 				if (audioContext.state === "suspended") {
// 					await audioContext.resume();
// 				}

// 				// Reuse existing audio element
// 				if (!audioElementRef.current) {
// 					const audio = new Audio();
// 					audio.crossOrigin = "anonymous";
// 					audio.preload = "auto";
// 					audio.volume = 1.0;
// 					audioElementRef.current = audio;
// 				}

// 				const audio = audioElementRef.current;

// 				// Only create nodes once
// 				if (!sourceRef.current && audio) {
// 					const analyser = audioContext.createAnalyser();
// 					// Optimized analyser settings for performance
// 					analyser.fftSize = 128; // Reduced from 256 for better performance
// 					analyser.smoothingTimeConstant = 0.1; // Less smoothing for more responsiveness
// 					analyser.minDecibels = -80;
// 					analyser.maxDecibels = -10;
// 					analyserRef.current = analyser;

// 					const gainNode = audioContext.createGain();
// 					gainNode.gain.value = 0;
// 					gainNodeRef.current = gainNode;

// 					const source = audioContext.createMediaElementSource(audio);
// 					source.connect(analyser);
// 					analyser.connect(gainNode);
// 					gainNode.connect(audioContext.destination);
// 					sourceRef.current = source;
// 				}

// 				if (audio.src !== audioUrl) {
// 					audio.src = audioUrl;
// 				}
// 			} catch (error) {
// 				console.error("Error initializing audio:", error);
// 			}
// 		}, [audioUrl]);

// 		// Pre-allocated arrays for better performance
// 		const dataArray = useRef<Uint8Array>();
// 		const bassRange = useRef<Uint8Array>();
// 		const midRange = useRef<Uint8Array>();

// 		const drawVisualization = useCallback((currentTime: number) => {
// 			const canvas = canvasRef.current;
// 			const analyser = analyserRef.current;

// 			if (!canvas || !analyser) return;

// 			// Remove 30fps throttling for smoother animation
// 			const ctx = canvas.getContext("2d");
// 			if (!ctx) return;

// 			// Optimize canvas sizing - only update when changed
// 			const rect = canvas.getBoundingClientRect();
// 			const dpr = window.devicePixelRatio || 1;
// 			const scaledWidth = rect.width * dpr;
// 			const scaledHeight = rect.height * dpr;

// 			if (
// 				lastCanvasSize.current.width !== scaledWidth ||
// 				lastCanvasSize.current.height !== scaledHeight
// 			) {
// 				canvas.width = scaledWidth;
// 				canvas.height = scaledHeight;
// 				canvas.style.width = rect.width + "px";
// 				canvas.style.height = rect.height + "px";
// 				ctx.scale(dpr, dpr);
// 				lastCanvasSize.current = { width: scaledWidth, height: scaledHeight };
// 			}

// 			// Fast clear
// 			ctx.clearRect(0, 0, rect.width, rect.height);

// 			// Cache frequently used values
// 			const centerX = rect.width * 0.5;
// 			const centerY = rect.height * 0.5;
// 			const avatarRadius = 70;
// 			const baseRadius = avatarRadius + 4;
// 			const secondRadius = avatarRadius + 14; // Fixed: was same as baseRadius

// 			// Reuse data arrays
// 			const bufferLength = analyser.frequencyBinCount;
// 			if (!dataArray.current || dataArray.current.length !== bufferLength) {
// 				dataArray.current = new Uint8Array(bufferLength);
// 				bassRange.current = new Uint8Array(6); // Pre-allocate slices
// 				midRange.current = new Uint8Array(20);
// 			}

// 			analyser.getByteFrequencyData(dataArray.current);

// 			// Optimized frequency analysis - direct indexing instead of slice()
// 			let bassSum = 0;
// 			let midSum = 0;

// 			// Bass: indices 1-6 (skip DC at 0)
// 			for (let i = 1; i <= 6; i++) {
// 				bassSum += dataArray.current[i];
// 			}
// 			// Mid: indices 7-26
// 			for (let i = 7; i <= 26; i++) {
// 				midSum += dataArray.current[i];
// 			}

// 			const bassLevel = bassSum / (6 * 255);
// 			const midLevel = midSum / (20 * 255);

// 			// Simplified intensity calculation
// 			const overallIntensity = (bassLevel * 1.6 + midLevel * 1.4) * 0.5;

// 			// Minimal history smoothing
// 			audioHistory.current.shift();
// 			audioHistory.current.push(overallIntensity);
// 			const smoothAverage =
// 				audioHistory.current.reduce((a, b) => a + b, 0) * 0.125; // Divide by 8

// 			const time = currentTime * 0.001;
// 			const enhancedIntensity = Math.pow(
// 				(overallIntensity * 0.7 + smoothAverage * 0.3) * 2.2,
// 				0.65,
// 			);

// 			// Draw rings with optimized parameters
// 			drawOptimizedRing(
// 				ctx,
// 				centerX,
// 				centerY,
// 				baseRadius,
// 				enhancedIntensity,
// 				bassLevel,
// 				time,
// 				0,
// 				true,
// 			);
// 			drawOptimizedRing(
// 				ctx,
// 				centerX,
// 				centerY,
// 				secondRadius,
// 				enhancedIntensity,
// 				midLevel,
// 				time * 1.3,
// 				Math.PI * 0.167,
// 				false,
// 			);

// 			animationRef.current = requestAnimationFrame(drawVisualization);
// 		}, []);

// 		const drawOptimizedRing = useCallback(
// 			(
// 				ctx: CanvasRenderingContext2D,
// 				centerX: number,
// 				centerY: number,
// 				radius: number,
// 				overallIntensity: number,
// 				frequencyIntensity: number,
// 				time: number,
// 				phaseOffset: number,
// 				isBass: boolean,
// 			) => {
// 				const bars = isBass ? 36 : 24; // Reduced bar count for performance
// 				const colors = cachedColors.current;

// 				// Pre-calculate common values
// 				const baseExpansion = frequencyIntensity * 16;
// 				const pulseExpansion =
// 					Math.sin(time * 8 + phaseOffset) * overallIntensity * 6;
// 				const timeVar = time * 3;
// 				const angleMultiplier = (Math.PI * 2) / bars;

// 				// Batch drawing operations
// 				ctx.lineCap = "round";
// 				ctx.globalAlpha = Math.min(1, 0.6 + overallIntensity * 0.4);

// 				for (let i = 0; i < bars; i++) {
// 					const angle = i * angleMultiplier + phaseOffset;

// 					// Simplified amplitude calculation
// 					const angleVar = Math.sin(angle * 2.5 + time * 2.5) * 0.25;
// 					const timeVar2 = Math.sin(timeVar + i * 0.15) * 0.15;

// 					const amplitude =
// 						(frequencyIntensity + angleVar + timeVar2) * (1 + overallIntensity);
// 					const barHeight = Math.max(
// 						2,
// 						Math.min(12, baseExpansion * amplitude + pulseExpansion),
// 					);

// 					const halfHeight = barHeight * 0.5;
// 					const innerRadius = radius - halfHeight;
// 					const outerRadius = radius + halfHeight;

// 					// Color selection with reduced string operations
// 					const useMain = (i & 1) === 0 || overallIntensity > 0.5; // Bitwise instead of modulo
// 					ctx.strokeStyle = isBass
// 						? useMain
// 							? colors.bassMain
// 							: colors.bassAccent
// 						: useMain
// 							? colors.midMain
// 							: colors.midAccent;

// 					ctx.lineWidth = 1.8 + overallIntensity * 2.2;

// 					// Optimized shadow for high intensity
// 					if (overallIntensity > 0.35) {
// 						ctx.shadowBlur = 1.5 + overallIntensity * 2.5;
// 						ctx.shadowColor = isBass ? colors.bassMain : colors.midMain;
// 					}

// 					// Pre-calculate trig functions
// 					const cosAngle = Math.cos(angle);
// 					const sinAngle = Math.sin(angle);

// 					ctx.beginPath();
// 					ctx.moveTo(
// 						centerX + cosAngle * innerRadius,
// 						centerY + sinAngle * innerRadius,
// 					);
// 					ctx.lineTo(
// 						centerX + cosAngle * outerRadius,
// 						centerY + sinAngle * outerRadius,
// 					);
// 					ctx.stroke();

// 					// Reset shadow
// 					if (overallIntensity > 0.35) {
// 						ctx.shadowBlur = 0;
// 					}
// 				}

// 				ctx.globalAlpha = 1;
// 			},
// 			[],
// 		);

// 		useEffect(() => {
// 			if (!isPlaying) {
// 				if (animationRef.current) {
// 					cancelAnimationFrame(animationRef.current);
// 					animationRef.current = null;
// 				}
// 				if (audioElementRef.current) {
// 					audioElementRef.current.pause();
// 				}
// 				// Quick canvas clear
// 				const canvas = canvasRef.current;
// 				if (canvas) {
// 					const ctx = canvas.getContext("2d");
// 					if (ctx) {
// 						ctx.clearRect(0, 0, canvas.width, canvas.height);
// 					}
// 				}
// 				return;
// 			}

// 			initializeAudio().then(() => {
// 				if (audioElementRef.current && isPlaying) {
// 					audioElementRef.current.play().catch(console.error);
// 					animationRef.current = requestAnimationFrame(drawVisualization);
// 				}
// 			});

// 			return () => {
// 				if (animationRef.current) {
// 					cancelAnimationFrame(animationRef.current);
// 				}
// 			};
// 		}, [audioUrl, isPlaying, initializeAudio, drawVisualization]);

// 		useEffect(() => {
// 			return () => {
// 				if (animationRef.current) {
// 					cancelAnimationFrame(animationRef.current);
// 				}
// 				if (audioElementRef.current) {
// 					audioElementRef.current.pause();
// 					audioElementRef.current.src = "";
// 				}
// 				if (audioContextRef.current?.state !== "closed") {
// 					audioContextRef.current?.close();
// 				}
// 			};
// 		}, []);

// 		return (
// 			<chakra.canvas
// 				ref={canvasRef}
// 				position="absolute"
// 				top="50%"
// 				left="50%"
// 				width="180px"
// 				height="180px"
// 				transform="translate(-50%, -50%)"
// 				zIndex={0}
// 				pointerEvents="none"
// 				style={{
// 					maxWidth: "180px",
// 					maxHeight: "180px",
// 				}}
// 			/>
// 		);
// 	},
// );

// const CircularWaveformVisualizer = memo(
// 	({ audioUrl, isPlaying }: CircularWaveformVisualizerProps) => {
// 		const canvasRef = useRef<HTMLCanvasElement>(null);
// 		const animationRef = useRef<number | null>(null);
// 		const audioContextRef = useRef<AudioContext | null>(null);
// 		const analyserRef = useRef<AnalyserNode | null>(null);
// 		const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
// 		const audioElementRef = useRef<HTMLAudioElement | null>(null);
// 		const gainNodeRef = useRef<GainNode | null>(null);
// 		const lastFrameTime = useRef<number>(0);
// 		const audioHistory = useRef<number[]>(new Array(30).fill(0));

// 		const initializeAudio = useCallback(async () => {
// 			if (!audioUrl) return;

// 			try {
// 				if (!audioContextRef.current) {
// 					audioContextRef.current = new (window.AudioContext ||
// 						(window as any).webkitAudioContext)();
// 				}

// 				const audioContext = audioContextRef.current;
// 				if (audioContext.state === "suspended") {
// 					await audioContext.resume();
// 				}

// 				if (!audioElementRef.current) {
// 					audioElementRef.current = new Audio();
// 					audioElementRef.current.crossOrigin = "anonymous";
// 					audioElementRef.current.preload = "auto";
// 					audioElementRef.current.volume = 1.0;
// 				}

// 				const audio = audioElementRef.current;

// 				if (!sourceRef.current && audio) {
// 					analyserRef.current = audioContext.createAnalyser();
// 					analyserRef.current.fftSize = 256;
// 					analyserRef.current.smoothingTimeConstant = 0.3;
// 					analyserRef.current.minDecibels = -90;
// 					analyserRef.current.maxDecibels = -10;

// 					gainNodeRef.current = audioContext.createGain();
// 					gainNodeRef.current.gain.value = 0;

// 					sourceRef.current = audioContext.createMediaElementSource(audio);
// 					sourceRef.current.connect(analyserRef.current);
// 					analyserRef.current.connect(gainNodeRef.current);
// 					gainNodeRef.current.connect(audioContext.destination);
// 				}

// 				if (audio.src !== audioUrl) {
// 					audio.src = audioUrl;
// 				}
// 			} catch (error) {
// 				console.error("Error initializing audio:", error);
// 			}
// 		}, [audioUrl]);

// 		const drawVisualization = useCallback((currentTime: number) => {
// 			if (!canvasRef.current || !analyserRef.current) return;

// 			// 30fps for performance
// 			if (currentTime - lastFrameTime.current < 33) {
// 				animationRef.current = requestAnimationFrame(drawVisualization);
// 				return;
// 			}
// 			lastFrameTime.current = currentTime;

// 			const canvas = canvasRef.current;
// 			const ctx = canvas.getContext("2d");
// 			if (!ctx) return;

// 			// Set up canvas with proper device pixel ratio
// 			const rect = canvas.getBoundingClientRect();
// 			const dpr = window.devicePixelRatio || 1;

// 			if (
// 				canvas.width !== rect.width * dpr ||
// 				canvas.height !== rect.height * dpr
// 			) {
// 				canvas.width = rect.width * dpr;
// 				canvas.height = rect.height * dpr;
// 				canvas.style.width = rect.width + "px";
// 				canvas.style.height = rect.height + "px";
// 				ctx.scale(dpr, dpr);
// 			}

// 			const size = Math.min(rect.width, rect.height);
// 			ctx.clearRect(0, 0, rect.width, rect.height);

// 			const centerX = rect.width / 2;
// 			const centerY = rect.height / 2;
// 			const avatarRadius = 70;

// 			// Tighter spacing - keep circles closer to avatar to prevent clipping
// 			const baseRadius = avatarRadius + 4; // First ring very close to avatar
// 			const secondRadius = avatarRadius + 4; // Second ring only 10 units away

// 			const analyser = analyserRef.current;
// 			const bufferLength = analyser.frequencyBinCount;
// 			const dataArray = new Uint8Array(bufferLength);
// 			analyser.getByteFrequencyData(dataArray);

// 			// Process multiple frequency bands for richer visualization
// 			const bassRange = dataArray.slice(0, 10);
// 			const midRange = dataArray.slice(10, 40);
// 			const highRange = dataArray.slice(40, 80);

// 			const bassLevel =
// 				bassRange.reduce((sum, val) => sum + val, 0) / (bassRange.length * 255);
// 			const midLevel =
// 				midRange.reduce((sum, val) => sum + val, 0) / (midRange.length * 255);
// 			const highLevel =
// 				highRange.reduce((sum, val) => sum + val, 0) / (highRange.length * 255);

// 			const overallIntensity =
// 				(bassLevel * 1.5 + midLevel * 1.2 + highLevel * 0.8) / 3;

// 			audioHistory.current.shift();
// 			audioHistory.current.push(overallIntensity);

// 			const smoothAverage =
// 				audioHistory.current.reduce((a, b) => a + b, 0) /
// 				audioHistory.current.length;
// 			const time = currentTime * 0.001;
// 			const enhancedIntensity = Math.pow(overallIntensity * 2, 0.6);

// 			// Draw tightly spaced reactive rings closer to avatar
// 			drawReactiveRing(
// 				ctx,
// 				centerX,
// 				centerY,
// 				baseRadius,
// 				enhancedIntensity,
// 				bassLevel,
// 				time,
// 				0,
// 				"bass",
// 			);
// 			drawReactiveRing(
// 				ctx,
// 				centerX,
// 				centerY,
// 				secondRadius,
// 				enhancedIntensity,
// 				midLevel,
// 				time * 1.3,
// 				Math.PI / 6,
// 				"bass",
// 			);

// 			animationRef.current = requestAnimationFrame(drawVisualization);
// 		}, []);

// 		const drawReactiveRing = useCallback(
// 			(
// 				ctx: CanvasRenderingContext2D,
// 				centerX: number,
// 				centerY: number,
// 				radius: number,
// 				overallIntensity: number,
// 				frequencyIntensity: number,
// 				time: number,
// 				phaseOffset: number,
// 				type: "bass" | "mid",
// 			) => {
// 				const bars = type === "bass" ? 48 : 36;
// 				const colors =
// 					type === "bass"
// 						? {
// 								main: `rgba(139, 92, 246, ${Math.min(1, 0.7 + overallIntensity * 0.3)})`,
// 								accent: `rgba(99, 102, 241, ${Math.min(1, 0.5 + overallIntensity * 0.3)})`,
// 							}
// 						: {
// 								main: `rgba(99, 102, 241, ${Math.min(1, 0.6 + overallIntensity * 0.4)})`,
// 								accent: `rgba(139, 92, 246, ${Math.min(1, 0.4 + overallIntensity * 0.4)})`,
// 							};

// 				// Reduced expansion to keep within bounds
// 				const baseExpansion = frequencyIntensity * 15; // Reduced from 25
// 				const pulseExpansion =
// 					Math.sin(time * 8 + phaseOffset) * overallIntensity * 5; // Reduced from 8
// 				const randomVariation = Math.sin(time * 3) * overallIntensity * 3; // Reduced from 5

// 				for (let i = 0; i < bars; i++) {
// 					const angle = (i / bars) * Math.PI * 2 + phaseOffset;

// 					const angleVariation = Math.sin(angle * 3 + time * 2) * 0.3;
// 					const timeVariation = Math.sin(time * 5 + i * 0.1) * 0.2;
// 					const intensityBoost = Math.pow(frequencyIntensity + 0.1, 1.5);

// 					const amplitude =
// 						(frequencyIntensity + angleVariation + timeVariation) *
// 						intensityBoost;
// 					const barHeight = Math.max(
// 						3,
// 						baseExpansion * amplitude + pulseExpansion + randomVariation,
// 					);

// 					// Constrain bars to stay within safe bounds
// 					const maxBarHeight = 12; // Maximum bar height to prevent clipping
// 					const constrainedBarHeight = Math.min(barHeight, maxBarHeight);

// 					const innerRadius = Math.max(
// 						radius - constrainedBarHeight / 2,
// 						radius - 8,
// 					);
// 					const outerRadius = Math.min(
// 						radius + constrainedBarHeight / 2,
// 						radius + 8,
// 					);

// 					if (outerRadius > innerRadius) {
// 						const baseOpacity = type === "bass" ? 0.8 : 0.6;
// 						const dynamicOpacity = Math.min(
// 							1,
// 							baseOpacity + overallIntensity * 0.4,
// 						);

// 						const useMainColor = i % 2 === 0 || overallIntensity > 0.5;
// 						ctx.strokeStyle = useMainColor ? colors.main : colors.accent;

// 						ctx.lineWidth = Math.max(1.5, 2 + overallIntensity * 2); // Slightly reduced line width
// 						ctx.lineCap = "round";
// 						ctx.globalAlpha = dynamicOpacity;

// 						if (overallIntensity > 0.4) {
// 							ctx.shadowBlur = 2 + overallIntensity * 3; // Reduced glow
// 							ctx.shadowColor = colors.main;
// 						}

// 						const x1 = centerX + Math.cos(angle) * innerRadius;
// 						const y1 = centerY + Math.sin(angle) * innerRadius;
// 						const x2 = centerX + Math.cos(angle) * outerRadius;
// 						const y2 = centerY + Math.sin(angle) * outerRadius;

// 						ctx.beginPath();
// 						ctx.moveTo(x1, y1);
// 						ctx.lineTo(x2, y2);
// 						ctx.stroke();

// 						ctx.shadowBlur = 1;
// 					}
// 				}

// 				ctx.globalAlpha = 1;
// 			},
// 			[],
// 		);

// 		useEffect(() => {
// 			if (!isPlaying) {
// 				if (animationRef.current) {
// 					cancelAnimationFrame(animationRef.current);
// 					animationRef.current = null;
// 				}
// 				if (audioElementRef.current) {
// 					audioElementRef.current.pause();
// 				}
// 				if (canvasRef.current) {
// 					const ctx = canvasRef.current.getContext("2d");
// 					if (ctx) {
// 						const rect = canvasRef.current.getBoundingClientRect();
// 						ctx.clearRect(0, 0, rect.width, rect.height);
// 					}
// 				}
// 				return;
// 			}

// 			initializeAudio().then(() => {
// 				if (audioElementRef.current && isPlaying) {
// 					audioElementRef.current.play().catch(console.error);
// 					animationRef.current = requestAnimationFrame(drawVisualization);
// 				}
// 			});

// 			return () => {
// 				if (animationRef.current) {
// 					cancelAnimationFrame(animationRef.current);
// 				}
// 			};
// 		}, [audioUrl, isPlaying, initializeAudio, drawVisualization]);

// 		useEffect(() => {
// 			return () => {
// 				if (animationRef.current) {
// 					cancelAnimationFrame(animationRef.current);
// 				}
// 				if (audioElementRef.current) {
// 					audioElementRef.current.pause();
// 					audioElementRef.current.src = "";
// 				}
// 				if (audioContextRef.current?.state !== "closed") {
// 					audioContextRef.current?.close();
// 				}
// 			};
// 		}, []);

// 		return (
// 			<chakra.canvas
// 				ref={canvasRef}
// 				position="absolute"
// 				top="50%"
// 				left="50%"
// 				width="180px"
// 				height="180px"
// 				transform="translate(-50%, -50%)"
// 				zIndex={0}
// 				pointerEvents="none"
// 				style={{
// 					maxWidth: "180px",
// 					maxHeight: "180px",
// 				}}
// 			/>
// 		);
// 	},
// );

function ChatContainer({
	themeParsed,
	headerConfigParsed,
	sessionId,
	initialInteractions,
	agentName,
	codeTheme,
	agentId,
	streaming,
	host,
	instanceId,
	withDebug,
	socket,
	fullScreenRef,
	sessionIdStorage,
}: AppProps & {
	themeParsed: Record<string, string>;
	headerConfigParsed: HeaderConfig;
	socket: WebSocket;
	fullScreenRef: RefObject<HTMLDivElement>;
}) {
	const [expanded, setExpanded] = useState(false);

	document
		.getElementsByTagName("html")?.[0]
		.setAttribute("data-theme", "light");
	// @ts-ignore
	document.getElementsByTagName("html")[0].style["color-scheme"] = "unset";

	const [TTS, setTTS] = useState(
		localStorage.getItem("ts-tts-enabled") === "true" || false,
	);
	const [playingUrl, setPlayingUrl] = useState("");

	const playAudio = useCallback((audioUrl: string) => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current = null;
		}

		const audio = new Audio();
		audioRef.current = audio;

		// Set up event listeners before playing
		audio.addEventListener("playing", () => setPlayingUrl(audioUrl));
		audio.addEventListener("pause", () => setPlayingUrl(""));
		audio.addEventListener("ended", () => setPlayingUrl(""));

		audio.src = audioUrl;
		audio.play().catch((err) => console.error("Error playing audio:", err));
	}, []);

	useEffect(() => {
		localStorage.setItem("ts-tts-enabled", TTS ? "true" : "false");
	}, [TTS]);

	const stopAudio = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
			setPlayingUrl("");
		}
	}, []);

	const initialInteractionsParsed = (
		typeof initialInteractions === "string"
			? JSON.parse(initialInteractions)
			: initialInteractions
	) as Interaction[];

	const { data, mutate } = useSWR(
		`/interactions/${sessionId}`,
		() =>
			initialInteractionsParsed.filter(
				(interaction) => interaction.id !== "new",
			) || [],
		{
			revalidateIfStale: false,
			revalidateOnFocus: false,
			revalidateOnMount: false,
			revalidateOnReconnect: false,
		},
	);

	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Clean up audio on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.src = "";
				audioRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!initialInteractionsParsed?.length) return;
		if (data?.length) return;

		console.log("SETTING INITIAL INTERACTIONS");
		console.log({ initialInteractionsParsed });

		mutate(() => initialInteractionsParsed, { populateCache: true });
	}, [data, initialInteractionsParsed]);

	useEffect(() => {
		const listener = () => {
			mutate([]);
		};

		window.addEventListener("tsmclearmessages", listener);

		return () => {
			window.removeEventListener("tsmclearmessages", listener);
		};
	}, []);

	return (
		<>
			<style>
				{`
					.github-light {
						background-color: transparent !important;
					}

					.github-dark {
						background-color: transparent !important;
					}

				.shiki {
					white-space: pre-wrap;
					outline: none;
					word-break: break-all;
					overflow: auto;
					font-family: monospace;
					font-size: 14px;
					background-color: transparent;
				}

				@layer tokens {
					:host, .light, .dark {
					  ${Object.keys(themeParsed)
							.map((key) => `${key}: ${themeParsed[key]};`)
							.join("\n")}
					}
				}
				`}
			</style>
			<Stack
				py="4"
				px={expanded ? { base: "4", md: "8" } : undefined}
				alignItems={data?.length ? "flex-start" : "center"}
				justifyContent={data?.length ? undefined : "center"}
				h="100%"
				maxH="100dvh"
				style={{ background: "var(--ts-chat-bg, white)" }}
			>
				{(headerConfigParsed?.show || !data?.length) && (
					<ChatHeader
						expanded={expanded}
						setExpanded={setExpanded}
						fullScreenRef={fullScreenRef}
						playingUrl={playingUrl}
						TTS={TTS}
						setTTS={setTTS}
						headerConfig={{
							...headerConfigParsed,
							showAvatar: !data?.length ? true : headerConfigParsed.showAvatar,
						}}
						stopAudio={stopAudio}
						agentName={agentName}
					/>
				)}
				{data?.length ? (
					<Messages
						TTS={TTS}
						interactions={data || []}
						playingUrl={playingUrl}
						playAudio={playAudio}
						withDebug={withDebug}
						stopAudio={stopAudio}
						headerConfig={headerConfigParsed}
						codeTheme={codeTheme}
						maxWidth={themeParsed["--ts-messages-max-width"] || undefined}
					/>
				) : null}
				<Box
					mt={data?.length ? "8" : "0"}
					w="100%"
					flex="0 0 auto"
					maxW={themeParsed["--ts-messages-max-width"] || undefined}
					mx="auto"
				>
					{/*{data?.length ? null : (
						<Text
							color={"var(--ts-chat-fg, black)"}
							textAlign="center"
							fontWeight={500}
							fontSize={"xl"}
							my="2"
						>
							Speak to {agentName}...
						</Text>
					)}*/}
					<ChatInput
						defaultMode="text-first"
						socket={socket}
						playAudio={playAudio}
						host={host}
						streaming={!!streaming}
						sessionId={sessionId}
						sessionIdStorage={sessionIdStorage}
						instanceId={instanceId}
						agentId={agentId}
						TTS={TTS}
						stopAudio={stopAudio}
						setTTS={setTTS}
					/>
				</Box>
			</Stack>
		</>
	);
}

// Updated ChatHeader with optimized circular waveform visualizer
function ChatHeader({
	headerConfig,
	playingUrl,
	TTS,
	setTTS,
	stopAudio,
	agentName,
	fullScreenRef,
	expanded,
	setExpanded,
}: {
	playingUrl: string;
	headerConfig: HeaderConfig;
	TTS: boolean;
	setTTS: React.Dispatch<SetStateAction<boolean>>;
	stopAudio: () => void;
	agentName: string;
	fullScreenRef: RefObject<HTMLDivElement>;
	expanded: boolean;
	setExpanded: React.Dispatch<SetStateAction<boolean>>;
}) {
	useEffect(() => {
		document.addEventListener("fullscreenchange", () => {
			if (document.fullscreenElement) {
				setExpanded(true);
			} else {
				setExpanded(false);
			}
		});
	}, []);

	function openFullscreen(ref: RefObject<HTMLDivElement>) {
		if (document.fullscreenElement) {
			document.exitFullscreen();
			return;
		}

		setExpanded(true);
		const elem = ref?.current as HTMLDivElement;
		if (!elem) return;
		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		} else if ((elem as any).webkitRequestFullscreen) {
			(elem as any).webkitRequestFullscreen();
		} else if ((elem as any).msRequestFullscreen) {
			(elem as any).msRequestFullscreen();
		}
	}

	return (
		<>
			<Group justify="end" alignSelf="end">
				{!headerConfig.hideExpandButton && (
					<IconButton
						colorPalette={"gray"}
						bg={{ _hover: "gray.100", base: "gray.200" }}
						opacity={0.8}
						color="gray.700"
						variant="solid"
						rounded="full"
						transform="scale(0.65)"
						onClick={() => {
							openFullscreen(fullScreenRef);
						}}
					>
						{expanded ? <LuShrink /> : <LuExpand />}
					</IconButton>
				)}
			</Group>
			<Stack w="100%" py="12" flex="0 0 auto">
				{headerConfig.showAvatar ? (
					<Box position="relative" alignSelf="center">
						<CircularWaveformVisualizer
							audioUrl={playingUrl}
							isPlaying={!!playingUrl}
						/>
						<Avatar.Root
							shape="full"
							w={140}
							h={140}
							shadow={"2xl"}
							position="relative"
							zIndex={1}
						>
							<Avatar.Fallback />
							<Avatar.Image src={headerConfig?.avatarUrl || avatarUrl} />

							<Float placement="bottom-end" offsetX="4" offsetY="4">
								<div>
									<IconButton
										colorPalette={"gray"}
										bg={{ _hover: "gray.100", base: "gray.200" }}
										opacity={0.8}
										color="gray.700"
										variant="solid"
										rounded="full"
										transform="scale(0.65)"
										onClick={() => {
											if (TTS) stopAudio();
											setTTS((prev) => !prev);
										}}
									>
										{TTS ? <LuVolume2 /> : <LuVolumeOff />}
									</IconButton>
								</div>
							</Float>
						</Avatar.Root>
					</Box>
				) : null}
				<Box>
					<Heading
						textAlign={"center"}
						size="lg"
						color={"var(--ts-chat-fg, black)"}
					>
						{agentName || "Agent"}
					</Heading>
					<Text
						fontWeight={500}
						color="gray.600"
						fontSize="xs"
						textAlign="center"
					>
						powered by{" "}
						<Text asChild>
							<a href="https://trueselph.com">TrueSelph</a>
						</Text>{" "}
						&copy;
					</Text>
				</Box>
			</Stack>
		</>
	);
}

export function VoiceChatInput({
	stopAudio,
	setDefaultMode,
	agentId,
	host,
	instanceId,
	sessionId,
	setTranscribeContent,
	startRecording,
	stopRecording,
	audioData,
	isRecording,
	recordingBlob,
}: {
	stopAudio: () => void;
	setTranscribeContent: (content: string) => void;
	agentId: string;
	sessionId: string;
	instanceId: string;
	host: string;
	setDefaultMode: React.Dispatch<SetStateAction<"voice-first" | "text-first">>;
	stopRecording: () => void;
	startRecording: () => void;
	recordingBlob: Blob | null;
	isRecording: boolean;
	audioData: Uint8Array<ArrayBufferLike> | null;
}) {
	const handleToggleRecording = () => {
		stopAudio();
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	};

	const { transcribe } = useTranscribe({
		agentId,
		sessionId,
		instanceId,
		host: host as string,
	});

	useEffect(() => {
		if (!recordingBlob) return;

		transcribe(recordingBlob).then(async (res) => {
			const result = (await res.json()) as {
				reports?: Array<{ transcript: string; success: boolean }>;
				success?: boolean;
				transcript?: string;
			};

			const transcript = result.reports?.[0]?.transcript || result?.transcript;

			if (transcript) {
				setTranscribeContent(transcript);
			}

			return result;
		});
	}, [recordingBlob]);

	return (
		<Group alignSelf="center" w="100%" justifyContent="center">
			<IconButton
				rounded="full"
				size="xs"
				mr="3"
				onClick={() => {
					setDefaultMode("text-first");
				}}
			>
				<LuKeyboard />
			</IconButton>
			<Box position="relative">
				<IconAudioVisualizer audioData={audioData} isPlaying={isRecording} />
				<IconButton
					variant={isRecording ? "solid" : "subtle"}
					colorScheme={isRecording ? "red" : "blue"}
					rounded="3xl"
					size="2xl"
					onClick={handleToggleRecording}
					position="relative"
					zIndex={2}
					transition="all 0.2s ease"
					_hover={{
						transform: "scale(1.05)",
					}}
					_active={{
						transform: "scale(0.95)",
					}}
				>
					{isRecording ? <AiOutlinePause /> : <HiOutlineMicrophone />}
				</IconButton>
			</Box>
		</Group>
	);
}

function MediaMessage({ message }: { message: ResponseMessage }) {
	if (message.message_type !== "MEDIA") return null;

	return (
		<>
			{message.mime?.startsWith("image/") && (
				<Image
					rounded="lg"
					aria-label="Message header"
					src={
						typeof message.data === "string" ? message.data : message.data?.url
					}
				/>
			)}

			{message.mime?.startsWith("audio/") && (
				// biome-ignore lint/a11y/useMediaCaption: <explanation>
				<audio
					controls
					aria-label="Message header"
					src={
						typeof message.data === "string" ? message.data : message.data?.url
					}
				/>
			)}

			{message.mime?.startsWith("video/") && (
				// biome-ignore lint/a11y/useMediaCaption: <explanation>
				<Box rounded="lg" overflow="hidden">
					<video
						controls
						src={
							typeof message.data === "string"
								? message.data
								: message.data?.url
						}
					/>
				</Box>
			)}
		</>
	);
}

export const Messages = memo(function Messages({
	interactions,
	playingUrl,
	playAudio,
	stopAudio,
	TTS,
	headerConfig,
	codeTheme,
	withDebug,
	maxWidth,
}: {
	interactions: Interaction[];
	playingUrl?: string;
	playAudio?: (url: string) => void;
	stopAudio?: () => void;
	TTS: boolean;
	headerConfig?: HeaderConfig;
	codeTheme?: string;
	withDebug?: boolean;
	maxWidth?: string;
}) {
	const messagesWrapperRef = useRef<HTMLDivElement>(null);
	const [debuggedInteraction, setDebuggedInteraction] =
		useState<Interaction | null>(null);

	useEffect(() => {
		if (messagesWrapperRef.current) {
			messagesWrapperRef.current.scrollTop =
				messagesWrapperRef.current?.scrollHeight;
		}
	}, [messagesWrapperRef.current, interactions]);

	useEffect(() => {
		window.dispatchEvent(
			new CustomEvent("tsminteractionschange", {
				detail: {
					interactions,
				},
			}),
		);
	}, [interactions]);

	return (
		<ScrollArea.Root>
			<ScrollArea.Viewport ref={messagesWrapperRef}>
				<ScrollArea.Content>
					<Stack
						id="ts-messages"
						w="100%"
						// overflowY="scroll"
						margin="0 auto"
						px="4"
						maxW={maxWidth}
					>
						{interactions
							?.filter((interaction) =>
								!debuggedInteraction
									? true
									: debuggedInteraction.id === interaction.id,
							)
							?.map?.((interaction) => (
								<Fragment key={interaction.id}>
									<ChatMessage
										sent
										headerConfig={headerConfig}
										interaction={interaction}
										codeTheme={codeTheme}
										setDebuggedInteraction={setDebuggedInteraction}
										withDebug={withDebug}
									/>
									<ChatMessage
										headerConfig={headerConfig}
										playingUrl={playingUrl}
										playAudio={playAudio}
										stopAudio={stopAudio}
										interaction={interaction}
										setDebuggedInteraction={setDebuggedInteraction}
										TTS={TTS}
										codeTheme={codeTheme}
										withDebug={withDebug}
									/>
								</Fragment>
							))}

						<Presence
							present={!!debuggedInteraction && withDebug}
							animationStyle={{
								_open: "scale-fade-in",
								_closed: "scale-fade-out",
							}}
							animationDuration="moderate"
						>
							<Box
								maxW={"100%"}
								overflow="auto"
								borderWidth="1px"
								borderColor={"var(--ts-input-bg, var(--chakra-colors-border))"}
								rounded="lg"
								px="2"
							>
								<Flex justify="end">
									<CopyIcon
										value={JSON.stringify(debuggedInteraction, null, 2)}
									/>
								</Flex>
								<ShikiHighlighter
									showLanguage={false}
									language="json"
									theme={codeTheme || "github-light"}
									style={{ outline: "none" }}
								>
									{JSON.stringify(debuggedInteraction, null, 2)}
								</ShikiHighlighter>
								<Flex justify="end">
									<IconButton
										size="2xs"
										rounded="3xl"
										variant="ghost"
										bg="var(--ts-icon-btn-bg)"
										color="var(--ts-icon-btn-color)"
										_hover={{
											background: "var(--ts-icon-btn-hover-bg)",
										}}
										onClick={() => setDebuggedInteraction(null)}
									>
										<LuArrowUpFromLine />
									</IconButton>
								</Flex>
							</Box>
						</Presence>
					</Stack>
				</ScrollArea.Content>
			</ScrollArea.Viewport>

			<ScrollArea.Scrollbar>
				<ScrollArea.Thumb />
			</ScrollArea.Scrollbar>
			<ScrollArea.Corner />
		</ScrollArea.Root>
	);
});

const CopyIcon = memo(function CopyIcon({ value }: { value: string }) {
	const { copied, copy } = useClipboard({
		value,
	});

	return (
		<IconButton
			size="2xs"
			rounded="3xl"
			variant="ghost"
			onClick={copy}
			bg="var(--ts-icon-btn-bg)"
			color="var(--ts-icon-btn-color)"
			_hover={{
				background: "var(--ts-icon-btn-hover-bg)",
			}}
		>
			{!copied ? <LuClipboard /> : <LuClipboardCheck />}
		</IconButton>
	);
});

export const ChatMessage = memo(function ChatMessage({
	sent,
	interaction,
	playingUrl,
	playAudio,
	stopAudio,
	withDebug,
	TTS,
	headerConfig,
	codeTheme,
	setDebuggedInteraction,
}: {
	sent?: boolean;
	interaction?: Interaction;
	playingUrl?: string;
	playAudio?: (url: string) => void;
	stopAudio?: () => void;
	withDebug?: boolean;
	TTS?: boolean;
	headerConfig?: HeaderConfig;
	codeTheme?: string;
	setDebuggedInteraction: React.Dispatch<
		React.SetStateAction<Interaction | null>
	>;
}) {
	const messageContent = useMemo(() => {
		if (!interaction?.response?.message) return "";
		const message = interaction.response.message;
		return message.message_type === "TEXT" ? message.content : "";
	}, [interaction?.response?.message]);

	const { copied, copy } = useClipboard({ value: messageContent });

	const handleCopy = useCallback(() => copy(), [copy]);

	const handleAudioToggle = useCallback(() => {
		if (playingUrl === interaction?.response?.audio_url) {
			stopAudio?.();
		} else if (interaction?.response?.audio_url) {
			playAudio?.(interaction.response.audio_url);
		}
	}, [playingUrl, interaction?.response?.audio_url, stopAudio, playAudio]);

	const handleDebugToggle = useCallback(() => {
		setDebuggedInteraction((prev) =>
			prev?.id === interaction?.id ? null : interaction || null,
		);
	}, [setDebuggedInteraction, interaction]);

	const renderer: Partial<ReactRenderer> = useMemo(
		() => ({
			table(content: ComponentChild[]) {
				return (
					<Table.Root size="md" maxW="100%" overflowX="auto" my="2">
						<Table.Header>
							{(
								content as unknown as any
							)[0]?.props?.children?.props?.children?.map(
								(header: any, index: number) => (
									<Table.ColumnHeader
										key={header.key || index}
										borderColor={
											"var(--ts-chat-bd, var(--global-color-border, currentColor))"
										}
									>
										{header.props.children}
									</Table.ColumnHeader>
								),
							)}
						</Table.Header>
						<Table.Body>
							{(content as unknown as any)[1]?.props?.children?.map(
								(row: any, rowIndex: number) => (
									<Table.Row key={row.key || `row-${rowIndex}`}>
										{row.props?.children?.map(
											(cell: any, cellIndex: number) => (
												<Table.Cell
													borderColor={
														"var(--ts-chat-bd, var(--global-color-border, currentColor))"
													}
													key={cell.key || `cell-${rowIndex}-${cellIndex}`}
												>
													{cell.props.children}
												</Table.Cell>
											),
										)}
									</Table.Row>
								),
							)}
						</Table.Body>
					</Table.Root>
				);
			},
			codespan(code: any) {
				return <Code>{code}</Code>;
			},
			code(snippet: ComponentChild, lang: string | undefined) {
				return (
					<Card.Root
						my="4"
						overflow="hidden"
						rounded="xl"
						borderColor={
							"var(--ts-chat-bd, var(--global-color-border, currentColor))"
						}
					>
						<Card.Header
							bg={"var(--ts-input-bg, var(--chakra-colors-gray-subtle))"}
							color={"var(--ts-input-color, inherit)"}
							borderColor={
								"var(--ts-chat-bd, var(--global-color-border, currentColor))"
							}
							py="1"
						>
							<Flex justify="space-between">
								<Code
									bg={"var(--ts-input-bg, var(--chakra-colors-gray-subtle))"}
									color={"var(--ts-input-color, inherit)"}
									variant={"plain"}
								>
									{lang}
								</Code>
								<CopyIcon value={snippet as string} />
							</Flex>
						</Card.Header>
						<Card.Body
							py="1"
							bg={"var(--ts-input-bg, var(--chakra-colors-gray-50))"}
							color={"var(--ts-input-color, inherit)"}
							borderColor={
								"var(--ts-chat-bd, var(--global-color-border, currentColor))"
							}
						>
							<ShikiHighlighter
								showLanguage={false}
								style={{
									overflow: "auto",
									width: "100%",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all",
								}}
								language={lang || "text"}
								delay={150}
								theme={codeTheme || "github-light"}
							>
								{snippet as string}
							</ShikiHighlighter>
						</Card.Body>
					</Card.Root>
				);
			},
		}),
		[codeTheme],
	);

	const renderMessageContent = useCallback(() => {
		if (!interaction?.response?.message) return null;

		const message = interaction.response.message;

		if (message.message_type === "TEXT") {
			return (
				<Markdown
					gfm={true}
					breaks={true}
					value={message.content || ""}
					renderer={renderer as any}
				/>
			);
		} else if (message.message_type === "MEDIA") {
			return <MediaMessage message={message} />;
		} else if (message.message_type === "MULTI") {
			return (
				<Stack>
					{(
						message.content as Array<TextResponeMessage | MediaResponseMessage>
					)?.map((item, index) => (
						<Fragment key={`multi-${index}`}>
							{item.message_type === "TEXT" && (
								<Markdown
									gfm={true}
									breaks={true}
									value={item.content || ""}
									renderer={renderer as Partial<ReactRenderer>}
								/>
							)}
							{item.message_type === "MEDIA" && <MediaMessage message={item} />}
						</Fragment>
					))}
				</Stack>
			);
		}

		return null;
	}, [interaction?.response?.message, renderer]);

	return (
		<Flex
			alignSelf={sent ? "flex-end" : "flex-start"}
			alignItems={"start"}
			w="auto"
			maxW={sent ? "11/12" : undefined}
			id="message-root"
		>
			{!sent && (
				<Avatar.Root size="xs" bg="transparent">
					<Avatar.Fallback />
					<Avatar.Image
						rounded="full"
						src={headerConfig?.avatarUrl || avatarUrl}
					/>
				</Avatar.Root>
			)}

			<ChatMessageContainer variant={sent ? "sent" : undefined} mt="0">
				{sent ? (
					<Markdown
						value={interaction?.utterance || ""}
						renderer={renderer as any}
					/>
				) : !interaction?.response?.message ? (
					<>
						<ReplyIndicator show={true} />
					</>
				) : (
					renderMessageContent()
				)}
				{!sent && interaction?.response ? (
					<Flex mt="xs">
						<IconButton
							rounded="3xl"
							size="2xs"
							variant="ghost"
							onClick={handleCopy}
							bg="var(--ts-icon-btn-bg)"
							color="var(--ts-icon-btn-color)"
							_hover={{
								background: "var(--ts-icon-btn-hover-bg)",
							}}
						>
							{!copied ? <LuClipboard /> : <LuClipboardCheck />}
						</IconButton>
						{interaction?.response?.audio_url && TTS ? (
							<IconButton
								rounded="3xl"
								size="2xs"
								variant="ghost"
								bg="var(--ts-icon-btn-bg)"
								color="var(--ts-icon-btn-color)"
								_hover={{
									background: "var(--ts-icon-btn-hover-bg)",
								}}
								onClick={handleAudioToggle}
							>
								{playingUrl === interaction?.response?.audio_url ? (
									<LuHeadphoneOff />
								) : (
									<LuHeadphones />
								)}
							</IconButton>
						) : null}

						{withDebug && (
							<IconButton
								rounded="3xl"
								size="2xs"
								variant="ghost"
								bg="var(--ts-icon-btn-bg)"
								color="var(--ts-icon-btn-color)"
								_hover={{
									background: "var(--ts-icon-btn-hover-bg)",
								}}
								onClick={handleDebugToggle}
							>
								<LuInfo />
							</IconButton>
						)}
					</Flex>
				) : null}
			</ChatMessageContainer>
		</Flex>
	);
});

const ChatMessageContainer = chakra("div", {
	base: {
		p: "2",
		bg: "var(--ts-response-msg-bg, transparent)",
		display: "inline-block",
		color: "var(--ts-response-msg-color, black)",
		"& a": {
			fontWeight: 500,
			fontStyle: "italic",
		},
	},
	variants: {
		variant: {
			sent: {
				px: "4",
				justifySelf: "flex-end",
				rounded: "2xl",
				background: "blue.50",
				color: "gray.900",
			},
		},
	},
});

export function ChatInput({
	sessionId,
	agentId,
	streaming,
	playAudio,
	instanceId,
	TTS,
	host,
	stopAudio,
	setTTS,
	socket,
	defaultMode = "text-first",
	sessionIdStorage,
}: {
	defaultMode: "text-first" | "voice-first";
	sessionId: string;
	agentId: string;
	streaming: boolean;
	playAudio: (audioUrl: string) => void;
	host?: string;
	instanceId?: string;
	TTS: boolean;
	stopAudio: () => void;
	setTTS: React.Dispatch<SetStateAction<boolean>>;
	socket: WebSocket;
	sessionIdStorage: AppProps["sessionIdStorage"];
}) {
	const [mode, setDefaultMode] = useState(defaultMode);
	const hostURL = host || "https://app.trueselph.com";
	const [content, setContent] = useState("");
	const [transcribeContent, setTranscribeContent] = useState("");
	const [_contentDraft, setContentDraft] = useState("");
	const [_userMsgIndex, setUserMsgIndex] = useState(0);
	const defaultStorageMode = "localstorage";

	const recorderControls = useVoiceVisualizer();
	const {
		mediaRecorder,
		isRecordingInProgress: isRecording,
		startRecording,
		stopRecording,
		recordedBlob: recordingBlob,
		audioData,
	} = recorderControls;

	const interactWithoutStreaming = async (
		_url: string,
		{ arg }: { arg: { sessionId: string; content: string } },
	) => {
		const sessionId =
			arg.sessionId ||
			getSessionId(sessionIdStorage || defaultStorageMode, agentId) ||
			undefined;
		const fullResult = await fetch(`${hostURL}/interact`, {
			method: "POST",
			body: JSON.stringify({
				agent_id: agentId,
				utterance: arg.content,
				instance_id: instanceId ? instanceId : undefined,
				session_id: sessionId,
				tts: TTS,
				verbose: true,
				streaming: false,
			}),
			headers: {
				"Content-Type": hostURL?.includes("app.trueselph.com")
					? "text/plain"
					: "application/json",
			},
		})
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				const result = Array.isArray(res?.reports) ? res?.reports?.[0] : res;
				return result;
			});

		if (!sessionId || fullResult.response?.session_id !== sessionId) {
			saveSessionId(
				fullResult.response?.session_id,
				sessionIdStorage || defaultStorageMode,
				agentId,
			);
		}

		window.dispatchEvent(new CustomEvent("tsmsave"));

		return [fullResult];
	};

	let fullContent = "";

	const interactWithStreaming = async (
		_url: string,
		{ arg }: { arg: { sessionId: string; content: string } },
	) => {
		const sessionId =
			arg.sessionId ||
			getSessionId(sessionIdStorage || defaultStorageMode, agentId) ||
			undefined;

		return new Promise((resolve, reject) => {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.onmessage = (event) => {
					const data = JSON.parse(event.data);
					const response = data.data;

					if (data.type === "connection") {
						socket.send(
							JSON.stringify({
								type: "walker",
								walker: "interact",
								response: true,
								context: {
									agent_id: agentId,
									utterance: arg.content,
									session_id: sessionId,
									tts: false,
									verbose: false,
									streaming: true,
									data: {
										client_id: response.client_id,
									},
								},
							}),
						);
					}

					if (data.type === "chat" && response) {
						fullContent += response.content;
						// Check if this is the final message based on metadata
						const isFinal = response.metadata?.finish_reason === "stop";

						updateInteraction({
							interaction: {
								utterance: content,
								isFinal: isFinal,
								id: response.id,
								response: {
									session_id: response.session_id,
									message_type: "TEXT",
									message: {
										message_type: "TEXT",
										content: fullContent,
									},
								},
							},
						} as unknown as any);

						if (isFinal) {
							resolve(response);
						}
					}
				};

				socket.send(JSON.stringify({ type: "connection" }));

				controller.current?.signal.addEventListener("abort", () => {
					socket.onmessage = null;
					controller.current = new AbortController();
					reject();
				});
			}
		}) as Promise<Interaction>;
	};

	const { trigger: triggerWithoutStreaming, isMutating } = useSWRMutation<
		Interaction[]
	>(`/interactions/${sessionId}`, interactWithoutStreaming, {
		onSuccess(data) {
			const [interaction] = data;
			if (interaction?.response?.audio_url && TTS) {
				playAudio(interaction.response.audio_url);
			}
		},
		optimisticData: (current) => {
			return [
				...(current?.filter((i) => !!i.id && !!i.response?.message) || []),
				{ id: "new", utterance: transcribeContent || content },
			] as any;
		},
		populateCache: (result, current) => {
			setContent("");
			setTranscribeContent("");
			return [
				...(current?.filter((i) => !!i.id && !!i.response?.message) || []),
				...result,
			];
		},
		revalidate: false,
	});

	const { trigger: updateInteraction } = useSWRMutation<
		(Interaction & { isFinal: boolean })[]
	>(
		`/interactions/${sessionId}`,
		(
			_url: string,
			{ arg }: { arg: { interaction: Interaction & { isFinal: boolean } } },
		) => {
			return [arg.interaction];
		},
		{
			revalidate: false,
			populateCache: (result, current) => {
				setContent("");
				console.log({ result, current });

				return [
					...(current || []).filter(
						(i) =>
							!(i?.id?.startsWith("stream") || i?.id === result[0]?.id) &&
							!!i?.response?.message?.content,
					),
					{
						...result[0],
					},
				];
			},
		},
	);

	const { trigger: clearStalledInteractions } = useSWRMutation<
		(Interaction & { isFinal: boolean })[]
	>(
		`/interactions/${sessionId}`,
		(_url: string) => {
			return [];
		},
		{
			revalidate: false,
			populateCache: (_result, current) => {
				return [...(current || []).filter((i) => i.id !== "new")];
			},
		},
	);

	const { trigger: triggerWithStreaming, isMutating: isStreaming } =
		useSWRMutation<Promise<Interaction>>(
			`/interactions/${sessionId}`,
			interactWithStreaming,
			{
				optimisticData: (current) =>
					[
						...((current as unknown as Interaction[]) || []),
						{ id: "stream", utterance: content },
					] as unknown as Promise<Interaction>,
				revalidate: false,
			},
		);

	const onContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		const { value } = event.currentTarget;
		setContent(value);
		setContentDraft(value);
		setUserMsgIndex(0);
	};

	let controller = useRef<AbortController>(new AbortController());
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleStreamAction = useCallback(async () => {
		try {
			if (isStreaming) {
				controller.current.abort();
			} else {
				sendMessage();
			}
		} catch (err) {
			console.log(err);
		}
	}, [sessionId, content, isStreaming, controller.current]);

	const sendMessage = useCallback(
		async (utterance?: string) => {
			if (streaming) {
				await triggerWithStreaming({
					content: utterance || content,
					sessionId,
				} as any);
			} else {
				await triggerWithoutStreaming({
					content: utterance || content,
					sessionId,
				} as any);
			}
		},
		[content, sessionId, streaming],
	);

	const { transcribe } = useTranscribe({
		agentId,
		sessionId,
		instanceId,
		host: host as string,
	});

	useEffect(() => {
		const handleSetContent = (e: CustomEvent<{ message: string }>) => {
			if (e.detail?.message) {
				setContent(e.detail.message);
			}
		};

		const handleSendMessage = () => {
			sendMessage(content);
		};

		window.addEventListener(
			"tssetmsgcontent",
			handleSetContent as EventListener,
		);
		window.addEventListener("tssendmsg", handleSendMessage);

		return () => {
			window.removeEventListener(
				"tssetmsgcontent",
				handleSetContent as EventListener,
			);
			window.removeEventListener("tssendmsg", handleSendMessage);
		};
	}, [content, sendMessage]);

	useEffect(() => {
		if (!recordingBlob) return;

		transcribe(recordingBlob).then(async (res) => {
			const result = (await res.json()) as {
				reports?: Array<{ transcript: string; success: boolean }>;
				success?: boolean;
				transcript?: string;
			};

			const transcript = result.reports?.[0]?.transcript || result?.transcript;

			if (transcript) {
				setTranscribeContent(transcript || "");
			}

			return result;
		});
	}, [recordingBlob]);

	useEffect(() => {
		if (transcribeContent) sendMessage(transcribeContent);
	}, [transcribeContent]);

	useEffect(() => {
		clearStalledInteractions();
	}, []);

	useEffect(() => {
		if (textareaRef?.current) textareaRef?.current?.focus();
	}, [textareaRef?.current]);

	return (
		<>
			{mode == "voice-first" && (
				<VoiceChatInput
					host={host!}
					agentId={agentId}
					setDefaultMode={setDefaultMode}
					audioData={audioData}
					isRecording={isRecording}
					recordingBlob={recordingBlob}
					startRecording={startRecording}
					sessionId={sessionId}
					instanceId={instanceId!}
					stopRecording={stopRecording}
					setTranscribeContent={setTranscribeContent}
					stopAudio={stopAudio}
				/>
			)}

			{mode == "text-first" && (
				<Card.Root
					gap="0"
					p="0"
					bg={"var(--ts-input-bg, var(--chakra-colors-gray-subtle))"}
					borderColor={"var(--ts-input-bg, var(--chakra-colors-border))"}
					rounded={"3xl"}
					w="100%"
					maxW="100%"
					style={{ overflow: "hidden" }}
				>
					<Card.Body p="0">
						{!mediaRecorder ? (
							<Textarea
								ref={textareaRef}
								color={"var(--ts-input-color, black)"}
								_placeholder={{
									color: "var(--ts-input-placeholder-color, black)",
								}}
								placeholder="Your message here..."
								autoFocus
								outline={"none"}
								autoresize
								maxH="14lh"
								disabled={isMutating || isStreaming}
								border="none"
								size="lg"
								rounded={"3xl"}
								rows={1}
								value={content}
								onChange={onContentChange}
								onKeyDown={async (event) => {
									if (event.code === "Enter" && !event.shiftKey) {
										event.preventDefault();
										if (content.trim().length > 0) {
											sendMessage();
										}
									}
								}}
							/>
						) : (
							<VoiceVisualizer
								isControlPanelShown={false}
								height={40}
								width={"100%"}
								controls={recorderControls}
								rounded={8}
								barWidth={3}
								mainBarColor="black"
								backgroundColor="#EFF6FF"
								fullscreen
								animateCurrentPick
								isProgressIndicatorTimeShown
								speed={1}
							/>
						)}
					</Card.Body>
					<Card.Footer py="2" px="0">
						<Flex gap="4" justify="space-between" w="100%" px="2" pb="0">
							<Flex gap="1" justify="start" w="100%" px="2" pb="0">
								<IconButton
									variant={isRecording ? "solid" : "subtle"}
									rounded="3xl"
									colorPalette={isRecording ? "red" : "gray"}
									size="sm"
									onClick={() => {
										setDefaultMode("voice-first");
										stopAudio();
										isRecording ? stopRecording() : startRecording();
									}}
								>
									{isRecording ? <AiOutlinePause /> : <HiOutlineMicrophone />}
								</IconButton>

								<IconButton
									colorPalette="gray"
									rounded="3xl"
									size="sm"
									onClick={() => {
										if (TTS) stopAudio();
										setTTS((prev) => !prev);
									}}
								>
									{TTS ? <LuVolume2 /> : <LuVolumeOff />}
								</IconButton>
							</Flex>

							<IconButton
								colorPalette="gray"
								rounded="3xl"
								size="sm"
								onClick={handleStreamAction}
								disabled={!(isMutating && !isStreaming) && !content}
								loading={isMutating && !isStreaming}
							>
								{isStreaming ? <AiOutlineStop /> : <AiOutlineArrowUp />}
							</IconButton>
						</Flex>
					</Card.Footer>
				</Card.Root>
			)}
		</>
	);
}
