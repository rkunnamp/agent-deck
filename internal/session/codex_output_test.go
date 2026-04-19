package session

import "testing"

func TestParseCodexOutput_TrimsTrailingPromptBlock(t *testing.T) {
	content := `> You are in /home/ubuntu/experiment_projects/pi_elixer/etl

  Do you trust the contents of this directory? Working with untrusted contents comes with higher risk of prompt injection.

› 1. Yes, continue
  2. No, quit

  Press enter to continue

╭────────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.121.0)                     │
│                                                │
│ model:     gpt-5.4 high   /model to change     │
│ directory: ~/experiment_projects/pi_elixer/etl │
╰────────────────────────────────────────────────╯

  Tip: Use /skills to list available skills or ask Codex to use one.


› hello and compute 17 * 23.

• Hello. 17 * 23 = 391.

› Summarize recent commits

  gpt-5.4 high · ~/experiment_projects/pi_elixer/etl`

	resp, err := parseCodexOutput(content)
	if err != nil {
		t.Fatalf("parseCodexOutput returned error: %v", err)
	}
	if got, want := resp.Content, "Hello. 17 * 23 = 391."; got != want {
		t.Fatalf("resp.Content = %q, want %q", got, want)
	}
}

func TestParseCodexOutput_PreservesMultilineAssistantBlock(t *testing.T) {
	content := `› explain the tradeoffs

• First line.
Second line.
- bullet one
- bullet two

› Run /review on my current changes

  gpt-5.4 high · ~/project`

	resp, err := parseCodexOutput(content)
	if err != nil {
		t.Fatalf("parseCodexOutput returned error: %v", err)
	}
	want := "First line.\nSecond line.\n- bullet one\n- bullet two"
	if got := resp.Content; got != want {
		t.Fatalf("resp.Content = %q, want %q", got, want)
	}
}

func TestParseCodexOutput_FallbackWithoutAssistantMarker(t *testing.T) {
	content := `› summarize the repo

Plain fallback line one.
Plain fallback line two.

› Run /review on my current changes

  gpt-5.4 high · ~/project`

	resp, err := parseCodexOutput(content)
	if err != nil {
		t.Fatalf("parseCodexOutput returned error: %v", err)
	}
	want := "Plain fallback line one.\nPlain fallback line two."
	if got := resp.Content; got != want {
		t.Fatalf("resp.Content = %q, want %q", got, want)
	}
}
