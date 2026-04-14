package session

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// captureCgroupIsolationLog swaps cgroupIsolationLog with a JSON-handler
// writing to buf for the duration of the test. The original logger is
// restored via t.Cleanup so concurrent test files are unaffected. Returns
// the buffer the test asserts against.
func captureCgroupIsolationLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	buf := &bytes.Buffer{}
	original := cgroupIsolationLog
	cgroupIsolationLog = slog.New(slog.NewJSONHandler(buf, nil))
	t.Cleanup(func() { cgroupIsolationLog = original })
	return buf
}

// extractMessages decodes each JSON log record in buf and returns the "msg"
// field from each, in order. Empty lines are skipped. A decode failure is
// fatal — the test producer is expected to emit valid JSON via slog.
func extractMessages(t *testing.T, buf *bytes.Buffer) []string {
	t.Helper()
	var msgs []string
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("decode log line %q: %v", line, err)
		}
		if m, ok := rec["msg"].(string); ok {
			msgs = append(msgs, m)
		}
	}
	return msgs
}

// TestLogCgroupIsolationDecision_NilOverride_SystemdAvailable pins the
// "default Linux+systemd" branch of OBS-01: empty config + systemd available
// MUST produce the exact "enabled (systemd-run detected)" string.
func TestLogCgroupIsolationDecision_NilOverride_SystemdAvailable(t *testing.T) {
	home := isolatedHomeDir(t)
	if err := os.WriteFile(filepath.Join(home, ".agent-deck", "config.toml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	ClearUserConfigCache()
	resetSystemdDetectionCacheForTest()
	original := systemdAvailableForLog
	systemdAvailableForLog = func() bool { return true }
	t.Cleanup(func() { systemdAvailableForLog = original })
	resetCgroupIsolationLogOnceForTest()
	buf := captureCgroupIsolationLog(t)

	LogCgroupIsolationDecision()

	msgs := extractMessages(t, buf)
	want := "tmux cgroup isolation: enabled (systemd-run detected)"
	if len(msgs) != 1 || msgs[0] != want {
		t.Fatalf("messages=%v, want exactly [%q]", msgs, want)
	}
}

// TestLogCgroupIsolationDecision_NilOverride_SystemdAbsent pins the "no
// systemd, no override" branch: empty config + systemd absent MUST produce
// the exact "disabled (systemd-run not available)" string. The swappable
// systemdAvailableForLog seam lets this test run on any host (systemd or
// not) without manipulating PATH.
func TestLogCgroupIsolationDecision_NilOverride_SystemdAbsent(t *testing.T) {
	home := isolatedHomeDir(t)
	if err := os.WriteFile(filepath.Join(home, ".agent-deck", "config.toml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	ClearUserConfigCache()
	original := systemdAvailableForLog
	systemdAvailableForLog = func() bool { return false }
	t.Cleanup(func() { systemdAvailableForLog = original })
	resetCgroupIsolationLogOnceForTest()
	buf := captureCgroupIsolationLog(t)

	LogCgroupIsolationDecision()

	msgs := extractMessages(t, buf)
	want := "tmux cgroup isolation: disabled (systemd-run not available)"
	if len(msgs) != 1 || msgs[0] != want {
		t.Fatalf("messages=%v, want exactly [%q]", msgs, want)
	}
}

// TestLogCgroupIsolationDecision_ExplicitFalseOverride pins PERSIST-03 at
// the log layer: explicit `launch_in_user_scope = false` in config MUST
// produce the exact "disabled (config override)" string regardless of host
// systemd capability.
func TestLogCgroupIsolationDecision_ExplicitFalseOverride(t *testing.T) {
	home := isolatedHomeDir(t)
	if err := os.WriteFile(filepath.Join(home, ".agent-deck", "config.toml"),
		[]byte("[tmux]\nlaunch_in_user_scope = false\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	ClearUserConfigCache()
	resetCgroupIsolationLogOnceForTest()
	buf := captureCgroupIsolationLog(t)

	LogCgroupIsolationDecision()

	msgs := extractMessages(t, buf)
	want := "tmux cgroup isolation: disabled (config override)"
	if len(msgs) != 1 || msgs[0] != want {
		t.Fatalf("messages=%v, want exactly [%q]", msgs, want)
	}
}

// TestLogCgroupIsolationDecision_ExplicitTrueOverride pins the symmetric
// override branch: explicit `launch_in_user_scope = true` MUST produce the
// exact "enabled (config override)" string. This branch completes the
// matrix and would otherwise share wording with the auto-detect-true
// branch, hiding override-vs-default ambiguity from operators.
func TestLogCgroupIsolationDecision_ExplicitTrueOverride(t *testing.T) {
	home := isolatedHomeDir(t)
	if err := os.WriteFile(filepath.Join(home, ".agent-deck", "config.toml"),
		[]byte("[tmux]\nlaunch_in_user_scope = true\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	ClearUserConfigCache()
	resetCgroupIsolationLogOnceForTest()
	buf := captureCgroupIsolationLog(t)

	LogCgroupIsolationDecision()

	msgs := extractMessages(t, buf)
	want := "tmux cgroup isolation: enabled (config override)"
	if len(msgs) != 1 || msgs[0] != want {
		t.Fatalf("messages=%v, want exactly [%q]", msgs, want)
	}
}

// TestLogCgroupIsolationDecision_OnlyEmitsOnce pins the OBS-01 dedup
// guarantee: three back-to-back calls produce exactly one log line. After
// resetCgroupIsolationLogOnceForTest, the count rises to two — proving the
// reset helper actually re-arms the sync.Once and that the guard isn't a
// stuck atomic.
func TestLogCgroupIsolationDecision_OnlyEmitsOnce(t *testing.T) {
	home := isolatedHomeDir(t)
	if err := os.WriteFile(filepath.Join(home, ".agent-deck", "config.toml"), []byte(""), 0o644); err != nil {
		t.Fatal(err)
	}
	ClearUserConfigCache()
	original := systemdAvailableForLog
	systemdAvailableForLog = func() bool { return true }
	t.Cleanup(func() { systemdAvailableForLog = original })

	resetCgroupIsolationLogOnceForTest()
	buf := captureCgroupIsolationLog(t)
	for i := 0; i < 3; i++ {
		LogCgroupIsolationDecision()
	}
	if msgs := extractMessages(t, buf); len(msgs) != 1 {
		t.Fatalf("emit count = %d, want 1 (sync.Once must hold across 3 calls); messages=%v", len(msgs), msgs)
	}
	resetCgroupIsolationLogOnceForTest()
	LogCgroupIsolationDecision()
	if msgs := extractMessages(t, buf); len(msgs) != 2 {
		t.Fatalf("emit count after reset+1 = %d, want 2; messages=%v", len(msgs), msgs)
	}
}
