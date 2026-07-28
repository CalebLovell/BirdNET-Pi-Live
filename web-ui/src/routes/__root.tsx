import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Footer } from "~/components/Footer.tsx";
import { Header } from "~/components/Header.tsx";
import { DEFAULT_FAVICON } from "~/lib/use-favicon.ts";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "BirdNET-Pi Live",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			// The one and only icon element in the document, standing in until a
			// proper mark exists. Routes that know which bird they are about point
			// this same link somewhere else via `useFavicon` -- see the note there
			// for why they must not render a second one. No `type`: the href gets
			// swapped between webp and png, and a stale type is worse than none.
			{
				rel: "icon",
				href: DEFAULT_FAVICON,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<div className="flex min-h-screen flex-col">
					<Header />
					<main className="flex-1">{children}</main>
					<Footer />
				</div>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
