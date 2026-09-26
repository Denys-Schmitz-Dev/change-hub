import { createContext } from "react";
import type { Payload } from "./types";

export const LiveData = createContext<{
    update: (data: Payload) => void;
    pending: boolean;
    setPending: (pending: boolean) => void;
} | null>(null);

export async function readPayload(response: Response): Promise<Payload> {
    if (!response.ok)
        throw new Error(
            `Request failed (${response.status}). Please try again.`,
        );
    const document = new DOMParser().parseFromString(
        await response.text(),
        "text/html",
    );
    const source = document.getElementById("hub-data")?.textContent;
    if (!source)
        throw new Error("The response could not be read. Please try again.");
    const data = JSON.parse(source) as Payload;
    if (!data.props || !Array.isArray(data.errors))
        throw new Error("The response could not be read. Please try again.");
    return data;
}
