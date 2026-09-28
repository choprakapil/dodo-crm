/**
 * Industry Template Registry (Phase B.3)
 *
 * Code-defined, immutable catalog of versioned industry templates.
 * Adding a new industry template requires ONLY adding a declarative definition here.
 * Zero changes are required to core CRM services, pipelines, or database schemas.
 */

import { IndustryTemplateDefinition, TemplateMetadata } from "./types";
import { generalSalesTemplate } from "./definitions/general-sales";
import { realEstateTemplate } from "./definitions/real-estate";
import { healthcareTemplate } from "./definitions/healthcare";
import { educationTemplate } from "./definitions/education";

export const SYSTEM_TEMPLATES: IndustryTemplateDefinition[] = [
  generalSalesTemplate,
  realEstateTemplate,
  healthcareTemplate,
  educationTemplate,
];

export class TemplateRegistry {
  /**
   * Lists metadata for all active system templates.
   */
  static listTemplates(): TemplateMetadata[] {
    return SYSTEM_TEMPLATES.filter((t) => t.metadata.active).map((t) => ({ ...t.metadata }));
  }

  /**
   * Resolves a template definition by key and optional version (defaults to latest version).
   */
  static getTemplate(key: string, version?: number): IndustryTemplateDefinition | null {
    const matching = SYSTEM_TEMPLATES.filter(
      (t) => t.metadata.key.toLowerCase() === key.toLowerCase() && t.metadata.active
    );

    if (matching.length === 0) {
      return null;
    }

    if (version !== undefined) {
      return matching.find((t) => t.metadata.version === version) ?? null;
    }

    // Default to highest version available
    return matching.sort((a, b) => b.metadata.version - a.metadata.version)[0] ?? null;
  }
}
