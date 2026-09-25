export interface TemporalRule {
    readonly validFrom?: string;
    readonly validUntil?: string;
    readonly weekdays?: number[]; // 0-6 (Sun-Sat) JavaScript Date object based
    readonly hours?: {
        readonly from: string;
        readonly until: string;
    }
}

export interface TemporalRoleMeta {
    readonly temporal?: TemporalRule;
}