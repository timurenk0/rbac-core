import { ModelCache } from "./cache/ModelCache.js";
import { Evaluator } from "./engine/Evaluator.js";
import { validateParentAssignment } from "./engine/hierarchy.js";
import type { CacheOptions, CheckRequest, ConditionResolver, Decision, Graph, Permission, Role, RoleForgeConfig, StorageAdapter, SubjectRoles } from "./types.js";

const DEFAULT_CACHE_TTL = 5000;

export class RoleForge<Context = unknown> {
    private readonly evaluator: Evaluator<Context>;
    private readonly cache: ModelCache;

    private constructor(
        private readonly adapter: StorageAdapter,
        plugins: ConditionResolver<Context>[],
        cacheOptions: CacheOptions | undefined,
        private readonly clock: () => Date
    ) {
        const enabled = cacheOptions?.enabled ?? true;

        const ttlMs = cacheOptions?.ttlMs ?? DEFAULT_CACHE_TTL;

        this.cache = new ModelCache(adapter, enabled ? ttlMs : 0, enabled);

        this.evaluator = new Evaluator(adapter, this.cache, plugins, clock);
    }

    static async init<Context = unknown>(
        config: RoleForgeConfig<Context>
    ): Promise<RoleForge<Context>> {
        await config.adapter.migrate();

        return new RoleForge(
            config.adapter,
            config.plugins ?? [],
            config.cache,
            config.clock ?? (() => new Date())
        );
    }
    
    async check(
        request: CheckRequest<Context>
    ): Promise<boolean> {
        const decision = await this.explain(request);
        return decision.granted;
    }

    async explain(
        request: CheckRequest<Context>
    ): Promise<Decision> {
        return this.evaluator.evaluate(request);
    }

    async createRole(
        role: Omit<Role, "id">
    ): Promise<Role> {
        const created = await this.adapter.createRole(role);

        this.cache.invalidate();

        return created;
    }

    async deleteRole(
        roleId: string
    ): Promise<void> {
        await this.adapter.deleteRole(roleId);

        this.cache.invalidate();
    }

    async setRoleParent(
        roleId: string,
        parentId: string | null
    ): Promise<void> {
        await this.adapter.setRoleParent(roleId, parentId);

        this.cache.invalidate();
    }

    async createPermission(
        permission: Parameters<StorageAdapter["createPermission"]>[0]
    ): Promise<Permission> {
        const created = await this.adapter.createPermission(permission);

        this.cache.invalidate();

        return created;
    }

    async deletePermission(
        permissionId: string
    ): Promise<void> {
        await this.adapter.deletePermission(permissionId);

        this.cache.invalidate();
    }

    async assignRole(
        subjectId: string,
        roleId: string
    ): Promise<void> {
        await this.adapter.assignRole(subjectId, roleId);

        this.cache.invalidate();
    }

    async unassignRole(
        subjectId: string,
        roleId: string
    ): Promise<void> {
        await this.adapter.unassignRole(subjectId, roleId);

        this.cache.invalidate();
    }

    async grantPermission(
        roleId: string,
        permissionId: string
    ): Promise<void> {
        await this.adapter.grantPermission(roleId, permissionId);

        this.cache.invalidate();
    }

    async revokePermission(
        roleId: string,
        permissionId: string
    ): Promise<void> {
        await this.adapter.revokePermission(roleId, permissionId);
    
        this.cache.invalidate();
    }

    async graph(): Promise<Graph> {
        const [roles, permissions] = await Promise.all([
            this.adapter.getRoles(),
            this.adapter.getAllPermissions()
        ]);

        const rolePermissions = await this.adapter.getRolePermissions(roles.map(r => r.id));

        const permissionEdges = 
            [...rolePermissions.entries()].flatMap(([roleId, rolePermissionList]) => 
                    rolePermissionList.map(rp => ({
                        from: roleId,
                        to: rp.id
                    }))
            );
        
        const hierarchy = roles.flatMap(r => r.parentId ? [{ from: r.id, to: r.parentId }] : []);

        return {
            roles,
            permissions,
            rolePermissions: permissionEdges,
            hierarchy
        }
    }

    async subjectRoles(
        subjectId: string
    ): Promise<SubjectRoles> {
        const [roles, directRoleIds] = await Promise.all([
            this.adapter.getRoles(),
            this.adapter.getSubjectRoleIds(subjectId)
        ]);

        const direct = roles.filter(r => directRoleIds.includes(r.id));

        const effective = new Map<string, Role>();

        for (const role of direct) {
            effective.set(role.id, role);

            let parentId = role.parentId ?? null;

            while (parentId !== null) {
                const parent = roles.find(candidate => candidate.id === parentId);
                if (!parent) break;

                effective.set(parent.id, parent);

                parentId = parent.parentId ?? null;
            }
        }
        
        return {
            direct,
            effective: [
                ...effective.values()
            ]
        }
    }
}