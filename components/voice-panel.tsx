"use client";

import { useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { ArrowUp, AudioLines, CircleHelp, LoaderCircle, Mic, MicOff, Square, X } from "lucide-react";
import { agentContext, answerQuestion, sources, type Answer, type Option, type Tab } from "@/lib/demo";

export type VoiceActions = {
  openSource: (id: string) => void;
  setTab: (tab: Tab) => void;
  selectOption: (option: Option) => void;
  showComparison: () => void;
};

export default function VoicePanel({ actions, openSetup, context }: { actions: VoiceActions; openSetup: () => void; context: string }) {
  const [configured, setConfigured] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const conversation = useConversation({
    micMuted: muted,
    onMessage: message => {
      setTranscript(previous => [...previous.slice(-9), { role: message.source === "user" ? "You" : "Relay", text: message.message }]);
      setExpanded(true);
    },
    onError: () => { setError("Voice connection interrupted. End the session and try again, or use the guided prompts."); setConnecting(false); },
    clientTools: {
      open_evidence: ({ source_id }) => {
        if (typeof source_id !== "string" || !sources.some(source => source.id === source_id)) return "Source not found. Only use source IDs from the supplied brief.";
        actions.openSource(source_id);
        return "The original evidence excerpt is open in the source dialog.";
      },
      show_comparison: () => { actions.setTab("brief"); actions.showComparison(); return "Solution comparison and planning assumptions are visible."; },
      prepare_reply: () => { actions.setTab("reply"); return "Customer reply view opened. This is a draft; no message sent or approved."; },
      show_followups: () => { actions.setTab("followups"); return "Follow-through view opened. No release or notification state changed."; },
      select_option: ({ option }) => {
        if (option !== "workaround" && option !== "permanent") return "Choose workaround or permanent.";
        actions.selectOption(option);
        return `Selected ${option} for review, not approved or committed. Changing the selection invalidates previous draft approval.`;
      },
    },
  });
  const { sendContextualUpdate } = conversation;
  const connected = conversation.status === "connected";
  const busy = connecting || conversation.status === "connecting";

  useEffect(() => {
    fetch("/api/voice/session").then(response => response.json()).then(result => setConfigured(result.configured === true)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (connected) sendContextualUpdate(context);
  }, [context, connected, sendContextualUpdate]);

  async function startVoice() {
    if (!configured) { openSetup(); return; }
    setError("");
    setConnecting(true);
    setMuted(false);
    try {
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
      permission.getTracks().forEach(track => track.stop());
      const response = await fetch("/api/voice/session", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start a voice session.");
      await conversation.startSession({
        conversationToken: result.token,
        connectionType: "webrtc",
        dynamicVariables: { brief_context: agentContext(), screen_context: context },
      });
      setExpanded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t start voice. Check microphone access and try again.");
    } finally {
      setConnecting(false);
    }
  }

  async function stopVoice() {
    try { await conversation.endSession(); }
    catch { setError("Couldn’t close the session cleanly. Refresh this tab to disconnect."); }
  }

  function ask(question: string) {
    if (!question.trim()) return;
    setQuery("");
    setExpanded(true);
    if (connected) {
      conversation.sendUserMessage(question.trim());
      return;
    }
    const result = answerQuestion(question);
    setAnswer(result);
    if (result.tab) actions.setTab(result.tab);
    if (result.option) actions.selectOption(result.option);
    if (result.compare) actions.showComparison();
  }

  return (
    <section className="assistant-shell" aria-label="Relay assistant">
      {expanded && <div className="assistant-popover">
        <div className="assistant-popover-head"><span><AudioLines size={16} /> {connected ? "Live conversation" : "Guided demo"}</span><button className="icon-button" aria-label="Close assistant transcript" onClick={() => setExpanded(false)}><X size={17} /></button></div>
        {connected ? <div className="transcript" role="log" aria-live="polite">{transcript.length ? transcript.map((message, index) => <p key={index}><strong>{message.role}</strong>{message.text}</p>) : <p>Connected. Ask about the evidence, options, or timeline.</p>}</div> : <>
          <p className="assistant-answer" aria-live="polite">{answer?.text || "Cross-examine this decision. Ask who’s affected, what’s at stake, or what would slip."}</p>
          {!!answer?.sourceIds.length && <div className="answer-sources">{answer.sourceIds.map((id, index) => <button key={id} onClick={() => actions.openSource(id)}>Source {index + 1} ↗</button>)}</div>}
          <span className="small muted">Scripted answers for synthetic data. No model request.</span>
        </>}
      </div>}
      {error && <div className="voice-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss voice error"><X size={14} /></button></div>}
      <div className="assistant-bar">
        <button className={`assistant-identity ${connected ? "is-live" : ""}`} onClick={() => setExpanded(value => !value)} aria-expanded={expanded}><span className="assistant-symbol"><AudioLines size={21} /></span><span><strong>Ask Relay</strong><small>{connected ? (conversation.isSpeaking ? "Speaking" : muted ? "Microphone muted" : "Listening") : "A little clarity, on demand"}</small></span></button>
        <form onSubmit={event => { event.preventDefault(); ask(query); }} className="assistant-input"><label className="sr-only" htmlFor="relay-question">Ask about this decision</label><input id="relay-question" maxLength={1000} value={query} onChange={event => setQuery(event.target.value)} placeholder={connected ? "Type into the live conversation…" : "What would slip if we prioritize this?"} /><button className="send-question" type="submit" disabled={!query.trim()} aria-label="Ask question"><ArrowUp size={17} /></button></form>
        {connected ? <><button className="icon-button mute-button" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button><button className="button voice-end" onClick={stopVoice}><Square size={12} fill="currentColor" /> End</button></> : <button className="button voice-button" disabled={busy} onClick={startVoice}>{busy ? <LoaderCircle size={16} className="spin" /> : <Mic size={16} />}{busy ? "Connecting…" : "Talk to Relay"}</button>}
        <button className="icon-button voice-help" aria-label="Voice setup and data processing details" onClick={openSetup}><CircleHelp size={18} /></button>
      </div>
      <div className="assistant-disclosure"><span className={`status-dot ${connected ? "green" : ""}`} />{connected ? "ElevenLabs live · Audio & brief processed in the cloud" : configured ? "ElevenLabs ready · Voice sends audio & brief to the cloud" : "Guided demo · Connect ElevenLabs to enable live voice"}<span className="keyboard-hint">Human approval, always.</span></div>
    </section>
  );
}
