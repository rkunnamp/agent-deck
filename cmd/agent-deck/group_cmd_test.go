package main

import (
	"testing"

	"github.com/asheshgoplani/agent-deck/internal/session"
)

// helper: create storage, add N root groups, return (storage, instances, groupTree).
// Each call overwrites the _test profile, so tests are independent when run sequentially.
func setupGroupsForReorder(t *testing.T, names ...string) *session.Storage {
	t.Helper()
	storage, err := session.NewStorageWithProfile("_test")
	if err != nil {
		t.Fatalf("NewStorageWithProfile: %v", err)
	}

	instances := []*session.Instance{}
	groupTree := session.NewGroupTreeWithGroups(instances, nil)

	for _, name := range names {
		groupTree.CreateGroup(name)
	}

	if err := storage.SaveWithGroups(instances, groupTree); err != nil {
		t.Fatalf("SaveWithGroups: %v", err)
	}

	return storage
}

// helper: reload groups from storage and return ordered paths (excluding default group)
func reloadGroupPaths(t *testing.T, storage *session.Storage) []string {
	t.Helper()
	_, groups, err := storage.LoadWithGroups()
	if err != nil {
		t.Fatalf("LoadWithGroups: %v", err)
	}

	instances := []*session.Instance{}
	tree := session.NewGroupTreeWithGroups(instances, groups)

	var paths []string
	for _, g := range tree.GroupList {
		if g.Path == session.DefaultGroupPath {
			continue
		}
		paths = append(paths, g.Path)
	}
	return paths
}

func TestGroupReorderUp(t *testing.T) {
	storage := setupGroupsForReorder(t, "Alpha", "Beta", "Gamma")

	// Move beta up — should swap with alpha
	handleGroupReorder("_test", []string{"beta", "--up"})

	paths := reloadGroupPaths(t, storage)
	if len(paths) < 3 {
		t.Fatalf("expected 3 groups, got %d", len(paths))
	}
	if paths[0] != "beta" || paths[1] != "alpha" || paths[2] != "gamma" {
		t.Errorf("expected [beta alpha gamma], got %v", paths)
	}
}

func TestGroupReorderDown(t *testing.T) {
	storage := setupGroupsForReorder(t, "Alpha", "Beta", "Gamma")

	// Move beta down — should swap with gamma
	handleGroupReorder("_test", []string{"beta", "--down"})

	paths := reloadGroupPaths(t, storage)
	if len(paths) < 3 {
		t.Fatalf("expected 3 groups, got %d", len(paths))
	}
	if paths[0] != "alpha" || paths[1] != "gamma" || paths[2] != "beta" {
		t.Errorf("expected [alpha gamma beta], got %v", paths)
	}
}

func TestGroupReorderPosition(t *testing.T) {
	storage := setupGroupsForReorder(t, "Alpha", "Beta", "Gamma")

	// Move gamma to position 0
	handleGroupReorder("_test", []string{"gamma", "--position", "0"})

	paths := reloadGroupPaths(t, storage)
	if len(paths) < 3 {
		t.Fatalf("expected 3 groups, got %d", len(paths))
	}
	if paths[0] != "gamma" || paths[1] != "alpha" || paths[2] != "beta" {
		t.Errorf("expected [gamma alpha beta], got %v", paths)
	}
}

func TestGroupReorderAlreadyAtTop(t *testing.T) {
	storage := setupGroupsForReorder(t, "Alpha", "Beta", "Gamma")

	// Move alpha up — already first, should be no-op
	handleGroupReorder("_test", []string{"alpha", "--up"})

	paths := reloadGroupPaths(t, storage)
	if len(paths) < 3 {
		t.Fatalf("expected 3 groups, got %d", len(paths))
	}
	if paths[0] != "alpha" || paths[1] != "beta" || paths[2] != "gamma" {
		t.Errorf("expected [alpha beta gamma], got %v", paths)
	}
}

func TestGroupReorderAlreadyAtBottom(t *testing.T) {
	storage := setupGroupsForReorder(t, "Alpha", "Beta", "Gamma")

	// Move gamma down — already last, should be no-op
	handleGroupReorder("_test", []string{"gamma", "--down"})

	paths := reloadGroupPaths(t, storage)
	if len(paths) < 3 {
		t.Fatalf("expected 3 groups, got %d", len(paths))
	}
	if paths[0] != "alpha" || paths[1] != "beta" || paths[2] != "gamma" {
		t.Errorf("expected [alpha beta gamma], got %v", paths)
	}
}

func TestGroupReorderPositionClamp(t *testing.T) {
	storage := setupGroupsForReorder(t, "Alpha", "Beta", "Gamma")

	// Move alpha to position 99 (should clamp to last)
	handleGroupReorder("_test", []string{"alpha", "--position", "99"})

	paths := reloadGroupPaths(t, storage)
	if len(paths) < 3 {
		t.Fatalf("expected 3 groups, got %d", len(paths))
	}
	if paths[0] != "beta" || paths[1] != "gamma" || paths[2] != "alpha" {
		t.Errorf("expected [beta gamma alpha], got %v", paths)
	}
}
