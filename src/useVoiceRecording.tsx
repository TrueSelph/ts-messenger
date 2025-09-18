import { useVoiceVisualizer } from "react-voice-visualizer";
import { useEffect } from "preact/compat";

export function useVoiceRecording({
	agentId,
	sessionId,
	instanceId,
	host,
	sendMessage,
}: {
	agentId: string;
	sessionId: string;
	instanceId?: string;
	host?: string;
	sendMessage: (utterance?: string) => void;
}) {
	const recorderControls = useVoiceVisualizer();
	const { recordedBlob } = recorderControls;

	const transcribe = async (blob: Blob) => {
		const formData = new FormData();
		formData.append(
			"file",
			new File([blob], "recording.wav", { type: blob.type }),
		);
		formData.append("agentId", agentId);
		formData.append("sessionId", sessionId || "");
		formData.append("instanceId", instanceId || "");

		const result = await fetch(`${host}/api/transcribe`, {
			method: "POST",
			body: formData,
		});

		if (result.ok) return result;

		formData.delete("agentId");
		formData.delete("sessionId");
		formData.delete("instanceId");

		return fetch(`${host}/walker/stt/${agentId}`, {
			method: "POST",
			body: formData,
		});
	};

	useEffect(() => {
		if (!recordedBlob) return;

		transcribe(recordedBlob).then(async (res) => {
			const result = (await res.json()) as {
				reports?: Array<{ transcript: string; success: boolean }>;
				success?: boolean;
				transcript?: string;
			};

			const transcript = result.reports?.[0]?.transcript || result?.transcript;

			if (transcript) {
				sendMessage(transcript);
			}

			return result;
		});
	}, [recordedBlob]);

	return recorderControls;
}
