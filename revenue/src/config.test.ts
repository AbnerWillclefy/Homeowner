import { describe, expect, it } from "vitest";
import { readConfig } from "./config";

const good = {
  VITE_API_URL: "http://localhost:8080/",
  VITE_COGNITO_REGION: "eu-west-1",
  VITE_COGNITO_CLIENT_ID: "abc123",
  VITE_PASSWORD_POLICY: '{"minimum_length":8,"require_lowercase":true,"require_uppercase":false,"require_numbers":true,"require_symbols":false}',
};

describe("readConfig", () => {
  it("reads the variables", () => {
    expect(readConfig(good)).toMatchObject({ apiUrl: "http://localhost:8080", cognitoRegion: "eu-west-1", passwordPolicy: { minimumLength: 8, requireNumbers: true } });
  });
  it.each(Object.keys(good))("names %s when it is missing", (name) => {
    expect(() => readConfig({ ...good, [name]: "" })).toThrow(name);
  });
  it("rejects a malformed password policy", () => {
    expect(() => readConfig({ ...good, VITE_PASSWORD_POLICY: '{"minimum_length":8}' })).toThrow("require_lowercase");
  });
});
