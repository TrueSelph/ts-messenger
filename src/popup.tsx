import {
	Avatar,
	Box,
	chakra,
	CloseButton,
	Drawer,
	Text,
	Portal,
} from "@chakra-ui/react";
import { useState } from "preact/hooks";
import { type AppProps, type HeaderConfig } from "./app";
import { avatarUrl } from "./avatar";

export function Popup({
	children,
	agentName,
	headerConfig,
}: { children: React.ReactNode; headerConfig?: HeaderConfig } & AppProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div>
			{/*<Text
				fontWeight={500}
				pos="fixed"
				bottom={4}
				right={10}
				color="gray.600"
				fontSize="xs"
				textAlign="center"
			>
				Chat with{" "}
				<Text asChild fontWeight="bold">
					<span>{agentName}</span>
				</Text>{" "}
			</Text>*/}

			<Drawer.Root
				closeOnEscape
				open={isOpen}
				onOpenChange={(e) => setIsOpen(e.open)}
				size="xl"
			>
				<Drawer.Trigger asChild>
					<TriggerButton>
						<Box className="avatar-container">
							<Avatar.Root size="xl" bg="transparent" w="60px" h="60px">
								<Avatar.Fallback />
								<Avatar.Image
									rounded="sm"
									src={headerConfig?.avatarUrl || avatarUrl}
								/>
							</Avatar.Root>
						</Box>
						<Box className="chat-text">
							<Text fontSize="sm" fontWeight="medium" color="white">
								Chat with {agentName}
							</Text>
						</Box>
					</TriggerButton>
				</Drawer.Trigger>

				<Portal>
					{/* <Drawer.Backdrop /> */}
					<Box
						pos="fixed"
						right="0"
						bottom="0"
						w="500px"
						maxW={"100vw"}
						zIndex={999}
					>
						<Drawer.Content
							h={{ base: "100vh", md: "80vh" }}
							w="500px"
							maxW={"100vw"}
							background="var(--ts-chat-popup-bg, transparent)"
							backdropFilter={"blur(220px)"}
						>
							<Drawer.Header>
								<Avatar.Root size="xs" bg="transparent">
									<Avatar.Fallback />
									<Avatar.Image
										rounded="full"
										src={headerConfig?.avatarUrl || avatarUrl}
									/>
								</Avatar.Root>
								<Drawer.Title
									color={"var(--ts-chat-fg, black)"}
									position="relative"
								>
									{agentName || "Agent"}
									<Text
										bottom={"-20px"}
										position={"absolute"}
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
								</Drawer.Title>
							</Drawer.Header>
							<Drawer.Body>{children}</Drawer.Body>
							{/* <Drawer.Footer>
								<Button variant="outline">Cancel</Button>
								<Button>Save</Button>
							</Drawer.Footer> */}
							<Drawer.CloseTrigger asChild color="var(--ts-icon-btn-color)">
								<CloseButton
									bg="var(--ts-icon-btn-bg)"
									color="var(--ts-icon-btn-color)"
									_hover={{
										background: "var(--ts-icon-btn-hover-bg)",
									}}
									size="sm"
								/>
							</Drawer.CloseTrigger>
						</Drawer.Content>
					</Box>
				</Portal>
			</Drawer.Root>

			{/* <Presence
				present={isOpen}
				// left="-100"
				// insetX="0"
				// animationName={{
				// 	_open: "slide-from-left-full",
				// 	_closed: "fade-out",
				// }}
				// animationDuration="slowest"
				// w
				position="fixed"
				right="0"
				bottom="0"
				// insetX="0"
				animationName={{
					_open: "slide-from-bottom-full",
					_closed: "slide-to-bottom-full",
				}}
				animationDuration="moderate"
			>
				<Box
					p="10"
					roundedTop="md"
					w="40%"
					left="0"
					right="0px"
					bottom="10px"
					layerStyle="fill.muted"
					pos="relative"
				>
					<PopupContainer>
						<CloseButton
							pos="absolute"
							onClick={() => setIsOpen(false)}
							top="0"
							right="0"
							zIndex={1000}
							variant="ghost"
						/>
						{children}
					</PopupContainer>
				</Box>
			</Presence> */}
		</div>
	);
}

// const PopupContainer = chakra("div", {
// 	base: {
// 		color: "black",
// 		background: "gray.100",
// 		border: "2px solid gray.900",
// 		borderRadius: "md",
// 		padding: "md",
// 		position: "absolute",
// 		zIndex: 999,
// 		maxH: "600px",
// 		height: "calc(100vh - 200px)",
// 		width: "400px",
// 		right: 10,
// 		bottom: 10,
// 	},
// 	variants: {},
// });

const TriggerButton = chakra("button", {
	base: {
		// background: "red",
		shadow: "2xl",
		width: "60px",
		cursor: "pointer",
		height: "60px",
		p: 0,
		borderRadius: "xl",
		overflow: "hidden",
		position: "fixed",
		zIndex: 998,
		right: 4,
		bottom: 4,
		animation: `pulsez 1.5s infinite`,
		// bg: "#000000",
		boxShadow:
			"rgba(0, 0, 0, 0.44) 7px 6px 9px 0px, rgba(0, 0, 0, 0.34) 0px 2px 32px",
		display: "flex",
		alignItems: "center",
		justifyContent: "flex-end",
		paddingLeft: 0,
		paddingRight: 0,
		transition: "all 0.3s ease",
		backgroundColor: "rgba(0, 0, 0, 0.8)",
		"& .avatar-container": {
			minWidth: "60px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		},
		"& .chat-text": {
			width: 0,
			opacity: 0,
			overflow: "hidden",
			whiteSpace: "nowrap",
			paddingLeft: 0,
			paddingRight: 0,
			transition: "all 0.3s ease",
		},
		"&:hover": {
			width: "200px",
			"& .chat-text": {
				width: "140px",
				opacity: 1,
				paddingLeft: "8px",
				paddingRight: "12px",
			},
		},
	},
	variants: {},
});
