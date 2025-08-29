import {
	ChakraProvider,
	EnvironmentProvider,
	type ChakraProviderProps,
} from "@chakra-ui/react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
// import { ThemeProvider, type ThemeProviderProps } from "next-themes";
import { useEffect, useState } from "react";
import root from "react-shadow/emotion";
import { system } from "./system";

export function Provider(
	props: Omit<ChakraProviderProps, "value"> & { theme: Record<string, string> },
) {
	document
		.getElementsByTagName("html")?.[0]
		.setAttribute("data-theme", "light");
	// @ts-ignore
	document.getElementsByTagName("html")[0].style["color-scheme"] = "unset";
	const [shadow, setShadow] = useState<HTMLElement | null>(null);
	const [cache, setCache] = useState<ReturnType<typeof createCache> | null>(
		null,
	);

	useEffect(() => {
		if (!shadow?.shadowRoot || cache) return;
		const emotionCache = createCache({
			key: "root",
			container: shadow.shadowRoot,
		});
		setCache(emotionCache);
	}, [shadow, cache]);

	return (
		<root.div
			ref={setShadow}
			style={{
				height: "100%",
				...props.theme,
				"--chakra-colors-bg": "var(--ts-chat-bg, var(--chakra-colors-bg))",
				"--chakra-colors-fg":
					"var(--ts-response-msg-color, var(--chakra-colors-fg))",
				"--chakra-colors-border":
					"var(--ts-chat-bd, var(--chakra-colors-border))",
			}}
		>
			{shadow && cache && (
				<EnvironmentProvider value={() => shadow.shadowRoot ?? document}>
					<CacheProvider value={cache}>
						<ChakraProvider {...props} value={system}>
							{/*<ThemeProvider  />*/}
						</ChakraProvider>
					</CacheProvider>
				</EnvironmentProvider>
			)}
		</root.div>
	);
}
