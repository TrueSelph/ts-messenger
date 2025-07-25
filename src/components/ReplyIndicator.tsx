import { chakra } from "@chakra-ui/react";

export const ReplyIndicator = ({ show }: { show: boolean }) => {
	return (
		<>
			{show && (
				<ReplyIndicatorContainter>
					<svg
						width="50"
						height="20"
						viewBox="0 0 40 20"
						xmlns="http://www.w3.org/2000/svg"
						fill="var(--ts-response-msg-color, inherit)"
					>
						<circle cx="7" cy="9" r="7">
							<animate
								attributeName="r"
								from="7"
								to="7"
								begin="0s"
								dur="0.8s"
								values="7;3;7"
								calcMode="linear"
								repeatCount="indefinite"
							/>
							<animate
								attributeName="fill-opacity"
								from="1"
								to="1"
								begin="0s"
								dur="0.8s"
								values="1;.5;1"
								calcMode="linear"
								repeatCount="indefinite"
							/>
						</circle>
						<circle cx="18" cy="9" r="3" fill-opacity="0.3">
							<animate
								attributeName="r"
								from="3"
								to="3"
								begin="0s"
								dur="0.8s"
								values="3;7;3"
								calcMode="linear"
								repeatCount="indefinite"
							/>
							<animate
								attributeName="fill-opacity"
								from="0.5"
								to="0.5"
								begin="0s"
								dur="0.8s"
								values=".5;1;.5"
								calcMode="linear"
								repeatCount="indefinite"
							/>
						</circle>
						<circle cx="30" cy="9" r="7">
							<animate
								attributeName="r"
								from="7"
								to="7"
								begin="0s"
								dur="0.8s"
								values="7;3;7"
								calcMode="linear"
								repeatCount="indefinite"
							/>
							<animate
								attributeName="fill-opacity"
								from="1"
								to="1"
								begin="0s"
								dur="0.8s"
								values="1;.5;1"
								calcMode="linear"
								repeatCount="indefinite"
							/>
						</circle>
					</svg>
				</ReplyIndicatorContainter>
			)}
		</>
	);
};

const ReplyIndicatorContainter = chakra("div", {
	base: {
		display: "flex",
		justifyContent: "center",
		paddingInline: "10px",
		animation: `0.5s ease-in fadeInUp`,
		fill: "inherit",
		color: "inherit",
	},
});
