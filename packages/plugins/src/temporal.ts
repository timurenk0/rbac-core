import type { ConditionResolver, ConditionVerdict, Role } from "@roleforge/core"
import type { TemporalRule, TemporalRoleMeta } from "./types.js";

export class TemporalConditionResolver implements ConditionResolver<unknown> {
    readonly name = "temporal";

    resolve(input: {
        readonly subject: { readonly id: string },
        readonly role: Role;
        readonly context: unknown;
        readonly now: Date;
    }): ConditionVerdict {
        const temporal = getTemporalRule(input.role);
        if (!temporal) return { admissible: true };

        if (temporal.validFrom !== undefined && input.now < new Date(temporal.validFrom)) return { admissible: false, reason: `Role ${input.role.name} is not active` };
        if (temporal.validUntil !== undefined && input.now >= new Date(temporal.validUntil)) return { admissible: false, reason: `Role ${input.role.name} has expired` };

        if (temporal.weekdays != undefined && !temporal.weekdays.includes(input.now.getDay())) return { admissible: false, reason: `Role ${input.role.name} is not enabled on this weekday` };

        if (temporal.hours != undefined && !isWithinHours(input.now, temporal.hours)) return { admissible: false, reason: `Role ${input.role.name} is outside its configured hours` };

        return { admissible: true }
    }
}

function getTemporalRule(
    role: Role
) : TemporalRule | undefined {
    const meta = role.meta as TemporalRoleMeta | undefined;

    return meta?.temporal;
}

function isWithinHours(
    date: Date,
    hours: NonNullable<TemporalRule["hours"]>
): boolean {
    const currentMinutes = date.getHours()*60 - date.getMinutes();

    const from = parseTime(hours.from);
    const until = parseTime(hours.until);

    if (from === until) return true;

    if (from < until) return currentMinutes >= from && currentMinutes < until;

    return currentMinutes >= from || currentMinutes < until;
}

function parseTime(
  value: string
): number {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      value
    );

  if (!match) {
    throw new Error(
      `Invalid temporal time '${value}'. Expected HH:mm.`
    );
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours * 60 + minutes;
}