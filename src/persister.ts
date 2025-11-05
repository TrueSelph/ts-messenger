// persister.ts - Updated version
import { get, set, del } from "idb-keyval";
import type {
	PersistedClient,
	Persister,
} from "@tanstack/react-query-persist-client";

/**
 * Creates an Indexed DB persister
 */
export function createIDBPersister(idbValidKey: IDBValidKey = "reactQuery") {
	return {
		persistClient: async (client: PersistedClient) => {
			try {
				await set(idbValidKey, client);
				console.log("Persisted client to IndexedDB");
			} catch (error) {
				console.error("Error persisting to IndexedDB:", error);
			}
		},
		restoreClient: async () => {
			try {
				const client = await get<PersistedClient>(idbValidKey);
				console.log(
					"Restored client from IndexedDB:",
					client ? "found" : "not found",
				);
				return client || undefined;
			} catch (error) {
				console.error("Error restoring from IndexedDB:", error);
				return undefined;
			}
		},
		removeClient: async () => {
			try {
				await del(idbValidKey);
			} catch (error) {
				console.error("Error removing from IndexedDB:", error);
			}
		},
	} as Persister;
}
