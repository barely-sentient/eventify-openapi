import { toPascalCase, toCamelCase } from "../src/utils/casing.js";

describe("casing utils", () => {
  describe("toPascalCase", () => {
    it("handles simple lower", () => {
      expect(toPascalCase("user")).toBe("User");
    });
    it("handles kebab", () => {
      expect(toPascalCase("user-profile")).toBe("UserProfile");
    });
    it("handles snake", () => {
      expect(toPascalCase("user_profile")).toBe("UserProfile");
    });
    it("handles space separated", () => {
      expect(toPascalCase("hello world")).toBe("HelloWorld");
    });
    it("strips leading non-alpha", () => {
      expect(toPascalCase("123user")).toBe("User");
      expect(toPascalCase("123_user_name")).toBe("UserName");
      expect(toPascalCase("___hello")).toBe("Hello");
    });
    it("returns Anonymous for no valid chars", () => {
      expect(toPascalCase("!!!")).toBe("Anonymous");
      expect(toPascalCase("")).toBe("Anonymous");
      expect(toPascalCase("123")).toBe("Anonymous");
      expect(toPascalCase("---")).toBe("Anonymous");
    });
    it("handles already Pascal", () => {
      expect(toPascalCase("UserProfile")).toBe("UserProfile");
    });
    it("handles mixed delimiters", () => {
      expect(toPascalCase("foo-bar_baz qux")).toBe("FooBarBazQux");
    });
    it("handles numbers inside", () => {
      expect(toPascalCase("user123Name")).toBe("User123Name");
      expect(toPascalCase("api-v2-test")).toBe("ApiV2Test");
    });
    it("handles single char", () => {
      expect(toPascalCase("a")).toBe("A");
      expect(toPascalCase("A")).toBe("A");
    });
    // Document actual impl behavior for uppercase inputs
    it("preserves uppercase tail (FOO_BAR -> FOOBAR)", () => {
      expect(toPascalCase("FOO_BAR")).toBe("FOOBAR");
      expect(toPascalCase("foo_bar")).toBe("FooBar");
    });
    it("handles cased with numbers and symbols", () => {
      expect(toPascalCase("product-category")).toBe("ProductCategory");
      expect(toPascalCase("productCategory")).toBe("ProductCategory");
    });
  });

  describe("toCamelCase", () => {
    it("lowercases first char of Pascal", () => {
      expect(toCamelCase("UserProfile")).toBe("userProfile");
      expect(toCamelCase("user-profile")).toBe("userProfile");
      expect(toCamelCase("User")).toBe("user");
    });
    it("handles Anonymous -> anonymous", () => {
      expect(toCamelCase("!!!")).toBe("anonymous");
      expect(toCamelCase("")).toBe("anonymous");
    });
    it("handles single char", () => {
      expect(toCamelCase("A")).toBe("a");
      expect(toCamelCase("a")).toBe("a");
    });
    it("derives from toPascalCase", () => {
      expect(toCamelCase("123_user_name")).toBe("userName");
      expect(toCamelCase("hello world")).toBe("helloWorld");
    });
  });
});
