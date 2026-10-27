import { describe, expect, it } from "vitest";
import { readAdminUrls, readConfig } from "./config";

const valid = {
  VITE_ENVIRONMENT: "staging",
  VITE_API_URL: "http://localhost:8080/",
  VITE_COGNITO_REGION: "eu-west-1",
  VITE_COGNITO_CLIENT_ID: "abc123",
  VITE_ADMIN_URLS: '{"production":"https://admin.example.com/"}',
};

describe("readConfig", () => {
  it("reads a valid set and normalises the URLs", () => {
    expect(readConfig(valid)).toEqual({
      environment: "staging",
      apiUrl: "http://localhost:8080",
      cognitoRegion: "eu-west-1",
      cognitoClientId: "abc123",
      adminUrls: { production: "https://admin.example.com" },
    });
  });

  it("rejects an environment that is not local, staging or production", () => {
    expect(() => readConfig({ ...valid, VITE_ENVIRONMENT: "prod" })).toThrow(/VITE_ENVIRONMENT/);
  });

  it("names each missing variable", () => {
    for (const name of ["VITE_ENVIRONMENT", "VITE_API_URL", "VITE_COGNITO_REGION", "VITE_COGNITO_CLIENT_ID"]) {
      expect(() => readConfig({ ...valid, [name]: "" })).toThrow(name);
    }
  });
});

describe("readAdminUrls", () => {
  it("accepts an unset, empty or blank value as no URLs", () => {
    expect(readAdminUrls(undefined)).toEqual({});
    expect(readAdminUrls("")).toEqual({});
    expect(readAdminUrls("  ")).toEqual({});
    expect(readAdminUrls("{}")).toEqual({});
  });

  it("accepts a partial map and http for localhost", () => {
    expect(readAdminUrls('{"local":"http://localhost:5174"}')).toEqual({ local: "http://localhost:5174" });
  });

  it("throws for bad JSON, a non-object, an unknown environment, a non-URL, and http off localhost", () => {
    expect(() => readAdminUrls("not json")).toThrow(/VITE_ADMIN_URLS/);
    expect(() => readAdminUrls("[]")).toThrow(/object/);
    expect(() => readAdminUrls('"https://a.example.com"')).toThrow(/object/);
    expect(() => readAdminUrls('{"prod":"https://a.example.com"}')).toThrow(/unknown environment/);
    expect(() => readAdminUrls('{"production":"nope"}')).toThrow(/not a URL/);
    expect(() => readAdminUrls('{"production":"http://admin.example.com"}')).toThrow(/https/);
    expect(() => readAdminUrls('{"production":7}')).toThrow(/string/);
  });
});
