import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert } from "lucide-react";

import { SettingsPage } from "~/components/settings/settings-page.tsx";
import {
	getSettingsPage,
	saveAudioSettingsFn,
	saveDetectionSettingsFn,
	savePrivacySettingsFn,
	saveRecordingSettingsFn,
	saveReviewSettingsFn,
	saveStationSettingsFn,
	saveStorageSettingsFn,
} from "~/lib/settings.ts";

export const Route = createFileRoute("/settings")({
	loader: () => getSettingsPage(),
	component: SettingsRoute,
	errorComponent: SettingsUnavailable,
});

function SettingsRoute() {
	const data = Route.useLoaderData();
	const saveStation = useServerFn(saveStationSettingsFn);
	const saveDetection = useServerFn(saveDetectionSettingsFn);
	const savePrivacy = useServerFn(savePrivacySettingsFn);
	const saveAudio = useServerFn(saveAudioSettingsFn);
	const saveRecording = useServerFn(saveRecordingSettingsFn);
	const saveStorage = useServerFn(saveStorageSettingsFn);
	const saveReview = useServerFn(saveReviewSettingsFn);

	return (
		<SettingsPage
			data={data}
			savers={{
				station: (values) => saveStation({ data: values }),
				detection: (values) => saveDetection({ data: values }),
				privacy: (values) => savePrivacy({ data: values }),
				audio: (values) => saveAudio({ data: values }),
				recording: (values) => saveRecording({ data: values }),
				storage: (values) => saveStorage({ data: values }),
				review: (values) => saveReview({ data: values }),
			}}
		/>
	);
}

function SettingsUnavailable() {
	return (
		<main className="page-wrap py-4">
			<section className="feature-card rounded-md p-5">
				<div className="flex items-start gap-3">
					<CircleAlert
						aria-hidden="true"
						className="mt-0.5 size-5 text-destructive"
					/>
					<div>
						<h1 className="display-title font-semibold text-xl">
							Settings unavailable
						</h1>
						<p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
							The BirdNET configuration could not be read. Check that the
							service can access <code>/etc/birdnet/birdnet.conf</code>, or set
							the
							<code>BIRDNET_CONF</code> environment variable to its location.
						</p>
					</div>
				</div>
			</section>
		</main>
	);
}
