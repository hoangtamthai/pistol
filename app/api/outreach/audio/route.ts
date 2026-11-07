import { NextRequest } from "next/server";
import { caseStore } from "@/lib/case-store";
import { CaseError, object, text } from "@/lib/issues";
import { apiError, readJson, requireOrigin, requireSession } from "@/lib/workspace-auth";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    requireSession(request); requireOrigin(request);
    const body = object(await readJson(request));
    if (body.consent !== true) throw new CaseError("Explicit consent to send the approved message to ElevenLabs is required.");
    const key = process.env.ELEVENLABS_API_KEY;
    const voice = process.env.ELEVENLABS_VOICE_ID;
    if (!key || !voice || !/^[a-zA-Z0-9_-]{1,100}$/.test(voice)) throw new CaseError("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID on the server, then restart. No audio has been generated.", 503);
    const store = caseStore();
    const proposal = store.reserveAudioPreview(text(body.proposalId, "Proposal ID", 100));
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: proposal.text, model_id: "eleven_multilingual_v2" }), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("audio/") || !response.body) throw new CaseError("ElevenLabs could not generate audio. Check voice permissions and credits; no automatic retry was made.", 502);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const maxAudioBytes = 8 * 1024 * 1024;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxAudioBytes) { await reader.cancel(); throw new CaseError("Audio exceeds the local 8 MB preview limit.", 502); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    store.approvedOutreach(proposal.id);
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return apiError(error instanceof CaseError ? error : new CaseError("Audio generation failed or timed out. Provider result is unknown; credits may have been used. No call was placed.", 502));
  }
}
