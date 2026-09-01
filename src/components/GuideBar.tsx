import { useEffect, useState } from "react";
import { CHATGPT_PROMPT, LIVE_URL } from "../guide";

interface Props {
  polyfilled: boolean;
}

export function GuideBar({ polyfilled }: Props) {
  const [open, setOpen] = useState(polyfilled);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOpen(polyfilled);
  }, [polyfilled]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(CHATGPT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`guide-bar${polyfilled ? " is-polyfill" : " is-native"}`}>
      <button
        type="button"
        className="guide-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="guide-status">{polyfilled ? "Polyfill" : "Native"}</span>
        <span className="guide-summary">
          {polyfilled
            ? "This tab cannot see WebMCP. Open the URL in ChatGPT's built-in browser."
            : "ChatGPT can see the page tools. Paste the prompt in the chat next to this tab."}
        </span>
        <span className="guide-chevron">{open ? "Hide" : "How"}</span>
      </button>

      {open ? (
        <div className="guide-body">
          <ol className="guide-steps">
            <li>
              Use the <strong>ChatGPT desktop app</strong>. Codex task previews and chatgpt.com in
              Chrome will stay on Polyfill.
            </li>
            <li>
              Model must be <strong>GPT-5.6 Sol</strong> or <strong>GPT-5.6 Terra</strong> (full, not
              Light). Luna has site tools off.
            </li>
            <li>
              Open the <strong>built-in browser</strong> from the ChatGPT toolbar (compass), not an
              embedded Codex preview. Go to <code>{LIVE_URL}</code>
            </li>
            <li>
              This pill should flip to <strong>Native</strong>. The address bar should show{" "}
              <strong>Site tools</strong> (about 20). Settings → Browser → Permissions → Enable site
              tools.
            </li>
            <li>Paste the prompt into the ChatGPT chat beside the browser.</li>
          </ol>
          <div className="guide-prompt">
            <p className="guide-prompt-label">Prompt</p>
            <pre>{CHATGPT_PROMPT}</pre>
            <button type="button" className="guide-copy" onClick={copyPrompt}>
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
