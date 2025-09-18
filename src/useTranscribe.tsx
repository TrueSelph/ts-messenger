export function useTranscribe({
	agentId,
	sessionId,
	instanceId,
	host,
}: {
	agentId: string;
	sessionId?: string;
	instanceId?: string;
	host: string;
}) {
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

	return { transcribe };
}
