export type ModelActionResultItem = {
	prompt: string[];
	functions: any[];
	result: string;
	generator: null;
	tokens: number;
	temperature: number;
	model_name: string;
	max_tokens: number;
	meta: Record<string, any>;
};

export type ContextData = {
	new_user: boolean;
	ModelActionResult: ModelActionResultItem[];
};

export type TextResponeMessage = {
	message_type: "TEXT";
	content: string;
	meta: Record<string, any>;
};

export type MediaResponseMessage = {
	message_type: "MEDIA";
	content: string;
	mime: string;
	data: null | { url: string; file_name?: string } | string;
	meta: Record<string, any>;
};

export type ResponseMessage =
	| TextResponeMessage
	| MediaResponseMessage
	| {
			message_type: "MULTI";
			content: Array<TextResponeMessage | MediaResponseMessage>;
			meta: Record<string, any>;
	  };

export type Response = {
	session_id: string;
	message_type: string;
	message: ResponseMessage;
	tokens: number;
	audio_url?: string;
};

export type Interaction = {
	id: string;
	agent_id: string;
	channel: string;
	utterance: string;
	tokens: number;
	time_stamp: string;
	trail: string[];
	intents: any[];
	functions: Record<string, any>;
	directives: string[];
	context_data: ContextData;
	events: any[];
	response: Response;
	data: Record<string, any>;
	closed: boolean;
};

export const interactions: Interaction[] = [
	{
		id: "n:Interaction:682f3e322939574bc36a3210",
		agent_id: "n:Agent:682f30bb2939574bc36a30b4",
		channel: "",
		utterance: "hi",
		tokens: 205,
		time_stamp: "2025-05-22T15:09:38.203534+00:00",
		trail: [
			"IntroInteractAction",
			"PersonaInteractAction",
			"ExitInteractAction",
		],
		intents: [],
		functions: {},
		directives: [
			"In a natural and brief manner:\n a. Introduce yourself by name and explain your role\n b. Refer the first-time user to read your AI policy at https://platform.trueselph.com/policy before continuing. It contains our privacy policy.",
		],
		context_data: {
			new_user: true,
			ModelActionResult: [
				{
					prompt: [
						"content='hi' additional_kwargs={} response_metadata={}",
						"content=\"Your name is Agent. Refer to the user as 'user', if not None. Keep in mind 'Thursday, 22 May, 2025' and '11:09 AM' to be aware of the current date and time. ### RESPONSE DIRECTIVES \\n Generate your response by executing the directives below carefully and in order: \\n1. In a natural and brief manner:\\n a. Introduce yourself by name and explain your role\\n b. Refer the first-time user to read your AI policy at https://platform.trueselph.com/policy before continuing. It contains our privacy policy.\\n\" additional_kwargs={} response_metadata={}",
					],
					functions: [],
					result:
						"Hi, I'm Agent, your AI assistant here to help with anything you need. If this is your first time interacting with me, I recommend checking out our AI policy at [https://platform.trueselph.com/policy](https://platform.trueselph.com/policy) to understand how your privacy is handled. How can I assist you today?",
					generator: null,
					tokens: 205,
					temperature: 0.4,
					model_name: "gpt-4o",
					max_tokens: 2048,
					meta: {},
				},
			],
		},
		events: [],
		response: {
			session_id: "7385ac24-bfad-4219-b41f-c21ab4a65085",
			message_type: "TEXT",
			message: {
				message_type: "TEXT",
				content:
					"Hi, I'm Agent, your AI assistant here to help with anything you need. If this is your first time interacting with me, I recommend checking out our AI policy at [https://platform.trueselph.com/policy](https://platform.trueselph.com/policy) to understand how your privacy is handled. How can I assist you today?",
				meta: {},
			},
			tokens: 205,
		},
		data: {},
		closed: true,
	},
];
