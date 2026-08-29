/**
 * Converts an arbitrary string into PascalCase (upper camel case).
 * 
 * Removes leading non-alphanumeric characters, splits by non-alphanumeric delimiters,
 * and capitalizes the first letter of each word segment.
 *
 * @param s - The input string to transform.
 * @returns The formatted PascalCase string, or `"Anonymous"` if no valid word characters are present.
 *
 * @example
 * ```ts
 * toPascalCase("user-profile"); // "UserProfile"
 * toPascalCase("123_user_name"); // "UserName"
 * toPascalCase("!!!"); // "Anonymous"
 * ```
 */
export const toPascalCase = (s: string): string => {
    return s.replace(/^[^a-zA-Z]+/, "").split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("") || "Anonymous";
};

/**
 * Converts an arbitrary string into camelCase (lower camel case).
 * 
 * Leverages {@link toPascalCase} internally and lowers the initial character.
 *
 * @param s - The input string to transform.
 * @returns The formatted camelCase string.
 *
 * @example
 * ```ts
 * toCamelCase("user-profile"); // "userProfile"
 * toCamelCase("User_Name"); // "userName"
 * ```
 */
export const toCamelCase = (s: string): string => {
    const pascal = toPascalCase(s);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};