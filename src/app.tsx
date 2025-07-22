import {
	Avatar,
	Box,
	Image,
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
} from "@chakra-ui/react";
import { ColorModeProvider } from "./components/ui/color-mode";
import {
	LuClipboard,
	LuClipboardCheck,
	LuHeadphones,
	LuHeadphoneOff,
	// TbClipboardPlus,
	// TbInfoSquare,
	LuInfo,
	LuVolume2,
	LuVolumeOff,
} from "react-icons/lu";

import "./app.css";
import { Provider } from "./components/ui/provider";
import Markdown, { ReactRenderer } from "marked-react";
import { ShikiHighlighter } from "react-shiki";
import {
	Fragment,
	useCallback,
	useEffect,
	useRef,
	useState,
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
import type { ComponentChild } from "preact";
import { ReplyIndicator } from "./components/ReplyIndicator";
import { Popup } from "./popup";

export type HeaderConfig = {
	showAvatar?: boolean;
	avatarUrl?: string;
	show?: boolean;
};

function localStorageProvider(agentId?: string, sessionId?: string) {
	return () => {
		// When initializing, we restore the data from `localStorage` into a map.
		const map = new Map(
			JSON.parse(
				localStorage.getItem(`ts-msgs-${agentId}-${sessionId}`) || "[]",
			),
		);

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

export function AppContainer(props: AppProps) {
	const socket = new WebSocket(`${props.host}/websocket`);
	const { headerConfig, theme, layout = "standard" } = props;

	const headerConfigParsed = (
		typeof headerConfig === "string" ? JSON.parse(headerConfig) : headerConfig
	) as HeaderConfig;

	const themeParsed = (
		typeof theme === "string" ? JSON.parse(theme) : theme
	) as Record<string, string>;

	return (
		<Provider enableColorScheme theme={themeParsed}>
			<ColorModeProvider forcedTheme="dark">
				{layout === "popup" ? (
					<Popup {...props} headerConfig={headerConfigParsed}>
						<ChatContainer
							socket={socket}
							themeParsed={themeParsed}
							headerConfigParsed={headerConfigParsed}
							{...props}
						/>
					</Popup>
				) : (
					<ChatContainer
						socket={socket}
						themeParsed={themeParsed}
						headerConfigParsed={headerConfigParsed}
						{...props}
					/>
				)}
			</ColorModeProvider>
		</Provider>
	);
}

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
}: AppProps & {
	themeParsed: Record<string, string>;
	headerConfigParsed: HeaderConfig;
	socket: WebSocket;
}) {
	const [TTS, setTTS] = useState(true);
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
		() => initialInteractionsParsed || [],
		{
			revalidateIfStale: false,
			revalidateOnFocus: false,
			revalidateOnMount: false,
			revalidateOnReconnect: false,
			// fallbackData: initialInteractionsParsed,
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
				alignItems={data?.length ? "flex-start" : "center"}
				justifyContent={data?.length ? undefined : "center"}
				h="100%"
			>
				{(headerConfigParsed?.show || !data?.length) && (
					<ChatHeader
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
					/>
				) : null}
				<Box mt={data?.length ? "8" : "0"} w="100%" flex="0 0 auto">
					{data?.length ? null : (
						<Text
							color={"var(--ts-chat-fg, black)"}
							fontWeight={500}
							fontSize={"xl"}
							my="2"
						>
							Speak to {agentName}...
						</Text>
					)}
					<ChatInput
						socket={socket}
						playAudio={playAudio}
						host={host}
						streaming={!!streaming}
						sessionId={sessionId}
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
					// className={`
					//            ${css({ width: "-webkit-fill-available" })()}
					//            ${css({ width: "-moz-available" })()}
					//          `}
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

			{/* {message.caption && (
				<FormattedMessage message={message.message.caption} />
			)} */}
		</>
	);
}

export function Messages({
	interactions,
	playingUrl,
	playAudio,
	stopAudio,
	TTS,
	headerConfig,
	codeTheme,
	withDebug,
}: {
	interactions: Interaction[];
	playingUrl?: string;
	playAudio?: (url: string) => void;
	stopAudio?: () => void;
	TTS: boolean;
	headerConfig?: HeaderConfig;
	codeTheme?: string;
	withDebug?: boolean;
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

	return (
		<Stack
			// alignItems={"flex-start"}
			id="ts-messages"
			w="100%"
			ref={messagesWrapperRef}
			// maxH={"20lh"}
			overflowY="scroll"
			px="4"
			flex="1 1 auto"
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
						<CopyIcon value={JSON.stringify(debuggedInteraction, null, 2)} />
					</Flex>
					<ShikiHighlighter
						showLanguage={false}
						language="json"
						theme={codeTheme || "github-light"}
						style={{ outline: "none" }}
					>
						{JSON.stringify(debuggedInteraction, null, 2)}
					</ShikiHighlighter>
				</Box>
			</Presence>
		</Stack>
	);
}

function CopyIcon({ value }: { value: string }) {
	const { copied, copy } = useClipboard({
		value,
	});

	return (
		<IconButton
			size="2xs"
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
}

export function ChatMessage({
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
	const getMessageContent = (): string => {
		if (!interaction?.response?.message) return "";

		const message = interaction.response.message;
		if (message.message_type === "TEXT") {
			return message.content;
		}
		return "";
	};

	const { copied, copy } = useClipboard({
		value: getMessageContent(),
	});

	const renderer: Partial<ReactRenderer> = {
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
									{row.props?.children?.map((cell: any, cellIndex: number) => (
										<Table.Cell
											borderColor={
												"var(--ts-chat-bd, var(--global-color-border, currentColor))"
											}
											key={cell.key || `cell-${rowIndex}-${cellIndex}`}
										>
											{cell.props.children}
										</Table.Cell>
									))}
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
						// bg="gray.50"
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
	};

	// Render message content based on message type
	const renderMessageContent = () => {
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
	};

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

			<ChatMessageContainer
				variant={sent ? "sent" : undefined}
				mt="0"
				// verticalAlign="ce"
				// py="0"
			>
				{sent ? (
					<Markdown
						value={interaction?.utterance || ""}
						renderer={renderer as any}
					/>
				) : !interaction?.response?.message ? (
					<ReplyIndicator show={true} />
				) : (
					renderMessageContent()
				)}
				{!sent && interaction?.response ? (
					<Flex mt="xs">
						<IconButton
							size="2xs"
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
						{interaction?.response?.audio_url && TTS ? (
							<IconButton
								size="2xs"
								variant="ghost"
								bg="var(--ts-icon-btn-bg)"
								color="var(--ts-icon-btn-color)"
								_hover={{
									background: "var(--ts-icon-btn-hover-bg)",
								}}
								onClick={() => {
									if (playingUrl === interaction?.response?.audio_url) {
										stopAudio?.();
									} else if (interaction?.response?.audio_url) {
										playAudio?.(interaction.response.audio_url);
									}
								}}
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
								size="2xs"
								variant="ghost"
								bg="var(--ts-icon-btn-bg)"
								color="var(--ts-icon-btn-color)"
								_hover={{
									background: "var(--ts-icon-btn-hover-bg)",
								}}
								onClick={() =>
									setDebuggedInteraction((prev) => {
										if (prev?.id === interaction.id) {
											return null;
										}

										return interaction;
									})
								}
							>
								<LuInfo />
							</IconButton>
						)}
					</Flex>
				) : null}
			</ChatMessageContainer>
		</Flex>
	);
}

export const avatarUrl =
	"data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='50'%20height='50'%20version='1.1'%20viewBox='0%200%20400000%20400000'%3e%3cg%20fill-rule='evenodd'%20stroke='none'%3e%3cpath%20d='M17400%20400c-136%20220%20123%20400%20576%20400%20453%200%20824-180%20824-400%200-220-260-400-576-400-317%200-688%20180-824%20400m363800%200c0%20519%201080%20519%201400%200%20136-220-123-400-576-400-453%200-824%20180-824%20400M13996%201404c-410%20496-351%20596%20355%20596%20467%200%20849-170%20849-376%200-693-704-822-1204-220M385055%201400c-155%20406%2021%20600%20545%20600s700-194%20545-600c-127-330-372-600-545-600-173%200-418%20270-545%20600M11461%202585c-95%20248%20167%20477%20583%20508%20416%2032%20756-172%20756-451%200-629-1100-676-1340-57M8000%205000c-415%20501-357%20600%20352%20600%20490%200%20850-255%20850-600%200-330-158-600-350-600-194%200-576%20270-850%20600m382996-193c-366%20592-20%20895%20835%20728%20626-122%20633-186%2068-654-450-373-705-394-902-74M4880%208102c-372%20450-393%20705-73%20902%20592%20366%20895%2020%20728-835-122-625-186-632-654-67m389920%20498c0%20330%20180%20600%20400%20600%20220%200%20400-270%20400-600%200-330-180-600-400-600-220%200-400%20270-400%20600M2500%2011465c-690%20278-631%201335%2075%201335%20329%200%20549-343%20515-800-33-440-67-786-75-768-8%2017-240%20122-515%20233M0%2017975c0%20454%20180%20825%20400%20825%20220%200%20400-260%20400-576%200-317-180-688-400-824-220-136-400%20123-400%20576m164644%20120305c-4661%201423-11844%207535-11844%2010078%200%20175-315%20930-700%201680-643%201250-700%203270-700%2024960v23600l1378%202800c2445%204966%207013%208866%2012130%2010353%201955%20568%206040%20645%2034754%20650%2017896%203%2032765%20150%2033042%20326%20396%20252%20482%204220%20400%2018494L233000%20249400l-32300%20102-32300%20103v-7954c0-6258-117-8047-550-8406-386-320-3235-424-9500-350l-8950%20110v10000c0%2012863%20572%2014961%205400%2019805%202583%202591%204549%203815%208000%204976%203006%201012%2072983%20913%2076077-108%204645-1532%209346-5339%2011018-8920%202236-4790%202143-3482%202019-28354l-114-23000-1093-2333c-2469-5272-6406-8832-11907-10767-1047-368-9871-544-35000-696l-33600-204v-36799H233000l108%208094c129%209656-1193%208574%2010292%208420l8400-114%20110-10200c118-10712%2053-11250-1843-15182-2022-4192-6650-7863-11867-9415-2993-890-70622-820-73556%2078m117448%20454c-390%20248-483%202383-400%209293L281800%20157000l47575%20102c37796%2080%2047641-2%2047894-400%20540-853%20404-17270-150-17822-560-560-94148-703-95027-145m-255678%20839c-530%20992-550%2015613-24%2017000l390%201026h47177c25948%200%2047462-109%2047810-243%20822-315%20966-17264%20153-18077-954-954-94993-665-95506%20294M281500%20193476c-1135%20296-1065%2017501%2074%2018110%201077%20576%2093775%20576%2094852%200%20728-390%20774-921%20774-9010v-8596l-1026-390c-1018-387-93205-498-94674-114m-255400%20390c-702%20282-721%2017353-20%2018054%20954%20954%2094993%20665%2095506-294%20442-826%20595-16290%20171-17393-237-619-94140-980-95657-368m255992%2054870c-390%20248-483%202383-400%209293L281800%20267000h95600l108-8750c75-6117-30-8915-349-9300-518-623-94090-836-95067-215m-255678%20839c-245%20458-414%203978-414%208626s170%208168%20414%208626c413%20770%2093378%201289%2095353%20530%20822-314%20966-17263%20153-18076-954-954-94993-665-95506%20294M4400%20391557c0%20197%20270%20460%20600%20588%20365%20140%20600%200%20600-358a595%20595%200%2000-600-587c-330%200-600%20161-600%20357m390267-90c-486%20486-277%20912%20333%20678%20330-127%20600-390%20600-588%200-420-551-473-933-90m-3167%203210c-832%20216-940%20923-143%20923%20307%200%20660-270%20788-600%20126-330%20191-580%20142-554-48%2026-402%20130-787%20230M8000%20395200c0%20220%20270%20400%20600%20400%20330%200%20600-180%20600-400%200-220-270-400-600-400-330%200-600%20180-600%20400'%20fill='%23f4f4f4'/%3e%3cpath%20d='M17000%20400c-136%20220-681%20400-1211%20400-692%200-899%20169-734%20600%20163%20423-33%20600-660%20600-786%200-827-80-344-664%20503-608%20473-617-351-104-495%20308-900%20877-900%201264%200%20780-433%20910-1030%20314-507-507-2570%201230-2570%202165%200%20475-273%20647-900%20566-1073-135-2008%20365-1677%20900%20130%20210-2%20333-293%20273-336-70-576%20370-656%201202-81%20840-320%201270-663%201200-767-160-2693%202166-2201%202658%20552%20553%20483%201030-148%201030-296%200-864%20360-1262%20800-398%20440-530%20800-295%20800%20235%200%20520-224%20630-500%20120-298%20215-217%20233%20200%2018%20386-238%20700-568%20700-590%200-820%201103-647%203100%2042%20496-110%20900-338%20900-660%200-574%20362670%2085%20362937%20389%20157%20379%20287-43%20583-380%20265-410%20462-100%20654%20244%20150%20443%20882%20443%201626%200%201277%20532%202164%20900%201502%2093-166%20116-82%2050%20186-63%20270%20145%20750%20463%201068%20319%20320%20410%20640%20200%20712-490%20170%202068%203134%202704%203134%20266%200%20483%20420%20483%20930%200%201150%201550%202670%202726%202670%20480%200%20874%20188%20874%20417%200%20440%20891%201423%202177%202396%20483%20366%20663%20400%20476%2088-165-275-110-500%20123-500%20233%200%20428%20225%20434%20500%205%20275%20680%20860%201500%201300%201493%20802%20365427%201547%20367290%20753%20330-140%201365-220%202300-174%201400%2067%201706-48%201732-650%2017-401%20117-520%20223-261%20227%20558%204116-1327%204431-2148%20110-285%20445-520%20744-520%20320%200%20450-247%20315-600-204-530%20260-730%201292-560%20488%2080%202496-2150%202330-2585-97-250%20457-980%201230-1624%20932-777%201405-1515%201410-2200%204-771%2096-886%20367-458%20266%20420%20436%20153%20640-1000%20151-864%20570-1805%20930-2090%201012-798%201012-368966%200-369765-360-284-786-1237-947-2117-240-1310-348-1455-599-800-252%20656-333%20548-452-600-89-850-342-1360-646-1300-275%2056-500-170-500-500%200-330-270-600-600-600-330%200-600-333-600-741%200-1145-1813-2858-3024-2858-728%200-996-170-854-540%20114-298-180-863-657-1256-476-393-1188-994-1582-1336-654-567-694-562-457%2055%20147%20385%2070%20677-183%20677-244%200-443-227-443-504s-380-740-842-1030c-463-288-722-332-576-96%20156%20253-70%20430-546%20430-556%200-740-188-580-600%20232-605-800-831-2956-646-495%2042-900-110-900-338C381200%20129%20324940%200%20200000%200%2079467%200%2018800%20134%2018800%20400c0%20220-370%20400-824%20400-453%200-712-180-576-400%20136-220%20157-400%2047-400s-310%20180-447%20400m221200%20137803c5218%201552%209845%205223%2011867%209415%201896%203932%201960%204470%201844%2015182l-110%2010200-8400%20113c-11482%20155-10160%201237-10290-8420L233000%20156600h-62800v36800l33600%20204c25129%20152%2033953%20328%2035000%20696%205500%201935%209438%205495%2011907%2010767l1093%202333%20114%2023000c124%2024872%20217%2023564-2020%2028354-1671%203580-6372%207388-11017%208920-3094%201021-73071%201120-76077%20108-3451-1161-5417-2385-8000-4976-4828-4844-5400-6942-5400-19806v-10000l8950-108c6266-75%209115%2029%209500%20350%20434%20360%20550%202146%20550%208410v7953l32300-103%2032300-102%20105-18174c82-14274-4-18242-400-18494-277-176-15146-323-33042-326-28715-5-32800-82-34754-650-5121-1487-9688-5387-12133-10356l-1378-2800V175000c0-21691%2057-23710%20700-24961%20385-749%20700-1505%20700-1680%200-2543%207183-8655%2011844-10078%202934-897%2070563-968%2073556-78m138920%20677c553%20553%20690%2016969%20150%2017822-253%20398-10098%20480-47894%20400L281800%20157000l-108-8972c-83-6910%2010-9045%20400-9293%20880-558%2094468-415%2095028%20145m-255200%20400c813%20813%20670%2017762-153%2018077-348%20134-21862%20243-47810%20243H26780l-390-1026c-527-1387-507-16008%2024-17000%20513-960%2094552-1248%2095506-294m254254%2054310%201026%20390v8596c0%208089-46%208620-774%209010-1077%20576-93775%20576-94852%200-1140-610-1210-17814-74-18110%201469-384%2093656-273%2094674%20114m-254417%20643c424%201103%20270%2016567-171%2017393-513%20960-94552%201248-95506%20294-700-700-682-17772%2020-18055%201517-612%2095420-251%2095657%20368m255402%2054718c320%20384%20424%203182%20349%209300l-108%208750h-95600l-108-8973c-83-6910%2010-9045%20400-9293%20977-621%2094550-408%2095067%20216m-255240%20330c814%20812%20670%2017760-152%2018076-1975%20758-94940%20240-95353-531-245-458-414-3978-414-8626s170-8168%20414-8626c513-960%2094552-1248%2095506-294'%20fill='%23040404'/%3e%3c/g%3e%3c/svg%3e";

function ChatHeader({
	headerConfig,
	playingUrl,
	TTS,
	setTTS,
	stopAudio,
	agentName,
}: {
	playingUrl: string;
	headerConfig: HeaderConfig;
	TTS: boolean;
	setTTS: React.Dispatch<SetStateAction<boolean>>;
	stopAudio: () => void;
	agentName: string;
}) {
	return (
		<>
			<Stack w="100%" py="12" flex="0 0 auto">
				{headerConfig.showAvatar ? (
					<Avatar.Root
						shape="full"
						w={140}
						h={140}
						shadow={"2xl"}
						alignSelf={"center"}
						animation={playingUrl ? "talking 2s infinite" : "none"}
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
									// p="2"
									// w="0"
									// h="0"
								>
									{TTS ? <LuVolume2 /> : <LuVolumeOff />}
								</IconButton>
							</div>
						</Float>
					</Avatar.Root>
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
				// shadow: "xs",
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
}: {
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
}) {
	const hostURL = host || "https://app.trueselph.com";
	const [content, setContent] = useState("");
	const [_contentDraft, setContentDraft] = useState("");
	const [_userMsgIndex, setUserMsgIndex] = useState(0);

	const recorderControls = useVoiceVisualizer();
	const {
		mediaRecorder,
		isRecordingInProgress: isRecording,
		startRecording,
		stopRecording,
		recordedBlob: recordingBlob,
	} = recorderControls;

	const interactWithoutStreaming = async (
		_url: string,
		{ arg }: { arg: { sessionId: string; content: string } },
	) => {
		const fullResult = await fetch(`${hostURL}/interact`, {
			method: "POST",
			body: JSON.stringify({
				agent_id: agentId,
				utterance: arg.content,
				instance_id: instanceId ? instanceId : undefined,
				session_id: arg.sessionId,
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
			.then((res) => res.json())
			.then((res) => res?.reports?.[0]);

		document.cookie = `tsSessionId=${fullResult.response?.session_id}; path=/`;

		return [fullResult];
	};

	let fullContent = "";

	const interactWithStreaming = async (
		_url: string,
		{ arg }: { arg: { sessionId: string; content: string } },
	) => {
		return new Promise((resolve, reject) => {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.onmessage = (event) => {
					const data = JSON.parse(event.data);
					console.log("yoo");
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

				controller.current?.signal.addEventListener("abort", () => {
					socket.onmessage = null;
					controller.current = new AbortController();
					// TODO: send an abort message back to jivas

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
		optimisticData: (current) =>
			[...(current || []), { id: "new", utterance: content }] as any,
		populateCache: (result, current) => {
			setContent("");
			return [...(current || []), ...result];
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
						// id: result[0]?.isFinal
						// 	? "completed-" + (current?.length || 0)
						// 	: "stream",
					},
				];
			},
		},
	);

	const { trigger: triggerWithStreaming, isMutating: isStreaming } =
		useSWRMutation<Promise<Interaction>>(
			`/interactions/${sessionId}`,
			interactWithStreaming,
			{
				// optimisticData: (current) =>
				// 	[
				// 		...((current as unknown as Interaction[]) || []),
				// 		{ id: "stream", utterance: content },
				// 	] as unknown as Promise<Response>,
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

	const handleStreamAction = useCallback(async () => {
		try {
			if (isStreaming) {
				controller.current.abort();
			} else {
				// if not streaming do a single mutation
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

	const transcribe = async (blob: Blob) => {
		const formData = new FormData();
		formData.append(
			"file",
			new File([blob], "recording.wav", { type: blob.type }),
		);
		formData.append("agentId", agentId);
		formData.append("sessionId", sessionId || "");
		formData.append("instanceId", instanceId || "");

		return fetch(`${host}/api/transcribe`, {
			method: "POST",
			body: formData,
		});
	};

	useEffect(() => {
		if (!recordingBlob) return;

		transcribe(recordingBlob).then(async (res) => {
			const result = (await res.json()) as
				| { success: false }
				| { success: true; transcript: string };

			if (result.success) {
				sendMessage(result.transcript);
			}

			return result;
		});
	}, [recordingBlob]);

	return (
		<Card.Root
			gap="0"
			p="0"
			bg={"var(--ts-input-bg, var(--chakra-colors-gray-subtle))"}
			borderColor={"var(--ts-input-bg, var(--chakra-colors-border))"}
			rounded={"lg"}
			w="100%"
			maxW="100%"
			style={{ overflow: "hidden" }}
		>
			<Card.Body p="0">
				{!mediaRecorder ? (
					<Textarea
						color={"var(--ts-input-color, black)"}
						_placeholder={{
							color: "var(--ts-input-placeholder-color, black)",
						}}
						placeholder="Your message here..."
						autoFocus
						outline={"none"}
						autoresize
						maxH="4lh"
						disabled={isMutating || isStreaming}
						border="none"
						size="lg"
						rounded={"lg"}
						// disabled={streamMutation.status === "pending"}
						// className={classes.input}
						rows={1}
						value={content}
						onChange={onContentChange}
						onKeyDown={async (event) => {
							if (event.code === "Enter" && !event.shiftKey) {
								event.preventDefault();
								sendMessage();
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
							colorPalette={isRecording ? "red" : "gray"}
							rounded="lg"
							size="sm"
							onClick={() => {
								stopAudio();
								isRecording ? stopRecording() : startRecording();
							}}
						>
							{isRecording ? <AiOutlinePause /> : <HiOutlineMicrophone />}
						</IconButton>

						<IconButton
							// variant="default"
							colorPalette="gray"
							rounded="lg"
							size="sm"
							onClick={() => {
								if (TTS) stopAudio();
								setTTS((prev) => !prev);
							}}
							// p="2"
							// w="0"
							// h="0"
						>
							{TTS ? <LuVolume2 /> : <LuVolumeOff />}
						</IconButton>
					</Flex>

					<IconButton
						// variant="default"
						colorPalette="gray"
						rounded="lg"
						size="sm"
						onClick={handleStreamAction}
						disabled={!(isMutating && !isStreaming) && !content}
						loading={isMutating && !isStreaming}
					>
						{isStreaming ? <AiOutlineStop /> : <AiOutlineArrowUp />}
					</IconButton>
				</Flex>
			</Card.Footer>
			{/* <Show largerThan="sm" styles={{ display: "none" }}> */}
		</Card.Root>
	);
}
