import { describe, expect, test } from "bun:test";
import {
  FEATURE_ROLE_PREFIX,
  FEATURE_ROLES,
  getFeatureRole,
  isFeatureRole,
  isRestrictedDatabase,
  checkConfiguredFeature,
} from "./feature_roles";

describe("rbac/feature_roles", () => {
  describe("FEATURE_ROLE_PREFIX", () => {
    test("should be clicklens_", () => {
      expect(FEATURE_ROLE_PREFIX).toBe("clicklens_");
    });
  });

  describe("FEATURE_ROLES", () => {
    test("should contain expected feature roles", () => {
      const roleIds = FEATURE_ROLES.map((r) => r.id);
      expect(roleIds).toContain("clicklens_table_explorer");
      expect(roleIds).toContain("clicklens_query_monitor");
      expect(roleIds).toContain("clicklens_cluster_monitor");
      expect(roleIds).toContain("clicklens_user_admin");
      expect(roleIds).toContain("clicklens_table_admin");
      expect(roleIds).toContain("clicklens_settings_admin");
    });

    test("all roles should have required properties", () => {
      for (const role of FEATURE_ROLES) {
        expect(role.id).toBeDefined();
        expect(role.name).toBeDefined();
        expect(role.description).toBeDefined();
        expect(role.details).toBeDefined();
        expect(role.grants).toBeDefined();
        expect(Array.isArray(role.grants)).toBe(true);
        expect(role.grants.length).toBeGreaterThan(0);
      }
    });

    test("all role ids should start with prefix", () => {
      for (const role of FEATURE_ROLES) {
        expect(role.id.startsWith(FEATURE_ROLE_PREFIX)).toBe(true);
      }
    });

    test("all grants should be valid SQL GRANT statements", () => {
      for (const role of FEATURE_ROLES) {
        for (const grant of role.grants) {
          expect(grant.toUpperCase().startsWith("GRANT")).toBe(true);
          expect(grant).toContain(role.id);
        }
      }
    });
  });

  describe("getFeatureRole", () => {
    test("returns role for valid id", () => {
      const role = getFeatureRole("clicklens_table_explorer");
      expect(role).toBeDefined();
      expect(role?.id).toBe("clicklens_table_explorer");
      expect(role?.name).toBe("Table Explorer");
    });

    test("returns undefined for invalid id", () => {
      const role = getFeatureRole("invalid_role");
      expect(role).toBeUndefined();
    });

    test("returns undefined for empty string", () => {
      const role = getFeatureRole("");
      expect(role).toBeUndefined();
    });

    test("returns correct role for each feature role", () => {
      for (const expectedRole of FEATURE_ROLES) {
        const role = getFeatureRole(expectedRole.id);
        expect(role).toEqual(expectedRole);
      }
    });
  });

  describe("isFeatureRole", () => {
    test("returns true for role with prefix", () => {
      expect(isFeatureRole("clicklens_table_explorer")).toBe(true);
      expect(isFeatureRole("clicklens_custom_role")).toBe(true);
    });

    test("returns false for role without prefix", () => {
      expect(isFeatureRole("admin")).toBe(false);
      expect(isFeatureRole("table_explorer")).toBe(false);
      expect(isFeatureRole("")).toBe(false);
    });

    test("is case-sensitive", () => {
      expect(isFeatureRole("CLICKLENS_table_explorer")).toBe(false);
      expect(isFeatureRole("Clicklens_table_explorer")).toBe(false);
    });
  });

  describe("isRestrictedDatabase", () => {
    test("returns true for system database", () => {
      expect(isRestrictedDatabase("system")).toBe(true);
    });

    test("returns true for information_schema", () => {
      expect(isRestrictedDatabase("information_schema")).toBe(true);
      expect(isRestrictedDatabase("INFORMATION_SCHEMA")).toBe(true);
    });

    test("returns false for regular databases", () => {
      expect(isRestrictedDatabase("default")).toBe(false);
      expect(isRestrictedDatabase("mydb")).toBe(false);
      expect(isRestrictedDatabase("production")).toBe(false);
    });

    test("returns false for empty string", () => {
      expect(isRestrictedDatabase("")).toBe(false);
    });
  });

  describe("checkConfiguredFeature", () => {
    describe("clicklens_table_explorer", () => {
      test("returns true for SHOW grant on global", () => {
        const grants = [{ access_type: "SHOW", database: "*", table: "*" }];
        expect(checkConfiguredFeature("clicklens_table_explorer", grants)).toBe(
          true
        );
      });

      test("returns true for SHOW grant without database", () => {
        const grants = [{ access_type: "SHOW" }];
        expect(checkConfiguredFeature("clicklens_table_explorer", grants)).toBe(
          true
        );
      });

      test("returns true for SELECT on system.tables", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "tables" },
        ];
        expect(checkConfiguredFeature("clicklens_table_explorer", grants)).toBe(
          true
        );
      });

      test("returns false for SELECT on non-system tables", () => {
        const grants = [
          { access_type: "SELECT", database: "mydb", table: "users" },
        ];
        expect(checkConfiguredFeature("clicklens_table_explorer", grants)).toBe(
          false
        );
      });
    });

    describe("clicklens_query_monitor", () => {
      test("returns true for KILL QUERY grant", () => {
        const grants = [{ access_type: "KILL QUERY", database: "*" }];
        expect(checkConfiguredFeature("clicklens_query_monitor", grants)).toBe(
          true
        );
      });

      test("returns true for SELECT on system.processes", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "processes" },
        ];
        expect(checkConfiguredFeature("clicklens_query_monitor", grants)).toBe(
          true
        );
      });

      test("returns false for unrelated grants", () => {
        const grants = [
          { access_type: "SELECT", database: "mydb", table: "users" },
        ];
        expect(checkConfiguredFeature("clicklens_query_monitor", grants)).toBe(
          false
        );
      });
    });

    describe("clicklens_cluster_monitor", () => {
      test("returns true for SELECT on system.clusters", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "clusters" },
        ];
        expect(checkConfiguredFeature("clicklens_cluster_monitor", grants)).toBe(
          true
        );
      });

      test("returns true for SELECT on system.replicas", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "replicas" },
        ];
        expect(checkConfiguredFeature("clicklens_cluster_monitor", grants)).toBe(
          true
        );
      });

      test("returns true for SELECT on system.disks", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "disks" },
        ];
        expect(checkConfiguredFeature("clicklens_cluster_monitor", grants)).toBe(
          true
        );
      });

      test("returns false for SELECT on other system tables", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "tables" },
        ];
        expect(checkConfiguredFeature("clicklens_cluster_monitor", grants)).toBe(
          false
        );
      });
    });

    describe("clicklens_user_admin", () => {
      test("returns true for ACCESS MANAGEMENT grant", () => {
        const grants = [{ access_type: "ACCESS MANAGEMENT" }];
        expect(checkConfiguredFeature("clicklens_user_admin", grants)).toBe(
          true
        );
      });

      test("returns false for other grants", () => {
        const grants = [{ access_type: "SELECT", database: "system" }];
        expect(checkConfiguredFeature("clicklens_user_admin", grants)).toBe(
          false
        );
      });
    });

    describe("clicklens_table_admin", () => {
      test("returns true for CREATE TABLE grant", () => {
        const grants = [{ access_type: "CREATE TABLE", database: "*" }];
        expect(checkConfiguredFeature("clicklens_table_admin", grants)).toBe(
          true
        );
      });

      test("returns true for DROP TABLE grant", () => {
        const grants = [{ access_type: "DROP TABLE" }];
        expect(checkConfiguredFeature("clicklens_table_admin", grants)).toBe(
          true
        );
      });

      test("returns true for ALTER TABLE grant", () => {
        const grants = [{ access_type: "ALTER TABLE", database: "*" }];
        expect(checkConfiguredFeature("clicklens_table_admin", grants)).toBe(
          true
        );
      });

      test("returns false for SELECT grant", () => {
        const grants = [{ access_type: "SELECT", database: "*" }];
        expect(checkConfiguredFeature("clicklens_table_admin", grants)).toBe(
          false
        );
      });
    });

    describe("clicklens_settings_admin", () => {
      test("returns true for SELECT on system.settings", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "settings" },
        ];
        expect(checkConfiguredFeature("clicklens_settings_admin", grants)).toBe(
          true
        );
      });

      test("returns false for SELECT on other tables", () => {
        const grants = [
          { access_type: "SELECT", database: "system", table: "users" },
        ];
        expect(checkConfiguredFeature("clicklens_settings_admin", grants)).toBe(
          false
        );
      });
    });

    describe("edge cases", () => {
      test("returns false for unknown feature id", () => {
        const grants = [{ access_type: "SELECT", database: "*" }];
        expect(checkConfiguredFeature("unknown_feature", grants)).toBe(false);
      });

      test("returns false for empty grants array", () => {
        expect(checkConfiguredFeature("clicklens_table_explorer", [])).toBe(
          false
        );
      });

      test("handles multiple grants correctly", () => {
        const grants = [
          { access_type: "SELECT", database: "mydb", table: "users" },
          { access_type: "SHOW", database: "*" },
        ];
        expect(checkConfiguredFeature("clicklens_table_explorer", grants)).toBe(
          true
        );
      });
    });
  });
});
