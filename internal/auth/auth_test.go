package auth

import (
	"testing"
)

func TestIsAdmin_caseInsensitive(t *testing.T) {
	t.Setenv("ADMIN_EMAILS", "admin@example.com, Owner@Example.com")
	svc := New()

	cases := []struct {
		email string
		want  bool
	}{
		{"admin@example.com", true},
		{"ADMIN@EXAMPLE.COM", true},
		{"Admin@Example.Com", true},
		{"owner@example.com", true},
		{"OWNER@EXAMPLE.COM", true},
		{"other@example.com", false},
		{"", false},
	}

	for _, tc := range cases {
		got := svc.IsAdmin(tc.email)
		if got != tc.want {
			t.Errorf("IsAdmin(%q) = %v, want %v", tc.email, got, tc.want)
		}
	}
}

func TestIsAdmin_emptyEnv(t *testing.T) {
	t.Setenv("ADMIN_EMAILS", "")
	svc := New()

	if svc.IsAdmin("anyone@example.com") {
		t.Error("expected no admins when ADMIN_EMAILS is empty")
	}
}

func TestIsAdmin_whitespaceHandling(t *testing.T) {
	t.Setenv("ADMIN_EMAILS", "  lorraine@fleurraine.com  ,  helper@fleurraine.com  ")
	svc := New()

	if !svc.IsAdmin("lorraine@fleurraine.com") {
		t.Error("expected lorraine@fleurraine.com to be admin")
	}
	if !svc.IsAdmin("  HELPER@FLEURRAINE.COM  ") {
		t.Error("expected helper@fleurraine.com (with surrounding spaces) to be admin")
	}
}
