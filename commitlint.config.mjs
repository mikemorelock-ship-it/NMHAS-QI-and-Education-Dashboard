export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation
        "style", // Formatting (no logic change)
        "refactor", // Code restructure (no feature/fix)
        "perf", // Performance improvement
        "test", // Tests
        "build", // Build system / dependencies
        "ci", // CI/CD changes
        "chore", // Maintenance tasks
        "revert", // Revert a previous commit
      ],
    ],
    "subject-case": [0], // Allow any case in subject
  },
};
