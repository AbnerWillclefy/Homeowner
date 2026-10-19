package config_test

import (
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

func TestPhotosAreOffByDefault(t *testing.T) {
	c, err := config.Load(env(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if c.PhotosEnabled() {
		t.Fatal("photos should be off without settings")
	}
}

func TestPhotosBothSettingsEnableThemAndTrimTheSlash(t *testing.T) {
	c, err := config.Load(env(map[string]string{
		"DATABASE_URL":    "postgres://x",
		"PHOTOS_BUCKET":   "my-bucket",
		"PHOTOS_BASE_URL": "https://cdn.example.com/avatars/",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !c.PhotosEnabled() || c.PhotosBucket != "my-bucket" || c.PhotosBaseURL != "https://cdn.example.com/avatars" {
		t.Fatalf("unexpected config: %+v", c)
	}
}

func TestPhotosExactlyOneSettingIsAnError(t *testing.T) {
	for name, vars := range map[string]map[string]string{
		"only bucket":   {"PHOTOS_BUCKET": "b"},
		"only base url": {"PHOTOS_BASE_URL": "https://cdn.example.com/avatars"},
	} {
		vars["DATABASE_URL"] = "postgres://x"
		_, err := config.Load(env(vars))
		if err == nil || !strings.Contains(err.Error(), "PHOTOS_BUCKET and PHOTOS_BASE_URL") {
			t.Errorf("%s: want a photos error, got %v", name, err)
		}
	}
}

func TestPhotosBaseURLMustBeHTTPS(t *testing.T) {
	for _, u := range []string{"http://cdn.example.com", "cdn.example.com", "https://"} {
		_, err := config.Load(env(map[string]string{
			"DATABASE_URL": "postgres://x", "PHOTOS_BUCKET": "b", "PHOTOS_BASE_URL": u,
		}))
		if err == nil || !strings.Contains(err.Error(), "PHOTOS_BASE_URL must be an https URL") {
			t.Errorf("%q: got %v", u, err)
		}
	}
}
