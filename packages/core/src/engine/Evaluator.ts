import type { ModelCache } from "../cache/ModelCache.js";
import type { CheckRequest, ConditionResolver, Decision, Permission, StorageAdapter, TraceCondition, TraceNode } from "../types.js";
import { expandRoles } from "./hierarchy.js";

export class Evaluator<Context = unknown> {
    constructor(
        private readonly adapter: StorageAdapter,
        private readonly cache: ModelCache,
        private readonly plugins: ConditionResolver<Context>[],
        private readonly clock: () => Date
    ) {}

    async evaluate(request: CheckRequest<Context>): Promise<Decision> {
        const evaluatedAt = this.clock().toISOString();

        const model = await this.cache.get()

        const directRoleIds = await this.adapter.getSubjectRoleIds(request.subject);

        const directRoles = model.roles.filter(dr => directRoleIds.includes(dr.id));

        const rolesInPlay = expandRoles(model.roles, directRoles);

        const rolePermissions = await this.adapter.getRolePermissions(rolesInPlay.map(({ role }) => role.id));

        const trace: TraceNode[] = [];

        for (const candidate of rolesInPlay) {
            const conditions: TraceCondition[] = [];

            let admissible = true;

            for (const plugin of this.plugins) {
                const verdict = await plugin.resolve({
                    subject: { id: request.subject },
                    role: candidate.role,
                    context: request.context,
                    now: this.clock()
                });

                if (verdict.admissible) {
                    conditions.push({
                        plugin: plugin.name,
                        admissible: true
                    });
                } else {
                    admissible = false;

                    conditions.push({
                        plugin: plugin.name,
                        admissible: false,
                        reason: verdict.reason
                    });
                }
            }

            const permissions = rolePermissions.get(candidate.role.id) ?? [];

            const matchedPermissions = admissible ?
                findMatchingPermissions(permissions, request.action, request.resource) : undefined;
            
            trace.push({
                roleId: candidate.role.id,
                roleName: candidate.role.name,
                source: candidate.source,
                conditions,
                ...(matchedPermissions ?
                    {
                        matchedPermissions: {
                            action: matchedPermissions.action,
                            resource: matchedPermissions.resource
                        }
                    } : {})
            });

            if (admissible && matchedPermissions) return {
                granted: true,
                subject: request.subject,
                action: request.action,
                resource: request.resource,
                evaluatedAt, trace
            };
        }
        
        return {
            granted: false,
            subject: request.subject,
            action: request.action,
            resource: request.resource,
            evaluatedAt, trace
        }
    }

}

function findMatchingPermissions(
    permissions: Permission[],
    action: string,
    resource: string
): Permission | undefined {
    return permissions.find(p => p.action === action && p.resource === resource);
}